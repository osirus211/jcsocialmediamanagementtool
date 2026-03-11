/**
 * Public API v2 - Posts Routes
 * 
 * External API for post management with API key authentication
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireScope } from '../../../middleware/apiKeyScope';
import { PostService } from '../../../services/PostService';
import { logger } from '../../../utils/logger';
import { SocialPlatform, PostStatus } from '../../../models/ScheduledPost';

const router = Router();
const postService = new PostService();

// Validation schemas
const CreatePostSchema = z.object({
  socialAccountId: z.string().min(1, 'Social account ID is required'),
  platform: z.nativeEnum(SocialPlatform),
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  mediaIds: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
  contentType: z.enum(['post', 'story', 'reel']).optional().default('post'),
});

const UpdatePostSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  mediaIds: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
});

const ListPostsSchema = z.object({
  status: z.nativeEnum(PostStatus).optional(),
  platform: z.nativeEnum(SocialPlatform).optional(),
  socialAccountId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

/**
 * GET /v2/posts - List posts with cursor-based pagination
 */
router.get('/', requireScope('posts:read'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const query = ListPostsSchema.parse(req.query);
    
    // Build filter
    const filter: any = { workspaceId };
    if (query.status) filter.status = query.status;
    if (query.platform) filter.platform = query.platform;
    if (query.socialAccountId) filter.socialAccountId = query.socialAccountId;
    
    // Cursor-based pagination
    if (query.cursor) {
      filter._id = { $lt: query.cursor };
    }
    
    const posts = await postService.getPosts({
      ...filter,
      limit: query.limit + 1, // Get one extra to check if there are more
      sort: { _id: -1 }, // Sort by ID descending for cursor pagination
    });
    
    const hasMore = posts.length > query.limit;
    const data = hasMore ? posts.slice(0, -1) : posts;
    const nextCursor = hasMore ? data[data.length - 1]._id.toString() : null;
    
    res.json({
      data,
      meta: {
        cursor: nextCursor,
        hasMore,
        total: await postService.getPostsCount(filter),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v2/posts/:id - Get single post
 */
router.get('/:id', requireScope('posts:read'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const postId = req.params.id;
    
    const post = await postService.getPostById(postId, workspaceId);
    
    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
    }
    
    res.json({ data: post });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v2/posts - Create new post
 */
router.post('/', requireScope('posts:write'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const data = CreatePostSchema.parse(req.body);
    
    const post = await postService.createPost({
      workspaceId,
      socialAccountId: data.socialAccountId,
      platform: data.platform,
      content: data.content,
      mediaIds: data.mediaIds,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : new Date(),
      contentType: data.contentType,
      createdBy: req.apiKey!.keyId, // Use API key ID as creator
    });
    
    logger.info('Post created via API v2', {
      postId: post._id,
      workspaceId,
      apiKeyId: req.apiKey!.keyId,
    });
    
    res.status(201).json({ data: post });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /v2/posts/:id - Update post
 */
router.patch('/:id', requireScope('posts:write'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const postId = req.params.id;
    const data = UpdatePostSchema.parse(req.body);
    
    const updateData: any = {};
    if (data.content !== undefined) updateData.content = data.content;
    if (data.mediaIds !== undefined) updateData.mediaIds = data.mediaIds;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = new Date(data.scheduledAt);
    
    const post = await postService.updatePost(postId, workspaceId, updateData);
    
    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
    }
    
    logger.info('Post updated via API v2', {
      postId,
      workspaceId,
      apiKeyId: req.apiKey!.keyId,
    });
    
    res.json({ data: post });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /v2/posts/:id - Delete post
 */
router.delete('/:id', requireScope('posts:write'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const postId = req.params.id;
    
    const deleted = await postService.deletePost(postId, workspaceId);
    
    if (!deleted) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
    }
    
    logger.info('Post deleted via API v2', {
      postId,
      workspaceId,
      apiKeyId: req.apiKey!.keyId,
    });
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v2/posts/:id/publish - Publish post immediately
 */
router.post('/:id/publish', requireScope('posts:write'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const postId = req.params.id;
    
    const post = await postService.publishPostImmediately(postId, workspaceId);
    
    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND',
      });
    }
    
    logger.info('Post published immediately via API v2', {
      postId,
      workspaceId,
      apiKeyId: req.apiKey!.keyId,
    });
    
    res.json({ 
      data: post,
      message: 'Post queued for immediate publishing',
    });
  } catch (error) {
    next(error);
  }
});

export default router;