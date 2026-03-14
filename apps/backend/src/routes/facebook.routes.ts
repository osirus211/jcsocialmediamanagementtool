/**
 * Facebook API Routes
 * 
 * Handles Facebook-specific functionality:
 * - Groups management
 * - Analytics
 * - Page management
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireWorkspace } from '../middleware/tenant';
import { FacebookGroupsService } from '../services/FacebookGroupsService';
import { FacebookAnalyticsService } from '../services/analytics/FacebookAnalyticsService';
import { SocialAccount } from '../models/SocialAccount';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();
const groupsService = new FacebookGroupsService();
const analyticsService = new FacebookAnalyticsService();

// Apply authentication and workspace validation to all routes
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * GET /api/v1/facebook/:accountId/groups
 * Get user's Facebook groups
 */
router.get('/:accountId/groups', async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const workspaceId = req.workspace?.workspaceId;

    // Find the Facebook account
    const account = await SocialAccount.findOne({
      _id: accountId,
      workspaceId,
      provider: 'facebook',
    });

    if (!account) {
      throw new NotFoundError('Facebook account not found');
    }

    const groups = await groupsService.getUserGroups(account);

    logger.info('Facebook groups fetched', {
      accountId,
      groupsCount: groups.length,
      workspaceId: workspaceId?.toString(),
    });

    res.json({
      success: true,
      groups,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/facebook/:accountId/groups/:groupId/publish
 * Publish post to Facebook group
 */
router.post('/:accountId/groups/:groupId/publish', async (req, res, next) => {
  try {
    const { accountId, groupId } = req.params;
    const { content, mediaIds, link, scheduledPublishTime } = req.body;
    const workspaceId = req.workspace?.workspaceId;

    if (!content) {
      throw new BadRequestError('Content is required');
    }

    // Find the Facebook account
    const account = await SocialAccount.findOne({
      _id: accountId,
      workspaceId,
      provider: 'facebook',
    });

    if (!account) {
      throw new NotFoundError('Facebook account not found');
    }

    const result = await groupsService.publishToGroup(account, groupId, {
      content,
      mediaIds,
      link,
      scheduledPublishTime,
    });

    logger.info('Facebook group post published', {
      accountId,
      groupId,
      postId: result.postId,
      workspaceId: workspaceId?.toString(),
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/facebook/:accountId/groups/:groupId/permissions
 * Get group posting permissions
 */
router.get('/:accountId/groups/:groupId/permissions', async (req, res, next) => {
  try {
    const { accountId, groupId } = req.params;
    const workspaceId = req.workspace?.workspaceId;

    // Find the Facebook account
    const account = await SocialAccount.findOne({
      _id: accountId,
      workspaceId,
      provider: 'facebook',
    });

    if (!account) {
      throw new NotFoundError('Facebook account not found');
    }

    const permissions = await groupsService.getGroupPermissions(account, groupId);

    res.json({
      success: true,
      ...permissions,
    });
  } catch (error) {
    next(error);
  }
});

export { router as facebookRoutes };