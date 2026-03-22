/**
 * Follower Analytics Routes
 * Follower growth and trend endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { FollowerAnalyticsController } from '../../controllers/FollowerAnalyticsController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { SlidingWindowRateLimiter } from '../../middleware/composerRateLimits';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

// Rate limiting for follower analytics endpoints
const followersLimit = new SlidingWindowRateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000,
  keyPrefix: 'rateLimit:followers',
});

const followersRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const key = req.workspace?.workspaceId?.toString() || req.ip || 'unknown';
    const { allowed } = await followersLimit.checkLimit(key);
    if (!allowed) {
      res.status(429).json({ code: 'RATE_LIMIT_EXCEEDED', message: 'Too many follower analytics requests.' });
      return;
    }
    next();
  } catch {
    next();
  }
};

router.use(followersRateLimit);

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

