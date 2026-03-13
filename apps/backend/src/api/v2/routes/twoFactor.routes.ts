/**
 * Two-Factor Authentication Routes
 * 
 * Handles 2FA setup, verification, and management endpoints
 * All routes under /api/v2/2fa
 */

import { Router } from 'express';
import { body, ValidationChain, validationResult } from 'express-validator';
import { requireAuth } from '../../../middleware/auth';
import { authRateLimiter } from '../../../middleware/rateLimiter';
import { TwoFactorController } from '../../../controllers/TwoFactorController';

const router = Router();

// Validation schemas
const verifySetupSchema: ValidationChain[] = [
  body('token')
    .isString()
    .isLength({ min: 6, max: 6 })
    .matches(/^\d{6}$/)
    .withMessage('Token must be a 6-digit number'),
];

const validateTokenSchema: ValidationChain[] = [
  body('userId')
    .isString()
    .isMongoId()
    .withMessage('Valid user ID is required'),
  body('token')
    .isString()
    .custom((value) => {
      // Allow either 6-digit TOTP or 8-character backup code
      return /^\d{6}$/.test(value) || /^[0-9A-F]{8}$/i.test(value);
    })
    .withMessage('Token must be a 6-digit TOTP code or 8-character backup code'),
];

const disableSchema: ValidationChain[] = [
  body('token')
    .isString()
    .isLength({ min: 6, max: 6 })
    .matches(/^\d{6}$/)
    .withMessage('Token must be a 6-digit number'),
];

const regenerateBackupCodesSchema: ValidationChain[] = [
  body('token')
    .isString()
    .isLength({ min: 6, max: 6 })
    .matches(/^\d{6}$/)
    .withMessage('Token must be a 6-digit number'),
];

/**
 * GET /setup
 * Generate temporary TOTP secret and QR code for setup
 * Protected route - requires authentication
 */
router.get(
  '/setup',
  requireAuth,
  authRateLimiter,
  TwoFactorController.setup
);

/**
 * POST /verify-setup
 * Verify TOTP token and enable 2FA
 * Protected route - requires authentication
 */
router.post(
  '/verify-setup',
  requireAuth,
  authRateLimiter,
  verifySetupSchema,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    TwoFactorController.verifySetup(req, res, next);
  }
);

/**
 * POST /validate
 * Validate TOTP token or backup code during login
 * Public route - no authentication required
 */
router.post(
  '/validate',
  authRateLimiter,
  validateTokenSchema,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    TwoFactorController.validate(req, res, next);
  }
);

/**
 * POST /disable
 * Disable 2FA after verifying TOTP token
 * Protected route - requires authentication
 */
router.post(
  '/disable',
  requireAuth,
  authRateLimiter,
  disableSchema,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    TwoFactorController.disable(req, res, next);
  }
);

/**
 * POST /regenerate-backup-codes
 * Generate new backup codes after verifying TOTP token
 * Protected route - requires authentication
 */
router.post(
  '/regenerate-backup-codes',
  requireAuth,
  authRateLimiter,
  regenerateBackupCodesSchema,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    TwoFactorController.regenerateBackupCodes(req, res, next);
  }
);

export default router;