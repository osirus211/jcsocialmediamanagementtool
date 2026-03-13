/**
 * Draft Service
 * 
 * Business logic for draft post management
 */

import { DraftPost, IDraftPost } from '../models/DraftPost';
import { ScheduledPost, PostStatus } from '../models/ScheduledPost';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export class DraftService {
  /**
   * Create a new draft
   */
  async createDraft(data: {
    workspaceId: string;
    userId: string;
    title?: string;
    content: string;
    platforms?: string[];
    socialAccountIds?: string[];
    mediaUrls?: string[];
    mediaIds?: string[];
    scheduledAt?: Date;
    metadata?: any;
  }): Promise<IDraftPost> {
    try {
      const draft = new DraftPost({
        workspaceId: new mongoose.Types.ObjectId(data.workspaceId),
        userId: new mongoose.Types.ObjectId(data.userId),
        title: data.title,
        content: data.content,
        platforms: data.platforms || [],
        socialAccountIds: data.socialAccountIds?.map((id) => new mongoose.Types.ObjectId(id)) || [],
        mediaUrls: data.mediaUrls || [],
        mediaIds: data.mediaIds?.map((id) => new mongoose.Types.ObjectId(id)) || [],
        scheduledAt: data.scheduledAt,
        metadata: data.metadata || {},
      });

      await draft.save();

      logger.info('Draft created', {
        draftId: draft._id.toString(),
        workspaceId: data.workspaceId,
        userId: data.userId,
      });

      return draft;
    } catch (error: any) {
      logger.error('Failed to create draft', {
        error: error.message,
        workspaceId: data.workspaceId,
      });
      throw error;
    }
  }

  /**
   * Get drafts for workspace with pagination
   */
  async getDrafts(
    workspaceId: string,
    options: {
      userId?: string;
      page?: number;
      limit?: number;
      sortBy?: 'createdAt' | 'updatedAt';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ drafts: IDraftPost[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy || 'updatedAt';
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

    const query: any = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };

    if (options.userId) {
      query.userId = new mongoose.Types.ObjectId(options.userId);
    }

    const [drafts, total] = await Promise.all([
      DraftPost.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      DraftPost.countDocuments(query),
    ]);

    return {
      drafts: drafts as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get draft by ID
   */
  async getDraftById(draftId: string, workspaceId: string): Promise<IDraftPost> {
    const draft = await DraftPost.findOne({
      _id: new mongoose.Types.ObjectId(draftId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!draft) {
      throw new NotFoundError('Draft not found');
    }

    return draft;
  }

  /**
   * Update draft
   */
  async updateDraft(
    draftId: string,
    workspaceId: string,
    updates: {
      title?: string;
      content?: string;
      platforms?: string[];
      socialAccountIds?: string[];
      mediaUrls?: string[];
      mediaIds?: string[];
      scheduledAt?: Date;
      metadata?: any;
    }
  ): Promise<IDraftPost> {
    const draft = await this.getDraftById(draftId, workspaceId);

    if (updates.title !== undefined) draft.title = updates.title;
    if (updates.content !== undefined) draft.content = updates.content;
    if (updates.platforms !== undefined) draft.platforms = updates.platforms as any;
    if (updates.socialAccountIds !== undefined) {
      draft.socialAccountIds = updates.socialAccountIds.map((id) => new mongoose.Types.ObjectId(id));
    }
    if (updates.mediaUrls !== undefined) draft.mediaUrls = updates.mediaUrls;
    if (updates.mediaIds !== undefined) {
      draft.mediaIds = updates.mediaIds.map((id) => new mongoose.Types.ObjectId(id));
    }
    if (updates.scheduledAt !== undefined) draft.scheduledAt = updates.scheduledAt;
    if (updates.metadata !== undefined) {
      draft.metadata = { ...draft.metadata, ...updates.metadata };
    }

    await draft.save();

    logger.info('Draft updated', {
      draftId: draft._id.toString(),
      workspaceId,
    });

    return draft;
  }

  /**
   * Delete draft
   */
  async deleteDraft(draftId: string, workspaceId: string): Promise<void> {
    const result = await DraftPost.deleteOne({
      _id: new mongoose.Types.ObjectId(draftId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundError('Draft not found');
    }

    logger.info('Draft deleted', {
      draftId,
      workspaceId,
    });
  }

  /**
   * Convert draft to scheduled post
   */
  async scheduleFromDraft(
    draftId: string,
    workspaceId: string,
    scheduledAt: Date
  ): Promise<any[]> {
    const draft = await this.getDraftById(draftId, workspaceId);

    if (!draft.platforms || draft.platforms.length === 0) {
      throw new BadRequestError('Draft must have at least one platform selected');
    }

    if (!draft.socialAccountIds || draft.socialAccountIds.length === 0) {
      throw new BadRequestError('Draft must have at least one social account selected');
    }

    // Validate scheduled time is in the future
    if (scheduledAt <= new Date()) {
      throw new BadRequestError('Scheduled time must be in the future');
    }

    // Create scheduled posts for each platform/account combination
    const scheduledPosts: any[] = [];

    for (const socialAccountId of draft.socialAccountIds) {
      const post = new ScheduledPost({
        workspaceId: draft.workspaceId,
        socialAccountId,
        platform: draft.platforms[0], // Use first platform (can be enhanced)
        content: draft.content,
        mediaUrls: draft.mediaUrls || [],
        scheduledAt,
        status: PostStatus.SCHEDULED,
        metadata: {
          ...draft.metadata,
          draftId: draft._id.toString(),
          draftTitle: draft.title,
        },
      });

      await post.save();
      scheduledPosts.push(post);
    }

    // Optionally delete the draft after scheduling
    await this.deleteDraft(draftId, workspaceId);

    logger.info('Draft converted to scheduled posts', {
      draftId,
      workspaceId,
      postCount: scheduledPosts.length,
    });

    return scheduledPosts;
  }
}

export const draftService = new DraftService();
