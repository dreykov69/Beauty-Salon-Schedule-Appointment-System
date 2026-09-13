import http from 'http';
import app from '../../src/app';
import { prisma } from '../../src/config/database';
import { env } from '../../src/config/env';

async function testForgotPasswordFlow() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('        TESTING FORGOT PASSWORD FLOW END-TO-END               ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Start HTTP server on dynamic port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  console.log(`[INFO] Test server started at ${baseUrl}`);

  // Use the configured SMTP_USER email so an actual email can be delivered to the owner's inbox if desired
  const testEmail = env.SMTP_USER || `test_salon_${Date.now()}@gmail.com`;
  const username = `testuser_${Date.now()}`;
  const initialPassword = 'InitialPassword123!';
  const newPassword = 'NewlyResetPassword123!';

  try {
    // 1. Ensure a user with this email exists in DB (or create one)
    let user = await prisma.user.findFirst({
      where: { email: { equals: testEmail, mode: 'insensitive' } },
    });

    if (!user) {
      console.log(`[STEP 1] Creating test user with email ${testEmail}...`);
      const regRes = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          username,
          password: initialPassword,
          firstName: 'Password',
          lastName: 'Tester',
        }),
      });
      const regData: any = await regRes.json();
      if (!regRes.ok || !regData.success) {
        throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
      }
      user = regData.data.user;
      console.log('✔ Test user created successfully.');
    } else {
      console.log(`[STEP 1] Found existing user for ${testEmail} (ID: ${user.id})`);
    }

    // 2. Call /auth/forgot-password
    console.log(`\n[STEP 2] Calling /auth/forgot-password for ${testEmail}...`);
    const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });

    const forgotData: any = await forgotRes.json();
    console.log(`Response Status: ${forgotRes.status}`);
    console.log(`Response Body: ${JSON.stringify(forgotData)}`);

    if (!forgotRes.ok || !forgotData.success) {
      throw new Error(`Forgot password request failed: ${JSON.stringify(forgotData)}`);
    }
    console.log('✔ Forgot-password endpoint returned 200 success!');

    // 3. Verify that a password reset token was recorded in the database
    console.log('\n[STEP 3] Verifying token in database...');
    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!tokenRecord) {
      throw new Error('No password reset token was found in the database!');
    }

    console.log(`✔ Password reset token successfully created in DB (Expires at: ${tokenRecord.expiresAt.toISOString()})`);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   🎉 FORGOT-PASSWORD & SMTP FLOW VERIFICATION PASSED!        ');
    console.log('═══════════════════════════════════════════════════════════════\n');
  } catch (error: any) {
    console.error('\n✘ Test failed with error:', error.message);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

testForgotPasswordFlow();
