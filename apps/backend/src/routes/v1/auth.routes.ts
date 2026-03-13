import { Router } from 'express';
import { AuthController } from '../../controllers/AuthController';
import { requireAuth } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validate';
import { getCsrfToken } from '../../middleware/csrf';
import magicLinkRoutes from './magicLink.routes';
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
  completeLoginSchema,
} from '../../validators/auth.validators';

const router = Router();

/**
 * Public routes (no authentication required)
 */

// Get CSRF token
router.get('/csrf-token', getCsrfToken);

// Register new user
router.post(
  '/register',
  registrationRateLimiter,
  validateRequest(registerSchema),
  AuthController.register
);

// Login user
router.post(
  '/login',
  authRateLimiter,
  validateRequest(loginSchema),
  AuthController.login
);

// Refresh access token
router.post(
  '/refresh',
  validateRequest(refreshTokenSchema),
  AuthController.refreshToken
);

// Request password reset
router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  validateRequest(requestPasswordResetSchema),
  AuthController.requestPasswordReset
);

// Reset password with token
router.post(
  '/reset-password',
  passwordResetRateLimiter,
  validateRequest(resetPasswordSchema),
  AuthController.resetPassword
);

// Complete login after 2FA verification
router.post(
  '/complete-login',
  authRateLimiter,
  validateRequest(completeLoginSchema),
  AuthController.completeLogin
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
  validateRequest(changePasswordSchema),
  AuthController.changePassword
);

// Verify email
router.post(
  '/verify-email',
  requireAuth,
  validateRequest(verifyEmailSchema),
  AuthController.verifyEmail
);

// Magic link routes
router.use('/magic-link', magicLinkRoutes);

export default router;
