/**
 * Trends Routes
 * Trending topic detection endpoints
 */

import { Router } from 'express';
import { TrendController } from '../../controllers/TrendController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * @route   GET /api/v1/trends/keyword/:keyword
 * @desc    Get trend history for keyword
 * @access  Private (requires auth + workspace)
 * @query   platform (required), startDate?, endDate?
 */
router.get('/keyword/:keyword', TrendController.getTrendHistory);

/**
 * @route   GET /api/v1/trends/:platform
 * @desc    Get trends for specific platform
 * @access  Private (requires auth + workspace)
 * @query   limit?
 */
router.get('/:platform', TrendController.getTrendsByPlatform);

/**
 * @route   GET /api/v1/trends
 * @desc    Get top trends across all platforms
 * @access  Private (requires auth + workspace)
 * @query   platform?, limit?
 */
router.get('/', TrendController.getTopTrends);

export default router;
