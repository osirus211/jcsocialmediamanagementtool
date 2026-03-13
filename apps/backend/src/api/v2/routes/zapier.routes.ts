/**
 * Public API v2 - Zapier Integration Routes
 * 
 * Zapier-compatible REST hooks and trigger/action endpoints
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireScope } from '../../../middleware/apiKeyScope';
import { AutomationService } from '../../../services/AutomationService';
import { logger } from '../../../utils/logger';
import { SocialPlatform } from '../../../models/ScheduledPost';

const router = Router();

// Validation schemas
const SubscribeHookSchema = z.object({
  hookUrl: z.string().url('Invalid hook URL'),
  event: z.string().min(1, 'Event is required'),
});

const UnsubscribeHookSchema = z.object({
  hookUrl: z.string().url('Invalid hook URL'),
});

const CreatePostSchema = z.object({
  platform: z.nativeEnum(SocialPlatform),
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  scheduledAt: z.string().datetime().optional(),
  mediaUrl: z.string().url().optional(),
});

const SchedulePostSchema = z.object({
  postId: z.string().min(1, 'Post ID is required'),
  scheduledAt: z.string().datetime(),
});

const UploadMediaSchema = z.object({
  platform: z.nativeEnum(SocialPlatform),
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  mediaUrl: z.string().url('Valid media URL is required'),
});

/**
 * GET /v2/zapier/auth/test - Test API key validity
 */
router.get('/auth/test', requireScope('posts:read'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    
    // Return workspace info for Zapier connection test
    res.json({
      workspace: {
        id: workspaceId,
        name: 'Social Media Workspace', // Could fetch actual name
      },
      user: {
        id: req.apiKey!.keyId,
        name: req.apiKey!.name,
      },
      status: 'connected',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v2/zapier/triggers/posts/new - Recent published posts (for Zapier polling)
 */
router.get('/triggers/posts/new', requireScope('posts:read'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    
    const posts = await AutomationService.getRecentPublishedPosts(workspaceId, 3);
    const formattedPosts = posts.map(post => AutomationService.formatPostForZapier(post));
    
    res.json(formattedPosts);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v2/zapier/triggers/posts/scheduled - Recent scheduled posts
 */
router.get('/triggers/posts/scheduled', requireScope('posts:read'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    
    const posts = await AutomationService.getRecentScheduledPosts(workspaceId, 3);
    const formattedPosts = posts.map(post => AutomationService.formatPostForZapier(post));
    
    res.json(formattedPosts);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v2/zapier/triggers/analytics/milestone - Recent milestone events
 */
router.get('/triggers/analytics/milestone', requireScope('analytics:read'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    
    // Return recent milestone events (placeholder - would need AnalyticsService method)
    const milestones = await AutomationService.getRecentMilestones(workspaceId, 3);
    
    res.json(milestones);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v2/zapier/hooks/subscribe - Register webhook for REST hooks
 */
router.post('/hooks/subscribe', requireScope('webhooks:write'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const data = SubscribeHookSchema.parse(req.body);
    
    const webhook = await AutomationService.registerAutomationWebhook(
      workspaceId,
      data.hookUrl,
      [data.event],
      'zapier'
    );
    
    logger.info('Zapier webhook subscribed', {
      workspaceId,
      hookUrl: data.hookUrl,
      event: data.event,
      webhookId: webhook._id,
    });
    
    res.status(201).json({
      id: webhook._id,
      hookUrl: data.hookUrl,
      event: data.event,
      status: 'subscribed',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /v2/zapier/hooks/unsubscribe - Remove webhook
 */
router.delete('/hooks/unsubscribe', requireScope('webhooks:write'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const data = UnsubscribeHookSchema.parse(req.body);
    
    await AutomationService.unregisterAutomationWebhook(workspaceId, data.hookUrl);
    
    logger.info('Zapier webhook unsubscribed', {
      workspaceId,
      hookUrl: data.hookUrl,
    });
    
    res.json({
      hookUrl: data.hookUrl,
      status: 'unsubscribed',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v2/zapier/actions/posts/create - Create a post
 */
router.post('/actions/posts/create', requireScope('posts:write'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const data = CreatePostSchema.parse(req.body);
    
    const post = await AutomationService.createPostFromAutomation(workspaceId, {
      platform: data.platform,
      content: data.content,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : new Date(),
      mediaUrl: data.mediaUrl,
    });
    
    logger.info('Post created via Zapier', {
      postId: post._id,
      workspaceId,
      platform: data.platform,
    });
    
    res.status(201).json(AutomationService.formatPostForZapier(post));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v2/zapier/actions/posts/schedule - Schedule existing draft
 */
router.post('/actions/posts/schedule', requireScope('posts:write'), async (req, res, next): Promise<void> => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const data = SchedulePostSchema.parse(req.body);
    
    const post = await AutomationService.scheduleExistingPost(
      workspaceId,
      data.postId,
      new Date(data.scheduledAt)
    );
    
    if (!post) {
      res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
      return;
    }
    
    logger.info('Post scheduled via Zapier', {
      postId: data.postId,
      workspaceId,
      scheduledAt: data.scheduledAt,
    });
    
    res.json(AutomationService.formatPostForZapier(post));
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v2/zapier/actions/media/upload-url - Create post with media URL
 */
router.post('/actions/media/upload-url', requireScope('posts:write'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const data = UploadMediaSchema.parse(req.body);
    
    const post = await AutomationService.createPostFromAutomation(workspaceId, {
      platform: data.platform,
      content: data.content,
      scheduledAt: new Date(),
      mediaUrl: data.mediaUrl,
    });
    
    logger.info('Post with media created via Zapier', {
      postId: post._id,
      workspaceId,
      platform: data.platform,
      mediaUrl: data.mediaUrl,
    });
    
    res.status(201).json(AutomationService.formatPostForZapier(post));
  } catch (error) {
    next(error);
  }
});

export default router;