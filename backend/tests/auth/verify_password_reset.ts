import app from '../../src/app';
import { prisma } from '../../src/config/database';
import { env } from '../../src/config/env';
import { setResendClient } from '../../src/services/email.service';
import crypto from 'crypto';
import http from 'http';

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   BEAUTY SALON - RESEND PASSWORD RESET VERIFICATION SUITE     ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Spy on console to verify Requirement 10 (No secrets/passwords/raw tokens logged)
  const loggedOutputs: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args: any[]) => {
    loggedOutputs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    originalLog(...args);
  };
  console.error = (...args: any[]) => {
    loggedOutputs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    originalError(...args);
  };
  console.warn = (...args: any[]) => {
    loggedOutputs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    originalWarn(...args);
  };

  // Mock Resend Client to capture email sending without requiring real API calls
  let sentEmailPayload: any = null;
  let sendCallCount = 0;

  const mockResend = {
    emails: {
      send: async (payload: any) => {
        sendCallCount++;
        sentEmailPayload = payload;
        return {
          data: { id: `mock_email_${Date.now()}` },
          error: null,
        };
      },
    },
  };

  setResendClient(mockResend as any);

  // Start ephemeral HTTP server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  const testEmail = `resend_test_${Date.now()}@example.com`;
  const testUsername = `user_${Date.now()}`;
  const oldPassword = 'OldPassword123!';
  const newPassword = 'BrandNewPassword123!';

  let testUserId = '';
  let extractedRawToken = '';

  try {
    // -------------------------------------------------------------------------
    // Setup: Register Test User
    // -------------------------------------------------------------------------
    originalLog('\n[SETUP] Registering test user...');
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        username: testUsername,
        password: oldPassword,
        firstName: 'Resend',
        lastName: 'Tester',
      }),
    });
    const regData: any = await regRes.json();
    if (!regRes.ok || !regData.success) {
      throw new Error(`User registration failed: ${JSON.stringify(regData)}`);
    }
    testUserId = regData.data.user.id;
    originalLog(`✔ Registered test user (ID: ${testUserId})`);

    // -------------------------------------------------------------------------
    // Requirement 1: Forgot-password returns expected generic success response
    // (Both for existing and non-existing email to prevent enumeration)
    // -------------------------------------------------------------------------
    originalLog('\n[REQ 1] Verifying generic response on forgot-password...');
    const forgotNonExistentRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'definitely_non_existent_98765@example.com' }),
    });
    const nonExistentData: any = await forgotNonExistentRes.json();
    if (!forgotNonExistentRes.ok || !nonExistentData.success) {
      throw new Error(`Non-existent user forgot-password failed: ${JSON.stringify(nonExistentData)}`);
    }
    const expectedGenericMsg = 'If an account exists with that email, a password reset link has been sent.';
    if (nonExistentData.message !== expectedGenericMsg) {
      throw new Error(`Expected generic message "${expectedGenericMsg}", got "${nonExistentData.message}"`);
    }

    // Now call for existing user
    const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const forgotData: any = await forgotRes.json();
    if (!forgotRes.ok || !forgotData.success || forgotData.message !== expectedGenericMsg) {
      throw new Error(`Existing user forgot-password failed or gave different message: ${JSON.stringify(forgotData)}`);
    }
    originalLog(`✔ REQ 1 PASSED: Generic success message returned for both existing and non-existing emails.`);

    // -------------------------------------------------------------------------
    // Requirement 2: Reset token is created correctly
    // -------------------------------------------------------------------------
    originalLog('\n[REQ 2] Verifying reset token in database...');
    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId: testUserId },
      orderBy: { createdAt: 'desc' },
    });
    if (!tokenRecord) {
      throw new Error('Password reset token record was not found in database!');
    }
    // Verify token expiration is approximately 15 minutes in the future
    const now = Date.now();
    const expiryDiffMinutes = (tokenRecord.expiresAt.getTime() - now) / (1000 * 60);
    if (expiryDiffMinutes < 14 || expiryDiffMinutes > 16) {
      throw new Error(`Token expiration window unexpected: ${expiryDiffMinutes.toFixed(2)} minutes`);
    }
    // Verify token is hashed (64 hex characters sha256)
    if (!/^[a-f0-9]{64}$/i.test(tokenRecord.tokenHash)) {
      throw new Error(`Token hash is not a 64-char SHA256 string: ${tokenRecord.tokenHash}`);
    }
    originalLog(`✔ REQ 2 PASSED: Reset token stored as SHA-256 hash with 15-minute expiration (${expiryDiffMinutes.toFixed(1)} mins).`);

    // -------------------------------------------------------------------------
    // Requirement 3: Resend email sending is invoked correctly
    // -------------------------------------------------------------------------
    originalLog('\n[REQ 3] Verifying Resend email invocation...');
    if (sendCallCount !== 1 || !sentEmailPayload) {
      throw new Error(`Resend send was not called exactly once! Call count: ${sendCallCount}`);
    }
    if (sentEmailPayload.to !== testEmail) {
      throw new Error(`Recipient mismatch: expected ${testEmail}, got ${sentEmailPayload.to}`);
    }
    if (sentEmailPayload.from !== env.EMAIL_FROM) {
      throw new Error(`Sender mismatch: expected ${env.EMAIL_FROM}, got ${sentEmailPayload.from}`);
    }
    if (sentEmailPayload.subject !== 'Password Reset Request - Beauty Salon') {
      throw new Error(`Subject mismatch: got "${sentEmailPayload.subject}"`);
    }
    if (!sentEmailPayload.html || !sentEmailPayload.text) {
      throw new Error('Email payload missing HTML or text version!');
    }

    // Extract raw token from the reset URL in the email body
    const tokenMatch = sentEmailPayload.text.match(/token=([a-f0-9]+)/i);
    if (!tokenMatch) {
      throw new Error('Failed to extract token from email body text!');
    }
    extractedRawToken = tokenMatch[1];

    // Confirm that hashing the extracted raw token matches the DB hash
    const computedHash = crypto.createHash('sha256').update(extractedRawToken).digest('hex');
    if (computedHash !== tokenRecord.tokenHash) {
      throw new Error('Raw token extracted from email does not match SHA256 hash in database!');
    }
    originalLog('✔ REQ 3 PASSED: Resend invoked with correct from, to, subject, HTML, text, and verifiable raw token.');

    // -------------------------------------------------------------------------
    // Requirement 9: Invalid tokens are rejected
    // -------------------------------------------------------------------------
    originalLog('\n[REQ 9] Testing reset with invalid token...');
    const invalidTokenRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'invalid_completely_fake_token_hex_1234567890',
        newPassword: newPassword,
        confirmPassword: newPassword,
      }),
    });
    const invalidTokenData: any = await invalidTokenRes.json();
    if (invalidTokenRes.status !== 400 || invalidTokenData.message !== 'Invalid or expired reset token') {
      throw new Error(`Expected 400 'Invalid or expired reset token', got: ${JSON.stringify(invalidTokenData)}`);
    }
    originalLog('✔ REQ 9 PASSED: Invalid reset token correctly rejected with 400.');

    // -------------------------------------------------------------------------
    // Requirement 8: Expired tokens are rejected
    // -------------------------------------------------------------------------
    originalLog('\n[REQ 8] Testing reset with expired token...');
    const expiredRawToken = crypto.randomBytes(32).toString('hex');
    const expiredHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: expiredHash,
        userId: testUserId,
        expiresAt: new Date(Date.now() - 30000), // Expired 30 seconds ago
      },
    });
    const expiredRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: expiredRawToken,
        newPassword: newPassword,
        confirmPassword: newPassword,
      }),
    });
    const expiredData: any = await expiredRes.json();
    if (expiredRes.status !== 400 || expiredData.message !== 'Invalid or expired reset token') {
      throw new Error(`Expected 400 for expired token, got: ${JSON.stringify(expiredData)}`);
    }
    originalLog('✔ REQ 8 PASSED: Expired reset token correctly rejected with 400.');

    // -------------------------------------------------------------------------
    // Requirement 4: Reset-password with a valid token works
    // -------------------------------------------------------------------------
    originalLog('\n[REQ 4] Resetting password with valid extracted token...');
    const resetRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: extractedRawToken,
        newPassword: newPassword,
        confirmPassword: newPassword,
      }),
    });
    const resetData: any = await resetRes.json();
    if (!resetRes.ok || !resetData.success) {
      throw new Error(`Reset password failed: ${JSON.stringify(resetData)}`);
    }
    originalLog(`✔ REQ 4 PASSED: Reset-password succeeded: "${resetData.message}"`);

    // -------------------------------------------------------------------------
    // Requirement 5: Old password no longer works
    // -------------------------------------------------------------------------
    originalLog('\n[REQ 5] Verifying old password no longer works...');
    const oldLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testEmail, password: oldPassword }),
    });
    const oldLoginData: any = await oldLoginRes.json();
    if (oldLoginRes.status !== 401 || oldLoginData.message !== 'Invalid credentials') {
      throw new Error(`Expected 401 for old password, got: ${JSON.stringify(oldLoginData)}`);
    }
    originalLog('✔ REQ 5 PASSED: Old password rejected with 401 Unauthorized.');

    // -------------------------------------------------------------------------
    // Requirement 6: New password works
    // -------------------------------------------------------------------------
    originalLog('\n[REQ 6] Verifying new password works...');
    const newLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testEmail, password: newPassword }),
    });
    const newLoginData: any = await newLoginRes.json();
    if (!newLoginRes.ok || !newLoginData.success || !newLoginData.data.token) {
      throw new Error(`Login with new password failed: ${JSON.stringify(newLoginData)}`);
    }
    originalLog('✔ REQ 6 PASSED: Login with new password succeeded and JWT issued.');

    // -------------------------------------------------------------------------
    // Requirement 7: The reset token cannot be reused
    // -------------------------------------------------------------------------
    originalLog('\n[REQ 7] Verifying reset token cannot be reused...');
    const reuseRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: extractedRawToken,
        newPassword: 'AnotherPassword999!',
        confirmPassword: 'AnotherPassword999!',
      }),
    });
    const reuseData: any = await reuseRes.json();
    if (reuseRes.status !== 400 || reuseData.message !== 'Invalid or expired reset token') {
      throw new Error(`Expected 400 when reusing token, got: ${JSON.stringify(reuseData)}`);
    }
    originalLog('✔ REQ 7 PASSED: Token reuse rejected with 400.');

    // -------------------------------------------------------------------------
    // Requirement 10: API secrets, passwords, and raw reset tokens are never logged
    // -------------------------------------------------------------------------
    originalLog('\n[REQ 10] Checking logs for leaked secrets...');
    const fullLogText = loggedOutputs.join('\n');

    if (env.RESEND_API_KEY && fullLogText.includes(env.RESEND_API_KEY)) {
      throw new Error('SECURITY VIOLATION: RESEND_API_KEY was found in application logs!');
    }
    if (fullLogText.includes(oldPassword)) {
      throw new Error('SECURITY VIOLATION: Old password was found in application logs!');
    }
    if (fullLogText.includes(newPassword)) {
      throw new Error('SECURITY VIOLATION: New password was found in application logs!');
    }
    if (extractedRawToken && fullLogText.includes(extractedRawToken)) {
      throw new Error('SECURITY VIOLATION: Raw reset token was found in application logs!');
    }
    originalLog('✔ REQ 10 PASSED: No API keys, passwords, or raw tokens were ever printed to logs.');

    // -------------------------------------------------------------------------
    // Resend Error Handling Verification
    // Verify that if Resend returns an error, forgot-password STILL returns 200 generic message
    // -------------------------------------------------------------------------
    originalLog('\n[EXTRA TEST] Verifying error resilience when Resend fails...');
    setResendClient({
      emails: {
        send: async () => ({
          data: null,
          error: { message: 'Domain not verified in Resend', name: 'validation_error', statusCode: 403 },
        }),
      },
    } as any);

    const errorForgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const errorForgotData: any = await errorForgotRes.json();
    if (!errorForgotRes.ok || !errorForgotData.success || errorForgotData.message !== expectedGenericMsg) {
      throw new Error(`Forgot-password did not return generic message when Resend failed: ${JSON.stringify(errorForgotData)}`);
    }
    originalLog('✔ RESEND ERROR RESILIENCE PASSED: Generic 200 response maintained even on Resend delivery failure.');

    originalLog('\n═══════════════════════════════════════════════════════════════');
    originalLog('   ALL 10 VERIFICATION REQUIREMENTS COMPLETED SUCCESSFULLY! 🎉  ');
    originalLog('═══════════════════════════════════════════════════════════════\n');
  } finally {
    // Restore original console
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;

    // Cleanup test user
    if (testUserId) {
      originalLog(`[CLEANUP] Deleting test user ${testUserId}...`);
      await prisma.passwordResetToken.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      originalLog('[CLEANUP] Done.');
    }
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
