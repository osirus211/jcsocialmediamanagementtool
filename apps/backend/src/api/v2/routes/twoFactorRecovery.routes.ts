/**
 * Two-Factor Authentication Recovery Routes
 * 
 * Handles account recovery when users lose access to their 2FA device
 * All routes under /api/v2/2fa/recovery
 */

import { Router } from 'express';
import { body, query, ValidationChain, validationResult } from 'express-validator';
import { authRateLimiter, strictRateLimiter } from '../../../middleware/rateLimiter';
import { TwoFactorRecoveryController } from '../../../controllers/TwoFactorRecoveryController';

const router = Router();

// Validation schemas
const emergencyDisableSchema: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('backupCode')
    .isString()
    .isLength({ min: 8, max: 8 })
    .matches(/^[0-9A-F]{8}$/i)
    .withMessage('Backup code must be an 8-character hexadecimal string'),
];

const requestSupportSchema: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('reason')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters'),
];

const recoveryStatusSchema: ValidationChain[] = [
  query('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
];

/**
 * POST /emergency-disable
 * Disable 2FA using backup code (emergency recovery)
 * Public route with strict rate limiting
 */
router.post(
  '/emergency-disable',
  strictRateLimiter, // Very strict rate limiting for security
  emergencyDisableSchema,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    TwoFactorRecoveryController.emergencyDisable(req, res, next);
  }
);

/**
 * POST /request-support
 * Request manual support for 2FA recovery
 * Public route with rate limiting
 */
router.post(
  '/request-support',
  authRateLimiter,
  requestSupportSchema,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    TwoFactorRecoveryController.requestSupport(req, res, next);
  }
);

/**
 * GET /status
 * Check recovery options available for a user
 * Public route with rate limiting
 */
router.get(
  '/status',
  authRateLimiter,
  recoveryStatusSchema,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    TwoFactorRecoveryController.getRecoveryStatus(req, res, next);
  }
);

export default router;