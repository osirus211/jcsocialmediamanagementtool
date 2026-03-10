/**
 * Post Controller
 * 
 * REST API endpoints for managing scheduled posts
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { postService, PostService } from '../services/PostService';
import { logger } from '../utils/logger';
import {
  sendSuccess,
  sendValidationError,
  sendNotFound,
  sendError,
} from '../utils/apiResponse';
import { recordCalendarRequest, recordHistoryRequest } from '../config/uiMetrics';

export class PostController {
  /**
   * POST /api/v1/posts
   * Create a scheduled post
   */
  async createPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { workspaceId, socialAccountId, platform, content, mediaUrls, scheduledAt } = req.body;

      // Create post
      const post = await postService.createPost({
        workspaceId,
        socialAccountId,
        platform,
        content,
        mediaUrls,
        scheduledAt: new Date(scheduledAt),
      });

      logger.info('Post created via API', {
        postId: post._id.toString(),
        workspaceId,
        platform,
      });

      sendSuccess(res, post.toJSON(), 201);
    } catch (error: any) {
      logger.error('Failed to create post', {
        error: error.message,
        body: req.body,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/posts
   * Get posts with pagination
   */
  async getPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { workspaceId, status, platform, socialAccountId, createdBy, page, limit } = req.query;

      // Get posts
      const result = await postService.getPosts({
        workspaceId: workspaceId as string,
        status: status as any,
        platform: platform as any,
        socialAccountId: socialAccountId as string,
        createdBy: createdBy as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      sendSuccess(
        res,
        {
          posts: result.posts.map((post) => post.toJSON()),
        },
        200,
        {
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
          },
        }
      );
    } catch (error: any) {
      logger.error('Failed to get posts', {
        error: error.message,
        query: req.query,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/posts/:id
   * Get post by ID
   */
  async getPostById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { id } = req.params;
      const { workspaceId } = req.query;

      // Get post with attempts
      const result = await postService.getPostWithAttempts(id, workspaceId as string);

      sendSuccess(res, {
        post: result.post.toJSON(),
        attempts: result.attempts.map((attempt) => attempt.toJSON()),
      });
    } catch (error: any) {
      if (error.message === 'Post not found') {
        sendNotFound(res, 'Post');
        return;
      }

      logger.error('Failed to get post', {
        error: error.message,
        postId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * PATCH /api/v1/posts/:id
   * Update scheduled post
   */
  async updatePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { id } = req.params;
      const { workspaceId } = req.query;
      const { content, mediaUrls, scheduledAt } = req.body;

      // Update post
      const post = await postService.updatePost(id, workspaceId as string, {
        content,
        mediaUrls,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      });

      logger.info('Post updated via API', {
        postId: post._id.toString(),
        workspaceId,
      });

      sendSuccess(res, post.toJSON());
    } catch (error: any) {
      if (error.message === 'Post not found') {
        sendNotFound(res, 'Post');
        return;
      }

      if (error.message.startsWith('Cannot update post')) {
        sendError(res, 'INVALID_OPERATION', error.message, 400);
        return;
      }

      logger.error('Failed to update post', {
        error: error.message,
        postId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * DELETE /api/v1/posts/:id
   * Delete scheduled post
   */
  async deletePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { id } = req.params;
      const { workspaceId } = req.query;

      // Delete post
      await postService.deletePost(id, workspaceId as string);

      logger.info('Post deleted via API', {
        postId: id,
        workspaceId,
      });

      sendSuccess(res, { message: 'Post deleted successfully' });
    } catch (error: any) {
      if (error.message === 'Post not found') {
        sendNotFound(res, 'Post');
        return;
      }

      if (error.message.startsWith('Cannot delete post')) {
        sendError(res, 'INVALID_OPERATION', error.message, 400);
        return;
      }

      logger.error('Failed to delete post', {
        error: error.message,
        postId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * POST /api/v1/posts/:id/retry
   * Retry failed post
   */
  async retryPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { id } = req.params;
      const { workspaceId } = req.query;

      // Retry post
      const post = await postService.retryPost(id, workspaceId as string);

      logger.info('Post retry scheduled via API', {
        postId: post._id.toString(),
        workspaceId,
      });

      sendSuccess(res, post.toJSON(), 200, { message: 'Post retry scheduled' });
    } catch (error: any) {
      if (error.message === 'Post not found') {
        sendNotFound(res, 'Post');
        return;
      }

      if (error.message.startsWith('Cannot retry post')) {
        sendError(res, 'INVALID_OPERATION', error.message, 400);
        return;
      }

      logger.error('Failed to retry post', {
        error: error.message,
        postId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/posts/stats
   * Get post statistics
   */
  async getPostStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { workspaceId } = req.query;

      // Get stats
      const stats = await postService.getPostStats(workspaceId as string);

      sendSuccess(res, stats);
    } catch (error: any) {
      logger.error('Failed to get post stats', {
        error: error.message,
        query: req.query,
      });

      next(error);
    }
  }
  /**
   * GET /api/v1/posts/calendar
   * Get posts grouped by scheduled date
   */
  async getCalendar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(
          res,
          errors.array().map((err) => ({
            field: err.type === 'field' ? (err as any).path : undefined,
            message: err.msg,
          }))
        );
        return;
      }

      const { workspaceId, startDate, endDate } = req.query;

      // Record metric
      recordCalendarRequest(workspaceId as string);

      // Get calendar data
      const calendar = await postService.getCalendar({
        workspaceId: workspaceId as string,
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      });

      sendSuccess(res, calendar, 200);
    } catch (error: any) {
      logger.error('Failed to get calendar', {
        error: error.message,
        query: req.query,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/posts/history
   * Get post history with filters
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(
          res,
          errors.array().map((err) => ({
            field: err.type === 'field' ? (err as any).path : undefined,
            message: err.msg,
          }))
        );
        return;
      }

      const { workspaceId, status, platform, startDate, endDate, page, limit } = req.query;

      // Record metric
      recordHistoryRequest(workspaceId as string, status as string, platform as string);

      // Get history
      const result = await postService.getHistory({
        workspaceId: workspaceId as string,
        status: status as any,
        platform: platform as any,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      sendSuccess(
        res,
        {
          posts: result.posts.map((post) => post.toJSON()),
        },
        200,
        {
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
          },
        }
      );
    } catch (error: any) {
      logger.error('Failed to get history', {
        error: error.message,
        query: req.query,
      });

      next(error);
    }
  }

  /**
   * Bulk delete posts
   * @route POST /api/v1/posts/bulk/delete
   */
  async bulkDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(
          res,
          errors.array().map((err) => ({
            field: err.type === 'field' ? (err as any).path : undefined,
            message: err.msg,
          }))
        );
        return;
      }

      const { workspaceId, postIds } = req.body;

      logger.info('Bulk delete request', {
        workspaceId,
        count: postIds.length,
      });

      // Bulk delete
      const result = await postService.bulkDeletePosts(postIds, workspaceId);

      sendSuccess(res, result, 200);
    } catch (error: any) {
      logger.error('Failed to bulk delete posts', {
        error: error.message,
        body: req.body,
      });

      next(error);
    }
  }

  /**
   * Bulk reschedule posts
   * @route POST /api/v1/posts/bulk/reschedule
   */
  async bulkReschedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(
          res,
          errors.array().map((err) => ({
            field: err.type === 'field' ? (err as any).path : undefined,
            message: err.msg,
          }))
        );
        return;
      }

      const { workspaceId, postIds, scheduledAt } = req.body;

      logger.info('Bulk reschedule request', {
        workspaceId,
        count: postIds.length,
        scheduledAt,
      });

      // Bulk reschedule
      const result = await postService.bulkReschedulePosts(
        postIds,
        new Date(scheduledAt),
        workspaceId
      );

      sendSuccess(res, result, 200);
    } catch (error: any) {
      logger.error('Failed to bulk reschedule posts', {
        error: error.message,
        body: req.body,
      });

      next(error);
    }
  }

  /**
   * Bulk update post status
   * @route POST /api/v1/posts/bulk/update
   */
  async bulkUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(
          res,
          errors.array().map((err) => ({
            field: err.type === 'field' ? (err as any).path : undefined,
            message: err.msg,
          }))
        );
        return;
      }

      const { workspaceId, postIds, status } = req.body;

      logger.info('Bulk update request', {
        workspaceId,
        count: postIds.length,
        status,
      });

      // Bulk update
      const result = await postService.bulkUpdateStatus(postIds, status, workspaceId);

      sendSuccess(res, result, 200);
    } catch (error: any) {
      logger.error('Failed to bulk update posts', {
        error: error.message,
        body: req.body,
      });

      next(error);
    }
  }

  /**
   * Duplicate post to multiple platforms
   * @route POST /api/v1/posts/:id/duplicate
   */
  async duplicatePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(
          res,
          errors.array().map((err) => ({
            field: err.type === 'field' ? (err as any).path : undefined,
            message: err.msg,
          }))
        );
        return;
      }

      const { id } = req.params;
      const { workspaceId, platforms, scheduledAt } = req.body;

      logger.info('Duplicate post request', {
        postId: id,
        workspaceId,
        platforms,
        scheduledAt,
      });

      // Duplicate post
      const result = await postService.duplicatePost(
        id,
        workspaceId,
        platforms,
        scheduledAt ? new Date(scheduledAt) : undefined
      );

      sendSuccess(res, result, 201);
    } catch (error: any) {
      logger.error('Failed to duplicate post', {
        error: error.message,
        postId: req.params.id,
        body: req.body,
      });

      next(error);
    }
  }

  /**
   * POST /api/v1/posts/:id/lock
   * Lock a post to prevent editing
   */
  async lockPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || !userRole) {
        return sendError(res, 'User information not found', 401);
      }

      // Check LOCK_POST permission
      const { workspacePermissionService, Permission } = await import('../services/WorkspacePermissionService');
      if (!workspacePermissionService.hasPermission(userRole, Permission.LOCK_POST)) {
        return sendError(res, 'Insufficient permissions to lock posts', 403);
      }

      const result = await postService.lockPost(id, userId, reason);
      sendSuccess(res, result);
    } catch (error: any) {
      logger.error('Failed to lock post', {
        error: error.message,
        postId: req.params.id,
        userId: req.user?.id,
      });
      next(error);
    }
  }

  /**
   * DELETE /api/v1/posts/:id/lock
   * Unlock a post
   */
  async unlockPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || !userRole) {
        return sendError(res, 'User information not found', 401);
      }

      // Check LOCK_POST permission
      const { workspacePermissionService, Permission } = await import('../services/WorkspacePermissionService');
      if (!workspacePermissionService.hasPermission(userRole, Permission.LOCK_POST)) {
        return sendError(res, 'Insufficient permissions to unlock posts', 403);
      }

      const result = await postService.unlockPost(id);
      sendSuccess(res, result);
    } catch (error: any) {
      logger.error('Failed to unlock post', {
        error: error.message,
        postId: req.params.id,
        userId: req.user?.id,
      });
      next(error);
    }
  }

  /**
   * GET /api/v1/posts/:id/lock
   * Get post lock status
   */
  async getLockStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const result = await postService.getLockStatus(id);
      sendSuccess(res, result);
    } catch (error: any) {
      logger.error('Failed to get lock status', {
        error: error.message,
        postId: req.params.id,
      });
      next(error);
    }
  }

  /**
   * POST /api/v1/posts/bulk
   * Create multiple scheduled posts
   */
  async bulkCreatePosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { posts } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId.toString();

      if (!workspaceId || !userId) {
        sendError(res, 'Workspace and user required', 400);
        return;
      }

      if (!Array.isArray(posts) || posts.length === 0) {
        sendError(res, 'Posts array is required and cannot be empty', 400);
        return;
      }

      // Add workspaceId to each post
      const postsWithWorkspace = posts.map(post => ({
        ...post,
        workspaceId,
        scheduledAt: new Date(post.scheduledAt),
      }));

      // Create posts using the static method
      const createdPosts = await PostService.bulkCreatePosts(
        workspaceId,
        userId,
        postsWithWorkspace
      );

      logger.info('Bulk posts created via API', {
        workspaceId,
        userId,
        count: createdPosts.length,
      });

      sendSuccess(res, {
        posts: createdPosts,
        count: createdPosts.length,
      });
    } catch (error: any) {
      logger.error('Failed to bulk create posts', {
        error: error.message,
        workspaceId: req.workspace?.workspaceId,
        userId: req.user?.userId,
      });
      next(error);
    }
  }
}

// Export singleton instance
export const postController = new PostController();
