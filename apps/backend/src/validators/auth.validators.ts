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
    email: z.string().email('Invalid email address').toLowerCase().max(255, 'Email too long'),
    password: z.string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password too long'),
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

/**
 * Update profile validation schema
 */
export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z
      .string()
      .min(1, 'First name is required')
      .max(50, 'First name cannot exceed 50 characters')
      .trim()
      .optional(),
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .max(50, 'Last name cannot exceed 50 characters')
      .trim()
      .optional(),
    bio: z
      .string()
      .max(500, 'Bio cannot exceed 500 characters')
      .optional(),
    timezone: z
      .string()
      .min(1, 'Timezone is required')
      .optional(),
    language: z
      .string()
      .min(2, 'Language code must be at least 2 characters')
      .max(5, 'Language code cannot exceed 5 characters')
      .optional(),
  }),
});

/**
 * Update notification preferences validation schema
 */
export const updateNotificationPreferencesSchema = z.object({
  body: z.object({
    email: z.object({
      postPublished: z.boolean().optional(),
      postFailed: z.boolean().optional(),
      weeklyReport: z.boolean().optional(),
      accountIssues: z.boolean().optional(),
    }).optional(),
    push: z.object({
      postPublished: z.boolean().optional(),
      postFailed: z.boolean().optional(),
      accountIssues: z.boolean().optional(),
    }).optional(),
  }),
});

/**
 * Delete account validation schema
 */
export const deleteAccountSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'Password is required'),
  }),
});
/**
 * Change email validation schema
 */
export const changeEmailSchema = z.object({
  body: z.object({
    newEmail: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),
});

/**
 * Deactivate account validation schema
 */
export const deactivateAccountSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'Password is required'),
  }),
});

/**
 * Login history query validation schema
 */
export const loginHistorySchema = z.object({
  query: z.object({
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
    offset: z.string().transform(Number).pipe(z.number().min(0)).optional(),
  }),
});