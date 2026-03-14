/**
 * Analytics Routes
 * Analytics and engagement tracking endpoints
 */

import { Router } from 'express';
import { AnalyticsController } from '../../controllers/AnalyticsController';
import { FollowerAnalyticsService } from '../../services/FollowerAnalyticsService';
import { HashtagAnalyticsService } from '../../services/HashtagAnalyticsService';
import { PostROIService } from '../../services/PostROIService';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace, requirePermission } from '../../middleware/tenant';
import { Permission } from '../../services/WorkspacePermissionService';
import { z } from 'zod';

// Import platform-specific analytics routes
import { facebookAnalyticsRoutes } from '../analytics/facebook.analytics.routes';
import linkedinAnalyticsRoutes from '../analytics/linkedin.analytics.routes';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

// Platform-specific analytics routes
router.use('/facebook', facebookAnalyticsRoutes);
router.use('/linkedin', linkedinAnalyticsRoutes);

/**
 * @route   GET /api/v1/analytics/overview
 * @desc    Get overview metrics for workspace
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 * @query   startDate, endDate (optional)
 */
router.get('/overview', requirePermission(Permission.VIEW_ANALYTICS), AnalyticsController.getOverview);

/**
 * @route   GET /api/v1/analytics/platform
 * @desc    Get platform comparison metrics
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 * @query   startDate, endDate (optional)
 */
router.get('/platform', requirePermission(Permission.VIEW_ANALYTICS), AnalyticsController.getPlatformMetrics);

/**
 * @route   GET /api/v1/analytics/growth
 * @desc    Get growth metrics over time
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 * @query   startDate, endDate (required), interval (optional: day/week/month)
 */
router.get('/growth', requirePermission(Permission.VIEW_ANALYTICS), AnalyticsController.getGrowthMetrics);

/**
 * @route   GET /api/v1/analytics/posts
 * @desc    Get top performing posts
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 * @query   startDate, endDate, limit (optional)
 */
router.get('/posts', requirePermission(Permission.VIEW_ANALYTICS), AnalyticsController.getTopPosts);

/**
 * @route   GET /api/v1/analytics/post/:postId
 * @desc    Get analytics for specific post
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 */
router.get('/post/:postId', requirePermission(Permission.VIEW_ANALYTICS), AnalyticsController.getPostAnalytics);

/**
 * @route   GET /api/v1/analytics/best-times
 * @desc    Get optimal posting times heatmap and AI suggestions
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 * @query   platform (optional), workspaceId (required)
 */
router.get('/best-times', requirePermission(Permission.VIEW_ANALYTICS), AnalyticsController.getBestTimes);

/**
 * @route   POST /api/v1/analytics/mock/:postId
 * @desc    Generate mock analytics for a post (development)
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 */
router.post('/mock/:postId', requirePermission(Permission.VIEW_ANALYTICS), AnalyticsController.generateMockAnalytics);

/**
 * @route   GET /api/v1/analytics/followers/growth
 * @desc    Get follower growth for an account
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 * @query   accountId (required), startDate, endDate (optional)
 */
router.get('/followers/growth', requirePermission(Permission.VIEW_ANALYTICS), async (req, res) => {
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
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 * @query   accountId (required), startDate, endDate (required), interval (optional)
 */
router.get('/followers/trends', requirePermission(Permission.VIEW_ANALYTICS), async (req, res) => {
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
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 * @query   startDate, endDate (optional)
 */
router.get('/followers/workspace', requirePermission(Permission.VIEW_ANALYTICS), async (req, res) => {
  try {
    const schema = z.object({
      startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
      endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
    });

    const { startDate, endDate } = schema.parse(req.query);
    const workspaceId = req.workspace.workspaceId.toString();
    
    const growth = await FollowerAnalyticsService.getWorkspaceFollowerGrowth(workspaceId, startDate, endDate);
    
    res.json({ success: true, data: growth });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/v1/analytics/hashtags
 * @desc    Get hashtag performance metrics for workspace
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 * @query   startDate, endDate, limit (optional)
 */
router.get('/hashtags', requirePermission(Permission.VIEW_ANALYTICS), async (req, res) => {
  try {
    const schema = z.object({
      startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
      endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
      limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
    });

    const { startDate, endDate, limit } = schema.parse(req.query);
    const workspaceId = req.workspace.workspaceId.toString();
    
    const hashtags = await HashtagAnalyticsService.getHashtagPerformance(workspaceId, startDate, endDate, limit);
    
    res.json({ success: true, data: hashtags });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/v1/analytics/hashtags/trends
 * @desc    Get hashtag trends over time
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 * @query   hashtag (required), startDate, endDate (optional)
 */
router.get('/hashtags/trends', requirePermission(Permission.VIEW_ANALYTICS), async (req, res) => {
  try {
    const schema = z.object({
      hashtag: z.string().min(1, 'Hashtag is required'),
      startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
      endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
    });

    const { hashtag, startDate, endDate } = schema.parse(req.query);
    const workspaceId = req.workspace.workspaceId.toString();
    
    const trends = await HashtagAnalyticsService.getHashtagTrends(workspaceId, hashtag, startDate, endDate);
    
    res.json({ success: true, data: trends });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/v1/analytics/hashtags/by-platform
 * @desc    Get top hashtags by platform
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 * @query   platform (required), limit (optional)
 */
router.get('/hashtags/by-platform', requirePermission(Permission.VIEW_ANALYTICS), async (req, res) => {
  try {
    const schema = z.object({
      platform: z.string().min(1, 'Platform is required'),
      limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
    });

    const { platform, limit } = schema.parse(req.query);
    const workspaceId = req.workspace.workspaceId.toString();
    
    const hashtags = await HashtagAnalyticsService.getTopHashtagsByPlatform(workspaceId, platform, limit);
    
    res.json({ success: true, data: hashtags });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/v1/analytics/hashtags/suggestions
 * @desc    Get hashtag suggestions based on performance
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 * @query   limit (optional)
 */
router.get('/hashtags/suggestions', requirePermission(Permission.VIEW_ANALYTICS), async (req, res) => {
  try {
    const schema = z.object({
      limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
    });

    const { limit } = schema.parse(req.query);
    const workspaceId = req.workspace.workspaceId.toString();
    
    const suggestions = await HashtagAnalyticsService.getHashtagSuggestions(workspaceId, limit);
    
    res.json({ success: true, data: suggestions });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/v1/analytics/post/:postId/performance
 * @desc    Get comprehensive post performance summary
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 */
router.get('/post/:postId/performance', requirePermission(Permission.VIEW_ANALYTICS), async (req, res) => {
  try {
    const schema = z.object({
      postId: z.string().min(1, 'Post ID is required'),
    });

    const { postId } = schema.parse(req.params);
    const workspaceId = req.workspace.workspaceId.toString();
    
    const performance = await PostROIService.getPostPerformanceSummary(postId, workspaceId);
    
    res.json({ success: true, data: performance });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   PATCH /api/v1/analytics/post/:postId/roi
 * @desc    Update post ROI data
 * @access  Private (requires auth + workspace + EXPORT_ANALYTICS permission)
 * @body    { adSpend?, estimatedRevenue? }
 */
router.patch('/post/:postId/roi', requirePermission(Permission.EXPORT_ANALYTICS), async (req, res) => {
  try {
    const paramsSchema = z.object({
      postId: z.string().min(1, 'Post ID is required'),
    });

    const bodySchema = z.object({
      adSpend: z.number().min(0).optional(),
      estimatedRevenue: z.number().min(0).optional(),
    });

    const { postId } = paramsSchema.parse(req.params);
    const { adSpend, estimatedRevenue } = bodySchema.parse(req.body);
    
    await PostROIService.updateROI(postId, adSpend, estimatedRevenue);
    
    res.json({ success: true, message: 'ROI data updated successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/v1/analytics/posts/top
 * @desc    Get top performing posts
 * @access  Private (requires auth + workspace + VIEW_ANALYTICS permission)
 * @query   sortBy? (engagement|ctr|roi), limit?, startDate?, endDate?
 */
router.get('/posts/top', requirePermission(Permission.VIEW_ANALYTICS), async (req, res) => {
  try {
    const schema = z.object({
      sortBy: z.enum(['engagement', 'ctr', 'roi']).optional().default('engagement'),
      limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
      startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
      endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
    });

    const { sortBy, limit, startDate, endDate } = schema.parse(req.query);
    const workspaceId = req.workspace.workspaceId.toString();
    
    const posts = await PostROIService.getTopPerformingPosts(workspaceId, startDate, endDate, sortBy, limit);
    
    res.json({ success: true, data: posts });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
