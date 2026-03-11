/**
 * Public API v2 Router
 * 
 * External developer API with API key authentication
 */

import { Router } from 'express';
import { requireApiKey } from '../../middleware/apiKeyAuth';
import { combinedApiKeyRateLimit } from '../../middleware/apiKeyRateLimit';
import postsRoutes from './routes/posts.routes';
import analyticsRoutes from './routes/analytics.routes';
import mediaRoutes from './routes/media.routes';
import webhooksRoutes from './routes/webhooks.routes';
import zapierRoutes from './routes/zapier.routes';
import makeRoutes from './routes/make.routes';
import docsRoutes from './docs.routes';

const router = Router();

// API v2 info endpoint (no auth required)
router.get('/', (_req, res) => {
  res.json({
    message: 'Social Media Scheduler Public API v2',
    version: '2.0.0',
    documentation: '/api/v2/docs',
    openapi: '/api/v2/openapi.json',
    authentication: 'API Key (x-api-key header)',
    endpoints: {
      posts: '/api/v2/posts',
      analytics: '/api/v2/analytics',
      media: '/api/v2/media',
      webhooks: '/api/v2/webhooks',
    },
  });
});

// Documentation routes (no auth required)
router.use('/', docsRoutes);

// Apply API key authentication and rate limiting to all protected routes
router.use(requireApiKey);
router.use(combinedApiKeyRateLimit);

// Mount protected routes
router.use('/posts', postsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/media', mediaRoutes);
router.use('/webhooks', webhooksRoutes);
router.use('/zapier', zapierRoutes);
router.use('/make', makeRoutes);

export default router;