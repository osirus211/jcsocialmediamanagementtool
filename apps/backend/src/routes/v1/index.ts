import { Router } from 'express';
import authRoutes from './auth.routes';
import workspaceRoutes from './workspace.routes';
import postRoutes from './post.routes';
import socialRoutes from './social.routes';
import oauthRoutes from './oauth.routes';
import aiRoutes from './ai.routes';
import analyticsRoutes from './analytics.routes';
import billingRoutes from './billing.routes';
import adminRoutes from '../admin.routes';
import composerRoutes from './composer.routes';
import metricsRoutes from './metrics.routes';
import googleBusinessRoutes from './googleBusinessRoutes';
import draftsRoutes from './drafts.routes';
import postsRoutes from './posts.routes';
import mediaRoutes from './media.routes';
import platformRoutes from './platform.routes';

const router = Router();

// API v1 routes
router.get('/', (_req, res) => {
  res.json({
    message: 'Social Media Scheduler API v1',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      workspaces: '/api/v1/workspaces',
      posts: '/api/v1/posts',
      drafts: '/api/v1/drafts',
      media: '/api/v1/media',
      platforms: '/api/v1/platforms',
      social: '/api/v1/social',
      oauth: '/api/v1/oauth',
      analytics: '/api/v1/analytics',
      ai: '/api/v1/ai',
      billing: '/api/v1/billing',
      admin: '/api/v1/admin',
      composer: '/api/v1/composer',
      metrics: '/api/v1/metrics',
      googleBusiness: '/api/v1/google-business',
    },
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/posts', postsRoutes); // New comprehensive posts API
router.use('/post', postRoutes); // Legacy post API
router.use('/drafts', draftsRoutes); // Draft posts API
router.use('/media', mediaRoutes); // Media API
router.use('/platforms', platformRoutes); // Platforms API
router.use('/social', socialRoutes);
router.use('/oauth', oauthRoutes);
router.use('/ai', aiRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/billing', billingRoutes);
router.use('/admin', adminRoutes);
router.use('/composer', composerRoutes);
router.use('/metrics', metricsRoutes);
router.use('/google-business', googleBusinessRoutes);

export default router;
