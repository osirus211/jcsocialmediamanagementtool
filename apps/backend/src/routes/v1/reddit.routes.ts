import { Router } from 'express';
import { RedditOAuthService } from '../../services/oauth/RedditOAuthService';
import { RedditPublisher } from '../../providers/publishers/RedditPublisher';
import { SocialAccount, SocialPlatform } from '../../models/SocialAccount';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

const router = Router();

// Initialize Reddit services
const redditOAuthService = new RedditOAuthService(
  process.env.REDDIT_CLIENT_ID!,
  process.env.REDDIT_CLIENT_SECRET!,
  process.env.REDDIT_REDIRECT_URI!,
  process.env.REDDIT_USER_AGENT!
);

const redditPublisher = new RedditPublisher(process.env.REDDIT_USER_AGENT!);

/**
 * GET /api/v1/oauth/reddit/authorize
 * Get Reddit OAuth authorization URL
 */
// @ts-ignore - Express route handlers don't need explicit returns
router.get('/oauth/reddit/authorize', requireAuth, requireWorkspace, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const workspaceId = (req as any).workspace.id;
    
    const { url, state } = await redditOAuthService.getAuthorizationUrl(
      userId.toString(),
      workspaceId.toString()
    );

    res.json({ url, state });
  } catch (error) {
    logger.error('Failed to generate Reddit authorization URL', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.userId,
      workspaceId: (req as any).workspace?.id
    });
    
    res.status(500).json({
      error: 'Failed to generate authorization URL'
    });
  }
});

/**
 * GET /api/v1/oauth/reddit/callback
 * Handle Reddit OAuth callback
 */
router.get('/oauth/reddit/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.error('Reddit OAuth error', { error });
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=oauth_error`);
    }

    if (!code || !state) {
      logger.error('Missing code or state in Reddit OAuth callback');
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=missing_params`);
    }

    // Note: In a real implementation, you'd need to decode the state to get userId and workspaceId
    // For now, we'll need to handle this through the frontend or store state differently
    
    // Redirect to frontend with code and state for client-side handling
    res.redirect(
      `${process.env.FRONTEND_URL}/settings/accounts/reddit/callback?code=${code}&state=${state}`
    );
  } catch (error) {
    logger.error('Failed to handle Reddit OAuth callback', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=callback_error`);
  }
});

/**
 * POST /api/v1/oauth/reddit/connect
 * Complete Reddit OAuth connection (called from frontend)
 */
// @ts-ignore - Express route handlers don't need explicit returns
router.post('/oauth/reddit/connect', requireAuth, requireWorkspace, async (req, res) => {
  try {
    const { code, state } = req.body;
    const userId = (req as any).user.userId;
    const workspaceId = (req as any).workspace.id;

    if (!code || !state) {
      return res.status(400).json({
        error: 'Code and state are required'
      });
    }

    const account = await redditOAuthService.handleCallback({
      code,
      state,
      userId: new mongoose.Types.ObjectId(userId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId)
    });

    res.json({
      success: true,
      account: {
        id: account._id,
        provider: account.provider,
        accountName: account.accountName,
        metadata: account.metadata
      }
    });
  } catch (error) {
    logger.error('Failed to connect Reddit account', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.userId,
      workspaceId: (req as any).workspace?.id
    });
    
    res.status(500).json({
      error: 'Failed to connect Reddit account'
    });
  }
});

/**
 * POST /api/v1/oauth/reddit/disconnect
 * Disconnect Reddit account
 */
// @ts-ignore - Express route handlers don't need explicit returns
router.post('/oauth/reddit/disconnect', requireAuth, requireWorkspace, async (req, res) => {
  try {
    const { accountId } = req.body;
    const userId = (req as any).user.userId;
    const workspaceId = (req as any).workspace.id;

    if (!accountId) {
      return res.status(400).json({
        error: 'Account ID is required'
      });
    }

    // Verify account belongs to user
    const account = await SocialAccount.findOne({
      _id: accountId,
      workspaceId,
      provider: SocialPlatform.REDDIT
    });

    if (!account) {
      return res.status(404).json({
        error: 'Reddit account not found'
      });
    }

    await redditOAuthService.disconnectAccount(accountId);

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to disconnect Reddit account', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.userId,
      workspaceId: (req as any).workspace?.id
    });
    
    res.status(500).json({
      error: 'Failed to disconnect Reddit account'
    });
  }
});

/**
 * GET /api/v1/reddit/subreddits
 * Get user's subscribed subreddits
 */
// @ts-ignore - Express route handlers don't need explicit returns
router.get('/reddit/subreddits', requireAuth, requireWorkspace, async (req, res) => {
  try {
    const { accountId } = req.query;
    const userId = (req as any).user.userId;
    const workspaceId = (req as any).workspace.id;

    if (!accountId) {
      return res.status(400).json({
        error: 'Account ID is required'
      });
    }

    const account = await SocialAccount.findOne({
      _id: accountId,
      workspaceId,
      provider: SocialPlatform.REDDIT
    });

    if (!account) {
      return res.status(404).json({
        error: 'Reddit account not found'
      });
    }

    // Check if token needs refresh
    const needsRefresh = await redditOAuthService.needsRefresh(account._id);
    if (needsRefresh) {
      const refreshResult = await redditOAuthService.refreshToken(account._id);
      if (!refreshResult.success) {
        return res.status(401).json({
          error: 'Failed to refresh Reddit token'
        });
      }
      // Reload account with new token
      await account.populate('');
    }

    const subreddits = await redditOAuthService.getSubscribedSubreddits(account.getDecryptedAccessToken());

    res.json({ subreddits });
  } catch (error) {
    logger.error('Failed to get Reddit subreddits', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.userId,
      workspaceId: (req as any).workspace?.id
    });
    
    res.status(500).json({
      error: 'Failed to get subreddits'
    });
  }
});

/**
 * GET /api/v1/reddit/subreddits/:name
 * Get subreddit information
 */
// @ts-ignore - Express route handlers don't need explicit returns
router.get('/reddit/subreddits/:name', requireAuth, requireWorkspace, async (req, res) => {
  try {
    const { name } = req.params;
    const { accountId } = req.query;
    const userId = (req as any).user.userId;
    const workspaceId = (req as any).workspace.id;

    if (!accountId) {
      return res.status(400).json({
        error: 'Account ID is required'
      });
    }

    const account = await SocialAccount.findOne({
      _id: accountId,
      workspaceId,
      provider: SocialPlatform.REDDIT
    });

    if (!account) {
      return res.status(404).json({
        error: 'Reddit account not found'
      });
    }

    // Check if token needs refresh
    const needsRefresh = await redditOAuthService.needsRefresh(account._id);
    if (needsRefresh) {
      const refreshResult = await redditOAuthService.refreshToken(account._id);
      if (!refreshResult.success) {
        return res.status(401).json({
          error: 'Failed to refresh Reddit token'
        });
      }
      // Reload account with new token
      await account.populate('');
    }

    const subredditInfo = await redditPublisher.getSubredditInfo(account.getDecryptedAccessToken(), name);

    res.json({ subreddit: subredditInfo });
  } catch (error) {
    logger.error('Failed to get Reddit subreddit info', {
      error: error instanceof Error ? error.message : 'Unknown error',
      subreddit: req.params.name,
      userId: (req as any).user?.userId,
      workspaceId: (req as any).workspace?.id
    });
    
    res.status(500).json({
      error: 'Failed to get subreddit information'
    });
  }
});

/**
 * GET /api/v1/reddit/subreddits/:name/flairs
 * Get subreddit flairs
 */
// @ts-ignore - Express route handlers don't need explicit returns
router.get('/reddit/subreddits/:name/flairs', requireAuth, requireWorkspace, async (req, res) => {
  try {
    const { name } = req.params;
    const { accountId } = req.query;
    const userId = (req as any).user.userId;
    const workspaceId = (req as any).workspace.id;

    if (!accountId) {
      return res.status(400).json({
        error: 'Account ID is required'
      });
    }

    const account = await SocialAccount.findOne({
      _id: accountId,
      workspaceId,
      provider: SocialPlatform.REDDIT
    });

    if (!account) {
      return res.status(404).json({
        error: 'Reddit account not found'
      });
    }

    // Check if token needs refresh
    const needsRefresh = await redditOAuthService.needsRefresh(account._id);
    if (needsRefresh) {
      const refreshResult = await redditOAuthService.refreshToken(account._id);
      if (!refreshResult.success) {
        return res.status(401).json({
          error: 'Failed to refresh Reddit token'
        });
      }
      // Reload account with new token
      await account.populate('');
    }

    const flairs = await redditPublisher.getSubredditFlairs(account.getDecryptedAccessToken(), name);

    res.json({ flairs });
  } catch (error) {
    logger.error('Failed to get Reddit subreddit flairs', {
      error: error instanceof Error ? error.message : 'Unknown error',
      subreddit: req.params.name,
      userId: (req as any).user?.userId,
      workspaceId: (req as any).workspace?.id
    });
    
    res.status(500).json({
      error: 'Failed to get subreddit flairs'
    });
  }
});

/**
 * POST /api/v1/reddit/validate-subreddit
 * Validate if user can post to subreddit
 */
// @ts-ignore - Express route handlers don't need explicit returns
router.post('/reddit/validate-subreddit', requireAuth, requireWorkspace, async (req, res) => {
  try {
    const { subreddit, accountId } = req.body;
    const userId = (req as any).user.userId;
    const workspaceId = (req as any).workspace.id;

    if (!subreddit || !accountId) {
      return res.status(400).json({
        error: 'Subreddit and account ID are required'
      });
    }

    const account = await SocialAccount.findOne({
      _id: accountId,
      workspaceId,
      provider: SocialPlatform.REDDIT
    });

    if (!account) {
      return res.status(404).json({
        error: 'Reddit account not found'
      });
    }

    // Check if token needs refresh
    const needsRefresh = await redditOAuthService.needsRefresh(account._id);
    if (needsRefresh) {
      const refreshResult = await redditOAuthService.refreshToken(account._id);
      if (!refreshResult.success) {
        return res.status(401).json({
          error: 'Failed to refresh Reddit token'
        });
      }
      // Reload account with new token
      await account.populate('');
    }

    const isValid = await redditPublisher.validateSubreddit(account.getDecryptedAccessToken(), subreddit);

    res.json({ valid: isValid });
  } catch (error) {
    logger.error('Failed to validate Reddit subreddit', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.userId,
      workspaceId: (req as any).workspace?.id
    });
    
    res.status(500).json({
      error: 'Failed to validate subreddit'
    });
  }
});

export default router;

