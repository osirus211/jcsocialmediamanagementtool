/**
 * Magic Link / Passwordless Authentication Routes
 * 
 * Handles magic link generation and verification endpoints
 * All routes under /api/v1/auth/magic-link
 */

import { Router } from 'express';
import { body, query, ValidationChain, validationResult } from 'express-validator';
import { MagicLinkController } from '../../controllers/MagicLinkController';
import { authRateLimiter, strictRateLimiter } from '../../middleware/rateLimiter';

const router = Router();

// Validation schemas
const requestMagicLinkSchema: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
];

const verifyMagicLinkSchema: ValidationChain[] = [
  query('token')
    .isString()
    .isLength({ min: 64, max: 64 })
    .matches(/^[a-f0-9]{64}$/)
    .withMessage('Valid magic link token is required'),
];

const checkStatusSchema: ValidationChain[] = [
  query('token')
    .isString()
    .isLength({ min: 64, max: 64 })
    .matches(/^[a-f0-9]{64}$/)
    .withMessage('Valid magic link token is required'),
];

/**
 * POST /request
 * Request a magic link for passwordless authentication
 * Public route with strict rate limiting
 */
router.post(
  '/request',
  strictRateLimiter, // Very strict rate limiting to prevent abuse
  requestMagicLinkSchema,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    MagicLinkController.requestMagicLink(req, res, next);
  }
);

/**
 * GET /verify
 * Verify magic link token and complete authentication
 * Public route with rate limiting
 */
router.get(
  '/verify',
  authRateLimiter,
  verifyMagicLinkSchema,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    MagicLinkController.verifyMagicLink(req, res, next);
  }
);

/**
 * GET /status
 * Check if a magic link token is valid (without consuming it)
 * Public route with rate limiting
 */
router.get(
  '/status',
  authRateLimiter,
  checkStatusSchema,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    MagicLinkController.checkMagicLinkStatus(req, res, next);
  }
);

export default router;