/**
 * Dashboard Routes
 * 
 * Routes for dashboard endpoints
 */

import { Router } from 'express';
import { z } from 'zod';
import { DashboardController } from '../../controllers/DashboardController';
import { DashboardLayoutService } from '../../services/DashboardLayoutService';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';
import { logger } from '../../utils/logger';

const router = Router();

// Validation schemas
const saveLayoutSchema = z.object({
  body: z.object({
    widgets: z.array(z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      size: z.enum(['small', 'medium', 'large']),
      position: z.number(),
      isVisible: z.boolean(),
      config: z.record(z.unknown()).optional().default({}),
    })),
  }),
});

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

/**
 * Get dashboard layout
 * GET /api/v1/dashboard/layout
 */
router.get('/layout', authMiddleware, async (req, res) => {
  try {
    const { userId, workspaceId } = req.user!;

    const layout = await DashboardLayoutService.getLayout(userId, workspaceId);

    res.json({
      success: true,
      data: layout,
    });
  } catch (error: any) {
    logger.error('Failed to get dashboard layout', {
      userId: req.user?.userId,
      workspaceId: req.user?.workspaceId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard layout',
    });
  }
});

/**
 * Save dashboard layout
 * POST /api/v1/dashboard/layout
 */
router.post('/layout', authMiddleware, validateRequest(saveLayoutSchema), async (req, res) => {
  try {
    const { userId, workspaceId } = req.user!;
    const { widgets } = req.body;

    const layout = await DashboardLayoutService.saveLayout(userId, workspaceId, widgets);

    res.json({
      success: true,
      data: layout,
    });
  } catch (error: any) {
    logger.error('Failed to save dashboard layout', {
      userId: req.user?.userId,
      workspaceId: req.user?.workspaceId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to save dashboard layout',
    });
  }
});

/**
 * Reset dashboard layout
 * POST /api/v1/dashboard/layout/reset
 */
router.post('/layout/reset', authMiddleware, async (req, res) => {
  try {
    const { userId, workspaceId } = req.user!;

    const layout = await DashboardLayoutService.resetLayout(userId, workspaceId);

    res.json({
      success: true,
      data: layout,
    });
  } catch (error: any) {
    logger.error('Failed to reset dashboard layout', {
      userId: req.user?.userId,
      workspaceId: req.user?.workspaceId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to reset dashboard layout',
    });
  }
});

export default router;

