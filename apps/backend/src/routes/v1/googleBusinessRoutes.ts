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
import { GoogleBusinessPublisher } from '../../providers/publishers/GoogleBusinessPublisher';
import { SocialAccount } from '../../models/SocialAccount';
import { oauthStateService } from '../../services/OAuthStateService';
import { getClientIp, getHashedClientIp } from '../../utils/ipHash';
import { logger } from '../../utils/logger';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../../utils/errors';
import { config } from '../../config';
import mongoose from 'mongoose';

const router = Router();

// Rate limiters
const initiateRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req as any).user?.userId || req.ip || 'unknown',
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
  keyGenerator: (req: Request) => (req as any).user?.userId || req.ip || 'unknown',
  message: 'Too many disconnect attempts. Please try again later.',
});

const reviewsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req as any).user?.userId || req.ip || 'unknown',
  message: 'Too many review requests. Please try again later.',
});

const insightsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req as any).user?.userId || req.ip || 'unknown',
  message: 'Too many insights requests. Please try again later.',
});

// Initialize Google Business OAuth Service
const getGoogleBusinessService = (): GoogleBusinessOAuthService => {
  const clientId = config.oauth.googleBusiness.clientId;
  const clientSecret = config.oauth.googleBusiness.clientSecret;
  const redirectUri = config.oauth.googleBusiness.redirectUri;

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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Failed to initiate Google Business Profile OAuth', {
        error: errorMessage,
        stack: errorStack,
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
          `${config.frontend.url}/integrations?error=${encodeURIComponent(
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
        `${config.frontend.url}/integrations?success=true&platform=google-business&locations=${result.locations.length}`
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Google Business Profile OAuth callback failed', {
        error: errorMessage,
        stack: errorStack,
      });

      // Redirect to frontend with error
      res.redirect(
        `${config.frontend.url}/integrations?error=${encodeURIComponent(
          errorMessage || 'Failed to connect Google Business Profile'
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Failed to disconnect Google Business Profile account', {
        error: errorMessage,
        stack: errorStack,
      });
      next(error);
    }
  }
);

/**
 * GET /api/v1/google-business/reviews/:accountId
 * 
 * Fetches reviews for a Google Business Profile location
 */
router.get(
  '/reviews/:accountId',
  requireAuth,
  requireWorkspace,
  reviewsRateLimit,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId } = req.params;
      const { pageSize = '50' } = req.query;
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

      // Find the social account
      const account = await SocialAccount.findOne({
        _id: accountId,
        workspaceId,
        provider: 'google-business',
      });

      if (!account) {
        throw new NotFoundError('Google Business Profile account not found');
      }

      logger.info('Fetching Google Business Profile reviews', {
        workspaceId,
        userId,
        accountId,
        pageSize,
      });

      // Get publisher and fetch reviews
      const publisher = new GoogleBusinessPublisher();
      const reviews = await publisher.getReviews(account, parseInt(pageSize.toString()));

      logger.info('Google Business Profile reviews fetched', {
        workspaceId,
        userId,
        accountId,
        reviewCount: reviews.length,
      });

      res.json({
        success: true,
        data: {
          reviews,
          count: reviews.length,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Failed to fetch Google Business Profile reviews', {
        error: errorMessage,
        stack: errorStack,
      });
      next(error);
    }
  }
);

/**
 * POST /api/v1/google-business/reviews/:accountId/:reviewId/reply
 * 
 * Replies to a Google Business Profile review
 */
router.post(
  '/reviews/:accountId/:reviewId/reply',
  requireAuth,
  requireWorkspace,
  reviewsRateLimit,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId, reviewId } = req.params;
      const { reply } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId.toString();

      // Validate authentication
      if (!workspaceId || !userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Validate parameters
      if (!mongoose.Types.ObjectId.isValid(accountId)) {
        throw new BadRequestError('Invalid account ID');
      }

      if (!reply || typeof reply !== 'string' || reply.trim().length === 0) {
        throw new BadRequestError('Reply text is required');
      }

      // Find the social account
      const account = await SocialAccount.findOne({
        _id: accountId,
        workspaceId,
        provider: 'google-business',
      });

      if (!account) {
        throw new NotFoundError('Google Business Profile account not found');
      }

      logger.info('Replying to Google Business Profile review', {
        workspaceId,
        userId,
        accountId,
        reviewId,
      });

      // Get publisher and reply to review
      const publisher = new GoogleBusinessPublisher();
      await publisher.replyToReview(account, reviewId, reply.trim());

      logger.info('Google Business Profile review reply posted', {
        workspaceId,
        userId,
        accountId,
        reviewId,
      });

      res.json({
        success: true,
        message: 'Review reply posted successfully',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Failed to reply to Google Business Profile review', {
        error: errorMessage,
        stack: errorStack,
      });
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/google-business/reviews/:accountId/:reviewId/reply
 * 
 * Deletes a reply to a Google Business Profile review
 */
router.delete(
  '/reviews/:accountId/:reviewId/reply',
  requireAuth,
  requireWorkspace,
  reviewsRateLimit,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId, reviewId } = req.params;
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

      // Find the social account
      const account = await SocialAccount.findOne({
        _id: accountId,
        workspaceId,
        provider: 'google-business',
      });

      if (!account) {
        throw new NotFoundError('Google Business Profile account not found');
      }

      logger.info('Deleting Google Business Profile review reply', {
        workspaceId,
        userId,
        accountId,
        reviewId,
      });

      // Get publisher and delete review reply
      const publisher = new GoogleBusinessPublisher();
      await publisher.deleteReviewReply(account, reviewId);

      logger.info('Google Business Profile review reply deleted', {
        workspaceId,
        userId,
        accountId,
        reviewId,
      });

      res.json({
        success: true,
        message: 'Review reply deleted successfully',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Failed to delete Google Business Profile review reply', {
        error: errorMessage,
        stack: errorStack,
      });
      next(error);
    }
  }
);

/**
 * GET /api/v1/google-business/insights/:accountId
 * 
 * Fetches location insights for a Google Business Profile
 */
router.get(
  '/insights/:accountId',
  requireAuth,
  requireWorkspace,
  insightsRateLimit,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId } = req.params;
      const { startDate, endDate } = req.query;
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

      // Validate date parameters
      if (!startDate || !endDate) {
        throw new BadRequestError('Start date and end date are required');
      }

      // Find the social account
      const account = await SocialAccount.findOne({
        _id: accountId,
        workspaceId,
        provider: 'google-business',
      });

      if (!account) {
        throw new NotFoundError('Google Business Profile account not found');
      }

      logger.info('Fetching Google Business Profile insights', {
        workspaceId,
        userId,
        accountId,
        startDate,
        endDate,
      });

      // Get publisher and fetch insights
      const publisher = new GoogleBusinessPublisher();
      const insights = await publisher.getLocationInsights(
        account,
        startDate.toString(),
        endDate.toString()
      );

      logger.info('Google Business Profile insights fetched', {
        workspaceId,
        userId,
        accountId,
        totalImpressions: insights.metrics.impressions,
      });

      res.json({
        success: true,
        data: insights,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Failed to fetch Google Business Profile insights', {
        error: errorMessage,
        stack: errorStack,
      });
      next(error);
    }
  }
);

export default router;
