import crypto from 'crypto';
import { prisma } from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { sendPasswordResetEmail } from './email.service';

// Authoritative password strength check (mirrors auth.validator.ts strongPasswordSchema)
export const validatePasswordStrength = (password: string): void => {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    throw new Error('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    throw new Error('Password must contain at least one number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new Error('Password must contain at least one special character');
  }
};

export const registerUser = async (data: any) => {
  // Authoritative backend validation
  validatePasswordStrength(data.password);

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: data.email }, { username: data.username }],
    },
  });

  if (existingUser) {
    throw new Error('Email or username already in use');
  }

  const hashedPassword = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      ...data,
      password: hashedPassword,
    },
  });

  const token = generateToken({ id: user.id, role: user.role });

  const { password, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, token };
};


export const loginUser = async (data: any) => {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: data.username },
        { email: data.username }
      ]
    },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (!user.isActive) {
    throw new Error('Your account has been disabled');
  }

  const isPasswordValid = await comparePassword(data.password, user.password);

  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  const token = generateToken({ id: user.id, role: user.role });

  const { password, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, token };
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      staffProfile: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const { password, ...userWithoutPassword } = user;

  return userWithoutPassword;
};

/**
 * Initiates the forgot password flow:
 * Generates a secure random token, stores its hash with a 15-minute expiration,
 * sends the reset email, and always returns a generic response to prevent email enumeration.
 */
export const requestPasswordReset = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
  });

  if (user) {
    // Invalidate any existing reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Generate a cryptographically secure 32-byte (64 hex characters) token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    // Send the password reset email with the raw token
    await sendPasswordResetEmail(user.email, rawToken);
  }

  return {
    message: 'If an account exists with that email, a password reset link has been sent.',
  };
};

/**
 * Verifies the reset token, validates the new password, hashes it,
 * updates the user's password record, and invalidates the token.
 */
export const resetPassword = async (data: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}) => {
  if (data.newPassword !== data.confirmPassword) {
    throw new Error('Passwords do not match');
  }

  // Validate new password meets complexity requirements
  validatePasswordStrength(data.newPassword);

  // Hash received token to query database
  const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex');

  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!tokenRecord) {
    throw new Error('Invalid or expired reset token');
  }

  if (new Date() > tokenRecord.expiresAt) {
    // Delete expired token
    await prisma.passwordResetToken.delete({
      where: { id: tokenRecord.id },
    });
    throw new Error('Invalid or expired reset token');
  }

  // Hash the new password with bcrypt
  const hashedPassword = await hashPassword(data.newPassword);

  // Update user's password
  await prisma.user.update({
    where: { id: tokenRecord.userId },
    data: { password: hashedPassword },
  });

  // Invalidate all reset tokens for this user to ensure single-use
  await prisma.passwordResetToken.deleteMany({
    where: { userId: tokenRecord.userId },
  });

  return {
    message: 'Password reset successfully. You can now log in with your new password.',
  };
};

