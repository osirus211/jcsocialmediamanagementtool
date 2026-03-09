/**
 * Dashboard Routes
 * 
 * Routes for dashboard endpoints
 */

import { Router } from 'express';
import { DashboardController } from '../../controllers/DashboardController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';

const router = Router();

/**
 * All dashboard routes require authentication and workspace context
 */
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * Get workspace overview dashboard
 * GET /api/v1/dashboard/overview
 * 
 * Returns:
 * - Analytics summary (last 30 days)
 * - Usage summary with limits
 * - Recent activity (5 items)
 */
router.get('/overview', DashboardController.getOverview);

/**
 * Get analytics dashboard
 * GET /api/v1/dashboard/analytics
 * 
 * Query params:
 * - dateFrom: Start date (ISO string)
 * - dateTo: End date (ISO string)
 * - platform: Filter by platform (optional)
 * - interval: Trend interval (day|week|month, default: day)
 * - topPostsLimit: Number of top posts (default: 10)
 * 
 * Returns:
 * - Analytics summary
 * - Top performing posts
 * - Platform performance comparison
 * - Engagement trends
 */
router.get('/analytics', DashboardController.getAnalytics);

/**
 * Get usage dashboard
 * GET /api/v1/dashboard/usage
 * 
 * Query params:
 * - months: Number of months of history (default: 6)
 * 
 * Returns:
 * - Current usage with percentages
 * - Plan limits
 * - Usage history
 */
router.get('/usage', DashboardController.getUsage);

/**
 * Get activity dashboard
 * GET /api/v1/dashboard/activity
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - action: Filter by action type (optional)
 * - userId: Filter by user (optional)
 * - dateFrom: Start date (ISO string, optional)
 * - dateTo: End date (ISO string, optional)
 * 
 * Returns:
 * - Activity feed with pagination
 * - Activity statistics
 */
router.get('/activity', DashboardController.getActivity);

export default router;

