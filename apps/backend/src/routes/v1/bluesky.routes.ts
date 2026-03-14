/**
 * Bluesky OAuth Routes
 * 
 * Handles Bluesky authentication using app passwords
 * Base: /api/v1/bluesky
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import rateLimit from 'express-rate-limit';
import { BlueskyOAuthService } from '../../services/oauth/BlueskyOAuthService';
import { SocialAccount } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';

const router = Router();

// Rate limiters
const connectRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 connection attempts per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user?.userId || (req as any).ip || 'unknown',
  message: 'Too many Bluesky connection attempts. Please try again later.',
});

const validateRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 validation requests per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user?.userId || (req as any).ip || 'unknown',
  message: 'Too many validation requests. Please try again later.',
});

// Apply auth middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * Connect Bluesky account using handle and app password
 * POST /api/v1/bluesky/connect
 */
router.post('/connect',
  connectRateLimit,
  [
    body('handle')
      .notEmpty()
      .withMessage('Handle is required')
      .matches(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
      .withMessage('Invalid handle format (e.g., user.bsky.social)'),
    body('appPassword')
      .notEmpty()
      .withMessage('App password is required')
      .isLength({ min: 19, max: 19 })
      .withMessage('App password must be exactly 19 characters'),
  ],
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { handle, appPassword } = req.body;
      const { userId, workspaceId } = req.user;

      const blueskyService = new BlueskyOAuthService();
      
      // Check if account already exists
      const existingAccount = await SocialAccount.findOne({
        userId,
        workspaceId,
        provider: 'bluesky',
        accountName: handle,
        status: 'active',
      });

      if (existingAccount) {
        return res.status(409).json({
          success: false,
          error: 'Bluesky account already connected',
          code: 'ACCOUNT_ALREADY_EXISTS'
        });
      }

      const account = await blueskyService.connectAccount(handle, appPassword, userId, workspaceId);

      res.json({
        success: true,
        account: {
          id: account._id,
          platform: account.provider,
          accountId: account.platformAccountId || account.providerUserId,
          accountName: account.accountName,
          displayName: account.metadata?.displayName || account.accountName,
          profileUrl: account.metadata?.profileUrl,
          metadata: account.metadata,
          isActive: account.status === 'active',
        }
      });
    } catch (error: any) {
      logger.error('Bluesky connect failed', {
        userId: req.user.userId,
        workspaceId: req.user.workspaceId,
        error: error.message
      });

      // Handle specific error types
      if (error.message.includes('Authentication failed')) {
        return res.status(401).json({
          success: false,
          error: 'Invalid handle or app password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      if (error.message.includes('Profile not found')) {
        return res.status(404).json({
          success: false,
          error: 'Bluesky profile not found',
          code: 'PROFILE_NOT_FOUND'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to connect Bluesky account',
        code: 'CONNECTION_FAILED'
      });
    }
  }
);

/**
 * Disconnect Bluesky account
 * POST /api/v1/bluesky/disconnect
 */
router.post('/disconnect',
  [
    body('accountId')
      .notEmpty()
      .withMessage('Account ID is required')
      .isMongoId()
      .withMessage('Invalid account ID format'),
  ],
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { accountId } = req.body;
      const { userId, workspaceId } = req.user;

      // Verify account belongs to user
      const account = await SocialAccount.findOne({
        _id: accountId,
        userId,
        workspaceId,
        provider: 'bluesky',
        status: 'active',
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Bluesky account not found',
          code: 'ACCOUNT_NOT_FOUND'
        });
      }

      const blueskyService = new BlueskyOAuthService();
      await blueskyService.disconnectAccount(accountId);

      res.json({
        success: true,
        message: 'Bluesky account disconnected successfully'
      });
    } catch (error: any) {
      logger.error('Bluesky disconnect failed', {
        userId: req.user.userId,
        workspaceId: req.user.workspaceId,
        accountId: req.body.accountId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to disconnect Bluesky account',
        code: 'DISCONNECT_FAILED'
      });
    }
  }
);

/**
 * Validate Bluesky account connection
 * GET /api/v1/bluesky/validate/:accountId
 */
router.get('/validate/:accountId',
  validateRateLimit,
  [
    param('accountId')
      .isMongoId()
      .withMessage('Invalid account ID format'),
  ],
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { accountId } = req.params;
      const { userId, workspaceId } = req.user;

      // Find account
      const account = await SocialAccount.findOne({
        _id: accountId,
        userId,
        workspaceId,
        provider: 'bluesky',
        status: 'active',
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Bluesky account not found',
          code: 'ACCOUNT_NOT_FOUND'
        });
      }

      const blueskyService = new BlueskyOAuthService();
      const isValid = await blueskyService.validateConnection(account);

      res.json({
        success: true,
        valid: isValid,
        account: {
          id: account._id,
          accountName: account.accountName,
          displayName: account.metadata?.displayName || account.accountName,
          lastValidated: new Date().toISOString(),
        }
      });
    } catch (error: any) {
      logger.error('Bluesky validation failed', {
        userId: req.user.userId,
        workspaceId: req.user.workspaceId,
        accountId: req.params.accountId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to validate Bluesky account',
        code: 'VALIDATION_FAILED'
      });
    }
  }
);

/**
 * Get Bluesky account info
 * GET /api/v1/bluesky/accounts
 */
router.get('/accounts', async (req: any, res: any) => {
  try {
    const { userId, workspaceId } = req.user;

    const accounts = await SocialAccount.find({
      userId,
      workspaceId,
      provider: 'bluesky',
      status: 'active',
    }).select('-accessToken -refreshToken');

    res.json({
      success: true,
      accounts: accounts.map(account => ({
        id: account._id,
        platform: account.provider,
        accountId: account.platformAccountId || account.providerUserId,
        accountName: account.accountName,
        displayName: account.metadata?.displayName || account.accountName,
        profileUrl: account.metadata?.profileUrl,
        metadata: account.metadata,
        connectedAt: account.createdAt,
        lastUsed: account.updatedAt,
      }))
    });
  } catch (error: any) {
    logger.error('Failed to get Bluesky accounts', {
      userId: req.user.userId,
      workspaceId: req.user.workspaceId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get Bluesky accounts',
      code: 'FETCH_FAILED'
    });
  }
});

export default router;
