/**
 * Analytics Routes
 * Analytics and engagement tracking endpoints
 */

import { Router } from 'express';
import { AnalyticsController } from '../../controllers/AnalyticsController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';

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
 * @route   POST /api/v1/analytics/mock/:postId
 * @desc    Generate mock analytics for a post (development)
 * @access  Private (requires auth + workspace)
 */
router.post('/mock/:postId', AnalyticsController.generateMockAnalytics);

export default router;
