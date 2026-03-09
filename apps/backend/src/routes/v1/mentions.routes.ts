/**
 * Mentions Routes
 * Social media mention retrieval endpoints
 */

import { Router } from 'express';
import { MentionController } from '../../controllers/MentionController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * @route   GET /api/v1/mentions/stats
 * @desc    Get mention statistics
 * @access  Private (requires auth + workspace)
 * @query   keyword?, platform?, startDate?, endDate?
 */
router.get('/stats', MentionController.getMentionStats);

/**
 * @route   GET /api/v1/mentions/:keyword
 * @desc    Get mentions for specific keyword
 * @access  Private (requires auth + workspace)
 * @query   platform?, startDate?, endDate?, limit?
 */
router.get('/:keyword', MentionController.getMentionsByKeyword);

/**
 * @route   GET /api/v1/mentions
 * @desc    Get mentions with pagination
 * @access  Private (requires auth + workspace)
 * @query   keyword?, platform?, startDate?, endDate?, page?, limit?, sortBy?, sortOrder?
 */
router.get('/', MentionController.getMentions);

export default router;
