/**
 * Follower Analytics Routes
 * Follower growth and trend endpoints
 */

import { Router } from 'express';
import { FollowerAnalyticsController } from '../../controllers/FollowerAnalyticsController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * @route   GET /api/v1/analytics/followers/workspace/growth
 * @desc    Get follower growth for all accounts in workspace
 * @access  Private (requires auth + workspace)
 * @query   startDate?, endDate?
 */
router.get('/workspace/growth', FollowerAnalyticsController.getWorkspaceFollowerGrowth);

/**
 * @route   GET /api/v1/analytics/followers/:accountId
 * @desc    Get follower history for an account
 * @access  Private (requires auth + workspace)
 * @query   startDate?, endDate?, limit?
 */
router.get('/:accountId', FollowerAnalyticsController.getFollowerHistory);

/**
 * @route   GET /api/v1/analytics/followers/:accountId/growth
 * @desc    Get follower growth for an account
 * @access  Private (requires auth + workspace)
 * @query   startDate?, endDate?
 */
router.get('/:accountId/growth', FollowerAnalyticsController.getFollowerGrowth);

/**
 * @route   GET /api/v1/analytics/followers/:accountId/trends
 * @desc    Get follower trends over time
 * @access  Private (requires auth + workspace)
 * @query   startDate (required), endDate (required), interval? (day/week/month)
 */
router.get('/:accountId/trends', FollowerAnalyticsController.getFollowerTrends);

export default router;
