/**
 * Google Business Profile OAuth Routes
 * 
 * Handles OAuth authorization flows for Google Business Profile integration
 * Base: /api/v1/google-business
 * 
 * Security:
 * - Rate limiting on OAuth endpoints
 * - Authentication required for all routes
 * - Workspace context validation
 * - Audit logging
 * 
 * Requirements: 1.1, 1.3, 6.4
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import rateLimit from 'express-rate-limit';
import { GoogleBusinessOAuthService } from '../../services/oauth/GoogleBusinessOAuthService';
import { oauthStateService } from '../../services/OAuthStateService';
import { getClientIp, getHashedClientIp } from '../../utils/ipHash';
import { logger } from '../../utils/logger';
import { BadRequestError, UnauthorizedError } from '../../utils/errors';
import mongoose from 'mongoose';

const router = Router();

// Rate limiters
const initiateRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.user?.userId || req.ip || 'unknown',
  message: 'Too many OAuth initiation attempts. Please try again later.',
});

const callbackRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many callback requests. Please try again later.',
});

const disconnectRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.user?.userId || req.ip || 'unknown',
  message: 'Too many disconnect attempts. Please try again later.',
});

// Initialize Google Business OAuth Service
const getGoogleBusinessService = (): GoogleBusinessOAuthService => {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google Business Profile OAuth credentials not configured');
  }

  return new GoogleBusinessOAuthService(clientId, clientSecret, redirectUri);
};

/**
 * POST /api/v1/google-business/oauth/initiate
 * 
 * Initiates Google Business Profile OAuth flow
 * Returns authorization URL for user to visit
 * 
 * Requirements: 1.1
 */
router.post(
  '/oauth/initiate',
  requireAuth,
  requireWorkspace,
  initiateRateLimit,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId.toString();
      const clientIp = getClientIp(req);
      const ipHash = getHashedClientIp(req);

      // Validate authentication
      if (!workspaceId || !userId) {
        throw new UnauthorizedError('Authentication required');
      }

      logger.info('Initiating Google Business Profile OAuth', {
        workspaceId,
        userId,
        ipAddress: clientIp,
      });

      // Get Google Business OAuth service
      const service = getGoogleBusinessService();

      // Generate authorization URL
      const { url, state } = await service.initiateOAuth();

      // Store state in Redis with IP binding
      await oauthStateService.createState(workspaceId, userId, 'google-business', {
        ipHash,
        metadata: {
          platform: 'google-business',
          timestamp: new Date().toISOString(),
          userAgent: req.headers['user-agent'],
        },
      });

      logger.info('Google Business Profile OAuth initiated', {
        workspaceId,
        userId,
        state: state.substring(0, 10) + '...',
      });

      res.json({
        success: true,
        data: {
          authorizationUrl: url,
          state,
        },
      });
    } catch (error: any) {
      logger.error('Failed to initiate Google Business Profile OAuth', {
        error: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }
);

/**
 * GET /api/v1/google-business/oauth/callback
 * 
 * Handles OAuth callback from Google
 * Exchanges authorization code for tokens
 * Fetches and stores business locations
 * 
 * Requirements: 1.3
 */
router.get(
  '/oauth/callback',
  callbackRateLimit,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code, state, error, error_description } = req.query;
      const clientIp = getClientIp(req);
      const ipHash = getHashedClientIp(req);

      // Handle OAuth errors
      if (error) {
        logger.warn('Google Business Profile OAuth error', {
          error,
          error_description,
          ipAddress: clientIp,
        });

        return res.redirect(
          `${process.env.FRONTEND_URL}/integrations?error=${encodeURIComponent(
            error_description?.toString() || error.toString()
          )}`
        );
      }

      // Validate required parameters
      if (!code || !state) {
        throw new BadRequestError('Missing required OAuth parameters');
      }

      logger.info('Google Business Profile OAuth callback received', {
        state: state.toString().substring(0, 10) + '...',
        ipAddress: clientIp,
      });

      // Validate and consume state
      const stateData = await oauthStateService.consumeState(state.toString());

      if (!stateData) {
        throw new BadRequestError('Invalid or expired OAuth state');
      }

      const { workspaceId, userId } = stateData;

      logger.info('OAuth state validated', {
        workspaceId,
        userId,
      });

      // Get Google Business OAuth service
      const service = getGoogleBusinessService();

      // Connect account (exchange code, fetch locations, save to DB)
      const result = await service.connectAccount({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(userId),
        code: code.toString(),
        state: state.toString(),
        ipAddress: clientIp,
      });

      logger.info('Google Business Profile account connected', {
        workspaceId,
        userId,
        accountId: result.account._id,
        locationCount: result.locations.length,
      });

      // Redirect to frontend with success
      res.redirect(
        `${process.env.FRONTEND_URL}/integrations?success=true&platform=google-business&locations=${result.locations.length}`
      );
    } catch (error: any) {
      logger.error('Google Business Profile OAuth callback failed', {
        error: error.message,
        stack: error.stack,
      });

      // Redirect to frontend with error
      res.redirect(
        `${process.env.FRONTEND_URL}/integrations?error=${encodeURIComponent(
          error.message || 'Failed to connect Google Business Profile'
        )}`
      );
    }
  }
);

/**
 * DELETE /api/v1/google-business/oauth/disconnect/:accountId
 * 
 * Disconnects Google Business Profile account
 * Deletes tokens and business locations
 * 
 * Requirements: 6.4
 */
router.delete(
  '/oauth/disconnect/:accountId',
  requireAuth,
  requireWorkspace,
  disconnectRateLimit,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId.toString();

      // Validate authentication
      if (!workspaceId || !userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Validate accountId
      if (!mongoose.Types.ObjectId.isValid(accountId)) {
        throw new BadRequestError('Invalid account ID');
      }

      logger.info('Disconnecting Google Business Profile account', {
        workspaceId,
        userId,
        accountId,
      });

      // Get Google Business OAuth service
      const service = getGoogleBusinessService();

      // Disconnect account
      await service.disconnectAccount(accountId);

      logger.info('Google Business Profile account disconnected', {
        workspaceId,
        userId,
        accountId,
      });

      res.json({
        success: true,
        message: 'Google Business Profile account disconnected successfully',
      });
    } catch (error: any) {
      logger.error('Failed to disconnect Google Business Profile account', {
        error: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }
);

export default router;
