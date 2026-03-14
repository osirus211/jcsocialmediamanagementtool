/**
 * Post Service
 * 
 * Business logic for managing scheduled posts
 */

import mongoose from 'mongoose';
import { ScheduledPost, PostStatus, SocialPlatform, IScheduledPost } from '../models/ScheduledPost';
import { PostPublishAttempt } from '../models/PostPublishAttempt';
import { SocialAccount } from '../models/SocialAccount';
import { PostPublishingQueue } from '../queue/PostPublishingQueue';
import { logger } from '../utils/logger';
import { recordPostScheduled } from '../config/publishingMetrics';
import { workspacePermissionService, Permission } from './WorkspacePermissionService';
import { MemberRole } from '../models/WorkspaceMember';
import { WorkspaceActivityLog, ActivityAction } from '../models/WorkspaceActivityLog';
import { ForbiddenError } from '../utils/errors';
import { workspaceService } from './WorkspaceService';

export interface CreatePostInput {
  workspaceId: string;
  socialAccountId: string;
  platform: SocialPlatform;
  content: string;
  mediaUrls?: string[]; // Deprecated: use mediaIds instead
  mediaIds?: string[]; // New: reference to Media model
  scheduledAt: Date;
  contentType?: 'post' | 'story' | 'reel';
  storyOptions?: {
    expiresAt?: Date;
    link?: string;
  };
  reelOptions?: {
    audioName?: string;
    shareToFeed?: boolean;
  };
  // Activity logging context
  createdBy?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdatePostInput {
  content?: string;
  mediaUrls?: string[]; // Deprecated: use mediaIds instead
  mediaIds?: string[]; // New: reference to Media model
  scheduledAt?: Date;
}

export interface GetPostsQuery {
  workspaceId: string;
  status?: PostStatus;
  platform?: SocialPlatform;
  socialAccountId?: string;
  createdBy?: string;
  categoryId?: string;
  campaignId?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface PostsResponse {
  posts: IScheduledPost[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class PostService {
  /**
   * Create a scheduled post
   */
  async createPost(input: CreatePostInput): Promise<IScheduledPost> {
    logger.info('Creating scheduled post', {
      workspaceId: input.workspaceId,
      platform: input.platform,
      scheduledAt: input.scheduledAt,
    });

    // Validate social account exists and belongs to workspace
    const account = await SocialAccount.findOne({
      _id: input.socialAccountId,
      workspaceId: input.workspaceId,
      platform: input.platform,
    });

    if (!account) {
      throw new Error('Social account not found or does not belong to workspace');
    }

    // Resolve media IDs to URLs if provided
    let mediaUrls = input.mediaUrls || [];
    if (input.mediaIds && input.mediaIds.length > 0) {
      mediaUrls = await this.resolveMediaIds(input.mediaIds, input.workspaceId);
    }

    // Create post
    const post = await ScheduledPost.create({
      workspaceId: new mongoose.Types.ObjectId(input.workspaceId),
      socialAccountId: new mongoose.Types.ObjectId(input.socialAccountId),
      platform: input.platform,
      content: input.content,
      mediaUrls,
      scheduledAt: input.scheduledAt,
      status: PostStatus.SCHEDULED,
      contentType: input.contentType || 'post',
      storyOptions: input.storyOptions,
      reelOptions: input.reelOptions,
      createdBy: input.createdBy ? new mongoose.Types.ObjectId(input.createdBy) : undefined,
    });

    // Enqueue delayed job immediately
    await this.enqueuePost(post);

    // Record metric
    recordPostScheduled(input.platform);

    // Log activity
    if (input.createdBy) {
      await WorkspaceActivityLog.create({
        workspaceId: new mongoose.Types.ObjectId(input.workspaceId),
        userId: new mongoose.Types.ObjectId(input.createdBy),
        action: ActivityAction.POST_CREATED,
        resourceType: 'ScheduledPost',
        resourceId: post._id,
        details: {
          platform: input.platform,
          contentType: input.contentType || 'post',
          scheduledAt: input.scheduledAt.toISOString(),
          hasMedia: mediaUrls.length > 0,
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
    }

    // Check if approval is required and auto-approve if not
    await this.handleApprovalWorkflow(post);

    logger.info('Scheduled post created and enqueued', {
      postId: post._id.toString(),
      workspaceId: input.workspaceId,
      platform: input.platform,
      scheduledAt: input.scheduledAt,
    });

    return post;
  }

  /**
   * Handle approval workflow for new posts
   */
  private async handleApprovalWorkflow(post: IScheduledPost): Promise<void> {
    const { approvalQueueService } = await import('./ApprovalQueueService');
    await approvalQueueService.autoApproveIfNotRequired(post._id);
  }

  /**
   * Resolve media IDs to storage URLs
   */
  private async resolveMediaIds(mediaIds: string[], workspaceId: string): Promise<string[]> {
    const { Media } = await import('../models/Media');
    
    const mediaRecords = await Media.find({
      _id: { $in: mediaIds.map(id => new mongoose.Types.ObjectId(id)) },
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      status: 'uploaded',
    });

    if (mediaRecords.length !== mediaIds.length) {
      throw new Error('One or more media files not found or not uploaded');
    }

    return mediaRecords.map(media => media.storageUrl);
  }

  /**
   * Enqueue a post for publishing with delay
   */
  private async enqueuePost(post: IScheduledPost): Promise<void> {
    const { PostPublishingQueue } = await import('../queue/PostPublishingQueue');
    const postPublishingQueue = new PostPublishingQueue();

    const now = Date.now();
    const scheduledTime = post.scheduledAt.getTime();
    const delay = Math.max(0, scheduledTime - now); // Delay in milliseconds

    // Update post status to queued with timestamp
    post.status = PostStatus.QUEUED;
    post.queuedAt = new Date();
    await post.save();

    // Add delayed job to publishing queue
    await postPublishingQueue.add(
      'publish-post',
      {
        postId: post._id.toString(),
        socialAccountId: post.socialAccountId.toString(),
        platform: post.platform,
        content: post.content,
        mediaUrls: post.mediaUrls,
        attemptNumber: 1,
      },
      {
        jobId: `post:${post._id.toString()}`, // Prevent duplicate jobs
        delay, // Delay until scheduled time
        priority: delay > 3600000 ? 10 : 5, // Lower priority for far future posts
      }
    );

    logger.info('Post enqueued with delay', {
      postId: post._id.toString(),
      platform: post.platform,
      scheduledAt: post.scheduledAt,
      delay,
      delayMinutes: Math.round(delay / 60000),
    });
  }

  /**
   * Get posts with pagination
   */
  async getPosts(query: GetPostsQuery): Promise<PostsResponse> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {
      workspaceId: new mongoose.Types.ObjectId(query.workspaceId),
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.platform) {
      filter.platform = query.platform;
    }

    if (query.socialAccountId) {
      filter.socialAccountId = new mongoose.Types.ObjectId(query.socialAccountId);
    }

    if (query.createdBy) {
      filter.createdBy = new mongoose.Types.ObjectId(query.createdBy);
    }

    if (query.categoryId) {
      filter.categoryId = new mongoose.Types.ObjectId(query.categoryId);
    }

    if (query.campaignId) {
      filter.campaignId = new mongoose.Types.ObjectId(query.campaignId);
    }

    if (query.tags && query.tags.length > 0) {
      filter.tags = { $in: query.tags };
    }

    // Execute query
    const [posts, total] = await Promise.all([
      ScheduledPost.find(filter)
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('socialAccountId', 'platform username profilePicture'),
      ScheduledPost.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    logger.debug('Posts fetched', {
      workspaceId: query.workspaceId,
      total,
      page,
      limit,
      totalPages,
    });

    return {
      posts,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get post by ID
   */
  async getPostById(postId: string, workspaceId: string): Promise<IScheduledPost> {
    const post = await ScheduledPost.findOne({
      _id: postId,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    }).populate('socialAccountId', 'platform username profilePicture');

    if (!post) {
      throw new Error('Post not found');
    }

    return post;
  }

  /**
   * Get post with publish attempts
   */
  async getPostWithAttempts(postId: string, workspaceId: string): Promise<{
    post: IScheduledPost;
    attempts: any[];
  }> {
    const post = await this.getPostById(postId, workspaceId);

    const attempts = await PostPublishAttempt.find({
      postId: new mongoose.Types.ObjectId(postId),
    }).sort({ attemptNumber: 1 });

    return {
      post,
      attempts,
    };
  }

  /**
   * Update scheduled post
   */
  async updatePost(
    postId: string,
    workspaceId: string,
    userId: string,
    userRole: MemberRole,
    input: UpdatePostInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IScheduledPost> {
    const post = await ScheduledPost.findOne({
      _id: postId,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!post) {
      throw new Error('Post not found');
    }

    // Check permission to edit post
    const canEdit = workspacePermissionService.canPerformAction({
      role: userRole,
      permission: Permission.EDIT_POST,
      resourceOwnerId: post.createdBy?.toString(),
      userId
    });

    if (!canEdit) {
      throw new ForbiddenError('Insufficient permissions to edit this post');
    }

    // Only allow updates for scheduled posts
    if (post.status !== PostStatus.SCHEDULED) {
      throw new Error(`Cannot update post with status: ${post.status}`);
    }

    // Update fields
    if (input.content !== undefined) {
      post.content = input.content;
    }

    if (input.mediaUrls !== undefined) {
      post.mediaUrls = input.mediaUrls;
    }

    if (input.scheduledAt !== undefined) {
      post.scheduledAt = input.scheduledAt;
    }

    await post.save();

    // Log activity
    await WorkspaceActivityLog.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      userId: new mongoose.Types.ObjectId(userId),
      action: ActivityAction.POST_UPDATED,
      resourceType: 'ScheduledPost',
      resourceId: post._id,
      details: {
        platform: post.platform,
        changes: {
          content: input.content !== undefined,
          mediaUrls: input.mediaUrls !== undefined,
          scheduledAt: input.scheduledAt !== undefined,
        },
      },
      ipAddress,
      userAgent,
    });

    logger.info('Post updated', {
      postId: post._id.toString(),
      workspaceId,
      userId,
    });

    return post;
  }

  /**
   * Delete scheduled post
   */
  async deletePost(
    postId: string, 
    workspaceId: string, 
    userId: string, 
    userRole: MemberRole,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const post = await ScheduledPost.findOne({
      _id: postId,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!post) {
      throw new Error('Post not found');
    }

    // Check permission to delete post
    const canDelete = workspacePermissionService.canPerformAction({
      role: userRole,
      permission: Permission.DELETE_POST,
      resourceOwnerId: post.createdBy?.toString(),
      userId
    });

    if (!canDelete) {
      throw new ForbiddenError('Insufficient permissions to delete this post');
    }

    // Only allow deletion for scheduled or failed posts
    if (post.status !== PostStatus.SCHEDULED && post.status !== PostStatus.FAILED) {
      throw new Error(`Cannot delete post with status: ${post.status}`);
    }

    await post.deleteOne();

    // Log activity
    await WorkspaceActivityLog.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      userId: new mongoose.Types.ObjectId(userId),
      action: ActivityAction.POST_DELETED,
      resourceType: 'ScheduledPost',
      resourceId: new mongoose.Types.ObjectId(postId),
      details: {
        platform: post.platform,
        wasScheduled: post.status === PostStatus.SCHEDULED,
      },
      ipAddress,
      userAgent,
    });

    logger.info('Post deleted', {
      postId: post._id.toString(),
      workspaceId,
      userId,
    });
  }

  /**
   * Retry failed post
   */
  async retryPost(postId: string, workspaceId: string): Promise<IScheduledPost> {
    const post = await ScheduledPost.findOne({
      _id: postId,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!post) {
      throw new Error('Post not found');
    }

    // Only allow retry for failed posts
    if (post.status !== PostStatus.FAILED) {
      throw new Error(`Cannot retry post with status: ${post.status}`);
    }

    // Reset post to scheduled status
    post.status = PostStatus.SCHEDULED;
    post.failureReason = undefined;
    post.failedAt = undefined;
    post.queuedAt = undefined;
    post.publishingStartedAt = undefined;

    // Set scheduled time to now (will be picked up immediately)
    post.scheduledAt = new Date();

    await post.save();

    logger.info('Post retry scheduled', {
      postId: post._id.toString(),
      workspaceId,
    });

    return post;
  }

  /**
   * Get post statistics for workspace
   */
  async getPostStats(workspaceId: string): Promise<{
    total: number;
    scheduled: number;
    queued: number;
    publishing: number;
    published: number;
    failed: number;
  }> {
    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);

    const [total, scheduled, queued, publishing, published, failed] = await Promise.all([
      ScheduledPost.countDocuments({ workspaceId: workspaceObjectId }),
      ScheduledPost.countDocuments({ workspaceId: workspaceObjectId, status: PostStatus.SCHEDULED }),
      ScheduledPost.countDocuments({ workspaceId: workspaceObjectId, status: PostStatus.QUEUED }),
      ScheduledPost.countDocuments({ workspaceId: workspaceObjectId, status: PostStatus.PUBLISHING }),
      ScheduledPost.countDocuments({ workspaceId: workspaceObjectId, status: PostStatus.PUBLISHED }),
      ScheduledPost.countDocuments({ workspaceId: workspaceObjectId, status: PostStatus.FAILED }),
    ]);

    return {
      total,
      scheduled,
      queued,
      publishing,
      published,
      failed,
    };
  }
  /**
   * Get calendar view of posts
   */
  async getCalendar(query: {
    workspaceId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{
    dates: Array<{
      date: string;
      posts: IScheduledPost[];
      count: number;
    }>;
  }> {
    const posts = await ScheduledPost.find({
      workspaceId: new mongoose.Types.ObjectId(query.workspaceId),
      scheduledAt: {
        $gte: query.startDate,
        $lte: query.endDate,
      },
    })
      .sort({ scheduledAt: 1 })
      .populate('socialAccountId', 'platform username profilePicture');

    // Group posts by date
    const dateMap = new Map<string, IScheduledPost[]>();

    for (const post of posts) {
      const dateKey = post.scheduledAt.toISOString().split('T')[0];
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(post);
    }

    // Convert to array
    const dates = Array.from(dateMap.entries()).map(([date, posts]) => ({
      date,
      posts,
      count: posts.length,
    }));

    logger.debug('Calendar data fetched', {
      workspaceId: query.workspaceId,
      startDate: query.startDate,
      endDate: query.endDate,
      totalDates: dates.length,
      totalPosts: posts.length,
    });

    return { dates };
  }

  /**
   * Get post history with filters
   */
  async getHistory(query: {
    workspaceId: string;
    status?: PostStatus;
    platform?: SocialPlatform;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<PostsResponse> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {
      workspaceId: new mongoose.Types.ObjectId(query.workspaceId),
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.platform) {
      filter.platform = query.platform;
    }

    if (query.startDate || query.endDate) {
      filter.scheduledAt = {};
      if (query.startDate) {
        filter.scheduledAt.$gte = query.startDate;
      }
      if (query.endDate) {
        filter.scheduledAt.$lte = query.endDate;
      }
    }

    // Execute query
    const [posts, total] = await Promise.all([
      ScheduledPost.find(filter)
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('socialAccountId', 'platform username profilePicture'),
      ScheduledPost.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    logger.debug('History fetched', {
      workspaceId: query.workspaceId,
      total,
      page,
      limit,
      totalPages,
    });

    return {
      posts,
      total,
      page,
      limit,
      totalPages,
    };
  }


    /**
     * Bulk delete posts
     */
    async bulkDeletePosts(
    postIds: string[], 
    workspaceId: string, 
    userId: string, 
    userRole: MemberRole
  ): Promise<{
      deleted: number;
      failed: Array<{ postId: string; reason: string }>;
    }> {
      // Check if user has bulk delete permission
      if (!workspacePermissionService.hasPermission(userRole, Permission.DELETE_POST)) {
        throw new ForbiddenError('Insufficient permissions to bulk delete posts');
      }

      logger.info('Bulk deleting posts', {
        workspaceId,
        userId,
        count: postIds.length,
      });

      const deleted: string[] = [];
      const failed: Array<{ postId: string; reason: string }> = [];

      for (const postId of postIds) {
        try {
          await this.deletePost(postId, workspaceId, userId, userRole);
          deleted.push(postId);
        } catch (error: any) {
          failed.push({
            postId,
            reason: error.message || 'Unknown error',
          });
        }
      }

      logger.info('Bulk delete completed', {
        workspaceId,
        userId,
        deleted: deleted.length,
        failed: failed.length,
      });

      return {
        deleted: deleted.length,
        failed,
      };
    }

    /**
     * Bulk reschedule posts
     */
    async bulkReschedulePosts(
      postIds: string[],
      scheduledAt: Date,
      workspaceId: string,
      userId: string,
      userRole: MemberRole
    ): Promise<{
      updated: number;
      failed: Array<{ postId: string; reason: string }>;
    }> {
      logger.info('Bulk rescheduling posts', {
        workspaceId,
        userId,
        count: postIds.length,
        newScheduledAt: scheduledAt,
      });

      const updated: string[] = [];
      const failed: Array<{ postId: string; reason: string }> = [];

      for (const postId of postIds) {
        try {
          await this.updatePost(postId, workspaceId, userId, userRole, { scheduledAt });
          updated.push(postId);
        } catch (error: any) {
          failed.push({
            postId,
            reason: error.message || 'Unknown error',
          });
        }
      }

      logger.info('Bulk reschedule completed', {
        workspaceId,
        userId,
        updated: updated.length,
        failed: failed.length,
      });

      return {
        updated: updated.length,
        failed,
      };
    }

    /**
     * Bulk update post status
     */
    async bulkUpdateStatus(
      postIds: string[],
      status: PostStatus,
      workspaceId: string
    ): Promise<{
      updated: number;
      failed: Array<{ postId: string; reason: string }>;
    }> {
      logger.info('Bulk updating post status', {
        workspaceId,
        count: postIds.length,
        newStatus: status,
      });

      const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);
      const updated: string[] = [];
      const failed: Array<{ postId: string; reason: string }> = [];

      for (const postId of postIds) {
        try {
          const post = await ScheduledPost.findOne({
            _id: postId,
            workspaceId: workspaceObjectId,
          });

          if (!post) {
            failed.push({
              postId,
              reason: 'Post not found',
            });
            continue;
          }

          // Validate status transition
          if (status === PostStatus.SCHEDULED && post.status !== PostStatus.FAILED) {
            failed.push({
              postId,
              reason: 'Can only reschedule failed posts',
            });
            continue;
          }

          post.status = status;
          await post.save();
          updated.push(postId);
        } catch (error: any) {
          failed.push({
            postId,
            reason: error.message || 'Unknown error',
          });
        }
      }

      logger.info('Bulk status update completed', {
        workspaceId,
        updated: updated.length,
        failed: failed.length,
      });

      return {
        updated: updated.length,
        failed,
      };
    }

  /**
   * Duplicate post to multiple platforms
   */
  async duplicatePost(
    postId: string,
    workspaceId: string,
    platforms: SocialPlatform[],
    scheduledAt?: Date
  ): Promise<{
    created: IScheduledPost[];
    failed: Array<{ platform: SocialPlatform; reason: string }>;
  }> {
    logger.info('Duplicating post', {
      postId,
      workspaceId,
      platforms,
      scheduledAt,
    });

    // Get original post
    const originalPost = await ScheduledPost.findOne({
      _id: postId,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!originalPost) {
      throw new Error('Post not found');
    }

    const created: IScheduledPost[] = [];
    const failed: Array<{ platform: SocialPlatform; reason: string }> = [];

    // Duplicate to each platform
    for (const platform of platforms) {
      try {
        // Find social account for this platform
        const account = await SocialAccount.findOne({
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          platform,
        });

        if (!account) {
          failed.push({
            platform,
            reason: `No connected account found for ${platform}`,
          });
          continue;
        }

        // Create duplicate post
        const duplicatePost = await ScheduledPost.create({
          workspaceId: originalPost.workspaceId,
          socialAccountId: account._id,
          platform,
          content: originalPost.content,
          mediaUrls: originalPost.mediaUrls,
          scheduledAt: scheduledAt || originalPost.scheduledAt,
          status: PostStatus.SCHEDULED,
        });

        // Enqueue delayed job
        await this.enqueuePost(duplicatePost);

        created.push(duplicatePost);

        logger.info('Post duplicated', {
          originalPostId: postId,
          duplicatePostId: duplicatePost._id.toString(),
          platform,
        });
      } catch (error: any) {
        failed.push({
          platform,
          reason: error.message || 'Unknown error',
        });
      }
    }

    logger.info('Post duplication completed', {
      postId,
      workspaceId,
      created: created.length,
      failed: failed.length,
    });

    return {
      created,
      failed,
    };
  }

  /**
   * Lock a post to prevent editing
   */
  async lockPost(postId: string, userId: string, reason?: string): Promise<{ message: string }> {
    const post = await ScheduledPost.findById(postId);
    
    if (!post) {
      throw new Error('Post not found');
    }

    // Set permanent lock (no expiration)
    (post as any).lockedBy = userId as any;
    (post as any).lockedAt = new Date();
    (post as any).lockExpiresAt = undefined; // Permanent lock
    (post as any).lockedReason = reason;

    await post.save();

    logger.info('Post locked', {
      postId,
      userId,
      reason,
    });

    return { message: 'Post locked successfully' };
  }

  /**
   * Unlock a post
   */
  async unlockPost(postId: string): Promise<{ message: string }> {
    const post = await ScheduledPost.findById(postId);
    
    if (!post) {
      throw new Error('Post not found');
    }

    // Clear lock fields
    (post as any).lockedBy = undefined;
    (post as any).lockedAt = undefined;
    (post as any).lockExpiresAt = undefined;
    (post as any).lockedReason = undefined;

    await post.save();

    logger.info('Post unlocked', {
      postId,
    });

    return { message: 'Post unlocked successfully' };
  }

  /**
   * Get post lock status
   */
  async getLockStatus(postId: string): Promise<{
    isLocked: boolean;
    lockedBy?: { name: string; avatar?: string };
    lockedAt?: Date;
    lockedReason?: string;
  }> {
    const post = await ScheduledPost.findById(postId).populate('lockedBy', 'name avatar');
    
    if (!post) {
      throw new Error('Post not found');
    }

    const isLocked = (post as any).isEditLocked();
    
    return {
      isLocked,
      lockedBy: (post as any).lockedBy ? {
        name: ((post as any).lockedBy as any).name,
        avatar: ((post as any).lockedBy as any).avatar,
      } : undefined,
      lockedAt: (post as any).lockedAt,
      lockedReason: (post as any).lockedReason,
    };
  }

  /**
   * Create multiple scheduled posts in bulk
   */
  static async bulkCreatePosts(
    workspaceId: string,
    userId: string,
    posts: CreatePostInput[]
  ): Promise<IScheduledPost[]> {
    logger.info('Creating bulk scheduled posts', {
      workspaceId,
      userId,
      count: posts.length,
    });

    // Validate all posts before creating any
    for (const post of posts) {
      if (!post.workspaceId || post.workspaceId !== workspaceId) {
        throw new Error('All posts must belong to the same workspace');
      }
    }

    // Create all posts in parallel
    const postService = new PostService();
    const createdPosts = await Promise.all(
      posts.map(async (postInput) => {
        try {
          return await postService.createPost(postInput);
        } catch (error) {
          logger.error('Failed to create post in bulk operation', {
            workspaceId,
            error: error.message,
            postInput,
          });
          throw error;
        }
      })
    );

    logger.info('Bulk post creation completed', {
      workspaceId,
      userId,
      created: createdPosts.length,
    });

    return createdPosts;
  }

    /**
     * Get eligible posts for queue processing
     */
    async getEligiblePostsForQueue(limit: number = 100): Promise<IScheduledPost[]> {
      const posts = await ScheduledPost.find({
        status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
        scheduledAt: { $lte: new Date() },
        isActive: true,
      })
      .sort({ scheduledAt: 1, priority: -1 })
      .limit(limit)
      .populate('workspaceId')
      .populate('socialAccountId');

      return posts;
    }

    /**
     * Update post status
     */
    async updatePostStatus(postId: string, status: PostStatus): Promise<IScheduledPost> {
      const post = await ScheduledPost.findByIdAndUpdate(
        postId,
        {
          status,
          updatedAt: new Date(),
          ...(status === PostStatus.PUBLISHED && { publishedAt: new Date() }),
          ...(status === PostStatus.FAILED && { failedAt: new Date() }),
        },
        { new: true }
      );

      if (!post) {
        throw new Error('Post not found');
      }

      return post;
    }

}

// Export singleton instance
export const postService = new PostService();
