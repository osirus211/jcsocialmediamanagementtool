import { z } from 'zod';
import { passwordSchema, emailSchema } from '../models/User';

/**
 * Register validation schema
 */
export const registerSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    firstName: z
      .string()
      .min(1, 'First name is required')
      .max(50, 'First name cannot exceed 50 characters')
      .trim(),
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .max(50, 'Last name cannot exceed 50 characters')
      .trim(),
  }),
});

/**
 * Login validation schema
 */
export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),
});

/**
 * Refresh token validation schema
 * Note: refreshToken can come from httpOnly cookie or request body
 */
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required').optional(),
  }),
});

/**
 * Change password validation schema
 */
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  }),
});

/**
 * Request password reset validation schema
 */
export const requestPasswordResetSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

/**
 * Reset password validation schema
 */
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: passwordSchema,
  }),
});

/**
 * Verify email validation schema
 */
export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Verification token is required'),
  }),
});

/**
 * Complete login validation schema (for 2FA)
 */
export const completeLoginSchema = z.object({
  body: z.object({
    userId: z.string().min(1, 'User ID is required'),
    token: z.string().min(1, 'Verification token is required')
      .refine((token) => {
        // Allow either 6-digit TOTP or 8-character backup code
        return /^\d{6}$/.test(token) || /^[0-9A-F]{8}$/i.test(token);
      }, 'Token must be a 6-digit TOTP code or 8-character backup code'),
  }),
});
