/**
 * Composer Service
 * 
 * Extends PostService with composer-specific functionality
 * 
 * Features:
 * - Create drafts
 * - Update drafts with media
 * - Schedule/Queue/Publish now
 * - Duplicate posts
 * - Cancel scheduled posts safely
 * - Queue slot calculation
 * 
 * SAFETY:
 * - Does NOT modify existing scheduler/queue logic
 * - Uses existing PostingQueue for enqueuing
 * - Idempotent operations
 * - Multi-tenant safe
 */

import { Post, IPost, PostStatus, PublishMode } from '../models/Post';
import { Media, IMedia } from '../models/Media';
import { SocialAccount } from '../models/SocialAccount';
import { PostingQueue } from '../queue/PostingQueue';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export interface CreateDraftInput {
  workspaceId: string;
  content: string;
  socialAccountIds?: string[];
  mediaIds?: string[];
  platformContent?: Array<{
    platform: string;
    text?: string;
    mediaIds?: string[];
    enabled: boolean;
  }>;
  createdBy: string;
}

export interface UpdateDraftInput {
  content?: string;
  socialAccountIds?: string[];
  mediaIds?: string[];
  platformContent?: Array<{
    platform: string;
    text?: string;
    mediaIds?: string[];
    enabled: boolean;
  }>;
}

export interface PublishInput {
  publishMode: PublishMode;
  scheduledAt?: Date;
  queueSlot?: string;
}

export class ComposerService {
  private _postingQueue: PostingQueue | null = null;

  private get postingQueue(): PostingQueue {
    if (!this._postingQueue) {
      this._postingQueue = new PostingQueue();
    }
    return this._postingQueue;
  }

  constructor() {
    // Lazy initialization of PostingQueue to avoid Redis dependency at module load time
  }

  /**
   * Create a draft post
   * Always creates with DRAFT status
   */
  async createDraft(input: CreateDraftInput): Promise<IPost> {
    try {
      // Validate social accounts belong to workspace
      const accountIds = input.socialAccountIds || [];
      
      if (accountIds.length === 0) {
        throw new BadRequestError('At least one social account is required');
      }

      const accounts = await SocialAccount.find({
        _id: { $in: accountIds },
        workspaceId: input.workspaceId,
      });

      if (accounts.length !== accountIds.length) {
        throw new BadRequestError('One or more social accounts not found or do not belong to workspace');
      }

      // Validate media belongs to workspace
      if (input.mediaIds && input.mediaIds.length > 0) {
        const media = await Media.find({
          _id: { $in: input.mediaIds },
          workspaceId: input.workspaceId,
        });

        if (media.length !== input.mediaIds.length) {
          throw new BadRequestError('One or more media files not found or do not belong to workspace');
        }
      }

      // Create post as DRAFT
      const post = new Post({
        workspaceId: input.workspaceId,
        socialAccountId: accountIds[0], // Primary account (for backward compatibility)
        socialAccountIds: accountIds.map(id => new mongoose.Types.ObjectId(id)),
        content: input.content,
        mediaIds: input.mediaIds?.map(id => new mongoose.Types.ObjectId(id)) || [],
        platformContent: input.platformContent || [],
        status: PostStatus.DRAFT,
        createdBy: input.createdBy,
        retryCount: 0,
        metadata: {},
      });

      await post.save();

      logger.info('Draft post created', {
        postId: post._id,
        workspaceId: input.workspaceId,
        accountCount: accountIds.length,
      });

      return post;
    } catch (error: any) {
      logger.error('Create draft error', { error: error.message, input });
      throw error;
    }
  }

  /**
   * Update a draft post
   * Only drafts can be updated
   */
  async updateDraft(
    postId: string,
    workspaceId: string,
    input: UpdateDraftInput
  ): Promise<IPost> {
    try {
      const post = await Post.findOne({
        _id: postId,
        workspaceId,
      });

      if (!post) {
        throw new NotFoundError('Post not found');
      }

      // Only drafts and scheduled posts can be edited
      if (!post.canBeEdited()) {
        throw new ForbiddenError(
          `Cannot edit post with status: ${post.status}. Only drafts and scheduled posts can be edited.`
        );
      }

      // Update content
      if (input.content !== undefined) {
        post.content = input.content;
      }

      // Update social accounts
      if (input.socialAccountIds !== undefined) {
        if (input.socialAccountIds.length === 0) {
          throw new BadRequestError('At least one social account is required');
        }

        const accounts = await SocialAccount.find({
          _id: { $in: input.socialAccountIds },
          workspaceId,
        });

        if (accounts.length !== input.socialAccountIds.length) {
          throw new BadRequestError('One or more social accounts not found');
        }

        post.socialAccountIds = input.socialAccountIds.map(id => new mongoose.Types.ObjectId(id));
        post.socialAccountId = new mongoose.Types.ObjectId(input.socialAccountIds[0]);
      }

      // Update media
      if (input.mediaIds !== undefined) {
        if (input.mediaIds.length > 0) {
          const media = await Media.find({
            _id: { $in: input.mediaIds },
            workspaceId,
          });

          if (media.length !== input.mediaIds.length) {
            throw new BadRequestError('One or more media files not found');
          }
        }

        post.mediaIds = input.mediaIds.map(id => new mongoose.Types.ObjectId(id));
      }

      // Update platform content
      if (input.platformContent !== undefined) {
        post.platformContent = input.platformContent;
      }

      await post.save();

      logger.info('Draft post updated', {
        postId,
        workspaceId,
      });

      return post;
    } catch (error: any) {
      logger.error('Update draft error', { error: error.message, postId });
      throw error;
    }
  }

  /**
   * Publish post (NOW, SCHEDULE, or QUEUE)
   * 
   * SAFETY:
   * - Uses existing PostingQueue
   * - Does NOT modify scheduler
   * - Idempotent
   */
  async publishPost(
    postId: string,
    workspaceId: string,
    input: PublishInput
  ): Promise<IPost> {
    try {
      const post = await Post.findOne({
        _id: postId,
        workspaceId,
      });

      if (!post) {
        throw new NotFoundError('Post not found');
      }

      // Only drafts and failed posts can be published
      if (!post.canBePublished() && post.status !== PostStatus.SCHEDULED) {
        throw new ForbiddenError(
          `Cannot publish post with status: ${post.status}`
        );
      }

      post.publishMode = input.publishMode;

      switch (input.publishMode) {
        case PublishMode.NOW:
          await this.publishNow(post);
          break;

        case PublishMode.SCHEDULE:
          if (!input.scheduledAt) {
            throw new BadRequestError('scheduledAt is required for SCHEDULE mode');
          }
          await this.schedulePost(post, input.scheduledAt);
          break;

        case PublishMode.QUEUE:
          await this.queuePost(post, workspaceId, input.queueSlot);
          break;

        default:
          throw new BadRequestError(`Invalid publish mode: ${input.publishMode}`);
      }

      await post.save();

      logger.info('Post published', {
        postId,
        workspaceId,
        publishMode: input.publishMode,
        status: post.status,
      });

      return post;
    } catch (error: any) {
      logger.error('Publish post error', { error: error.message, postId });
      throw error;
    }
  }

  /**
   * Publish immediately
   * Enqueues post using existing PostingQueue
   * 
   * MULTI-PLATFORM FANOUT:
   * - If socialAccountIds is populated, create one job per account
   * - If socialAccountIds is empty, use socialAccountId (backward compatibility)
   */
  private async publishNow(post: IPost): Promise<void> {
    // Update status to QUEUED
    post.status = PostStatus.QUEUED;
    post.scheduledAt = new Date(); // Set to now

    // MULTI-PLATFORM FANOUT: Determine which accounts to publish to
    const accountIds = post.socialAccountIds && post.socialAccountIds.length > 0
      ? post.socialAccountIds
      : [post.socialAccountId];

    // Fetch all social accounts to get platform information
    const accounts = await SocialAccount.find({
      _id: { $in: accountIds },
      workspaceId: post.workspaceId,
    });

    if (accounts.length === 0) {
      throw new BadRequestError('No valid social accounts found');
    }

    // Create one job per account/platform
    for (const account of accounts) {
      await this.postingQueue.addPost({
        postId: post._id.toString(),
        workspaceId: post.workspaceId.toString(),
        socialAccountId: account._id.toString(),
        platform: account.provider, // Include platform for idempotency
        retryCount: post.retryCount || 0,
      });

      logger.info('Post enqueued for immediate publishing', {
        postId: post._id,
        platform: account.provider,
        socialAccountId: account._id,
      });
    }
  }

  /**
   * Schedule post for future publishing
   * Scheduler will pick it up automatically
   */
  private async schedulePost(post: IPost, scheduledAt: Date): Promise<void> {
    if (scheduledAt <= new Date()) {
      throw new BadRequestError('Scheduled time must be in the future');
    }

    post.status = PostStatus.SCHEDULED;
    post.scheduledAt = scheduledAt;

    logger.info('Post scheduled', {
      postId: post._id,
      scheduledAt,
    });
  }

  /**
   * Queue post using queue slot logic
   * Calculates next available slot and schedules
   */
  private async queuePost(
    post: IPost,
    workspaceId: string,
    queueSlot?: string
  ): Promise<void> {
    // Calculate next available slot
    const nextSlot = await this.calculateNextQueueSlot(workspaceId, queueSlot);

    post.status = PostStatus.SCHEDULED;
    post.scheduledAt = nextSlot.scheduledAt;
    post.queueSlot = nextSlot.slotId;

    logger.info('Post queued', {
      postId: post._id,
      queueSlot: nextSlot.slotId,
      scheduledAt: nextSlot.scheduledAt,
    });
  }

  /**
   * Calculate next available queue slot
   * 
   * LOGIC:
   * - Default slots: Every 2 hours from 9 AM to 5 PM
   * - Finds next available slot that's not occupied
   * - Returns slot ID and scheduled time
   */
  private async calculateNextQueueSlot(
    workspaceId: string,
    preferredSlot?: string
  ): Promise<{ slotId: string; scheduledAt: Date }> {
    // Default posting times (9 AM, 11 AM, 1 PM, 3 PM, 5 PM)
    const defaultSlotHours = [9, 11, 13, 15, 17];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Generate slots for next 7 days
    const availableSlots: Array<{ slotId: string; scheduledAt: Date }> = [];

    for (let day = 0; day < 7; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() + day);

      for (const hour of defaultSlotHours) {
        const slotTime = new Date(date);
        slotTime.setHours(hour, 0, 0, 0);

        // Skip past slots
        if (slotTime <= now) {
          continue;
        }

        const slotId = `${date.toISOString().split('T')[0]}-${hour}`;
        availableSlots.push({ slotId, scheduledAt: slotTime });
      }
    }

    // Get occupied slots
    const occupiedPosts = await Post.find({
      workspaceId,
      status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
      queueSlot: { $exists: true, $ne: null },
    }).select('queueSlot scheduledAt');

    const occupiedSlots = new Set(occupiedPosts.map(p => p.queueSlot));

    // Find first available slot
    for (const slot of availableSlots) {
      if (!occupiedSlots.has(slot.slotId)) {
        return slot;
      }
    }

    // If all slots occupied, use next available time slot
    const lastSlot = availableSlots[availableSlots.length - 1];
    const nextSlotTime = new Date(lastSlot.scheduledAt);
    nextSlotTime.setHours(nextSlotTime.getHours() + 2);

    return {
      slotId: `custom-${nextSlotTime.toISOString()}`,
      scheduledAt: nextSlotTime,
    };
  }

  /**
   * Duplicate post
   * Creates new DRAFT copy
   */
  async duplicatePost(postId: string, workspaceId: string, userId: string): Promise<IPost> {
    try {
      const originalPost = await Post.findOne({
        _id: postId,
        workspaceId,
      });

      if (!originalPost) {
        throw new NotFoundError('Post not found');
      }

      // Create duplicate as DRAFT
      const duplicate = new Post({
        workspaceId: originalPost.workspaceId,
        socialAccountId: originalPost.socialAccountId,
        socialAccountIds: originalPost.socialAccountIds,
        content: originalPost.content,
        mediaIds: originalPost.mediaIds,
        platformContent: originalPost.platformContent,
        status: PostStatus.DRAFT, // Always DRAFT
        createdBy: userId,
        retryCount: 0,
        metadata: {
          duplicatedFrom: originalPost._id,
        },
      });

      await duplicate.save();

      logger.info('Post duplicated', {
        originalPostId: postId,
        duplicatePostId: duplicate._id,
        workspaceId,
      });

      return duplicate;
    } catch (error: any) {
      logger.error('Duplicate post error', { error: error.message, postId });
      throw error;
    }
  }

  /**
   * Cancel scheduled post
   * 
   * SAFETY:
   * - Removes from queue if queued
   * - Updates status to CANCELLED
   * - Idempotent
   */
  async cancelPost(postId: string, workspaceId: string): Promise<IPost> {
    try {
      const post = await Post.findOne({
        _id: postId,
        workspaceId,
      });

      if (!post) {
        throw new NotFoundError('Post not found');
      }

      // Only scheduled or queued posts can be cancelled
      if (![PostStatus.SCHEDULED, PostStatus.QUEUED].includes(post.status)) {
        throw new ForbiddenError(
          `Cannot cancel post with status: ${post.status}`
        );
      }

      // Remove from queue if queued
      if (post.status === PostStatus.QUEUED) {
        try {
          await this.postingQueue.removePost(postId);
          logger.info('Post removed from queue', { postId });
        } catch (error: any) {
          logger.warn('Failed to remove post from queue (may not be in queue)', {
            postId,
            error: error.message,
          });
        }
      }

      post.status = PostStatus.CANCELLED;
      await post.save();

      logger.info('Post cancelled', {
        postId,
        workspaceId,
      });

      return post;
    } catch (error: any) {
      logger.error('Cancel post error', { error: error.message, postId });
      throw error;
    }
  }

  /**
   * Delete post
   * 
   * SAFETY:
   * - Cannot delete published or publishing posts
   * - Removes from queue if queued
   */
  async deletePost(postId: string, workspaceId: string): Promise<void> {
    try {
      const post = await Post.findOne({
        _id: postId,
        workspaceId,
      });

      if (!post) {
        throw new NotFoundError('Post not found');
      }

      // Check if post can be deleted
      if (!post.canBeDeleted()) {
        throw new ForbiddenError(
          `Cannot delete post with status: ${post.status}`
        );
      }

      // Remove from queue if queued
      if (post.status === PostStatus.QUEUED) {
        try {
          await this.postingQueue.removePost(postId);
        } catch (error: any) {
          logger.warn('Failed to remove post from queue during delete', {
            postId,
            error: error.message,
          });
        }
      }

      await Post.deleteOne({ _id: postId });

      logger.info('Post deleted', {
        postId,
        workspaceId,
      });
    } catch (error: any) {
      logger.error('Delete post error', { error: error.message, postId });
      throw error;
    }
  }
}

// Lazy initialization to avoid Redis dependency at module load time
let composerServiceInstance: ComposerService | null = null;

export const composerService = {
  get instance(): ComposerService {
    if (!composerServiceInstance) {
      composerServiceInstance = new ComposerService();
    }
    return composerServiceInstance;
  }
};

