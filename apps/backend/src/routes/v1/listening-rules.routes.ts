/**
 * Listening Rules Routes
 * Social listening rule management endpoints
 */

import { Router } from 'express';
import { ListeningRuleController } from '../../controllers/ListeningRuleController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * @route   POST /api/v1/listening-rules
 * @desc    Create listening rule
 * @access  Private (requires auth + workspace)
 * @body    { platform, type, value }
 */
router.post('/', ListeningRuleController.createRule);

/**
 * @route   GET /api/v1/listening-rules
 * @desc    Get listening rules
 * @access  Private (requires auth + workspace)
 * @query   platform?, type?, active?
 */
router.get('/', ListeningRuleController.getRules);

/**
 * @route   PATCH /api/v1/listening-rules/:id
 * @desc    Update listening rule (activate/deactivate)
 * @access  Private (requires auth + workspace)
 * @body    { active }
 */
router.patch('/:id', ListeningRuleController.updateRule);

/**
 * @route   DELETE /api/v1/listening-rules/:id
 * @desc    Delete listening rule
 * @access  Private (requires auth + workspace)
 */
router.delete('/:id', ListeningRuleController.deleteRule);

export default router;
