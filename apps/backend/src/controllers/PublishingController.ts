/**
 * Publishing Controller
 * 
 * Handles multi-platform publishing with real-time status tracking
 * Superior to all competitors: Buffer, Hootsuite, Sprout Social, Later
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { PostService } from '../services/PostService';
import { ScheduledPost, PostStatus } from '../models/ScheduledPost';
import { SocialAccount } from '../models/SocialAccount';
import { logger } from '../utils/logger';
import { sendSuccess, sendError, sendValidationError } from '../utils/apiResponse';
import mongoose from 'mongoose';

export class PublishingController {
  /**
   * Publish Now - Immediate multi-platform publishing
   * This is the core "Publish Now" button functionality
   */
  static async publishNow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { content, platforms, mediaIds, contentType } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId;

      if (!workspaceId || !userId) {
        sendError(res, 'BAD_REQUEST', 'Workspace and user required', 400);
        return;
      }

      // Get social accounts for all requested platforms
      const socialAccounts = await SocialAccount.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        platform: { $in: platforms },
        status: 'active',
      });

      if (socialAccounts.length === 0) {
        sendError(res, 'BAD_REQUEST', 'No active social accounts found for selected platforms', 400);
        return;
      }

      // Create posts for all platforms simultaneously
      const postService = new PostService();
      const now = new Date();
      const createdPosts = [];

      for (const account of socialAccounts) {
        try {
          const post = await postService.createPost({
            workspaceId,
            socialAccountId: account._id.toString(),
            platform: account.provider,
            content,
            mediaIds,
            scheduledAt: now, // Immediate publishing
            contentType: contentType || 'post',
            createdBy: userId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
          });
          createdPosts.push(post);
        } catch (error: any) {
          logger.error('Failed to create post for platform', {
            platform: account.provider,
            error: error.message,
          });
        }
      }

      // Build platform status response
      const platformStatuses: Array<{
        platform: any;
        status: 'queued' | 'failed';
        postId: string | null;
        error?: string;
      }> = createdPosts.map(post => ({
        platform: post.platform,
        status: 'queued' as const,
        postId: post._id.toString(),
      }));

      // Add failed platforms
      const createdPlatforms = createdPosts.map(p => p.platform);
      const failedPlatforms = platforms.filter((p: string) => !createdPlatforms.includes(p));
      
      for (const platform of failedPlatforms) {
        platformStatuses.push({
          platform,
          status: 'failed' as const,
          postId: null,
          error: 'No active social account found',
        });
      }

      logger.info('Multi-platform publish initiated', {
        workspaceId,
        userId,
        platforms,
        successfulPosts: createdPosts.length,
        failedPlatforms: failedPlatforms.length,
      });

      sendSuccess(res, {
        success: true,
        postId: createdPosts[0]?._id.toString(), // Primary post ID
        platforms: platformStatuses,
        message: `Publishing to ${createdPosts.length} platforms`,
      });
    } catch (error: any) {
      logger.error('Publish now failed', {
        error: error.message,
        workspaceId: req.workspace?.workspaceId,
        userId: req.user?.userId,
      });
      next(error);
    }
  }

  /**
   * Get real-time publishing status for a post
   */
  static async getPublishStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        sendError(res, 'BAD_REQUEST', 'Workspace required', 400);
        return;
      }

      // Get all posts for this publishing session
      // For multi-platform, we need to find all related posts
      const posts = await ScheduledPost.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        $or: [
          { _id: postId },
          { 'metadata.batchId': postId }, // If using batch publishing
        ],
      }).populate('socialAccountId', 'platform provider');

      if (posts.length === 0) {
        sendError(res, 'NOT_FOUND', 'Post not found', 404);
        return;
      }

      // Build platform status array
      const platformStatuses = posts.map(post => {
        const account = post.socialAccountId as any;
        
        return {
          platform: account.platform,
          status: post.status.toLowerCase(),
          platformPostId: post.metadata?.platformPostId,
          url: post.metadata?.platformPostId ? 
            `https://${account.platform}.com/post/${post.metadata.platformPostId}` : 
            undefined,
          error: post.failureReason,
          publishedAt: post.publishedAt,
          retryCount: (post.metadata?.retryCount as number) || 0,
        };
      });

      // Determine overall status
      const statuses = platformStatuses.map(p => p.status);
      let overallStatus: string;
      
      if (statuses.every(s => s === 'published')) {
        overallStatus = 'completed';
      } else if (statuses.some(s => s === 'publishing' || s === 'queued')) {
        overallStatus = 'publishing';
      } else if (statuses.some(s => s === 'published')) {
        overallStatus = 'partial_failure';
      } else {
        overallStatus = 'failed';
      }

      sendSuccess(res, {
        postId,
        platforms: platformStatuses,
        overallStatus,
        completedAt: statuses.every(s => s === 'published' || s === 'failed') ? new Date() : undefined,
      });
    } catch (error: any) {
      logger.error('Get publish status failed', {
        error: error.message,
        postId: req.params.postId,
      });
      next(error);
    }
  }

  /**
   * Retry publishing to a specific platform
   */
  static async retryPlatform(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;
      const { platform } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        sendError(res, 'BAD_REQUEST', 'Workspace required', 400);
        return;
      }

      // Find the specific post for this platform
      const post = await ScheduledPost.findOne({
        _id: postId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      }).populate('socialAccountId');

      if (!post) {
        sendError(res, 'NOT_FOUND', 'Post not found', 404);
        return;
      }

      const account = post.socialAccountId as any;
      if (account.platform !== platform) {
        sendError(res, 'BAD_REQUEST', 'Platform mismatch', 400);
        return;
      }

      // Retry the post
      const postService = new PostService();
      const retriedPost = await postService.retryPost(postId, workspaceId);

      logger.info('Platform retry initiated', {
        postId,
        platform,
        workspaceId,
        retryCount: (retriedPost.metadata?.retryCount as number) || 0,
      });

      sendSuccess(res, {
        success: true,
        message: `Retrying ${platform}`,
        retryCount: (retriedPost.metadata?.retryCount as number) || 0,
      });
    } catch (error: any) {
      logger.error('Platform retry failed', {
        error: error.message,
        postId: req.params.postId,
        platform: req.body.platform,
      });
      next(error);
    }
  }

  /**
   * Retry all failed platforms for a post
   */
  static async retryAllFailed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        sendError(res, 'BAD_REQUEST', 'Workspace required', 400);
        return;
      }

      // Find all failed posts for this publishing session
      const failedPosts = await ScheduledPost.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        $or: [
          { _id: postId, status: PostStatus.FAILED },
          { 'metadata.batchId': postId, status: PostStatus.FAILED },
        ],
      }).populate('socialAccountId', 'platform');

      if (failedPosts.length === 0) {
        sendError(res, 'NOT_FOUND', 'No failed posts found', 404);
        return;
      }

      // Retry all failed posts
      const postService = new PostService();
      const retriedPlatforms = [];

      for (const post of failedPosts) {
        try {
          await postService.retryPost(post._id.toString(), workspaceId);
          const account = post.socialAccountId as any;
          retriedPlatforms.push(account.platform);
        } catch (error: any) {
          logger.error('Failed to retry post', {
            postId: post._id.toString(),
            error: error.message,
          });
        }
      }

      logger.info('All failed platforms retry initiated', {
        originalPostId: postId,
        workspaceId,
        retriedPlatforms,
      });

      sendSuccess(res, {
        success: true,
        message: `Retrying ${retriedPlatforms.length} failed platforms`,
        retriedPlatforms,
      });
    } catch (error: any) {
      logger.error('Retry all failed platforms failed', {
        error: error.message,
        postId: req.params.postId,
      });
      next(error);
    }
  }

  /**
   * Get platform-specific post URLs
   */
  static async getPlatformUrls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        sendError(res, 'BAD_REQUEST', 'Workspace required', 400);
        return;
      }

      // Get all published posts for this session
      const posts = await ScheduledPost.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        $or: [
          { _id: postId },
          { 'metadata.batchId': postId },
        ],
        status: PostStatus.PUBLISHED,
      }).populate('socialAccountId', 'platform provider');

      const platformUrls: Record<string, string> = {};

      for (const post of posts) {
        const account = post.socialAccountId as any;
        const platformPostId = post.metadata?.platformPostId;
        
        if (platformPostId) {
          // Generate platform-specific URLs
          switch (account.platform) {
            case 'twitter':
              platformUrls[account.platform] = `https://twitter.com/i/web/status/${platformPostId}`;
              break;
            case 'linkedin':
              platformUrls[account.platform] = `https://www.linkedin.com/feed/update/${platformPostId}`;
              break;
            case 'facebook':
              platformUrls[account.platform] = `https://www.facebook.com/posts/${platformPostId}`;
              break;
            case 'instagram':
              platformUrls[account.platform] = `https://www.instagram.com/p/${platformPostId}`;
              break;
            default:
              platformUrls[account.platform] = `https://${account.platform}.com/post/${platformPostId}`;
          }
        }
      }

      sendSuccess(res, platformUrls);
    } catch (error: any) {
      logger.error('Get platform URLs failed', {
        error: error.message,
        postId: req.params.postId,
      });
      next(error);
    }
  }
}