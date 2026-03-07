import { Router } from 'express';
import { AuthController } from '../../controllers/AuthController';
import { requireAuth } from '../../middleware/auth';
import { validate, sanitizeInput } from '../../middleware/validate';
import {
  authRateLimiter,
  registrationRateLimiter,
  passwordResetRateLimiter,
} from '../../middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../../validators/auth.validators';

const router = Router();

/**
 * Public routes (no authentication required)
 */

// Register new user
router.post(
  '/register',
  registrationRateLimiter,
  sanitizeInput,
  validate(registerSchema),
  AuthController.register
);

// Login user
router.post(
  '/login',
  authRateLimiter,
  sanitizeInput,
  validate(loginSchema),
  AuthController.login
);

// Refresh access token
router.post(
  '/refresh',
  sanitizeInput,
  validate(refreshTokenSchema),
  AuthController.refreshToken
);

// Request password reset
router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  sanitizeInput,
  validate(requestPasswordResetSchema),
  AuthController.requestPasswordReset
);

// Reset password with token
router.post(
  '/reset-password',
  passwordResetRateLimiter,
  sanitizeInput,
  validate(resetPasswordSchema),
  AuthController.resetPassword
);

/**
 * Protected routes (authentication required)
 */

// Get current user
router.get('/me', requireAuth, AuthController.getCurrentUser);

// Logout current session
router.post('/logout', requireAuth, AuthController.logout);

// Logout from all devices
router.post('/logout-all', requireAuth, AuthController.logoutAll);

// Change password
router.post(
  '/change-password',
  requireAuth,
  sanitizeInput,
  validate(changePasswordSchema),
  AuthController.changePassword
);

// Verify email
router.post(
  '/verify-email',
  requireAuth,
  sanitizeInput,
  validate(verifyEmailSchema),
  AuthController.verifyEmail
);

export default router;
