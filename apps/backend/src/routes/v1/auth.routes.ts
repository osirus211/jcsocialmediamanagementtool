import { Router } from 'express';
import { AuthController } from '../../controllers/AuthController';
import { DeviceTrustController } from '../../controllers/DeviceTrustController';
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
  updateProfileSchema,
  updateNotificationPreferencesSchema,
  deleteAccountSchema,
  changeEmailSchema,
  deactivateAccountSchema,
  loginHistorySchema,
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
  authRateLimiter,
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

// Step-up authentication for high-risk logins
if (process.env.NODE_ENV !== 'test') {
  const { StepUpAuthController } = require('../../controllers/StepUpAuthController');
  router.post(
    '/step-up',
    requireAuth,
    authRateLimiter,
    StepUpAuthController.stepUpAuth
  );
}

/**
 * Protected routes (authentication required)
 */

// Get current user
router.get('/me', requireAuth, AuthController.getCurrentUser);

// Update profile
router.patch('/profile', requireAuth, validateRequest(updateProfileSchema), AuthController.updateProfile);

// Upload avatar (TODO: Add multer middleware)
router.post('/avatar', requireAuth, AuthController.uploadAvatar);

// Get active sessions
router.get('/sessions', requireAuth, AuthController.getSessions);

// Revoke specific session
router.delete('/sessions/:sessionId', requireAuth, AuthController.revokeSession);

// Update notification preferences
router.patch('/notifications', requireAuth, validateRequest(updateNotificationPreferencesSchema), AuthController.updateNotificationPreferences);

// Delete account
router.delete('/account', requireAuth, validateRequest(deleteAccountSchema), AuthController.deleteAccount);

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

// Account management endpoints
router.post('/change-email', requireAuth, validateRequest(changeEmailSchema), AuthController.changeEmail);
router.post('/resend-email-verification', requireAuth, AuthController.resendEmailVerification);
router.delete('/cancel-email-change', requireAuth, AuthController.cancelEmailChange);
router.get('/pending-email-change', requireAuth, AuthController.getPendingEmailChange);

// Security endpoints
router.get('/login-history', requireAuth, validateRequest(loginHistorySchema), AuthController.getLoginHistory);
router.get('/trusted-devices', requireAuth, AuthController.getTrustedDevices);
router.delete('/trusted-devices/:deviceId', requireAuth, AuthController.revokeTrustedDevice);
router.get('/account-status', requireAuth, AuthController.getAccountStatus);

// Device trust endpoints
router.post('/devices/trust', requireAuth, DeviceTrustController.trustDevice);
router.get('/devices', requireAuth, DeviceTrustController.getTrustedDevices);
router.delete('/devices/:deviceId', requireAuth, DeviceTrustController.removeTrustedDevice);

// Data export endpoint
router.get('/export-data', requireAuth, AuthController.exportAccountData);

// Get connected OAuth providers
router.get('/connected-providers', requireAuth, AuthController.getConnectedProviders);

// Account deactivation
router.post('/deactivate-account', requireAuth, validateRequest(deactivateAccountSchema), AuthController.deactivateAccount);

// WebAuthn / Passkey routes
router.post('/webauthn/register/options', requireAuth, AuthController.generateWebAuthnRegistrationOptions);
router.post('/webauthn/register/verify', requireAuth, AuthController.verifyWebAuthnRegistration);
router.post('/webauthn/authenticate/options', AuthController.generateWebAuthnAuthenticationOptions);
router.post('/webauthn/authenticate/verify', AuthController.verifyWebAuthnAuthentication);

// Magic link routes
router.use('/magic-link', magicLinkRoutes);

export default router;

