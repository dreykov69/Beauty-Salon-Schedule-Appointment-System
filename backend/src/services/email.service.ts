import nodemailer from 'nodemailer';
import dns from 'dns';
import { env } from '../config/env';

// Prefer IPv4 resolution to prevent ENETUNREACH errors on hosts without active IPv6 routing (e.g. Render)
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

// Nodemailer 10 resolves SMTP hostnames by querying dns.resolve4 and dns.resolve6 via dns.Resolver.
// Cloud environments like Render lack outbound IPv6 routing, so any connection attempt to an
// IPv6 address (AAAA record) fails immediately with `connect ENETUNREACH ... - Local (:::0)`.
// By returning NODATA for resolve6, Nodemailer resolves and connects via valid IPv4 addresses only.
const disableIPv6Resolution = (
  _hostname: string,
  optionsOrCallback: any,
  callback?: (err: NodeJS.ErrnoException | null, addresses: string[]) => void
) => {
  const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
  if (typeof cb === 'function') {
    const err: any = new Error('IPv6 resolution disabled');
    err.code = 'NODATA';
    cb(err, []);
  }
};

(dns as any).resolve6 = disableIPv6Resolution;
if (dns.Resolver && dns.Resolver.prototype) {
  ((dns.Resolver as any).prototype).resolve6 = disableIPv6Resolution;
}
if (dns.promises) {
  (dns.promises as any).resolve6 = async () => [];
  if (dns.promises.Resolver && (dns.promises.Resolver as any).prototype) {
    ((dns.promises.Resolver as any).prototype).resolve6 = async () => [];
  }
}

/**
 * Creates and returns a Nodemailer transporter configured from environment variables.
 * When using port 587, uses STARTTLS (secure: false, requireTLS: true) over IPv4.
 */
export const getTransporter = () => {
  const port = parseInt(env.SMTP_PORT || '587', 10);
  const isSecure = port === 465;

  return nodemailer.createTransport({
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: isSecure, // false for port 587 (STARTTLS)
    requireTLS: !isSecure, // Enforce STARTTLS encryption when port is 587
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
    tls: {
      servername: env.SMTP_HOST || 'smtp.gmail.com',
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 10000,
  });
};

/**
 * Verifies the SMTP connection and authentication credentials.
 */
export const verifySmtpConnection = async (): Promise<boolean> => {
  if (!env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new Error('SMTP credentials are not configured');
  }
  const transporter = getTransporter();
  await transporter.verify();
  return true;
};

/**
 * Sends a password reset email with salon branding, reset button, and security notice.
 *
 * @param to - Recipient email address
 * @param token - Raw cryptographically generated reset token
 */
export const sendPasswordResetEmail = async (to: string, token: string): Promise<void> => {
  if (!env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new Error('SMTP credentials are not configured');
  }

  const frontendUrl = (env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #fdf2f8;
      color: #1f2937;
      margin: 0;
      padding: 24px;
    }
    .container {
      max-width: 540px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      border: 1px solid #fce7f3;
    }
    .brand {
      text-align: center;
      margin-bottom: 24px;
    }
    .brand-badge {
      display: inline-block;
      width: 44px;
      height: 44px;
      line-height: 44px;
      background: linear-gradient(135deg, #db2777, #f43f5e);
      border-radius: 12px;
      color: #ffffff;
      font-size: 20px;
      margin-bottom: 8px;
    }
    .brand-name {
      font-size: 22px;
      font-weight: bold;
      color: #111827;
      margin: 0;
      letter-spacing: 0.5px;
    }
    .brand-tagline {
      font-size: 13px;
      color: #db2777;
      margin: 4px 0 0 0;
      font-weight: 600;
    }
    .divider {
      border-top: 1px solid #f3f4f6;
      margin: 20px 0;
    }
    h2 {
      color: #1f2937;
      font-size: 18px;
      margin-top: 0;
      margin-bottom: 12px;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #4b5563;
      margin: 0 0 16px 0;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #db2777, #e11d48);
      color: #ffffff !important;
      padding: 14px 32px;
      text-decoration: none;
      font-size: 15px;
      font-weight: 600;
      border-radius: 12px;
      box-shadow: 0 4px 10px rgba(219, 39, 119, 0.25);
    }
    .notice {
      background-color: #fff1f2;
      border-left: 4px solid #f43f5e;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      color: #9f1239;
      margin-bottom: 20px;
    }
    .fallback {
      font-size: 12px;
      color: #6b7280;
      word-break: break-all;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">
      <div class="brand-badge">✨</div>
      <h1 class="brand-name">BEAUTY SALON</h1>
      <p class="brand-tagline">“Your Beauty, Your Time.”</p>
    </div>

    <div class="divider"></div>

    <h2>Password Reset Request</h2>
    <p>Hello,</p>
    <p>We received a request to reset your password for your Beauty Salon account. Click the button below to choose a new password:</p>

    <div class="btn-container">
      <a href="${resetLink}" class="btn" target="_blank">Reset Password</a>
    </div>

    <div class="notice">
      ⏰ <strong>Important:</strong> This reset link will expire in <strong>15 minutes</strong>.
    </div>

    <p>If the button above does not work, copy and paste the following link into your browser:</p>
    <p class="fallback"><a href="${resetLink}" style="color: #db2777;">${resetLink}</a></p>

    <div class="divider"></div>

    <p style="font-size: 13px; color: #6b7280; margin-bottom: 0;">
      If you did not request a password reset, please disregard this email. Your password will remain unchanged and your account is secure.
    </p>

    <div class="footer">
      &copy; ${new Date().getFullYear()} Beauty Salon Appointment System. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

  const text = `
Beauty Salon - Password Reset Request

Hello,

We received a request to reset your password for your Beauty Salon account.

Please visit the link below to reset your password:
${resetLink}

This link is valid for 15 minutes.

If you did not request this password reset, please ignore this email. Your account remains secure.

© ${new Date().getFullYear()} Beauty Salon
`;

  const mailOptions = {
    from: `"Beauty Salon" <${env.SMTP_USER}>`,
    to,
    subject: 'Password Reset Request - Beauty Salon',
    text,
    html,
  };

  const transporter = getTransporter();
  await transporter.sendMail(mailOptions);
};
