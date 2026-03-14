/**
 * Pinterest OAuth Routes
 * Handles Pinterest OAuth 2.0 authentication endpoints
 */

import { Router } from 'express';
import { PinterestOAuthService } from '../../services/oauth/PinterestOAuthService';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { SocialAccount, SocialPlatform } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';
import { BadRequestError, UnauthorizedError } from '../../utils/errors';

const router = Router();

// Apply middleware
router.use(requireAuth);
router.use(requireWorkspace);

// Initialize Pinterest OAuth service
const pinterestOAuth = new PinterestOAuthService(
  process.env.PINTEREST_APP_ID!,
  process.env.PINTEREST_APP_SECRET!,
  process.env.PINTEREST_REDIRECT_URI!
);

/**
 * GET /api/v1/oauth/pinterest/authorize
 * Generate Pinterest authorization URL
 */
router.get('/authorize', async (req, res) => {
  try {
    const { url, state } = await pinterestOAuth.getAuthorizationUrl();
    
    logger.info('Pinterest authorization URL generated', {
      userId: req.user?.userId,
      state,
    });

    res.json({ url, state });
  } catch (error: any) {
    logger.error('Failed to generate Pinterest authorization URL', {
      userId: req.user?.userId,
      error: error.message,
    });
    res.status(500).json({ 
      error: 'Failed to generate authorization URL',
      message: error.message 
    });
  }
});

/**
 * POST /api/v1/oauth/pinterest/disconnect
 * Disconnect Pinterest account
 */
router.post('/disconnect', async (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      throw new BadRequestError('Account ID is required');
    }

    // Verify account belongs to user
    const account = await SocialAccount.findOne({
      _id: accountId,
      userId: req.user!.userId,
      workspaceId: req.workspace!.workspaceId,
      platform: SocialPlatform.PINTEREST,
    });

    if (!account) {
      throw new BadRequestError('Pinterest account not found');
    }

    await pinterestOAuth.disconnectAccount(accountId);

    logger.info('Pinterest account disconnected', {
      userId: req.user?.userId,
      accountId,
      username: account.accountName,
    });

    res.json({ 
      success: true,
      message: 'Pinterest account disconnected successfully' 
    });
  } catch (error: any) {
    logger.error('Failed to disconnect Pinterest account', {
      userId: req.user?.userId,
      error: error.message,
    });
    res.status(error.statusCode || 500).json({ 
      error: 'Failed to disconnect account',
      message: error.message 
    });
  }
});

/**
 * GET /api/v1/oauth/pinterest/boards
 * Get Pinterest boards for connected accounts
 */
router.get('/boards', async (req, res) => {
  try {
    const { accountId } = req.query;

    // Get Pinterest accounts for user
    const query: any = {
      userId: req.user!.userId,
      workspaceId: req.workspace!.workspaceId,
      platform: SocialPlatform.PINTEREST,
      isActive: true,
    };

    if (accountId) {
      query._id = accountId;
    }

    const accounts = await SocialAccount.find(query);

    if (accounts.length === 0) {
      return res.json({ boards: [] });
    }

    // Collect boards from all accounts
    const allBoards: any[] = [];
    
    for (const account of accounts) {
      try {
        // Validate account and refresh if needed
        const isValid = await pinterestOAuth.validateAccount(account);
        if (!isValid) {
          logger.warn('Pinterest account token invalid, skipping', {
            accountId: account._id,
            username: account.accountName,
          });
          continue;
        }

        const boards = await pinterestOAuth.getUserBoards(account.accessToken);
        
        // Add account info to each board
        const boardsWithAccount = boards.map(board => ({
          ...board,
          accountId: account._id,
          accountUsername: account.accountName,
        }));
        
        allBoards.push(...boardsWithAccount);
      } catch (error: any) {
        logger.warn('Failed to fetch boards for Pinterest account', {
          accountId: account._id,
          username: account.accountName,
          error: error.message,
        });
      }
    }

    logger.info('Pinterest boards fetched', {
      userId: req.user?.userId,
      accountCount: accounts.length,
      boardCount: allBoards.length,
    });

    return res.json({ boards: allBoards });
  } catch (error: any) {
    logger.error('Failed to fetch Pinterest boards', {
      userId: req.user?.userId,
      error: error.message,
    });
    return res.status(500).json({ 
      error: 'Failed to fetch boards',
      message: error.message 
    });
  }
});

/**
 * POST /api/v1/oauth/pinterest/boards
 * Create a new Pinterest board
 */
router.post('/boards', async (req, res) => {
  try {
    const { accountId, name, description, privacy = 'PUBLIC' } = req.body;

    if (!accountId || !name) {
      throw new BadRequestError('Account ID and board name are required');
    }

    // Verify account belongs to user
    const account = await SocialAccount.findOne({
      _id: accountId,
      userId: req.user!.userId,
      workspaceId: req.workspace!.workspaceId,
      platform: SocialPlatform.PINTEREST,
      isActive: true,
    });

    if (!account) {
      throw new BadRequestError('Pinterest account not found');
    }

    // Validate account token
    const isValid = await pinterestOAuth.validateAccount(account);
    if (!isValid) {
      throw new UnauthorizedError('Pinterest account token is invalid');
    }

    // Create board using publisher
    const { PinterestPublisher } = await import('../../providers/publishers/PinterestPublisher');
    const publisher = new PinterestPublisher();
    
    const boardId = await publisher.createBoard(
      account.accessToken,
      name,
      description,
      privacy
    );

    // Sync account to update boards list
    await pinterestOAuth.syncAccount(account);

    logger.info('Pinterest board created', {
      userId: req.user?.userId,
      accountId,
      boardId,
      name,
      privacy,
    });

    res.json({ 
      success: true,
      boardId,
      message: 'Board created successfully' 
    });
  } catch (error: any) {
    logger.error('Failed to create Pinterest board', {
      userId: req.user?.userId,
      error: error.message,
    });
    res.status(error.statusCode || 500).json({ 
      error: 'Failed to create board',
      message: error.message 
    });
  }
});

/**
 * POST /api/v1/oauth/pinterest/sync
 * Sync Pinterest account data
 */
router.post('/sync', async (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      throw new BadRequestError('Account ID is required');
    }

    // Verify account belongs to user
    const account = await SocialAccount.findOne({
      _id: accountId,
      userId: req.user!.userId,
      workspaceId: req.workspace!.workspaceId,
      platform: SocialPlatform.PINTEREST,
    });

    if (!account) {
      throw new BadRequestError('Pinterest account not found');
    }

    await pinterestOAuth.syncAccount(account);

    logger.info('Pinterest account synced', {
      userId: req.user?.userId,
      accountId,
      username: account.accountName,
    });

    res.json({ 
      success: true,
      message: 'Account synced successfully' 
    });
  } catch (error: any) {
    logger.error('Failed to sync Pinterest account', {
      userId: req.user?.userId,
      error: error.message,
    });
    res.status(error.statusCode || 500).json({ 
      error: 'Failed to sync account',
      message: error.message 
    });
  }
});

export default router;