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
    });

    // Enqueue delayed job immediately
    await this.enqueuePost(post);

    // Record metric
    recordPostScheduled(input.platform);

    logger.info('Scheduled post created and enqueued', {
      postId: post._id.toString(),
      workspaceId: input.workspaceId,
      platform: input.platform,
      scheduledAt: input.scheduledAt,
    });

    return post;
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
    input: UpdatePostInput
  ): Promise<IScheduledPost> {
    const post = await ScheduledPost.findOne({
      _id: postId,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!post) {
      throw new Error('Post not found');
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

    logger.info('Post updated', {
      postId: post._id.toString(),
      workspaceId,
    });

    return post;
  }

  /**
   * Delete scheduled post
   */
  async deletePost(postId: string, workspaceId: string): Promise<void> {
    const post = await ScheduledPost.findOne({
      _id: postId,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!post) {
      throw new Error('Post not found');
    }

    // Only allow deletion for scheduled or failed posts
    if (post.status !== PostStatus.SCHEDULED && post.status !== PostStatus.FAILED) {
      throw new Error(`Cannot delete post with status: ${post.status}`);
    }

    await post.deleteOne();

    logger.info('Post deleted', {
      postId: post._id.toString(),
      workspaceId,
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
    async bulkDeletePosts(postIds: string[], workspaceId: string): Promise<{
      deleted: number;
      failed: Array<{ postId: string; reason: string }>;
    }> {
      logger.info('Bulk deleting posts', {
        workspaceId,
        count: postIds.length,
      });

      const deleted: string[] = [];
      const failed: Array<{ postId: string; reason: string }> = [];

      for (const postId of postIds) {
        try {
          await this.deletePost(postId, workspaceId);
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
      workspaceId: string
    ): Promise<{
      updated: number;
      failed: Array<{ postId: string; reason: string }>;
    }> {
      logger.info('Bulk rescheduling posts', {
        workspaceId,
        count: postIds.length,
        newScheduledAt: scheduledAt,
      });

      const updated: string[] = [];
      const failed: Array<{ postId: string; reason: string }> = [];

      for (const postId of postIds) {
        try {
          await this.updatePost(postId, workspaceId, { scheduledAt });
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
    const post = await Post.findById(postId);
    
    if (!post) {
      throw new Error('Post not found');
    }

    // Set permanent lock (no expiration)
    post.lockedBy = userId as any;
    post.lockedAt = new Date();
    post.lockExpiresAt = undefined; // Permanent lock
    post.lockedReason = reason;

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
    const post = await Post.findById(postId);
    
    if (!post) {
      throw new Error('Post not found');
    }

    // Clear lock fields
    post.lockedBy = undefined;
    post.lockedAt = undefined;
    post.lockExpiresAt = undefined;
    post.lockedReason = undefined;

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
    const post = await Post.findById(postId).populate('lockedBy', 'name avatar');
    
    if (!post) {
      throw new Error('Post not found');
    }

    const isLocked = post.isEditLocked();
    
    return {
      isLocked,
      lockedBy: post.lockedBy ? {
        name: (post.lockedBy as any).name,
        avatar: (post.lockedBy as any).avatar,
      } : undefined,
      lockedAt: post.lockedAt,
      lockedReason: post.lockedReason,
    };
  }

}

// Export singleton instance
export const postService = new PostService();
