/**
 * Mastodon OAuth Routes
 * 
 * Handles Mastodon OAuth flow and account management
 * Base: /api/v1/mastodon
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import rateLimit from 'express-rate-limit';
import { MastodonOAuthService } from '../../services/oauth/MastodonOAuthService';
import { OAuthStateService } from '../../services/oauth/OAuthStateService';
import { SocialAccount, SocialPlatform } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';

const router = Router();

// Rate limiters
const registerRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many Mastodon registration attempts. Please try again later.',
});

const callbackRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many Mastodon callback requests. Please try again later.',
});

const disconnectRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user?.userId || (req as any).ip || 'unknown',
  message: 'Too many disconnect attempts. Please try again later.',
});

const mastodonService = new MastodonOAuthService();
const oauthStateService = new OAuthStateService();

/**
 * POST /api/v1/mastodon/register
 * Register app on Mastodon instance and get authorization URL
 */
// @ts-ignore - Express route handlers don't need explicit returns
router.post('/register', requireAuth, requireWorkspace, registerRateLimit, async (req, res) => {
  try {
    const { instanceUrl } = req.body;
    const userId = (req as any).user.userId;
    const workspaceId = (req as any).workspace.id;

    if (!instanceUrl) {
      return res.status(400).json({
        success: false,
        error: 'Instance URL is required'
      });
    }

    // Validate instance
    const isValidInstance = await mastodonService.validateInstance(instanceUrl);
    if (!isValidInstance) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Mastodon instance URL'
      });
    }

    // Register app on instance
    const appCredentials = await mastodonService.registerApp(instanceUrl);

    // Generate OAuth state
    const state = await oauthStateService.createState({
      platform: SocialPlatform.MASTODON,
      userId,
      workspaceId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      instanceUrl,
      clientId: appCredentials.client_id,
      clientSecret: appCredentials.client_secret
    });

    // Get authorization URL
    const authUrl = mastodonService.getAuthorizationUrl(
      instanceUrl,
      appCredentials.client_id,
      state
    );

    logger.info('Mastodon app registered and auth URL generated', {
      userId,
      workspaceId,
      instanceUrl,
      clientId: appCredentials.client_id
    });

    res.json({
      success: true,
      authUrl,
      state
    });
  } catch (error: any) {
    logger.error('Failed to register Mastodon app', {
      error: error.message,
      userId: (req as any).user?.userId,
      instanceUrl: req.body.instanceUrl
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/mastodon/callback
 * Handle OAuth callback from Mastodon
 */
router.get('/callback', callbackRateLimit, async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.warn('Mastodon OAuth error', { error });
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=oauth_denied`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=missing_params`);
    }

    // Validate state and get stored data
    const stateData = await oauthStateService.validateState(state as string);
    if (!stateData || stateData.platform !== SocialPlatform.MASTODON) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=invalid_state`);
    }

    // Connect account
    const result = await mastodonService.connectAccount({
      code: code as string,
      state: state as string,
      instanceUrl: stateData.instanceUrl,
      userId: stateData.userId,
      workspaceId: stateData.workspaceId
    });

    if (result.success) {
      logger.info('Mastodon account connected successfully', {
        userId: stateData.userId,
        workspaceId: stateData.workspaceId,
        instanceUrl: stateData.instanceUrl
      });
      
      res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?connected=mastodon`);
    } else {
      logger.error('Failed to connect Mastodon account', {
        error: result.error,
        userId: stateData.userId,
        instanceUrl: stateData.instanceUrl
      });
      
      res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=connection_failed`);
    }
  } catch (error: any) {
    logger.error('Mastodon callback error', {
      error: error.message,
      code: req.query.code,
      state: req.query.state
    });

    res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=callback_error`);
  }
});

/**
 * POST /api/v1/mastodon/disconnect
 * Disconnect Mastodon account
 */
// @ts-ignore - Express route handlers don't need explicit returns
router.post('/disconnect', requireAuth, requireWorkspace, disconnectRateLimit, async (req, res) => {
  try {
    const { accountId } = req.body;
    const userId = (req as any).user.userId;
    const workspaceId = (req as any).workspace.id;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required'
      });
    }

    // Verify account belongs to user/workspace
    const account = await SocialAccount.findOne({
      _id: accountId,
      userId,
      workspaceId,
      platform: 'mastodon'
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Disconnect account
    await mastodonService.disconnectAccount(accountId);

    logger.info('Mastodon account disconnected', {
      accountId,
      userId,
      workspaceId
    });

    res.json({
      success: true,
      message: 'Account disconnected successfully'
    });
  } catch (error: any) {
    logger.error('Failed to disconnect Mastodon account', {
      error: error.message,
      accountId: req.body.accountId,
      userId: (req as any).user?.userId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/mastodon/instances/popular
 * Get list of popular Mastodon instances
 */
router.get('/instances/popular', async (req, res) => {
  try {
    const instances = mastodonService.getPopularInstances();
    
    res.json({
      success: true,
      instances
    });
  } catch (error: any) {
    logger.error('Failed to get popular instances', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/mastodon/instances/validate
 * Validate if URL is a Mastodon instance
 */
// @ts-ignore - Express route handlers don't need explicit returns
router.post('/instances/validate', async (req, res) => {
  try {
    const { instanceUrl } = req.body;

    if (!instanceUrl) {
      return res.status(400).json({
        success: false,
        error: 'Instance URL is required'
      });
    }

    const isValid = await mastodonService.validateInstance(instanceUrl);
    
    res.json({
      success: true,
      valid: isValid
    });
  } catch (error: any) {
    logger.error('Failed to validate instance', {
      error: error.message,
      instanceUrl: req.body.instanceUrl
    });

    res.json({
      success: true,
      valid: false
    });
  }
});

export default router;