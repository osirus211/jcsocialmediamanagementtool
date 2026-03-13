/**
 * Authentication Routes v2
 * 
 * Handles 2FA-related authentication endpoints
 */

import { Router } from 'express';
import { body, ValidationChain, validationResult } from 'express-validator';
import { authRateLimiter } from '../../../middleware/rateLimiter';
import { AuthV2Controller } from '../../../controllers/AuthV2Controller';

const router = Router();

// Validation schemas
const completeLoginSchema: ValidationChain[] = [
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

/**
 * POST /complete-login
 * Complete login after 2FA verification
 * Public route - no authentication required
 */
router.post(
  '/complete-login',
  authRateLimiter,
  completeLoginSchema,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    AuthV2Controller.completeLogin(req, res);
  }
);

export default router;