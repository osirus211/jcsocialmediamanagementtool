/**
 * Listening Rules Routes
 * Social listening rule management endpoints
 */

import { Router } from 'express';
import { ListeningRuleController } from '../../controllers/ListeningRuleController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { requireAdminOrOwner } from '../../middleware/rbac';
import { SlidingWindowRateLimiter } from '../../middleware/composerRateLimits';
import { Request, Response, NextFunction } from 'express';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

// Rate limiter for listening rules (60 per minute per workspace)
const listeningRuleLimit = new SlidingWindowRateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000,
  keyPrefix: 'rateLimit:listeningRules',
});

const listeningRuleRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const key = req.workspace?.workspaceId?.toString() || req.ip || 'unknown';
    const { allowed } = await listeningRuleLimit.checkLimit(key);
    if (!allowed) {
      res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many listening rule requests.',
      });
      return;
    }
    next();
  } catch {
    next();
  }
};

router.use(listeningRuleRateLimit);

/**
 * @route   POST /api/v1/listening-rules
 * @desc    Create listening rule
 * @access  Private (requires auth + workspace + admin/owner)
 * @body    { platform, type, value }
 */
router.post('/', requireAdminOrOwner, ListeningRuleController.createRule);

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
 * @access  Private (requires auth + workspace + admin/owner)
 */
router.delete('/:id', requireAdminOrOwner, ListeningRuleController.deleteRule);

export default router;

