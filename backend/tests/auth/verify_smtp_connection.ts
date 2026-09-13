import { verifySmtpConnection } from '../../src/services/email.service';
import { env } from '../../src/config/env';

async function testSmtp() {
  console.log('--- Testing SMTP Verification ---');
  console.log(`Host: ${env.SMTP_HOST}`);
  console.log(`Configured Port: ${env.SMTP_PORT}`);
  console.log(`User: ${env.SMTP_USER ? env.SMTP_USER.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'NOT SET'}`);
  console.log('Connecting...');

  try {
    const success = await verifySmtpConnection();
    if (success) {
      console.log('✔ SMTP connection and authentication verified successfully!');
    }
  } catch (error: any) {
    console.error('✘ SMTP connection failed:', error.message);
    process.exit(1);
  }
}

testSmtp();
