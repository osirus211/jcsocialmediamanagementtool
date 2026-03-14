/**
 * Facebook Analytics API Routes
 * 
 * Handles Facebook analytics and insights
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { FacebookAnalyticsService } from '../../services/analytics/FacebookAnalyticsService';
import { SocialAccount } from '../../models/SocialAccount';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';

const router = Router();
const analyticsService = new FacebookAnalyticsService();

// Apply authentication and workspace validation to all routes
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * GET /api/v1/analytics/facebook/:accountId/page
 * Get Facebook page insights
 */
router.get('/:accountId/page', async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { startDate, endDate, period = 'day' } = req.query;
    const workspaceId = req.workspace?.workspaceId;

    if (!startDate || !endDate) {
      throw new BadRequestError('startDate and endDate are required');
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

    const insights = await analyticsService.getPageInsights(
      account,
      new Date(startDate as string),
      new Date(endDate as string),
      period as 'day' | 'week' | 'days_28'
    );

    logger.info('Facebook page insights fetched', {
      accountId,
      period,
      workspaceId: workspaceId?.toString(),
    });

    res.json({
      success: true,
      insights,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/analytics/facebook/:accountId/post/:postId
 * Get Facebook post insights
 */
router.get('/:accountId/post/:postId', async (req, res, next) => {
  try {
    const { accountId, postId } = req.params;
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

    const insights = await analyticsService.getPostInsights(account, postId);

    logger.info('Facebook post insights fetched', {
      accountId,
      postId,
      workspaceId: workspaceId?.toString(),
    });

    res.json({
      success: true,
      insights,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/analytics/facebook/:accountId/audience
 * Get Facebook audience insights
 */
router.get('/:accountId/audience', async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { startDate, endDate } = req.query;
    const workspaceId = req.workspace?.workspaceId;

    if (!startDate || !endDate) {
      throw new BadRequestError('startDate and endDate are required');
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

    const insights = await analyticsService.getAudienceInsights(
      account,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    logger.info('Facebook audience insights fetched', {
      accountId,
      workspaceId: workspaceId?.toString(),
    });

    res.json({
      success: true,
      insights,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/analytics/facebook/:accountId/video/:videoId
 * Get Facebook video metrics
 */
router.get('/:accountId/video/:videoId', async (req, res, next) => {
  try {
    const { accountId, videoId } = req.params;
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

    const metrics = await analyticsService.getVideoMetrics(account, videoId);

    logger.info('Facebook video metrics fetched', {
      accountId,
      videoId,
      workspaceId: workspaceId?.toString(),
    });

    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/analytics/facebook/:accountId/summary
 * Get comprehensive Facebook analytics summary
 */
router.get('/:accountId/summary', async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { startDate, endDate } = req.query;
    const workspaceId = req.workspace?.workspaceId;

    if (!startDate || !endDate) {
      throw new BadRequestError('startDate and endDate are required');
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

    const summary = await analyticsService.getAnalyticsSummary(
      account,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    logger.info('Facebook analytics summary fetched', {
      accountId,
      workspaceId: workspaceId?.toString(),
    });

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    next(error);
  }
});

export { router as facebookAnalyticsRoutes };