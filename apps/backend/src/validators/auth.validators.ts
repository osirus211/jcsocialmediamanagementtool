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
