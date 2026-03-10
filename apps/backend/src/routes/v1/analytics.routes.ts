/**
 * Analytics Routes
 * Analytics and engagement tracking endpoints
 */

import { Router } from 'express';
import { AnalyticsController } from '../../controllers/AnalyticsController';
import { FollowerAnalyticsService } from '../../services/FollowerAnalyticsService';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { z } from 'zod';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * @route   GET /api/v1/analytics/overview
 * @desc    Get overview metrics for workspace
 * @access  Private (requires auth + workspace)
 * @query   startDate, endDate (optional)
 */
router.get('/overview', AnalyticsController.getOverview);

/**
 * @route   GET /api/v1/analytics/platform
 * @desc    Get platform comparison metrics
 * @access  Private (requires auth + workspace)
 * @query   startDate, endDate (optional)
 */
router.get('/platform', AnalyticsController.getPlatformMetrics);

/**
 * @route   GET /api/v1/analytics/growth
 * @desc    Get growth metrics over time
 * @access  Private (requires auth + workspace)
 * @query   startDate, endDate (required), interval (optional: day/week/month)
 */
router.get('/growth', AnalyticsController.getGrowthMetrics);

/**
 * @route   GET /api/v1/analytics/posts
 * @desc    Get top performing posts
 * @access  Private (requires auth + workspace)
 * @query   startDate, endDate, limit (optional)
 */
router.get('/posts', AnalyticsController.getTopPosts);

/**
 * @route   GET /api/v1/analytics/post/:postId
 * @desc    Get analytics for specific post
 * @access  Private (requires auth + workspace)
 */
router.get('/post/:postId', AnalyticsController.getPostAnalytics);

/**
 * @route   GET /api/v1/analytics/best-times
 * @desc    Get optimal posting times heatmap and AI suggestions
 * @access  Private (requires auth + workspace)
 * @query   platform (optional), workspaceId (required)
 */
router.get('/best-times', AnalyticsController.getBestTimes);

/**
 * @route   POST /api/v1/analytics/mock/:postId
 * @desc    Generate mock analytics for a post (development)
 * @access  Private (requires auth + workspace)
 */
router.post('/mock/:postId', AnalyticsController.generateMockAnalytics);

/**
 * @route   GET /api/v1/analytics/followers/growth
 * @desc    Get follower growth for an account
 * @access  Private (requires auth + workspace)
 * @query   accountId (required), startDate, endDate (optional)
 */
router.get('/followers/growth', async (req, res) => {
  try {
    const schema = z.object({
      accountId: z.string().min(1, 'Account ID is required'),
      startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
      endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
    });

    const { accountId, startDate, endDate } = schema.parse(req.query);
    
    const growth = await FollowerAnalyticsService.getFollowerGrowth(accountId, startDate, endDate);
    
    res.json({ success: true, data: growth });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/v1/analytics/followers/trends
 * @desc    Get follower trends over time for an account
 * @access  Private (requires auth + workspace)
 * @query   accountId (required), startDate, endDate (required), interval (optional)
 */
router.get('/followers/trends', async (req, res) => {
  try {
    const schema = z.object({
      accountId: z.string().min(1, 'Account ID is required'),
      startDate: z.string().transform(val => new Date(val)),
      endDate: z.string().transform(val => new Date(val)),
      interval: z.enum(['day', 'week', 'month']).optional().default('day'),
    });

    const { accountId, startDate, endDate, interval } = schema.parse(req.query);
    
    const trends = await FollowerAnalyticsService.getFollowerTrends(accountId, startDate, endDate, interval);
    
    res.json({ success: true, data: trends });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/v1/analytics/followers/workspace
 * @desc    Get follower growth for all accounts in workspace
 * @access  Private (requires auth + workspace)
 * @query   startDate, endDate (optional)
 */
router.get('/followers/workspace', async (req, res) => {
  try {
    const schema = z.object({
      startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
      endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
    });

    const { startDate, endDate } = schema.parse(req.query);
    const workspaceId = req.workspace._id.toString();
    
    const growth = await FollowerAnalyticsService.getWorkspaceFollowerGrowth(workspaceId, startDate, endDate);
    
    res.json({ success: true, data: growth });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
