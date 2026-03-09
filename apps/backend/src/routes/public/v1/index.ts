/**
 * Public API v1 Router
 * 
 * External-facing API for third-party integrations using API keys
 */

import { Router } from 'express';
import { requireApiKey } from '../../../middleware/apiKeyAuth';
import { apiKeyRateLimit } from '../../../middleware/apiKeyRateLimit';
import postsRoutes from './posts.routes';
import accountsRoutes from './accounts.routes';
import analyticsRoutes from './analytics.routes';
import mediaRoutes from './media.routes';
import docsRoutes from '../docs.routes';

const router = Router();

// Mount documentation routes (no auth required)
router.use('/docs', docsRoutes);

// Apply API key authentication and rate limiting to all public routes
router.use(requireApiKey);
router.use(apiKeyRateLimit);

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
