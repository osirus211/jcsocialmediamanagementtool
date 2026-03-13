/**
 * Public API v2 - Make.com Integration Routes
 * 
 * Make.com compatible webhook and action endpoints
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireScope } from '../../../middleware/apiKeyScope';
import { AutomationService } from '../../../services/AutomationService';
import { logger } from '../../../utils/logger';
import { SocialPlatform } from '../../../models/ScheduledPost';
import { Webhook } from '../../../models/Webhook';

const router = Router();

// Validation schemas
const RegisterHookSchema = z.object({
  hookUrl: z.string().url('Invalid hook URL'),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  workspaceId: z.string().optional(), // Make.com might send this
});

const CreatePostSchema = z.object({
  platforms: z.array(z.nativeEnum(SocialPlatform)).min(1, 'At least one platform required'),
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  scheduledAt: z.string().datetime().optional(),
  categoryId: z.string().optional(),
  campaignId: z.string().optional(),
});

const UploadMediaSchema = z.object({
  url: z.string().url('Valid media URL is required'),
  filename: z.string().min(1, 'Filename is required'),
});

const ApprovePostSchema = z.object({
  postId: z.string().min(1, 'Post ID is required'),
});

/**
 * GET /v2/make/auth/verify - Verify connection
 */
router.get('/auth/verify', requireScope('posts:read'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    
    res.json({
      status: 'verified',
      workspace: {
        id: workspaceId,
        name: 'Social Media Workspace',
      },
      apiKey: {
        id: req.apiKey!.keyId,
        name: req.apiKey!.name,
        scopes: req.apiKey!.scopes,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v2/make/hooks/register - Register webhook for Make.com
 */
router.post('/hooks/register', requireScope('webhooks:write'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const data = RegisterHookSchema.parse(req.body);
    
    const webhook = await AutomationService.registerAutomationWebhook(
      workspaceId,
      data.hookUrl,
      data.events,
      'make'
    );
    
    logger.info('Make.com webhook registered', {
      workspaceId,
      hookUrl: data.hookUrl,
      events: data.events,
      webhookId: webhook._id,
    });
    
    res.status(201).json({
      hookId: webhook._id,
      hookUrl: data.hookUrl,
      events: data.events,
      status: 'registered',
      createdAt: webhook.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /v2/make/hooks/:hookId - Unregister webhook
 */
router.delete('/hooks/:hookId', requireScope('webhooks:write'), async (req, res, next): Promise<void> => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const hookId = req.params.hookId;
    
    const webhook = await Webhook.findOneAndDelete({
      _id: hookId,
      workspaceId,
    });
    
    if (!webhook) {
      res.status(404).json({
        error: 'Webhook not found',
        code: 'WEBHOOK_NOT_FOUND',
      });
      return;
    }
    
    logger.info('Make.com webhook unregistered', {
      workspaceId,
      hookId,
      hookUrl: webhook.url,
    });
    
    res.json({
      hookId,
      status: 'unregistered',
    });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v2/make/triggers/posts - Poll for new posts
 */
router.post('/triggers/posts', requireScope('posts:read'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    
    const posts = await AutomationService.getRecentPublishedPosts(workspaceId, 10);
    const formattedPosts = posts.map(post => AutomationService.formatPostForMake(post));
    
    res.json(formattedPosts);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v2/make/triggers/analytics - Poll for analytics updates
 */
router.post('/triggers/analytics', requireScope('analytics:read'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    
    const milestones = await AutomationService.getRecentMilestones(workspaceId, 10);
    
    res.json(milestones);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v2/make/actions/create-post - Create post for multiple platforms
 */
router.post('/actions/create-post', requireScope('posts:write'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const data = CreatePostSchema.parse(req.body);
    
    const posts = [];
    
    // Create post for each platform
    for (const platform of data.platforms) {
      const post = await AutomationService.createPostFromAutomation(workspaceId, {
        platform,
        content: data.content,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : new Date(),
        categoryId: data.categoryId,
        campaignId: data.campaignId,
      });
      
      posts.push(AutomationService.formatPostForMake(post));
    }
    
    logger.info('Multi-platform posts created via Make.com', {
      workspaceId,
      platforms: data.platforms,
      postCount: posts.length,
    });
    
    res.status(201).json({
      posts,
      summary: {
        created: posts.length,
        platforms: data.platforms,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v2/make/actions/upload-media - Download and save media to library
 */
router.post('/actions/upload-media', requireScope('media:write'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const data = UploadMediaSchema.parse(req.body);
    
    const media = await AutomationService.downloadAndSaveMedia(
      workspaceId,
      data.url,
      data.filename
    );
    
    logger.info('Media uploaded via Make.com', {
      workspaceId,
      mediaId: media._id,
      filename: data.filename,
      sourceUrl: data.url,
    });
    
    res.status(201).json({
      id: media._id,
      filename: media.filename,
      url: media.url,
      mimeType: media.mimeType,
      size: media.size,
      uploadedAt: media.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v2/make/actions/approve-post - Approve a pending post
 */
router.post('/actions/approve-post', requireScope('posts:write'), async (req, res, next): Promise<void> => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const data = ApprovePostSchema.parse(req.body);
    
    const post = await AutomationService.approvePost(workspaceId, data.postId);
    
    if (!post) {
      res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
      return;
    }
    
    logger.info('Post approved via Make.com', {
      workspaceId,
      postId: data.postId,
    });
    
    res.json({
      ...AutomationService.formatPostForMake(post),
      approved: true,
      approvedAt: new Date().toISOString(),
    });
    return;
  } catch (error) {
    next(error);
  }
});

export default router;