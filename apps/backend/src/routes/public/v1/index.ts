/**
 * Public API v1 Router
 * 
 * External-facing API for third-party integrations using API keys
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireApiKey } from '../../../middleware/apiKeyAuth';
import { apiKeyRateLimit } from '../../../middleware/apiKeyRateLimit';
import { SlidingWindowRateLimiter } from '../../../middleware/composerRateLimits';
import postsRoutes from './posts.routes';
import accountsRoutes from './accounts.routes';
import analyticsRoutes from './analytics.routes';
import mediaRoutes from './media.routes';
import docsRoutes from '../docs.routes';

const router = Router();

// Workspace-level rate limit for public API (second layer after per-key limit)
const publicApiLimit = new SlidingWindowRateLimiter({
  maxRequests: 1000,
  windowMs: 60 * 60 * 1000, // 1000 per hour per workspace
  keyPrefix: 'rateLimit:publicApi',
});

const publicApiRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const key = (req as any).apiKey?.workspaceId?.toString() || req.ip || 'unknown';
    const { allowed, remaining } = await publicApiLimit.checkLimit(key);
    
    if (!allowed) {
      res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Public API rate limit exceeded. Max 1000 requests per hour per workspace.',
      });
      return;
    }
    
    res.setHeader('X-RateLimit-Remaining', remaining);
    next();
  } catch {
    next();
  }
};

// Mount documentation routes (no auth required)
router.use('/docs', docsRoutes);

// Apply API key authentication and rate limiting to all public routes
router.use(requireApiKey);
router.use(apiKeyRateLimit);
router.use(publicApiRateLimit); // Workspace-level rate limit

// Public API info endpoint
router.get('/', (_req, res) => {
  res.json({
    message: 'Social Media Scheduler Public API v1',
    version: '1.0.0',
    documentation: '/api/public/v1/docs',
    interactiveDocs: '/api/public/v1/docs/ui',
    endpoints: {
      posts: '/api/public/v1/posts',
      accounts: '/api/public/v1/accounts',
      analytics: '/api/public/v1/analytics',
      media: '/api/public/v1/media',
    },
  });
});

// Mount public API routes
router.use('/posts', postsRoutes);
router.use('/accounts', accountsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/media', mediaRoutes);

export default router;
