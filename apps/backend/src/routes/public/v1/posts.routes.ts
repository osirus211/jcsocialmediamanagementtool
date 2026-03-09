/**
 * Public API - Posts Routes
 * 
 * External endpoints for managing posts via API keys
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireScope } from '../../../middleware/apiKeyScope';
import { Post } from '../../../models/Post';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import mongoose from 'mongoose';

const router = Router();

/**
 * GET /api/public/v1/posts
 * List posts for the workspace
 * 
 * Query params:
 * - status: filter by status (draft, scheduled, published, failed)
 * - limit: number of posts to return (default: 20, max: 100)
 * - page: page number (default: 1)
 * 
 * Requires: posts:read scope
 */
router.get('/',
  requireScope('posts:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.apiKey!.workspaceId;
      
      // Parse query params
      const status = req.query.status as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const page = parseInt(req.query.page as string) || 1;
      const skip = (page - 1) * limit;
      
      // Build query
      const query: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };
      
      if (status) {
        query.status = status;
      }
      
      // Fetch posts
      const [posts, total] = await Promise.all([
        Post.find(query)
          .sort({ scheduledFor: -1, createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .select('-__v'),
        Post.countDocuments(query),
      ]);
      
      res.json({
        posts: posts.map(post => ({
          id: post._id,
          content: post.content,
          platformContent: post.platformContent,
          socialAccountIds: post.socialAccountIds,
          status: post.status,
          scheduledAt: post.scheduledAt,
          publishedAt: post.publishedAt,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/public/v1/posts/:id
 * Get a single post
 * 
 * Requires: posts:read scope
 */
router.get('/:id',
  requireScope('posts:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const workspaceId = req.apiKey!.workspaceId;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError('Invalid post ID');
      }
      
      const post = await Post.findOne({
        _id: new mongoose.Types.ObjectId(id),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      }).select('-__v');
      
      if (!post) {
        throw new NotFoundError('Post not found');
      }
      
      res.json({
        post: {
          id: post._id,
          content: post.content,
          platformContent: post.platformContent,
          socialAccountIds: post.socialAccountIds,
          status: post.status,
          scheduledAt: post.scheduledAt,
          publishedAt: post.publishedAt,
          errorMessage: post.errorMessage,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/public/v1/posts
 * Create a new post
 * 
 * Body:
 * {
 *   "content": "Post content",
 *   "platforms": ["twitter", "facebook"],
 *   "scheduledFor": "2026-03-08T10:00:00Z"
 * }
 * 
 * Requires: posts:write scope
 */
router.post('/',
  requireScope('posts:write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.apiKey!.workspaceId;
      const { content, socialAccountIds, scheduledAt, platformContent, mediaIds } = req.body;
      
      // Validate required fields
      if (!content || !socialAccountIds || !scheduledAt) {
        throw new BadRequestError('Content, socialAccountIds, and scheduledAt are required');
      }
      
      if (!Array.isArray(socialAccountIds) || socialAccountIds.length === 0) {
        throw new BadRequestError('At least one social account is required');
      }
      
      // Validate scheduled time
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        throw new BadRequestError('Invalid scheduledAt date');
      }
      
      if (scheduledDate <= new Date()) {
        throw new BadRequestError('scheduledAt must be in the future');
      }
      
      // Create post
      const post = await Post.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        createdBy: new mongoose.Types.ObjectId(workspaceId), // Use workspace ID as creator for API keys
        socialAccountId: new mongoose.Types.ObjectId(socialAccountIds[0]), // Use first account as primary
        socialAccountIds: socialAccountIds.map((id: string) => new mongoose.Types.ObjectId(id)),
        content,
        platformContent: platformContent || [],
        scheduledAt: scheduledDate,
        status: 'scheduled',
        mediaIds: mediaIds ? mediaIds.map((id: string) => new mongoose.Types.ObjectId(id)) : [],
      });
      
      res.status(201).json({
        post: {
          id: post._id,
          content: post.content,
          platformContent: post.platformContent,
          socialAccountIds: post.socialAccountIds,
          status: post.status,
          scheduledAt: post.scheduledAt,
          createdAt: post.createdAt,
        },
        message: 'Post created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/public/v1/posts/:id
 * Delete a post
 * 
 * Requires: posts:write scope
 */
router.delete('/:id',
  requireScope('posts:write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const workspaceId = req.apiKey!.workspaceId;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError('Invalid post ID');
      }
      
      const result = await Post.deleteOne({
        _id: new mongoose.Types.ObjectId(id),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });
      
      if (result.deletedCount === 0) {
        throw new NotFoundError('Post not found');
      }
      
      res.json({
        message: 'Post deleted successfully',
        postId: id,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
