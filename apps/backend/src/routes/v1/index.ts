import { Router } from 'express';
import authRoutes from './auth.routes';
import workspaceRoutes from './workspace.routes';
import invitationRoutes from './invitation.routes';
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
import postsRoutes from './posts.routes';
import mediaRoutes from './media.routes';
import platformRoutes from './platform.routes';
import dashboardRoutes from './dashboard.routes';
import apiKeysRoutes from './apiKeys.routes';
import taskRoutes from './tasks.routes'; // Task management
import templatesRoutes from './templates.routes'; // Phase-2: Post templates
import queueSlotsRoutes from './queue-slots.routes'; // Phase-2: Queue slots
import linksRoutes from './links.routes'; // Phase-2: Link shortening
import followersRoutes from './followers.routes'; // Phase-3: Follower analytics
import competitorsRoutes from './competitors.routes'; // Phase-3: Competitor analytics
import listeningRulesRoutes from './listening-rules.routes'; // Phase-4: Social listening
import mentionsRoutes from './mentions.routes'; // Phase-4: Mentions
import trendsRoutes from './trends.routes'; // Phase-4: Trends
import workflowsRoutes from './workflows.routes'; // Phase-5: Automation workflows
import rssFeedsRoutes from './rss-feeds.routes'; // Phase-5: RSS feeds
import evergreenRoutes from './evergreen.routes'; // Phase-5: Evergreen content
import reportsRoutes from './reports.routes'; // Phase-3: Scheduled reports
import webhooksOutboundRoutes from './webhooks-outbound.routes'; // Outbound webhooks
import approvalsRoutes from './approvals.routes'; // Phase-4: Post approval workflow
import activityRoutes from './activity.routes'; // Phase-4: Team activity feed
import draftsRoutes from './drafts.routes'; // Phase-4: Collaborative draft editing
import accountPermissionsRoutes from './account-permissions.routes'; // Phase-4: Granular permissions
import postCommentsRoutes from './post-comments.routes'; // Phase-4: In-line post comments
import clientPortalRoutes from './client-portal.routes'; // Phase-4: Client approval portal
import categoriesRoutes from './categories.routes'; // Phase-4: Content categories
import campaignsRoutes from './campaigns.routes'; // Phase-4: Campaign tagging
import designIntegrationsRoutes from './design-integrations.routes'; // Phase-4: Canva & Figma integration
import stockPhotosRoutes from './stock-photos.routes'; // Phase-4: Stock photo library
import gdprRoutes from './gdpr.routes'; // GDPR compliance
import { onboardingRoutes } from './onboarding.routes'; // User onboarding
import instagramRoutes from './instagram.routes'; // Instagram-specific features
import { facebookRoutes } from '../facebook.routes'; // Facebook-specific features
import { facebookAnalyticsRoutes } from '../analytics/facebook.analytics.routes'; // Facebook analytics

const router = Router();

// API v1 routes
router.get('/', (_req, res) => {
  res.json({
    message: 'Social Media Scheduler API v1',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      workspaces: '/api/v1/workspaces',
      invitations: '/api/v1/invitations',
      posts: '/api/v1/posts',
      tasks: '/api/v1/tasks',
      templates: '/api/v1/templates',
      queueSlots: '/api/v1/queue-slots',
      links: '/api/v1/links',
      media: '/api/v1/media',
      platforms: '/api/v1/platforms',
      social: '/api/v1/social',
      oauth: '/api/v1/oauth',
      analytics: '/api/v1/analytics',
      followers: '/api/v1/analytics/followers',
      competitors: '/api/v1/competitors',
      listeningRules: '/api/v1/listening-rules',
      mentions: '/api/v1/mentions',
      trends: '/api/v1/trends',
      workflows: '/api/v1/workflows',
      rssFeeds: '/api/v1/rss-feeds',
      evergreenRules: '/api/v1/evergreen-rules',
      reports: '/api/v1/reports',
      webhooksOutbound: '/api/v1/webhooks/outbound',
      approvals: '/api/v1/approvals',
      activity: '/api/v1/activity',
      drafts: '/api/v1/drafts',
      accountPermissions: '/api/v1/account-permissions',
      postComments: '/api/v1/posts/:postId/comments',
      clientPortal: '/api/v1/client-portal',
      clientPortals: '/api/v1/client-portals',
      categories: '/api/v1/categories',
      campaigns: '/api/v1/campaigns',
      designIntegrations: '/api/v1/design-integrations',
      stockPhotos: '/api/v1/stock-photos',
      gdpr: '/api/v1/gdpr',
      onboarding: '/api/v1/onboarding',
      instagram: '/api/v1/instagram',
      dashboard: '/api/v1/dashboard',
      ai: '/api/v1/ai',
      billing: '/api/v1/billing',
      admin: '/api/v1/admin',
      composer: '/api/v1/composer',
      metrics: '/api/v1/metrics',
      googleBusiness: '/api/v1/google-business',
      apiKeys: '/api/v1/api-keys',
    },
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/invitations', invitationRoutes); // Public invitation routes
router.use('/posts', postsRoutes); // New comprehensive posts API
router.use('/post', postRoutes); // Legacy post API
router.use('/tasks', taskRoutes); // Task management
router.use('/templates', templatesRoutes); // Phase-2: Post templates
router.use('/queue-slots', queueSlotsRoutes); // Phase-2: Queue slots
router.use('/links', linksRoutes); // Phase-2: Link shortening
router.use('/media', mediaRoutes); // Media API
router.use('/platforms', platformRoutes); // Platforms API
router.use('/social', socialRoutes);
router.use('/oauth', oauthRoutes);
router.use('/ai', aiRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/analytics/facebook', facebookAnalyticsRoutes); // Facebook analytics
router.use('/analytics/followers', followersRoutes); // Phase-3: Follower analytics
router.use('/competitors', competitorsRoutes); // Phase-3: Competitor analytics
router.use('/listening-rules', listeningRulesRoutes); // Phase-4: Social listening
router.use('/mentions', mentionsRoutes); // Phase-4: Mentions
router.use('/trends', trendsRoutes); // Phase-4: Trends
router.use('/workflows', workflowsRoutes); // Phase-5: Automation workflows
router.use('/rss-feeds', rssFeedsRoutes); // Phase-5: RSS feeds
router.use('/evergreen-rules', evergreenRoutes); // Phase-5: Evergreen content
router.use('/reports', reportsRoutes); // Phase-3: Scheduled reports
router.use('/webhooks/outbound', webhooksOutboundRoutes); // Outbound webhooks
router.use('/approvals', approvalsRoutes); // Phase-4: Post approval workflow
router.use('/activity', activityRoutes); // Phase-4: Team activity feed
router.use('/drafts', draftsRoutes); // Phase-4: Collaborative draft editing
router.use('/account-permissions', accountPermissionsRoutes); // Phase-4: Granular permissions
router.use('/posts', postCommentsRoutes); // Phase-4: In-line post comments
router.use('/client-portal', clientPortalRoutes); // Phase-4: Client approval portal
router.use('/client-portals', clientPortalRoutes); // Phase-4: Client approval portal (new endpoints)
router.use('/categories', categoriesRoutes); // Phase-4: Content categories
router.use('/campaigns', campaignsRoutes); // Phase-4: Campaign tagging
router.use('/design-integrations', designIntegrationsRoutes); // Phase-4: Canva & Figma integration
router.use('/facebook', facebookRoutes); // Facebook-specific features
router.use('/stock-photos', stockPhotosRoutes); // Phase-4: Stock photo library
router.use('/gdpr', gdprRoutes); // GDPR compliance
router.use('/onboarding', onboardingRoutes); // User onboarding
router.use('/instagram', instagramRoutes); // Instagram-specific features
router.use('/dashboard', dashboardRoutes);
router.use('/billing', billingRoutes);
router.use('/admin', adminRoutes);
router.use('/composer', composerRoutes);
router.use('/metrics', metricsRoutes);
router.use('/google-business', googleBusinessRoutes);
router.use('/api-keys', apiKeysRoutes); // API key management

export default router;
