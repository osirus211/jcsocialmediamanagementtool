/**
 * Competitor Routes
 * Competitor tracking and analytics endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { CompetitorController } from '../../controllers/CompetitorController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { SlidingWindowRateLimiter } from '../../middleware/composerRateLimits';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

// Rate limiting for competitor endpoints
const competitorsLimit = new SlidingWindowRateLimiter({
  maxRequests: 50,
  windowMs: 60 * 1000,
  keyPrefix: 'rateLimit:competitors',
});

const competitorsRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const key = req.workspace?.workspaceId?.toString() || req.ip || 'unknown';
    const { allowed } = await competitorsLimit.checkLimit(key);
    if (!allowed) {
      res.status(429).json({ code: 'RATE_LIMIT_EXCEEDED', message: 'Too many competitor requests.' });
      return;
    }
    next();
  } catch {
    next();
  }
};

router.use(competitorsRateLimit);

/**
 * @route   POST /api/v1/competitors
 * @desc    Add competitor to track
 * @access  Private (requires auth + workspace)
 * @body    { platform, handle, displayName? }
 */
router.post('/', CompetitorController.addCompetitor);

/**
 * @route   GET /api/v1/competitors
 * @desc    Get competitors for workspace
 * @access  Private (requires auth + workspace)
 * @query   platform?, isActive?
 */
router.get('/', CompetitorController.getCompetitors);

/**
 * @route   DELETE /api/v1/competitors/:id
 * @desc    Remove competitor
 * @access  Private (requires auth + workspace)
 */
router.delete('/:id', CompetitorController.removeCompetitor);

/**
 * @route   GET /api/v1/competitors/:id/analytics
 * @desc    Get competitor analytics history
 * @access  Private (requires auth + workspace)
 * @query   startDate?, endDate?, limit?
 */
router.get('/:id/analytics', CompetitorController.getCompetitorAnalytics);

/**
 * @route   GET /api/v1/competitors/:id/growth
 * @desc    Get competitor growth metrics
 * @access  Private (requires auth + workspace)
 * @query   startDate?, endDate?
 */
router.get('/:id/growth', CompetitorController.getCompetitorGrowth);

/**
 * @route   POST /api/v1/competitors/compare
 * @desc    Compare multiple competitors
 * @access  Private (requires auth + workspace)
 * @body    { competitorIds: string[], startDate?, endDate? }
 */
router.post('/compare', CompetitorController.compareCompetitors);

export default router;

