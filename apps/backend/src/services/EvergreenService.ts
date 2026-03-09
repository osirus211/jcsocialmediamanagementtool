/**
 * Evergreen Service
 * 
 * Manages evergreen rule CRUD operations and repost creation
 * Enforces workspace isolation and content modification
 */

import mongoose from 'mongoose';
import { EvergreenRule, IEvergreenRule, ContentModification } from '../models/EvergreenRule';
import { Post } from '../models/Post';
import { logger } from '../utils/logger';

export interface CreateRuleInput {
  workspaceId: string;
  postId: string;
  repostInterval: number;
  maxReposts: number;
  enabled: boolean;
  contentModification?: ContentModification;
  createdBy: string;
}

export interface UpdateRuleInput {
  repostInterval?: number;
  maxReposts?: number;
  enabled?: boolean;
  contentModification?: ContentModification;
}

export interface ListRulesOptions {
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export class EvergreenService {
  /**
   * Create a new evergreen rule
   */
  static async createRule(input: CreateRuleInput): Promise<IEvergreenRule> {
    try {
      // Validate post exists and is published
      await this.validatePost(input.postId, input.workspaceId);

      const rule = new EvergreenRule({
        workspaceId: new mongoose.Types.ObjectId(input.workspaceId),
        postId: new mongoose.Types.ObjectId(input.postId),
        repostInterval: input.repostInterval,
        maxReposts: input.maxReposts,
        enabled: input.enabled,
        repostCount: 0,
        contentModification: input.contentModification,
        createdBy: new mongoose.Types.ObjectId(input.createdBy),
      });

      await rule.save();

      logger.info('Evergreen rule created', {
        ruleId: rule._id.toString(),
        workspaceId: input.workspaceId,
        postId: input.postId,
        repostInterval: input.repostInterval,
      });

      return rule;
    } catch (error: any) {
      logger.error('Create evergreen rule error:', {
        workspaceId: input.workspaceId,
        postId: input.postId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update an existing evergreen rule
   */
  static async updateRule(
    ruleId: string,
    workspaceId: string,
    input: UpdateRuleInput
  ): Promise<IEvergreenRule | null> {
    try {
      const rule = await EvergreenRule.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(ruleId),
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        { $set: input },
        { new: true, runValidators: true }
      );

      if (rule) {
        logger.info('Evergreen rule updated', {
          ruleId,
          workspaceId,
        });
      }

      return rule;
    } catch (error: any) {
      logger.error('Update evergreen rule error:', {
        ruleId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete an evergreen rule
   */
  static async deleteRule(ruleId: string, workspaceId: string): Promise<boolean> {
    try {
      const result = await EvergreenRule.deleteOne({
        _id: new mongoose.Types.ObjectId(ruleId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (result.deletedCount > 0) {
        logger.info('Evergreen rule deleted', {
          ruleId,
          workspaceId,
        });
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('Delete evergreen rule error:', {
        ruleId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get evergreen rule by ID
   */
  static async getRule(ruleId: string, workspaceId: string): Promise<IEvergreenRule | null> {
    try {
      return await EvergreenRule.findOne({
        _id: new mongoose.Types.ObjectId(ruleId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });
    } catch (error: any) {
      logger.error('Get evergreen rule error:', {
        ruleId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * List evergreen rules with pagination and filtering
   */
  static async listRules(
    workspaceId: string,
    options: ListRulesOptions = {}
  ): Promise<{ rules: IEvergreenRule[]; total: number; page: number; limit: number }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      const query: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };

      if (options.enabled !== undefined) {
        query.enabled = options.enabled;
      }

      const [rules, total] = await Promise.all([
        EvergreenRule.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        EvergreenRule.countDocuments(query),
      ]);

      return {
        rules: rules as any,
        total,
        page,
        limit,
      };
    } catch (error: any) {
      logger.error('List evergreen rules error:', {
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate post exists and is published
   */
  static async validatePost(postId: string, workspaceId: string): Promise<void> {
    const post = await Post.findOne({
      _id: new mongoose.Types.ObjectId(postId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!post) {
      throw new Error('Post not found');
    }

    if (post.status !== 'published') {
      throw new Error('Post must be published to create evergreen rule');
    }
  }

  /**
   * Apply content modification to post content
   * Handles prefix, suffix, and hashtag replacement
   */
  static applyContentModification(
    originalContent: string,
    modification?: ContentModification
  ): string {
    if (!modification) {
      return originalContent;
    }

    let modifiedContent = originalContent;

    // Apply hashtag replacement
    if (modification.hashtagReplacement) {
      for (const [oldHashtag, newHashtag] of Object.entries(modification.hashtagReplacement)) {
        const regex = new RegExp(`#${oldHashtag}\\b`, 'gi');
        modifiedContent = modifiedContent.replace(regex, `#${newHashtag}`);
      }
    }

    // Apply prefix
    if (modification.prefix) {
      modifiedContent = `${modification.prefix} ${modifiedContent}`;
    }

    // Apply suffix
    if (modification.suffix) {
      modifiedContent = `${modifiedContent} ${modification.suffix}`;
    }

    return modifiedContent.trim();
  }

  /**
   * Create repost from original post
   * Uses existing PostService for post creation
   * Returns the new post ID
   */
  static async createRepost(
    originalPostId: string,
    workspaceId: string,
    contentModification?: ContentModification
  ): Promise<string> {
    try {
      // Get original post
      const originalPost = await Post.findOne({
        _id: new mongoose.Types.ObjectId(originalPostId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!originalPost) {
        throw new Error('Original post not found');
      }

      // Apply content modification
      const modifiedContent = this.applyContentModification(
        originalPost.content,
        contentModification
      );

      // Create new post with modified content
      // Note: This will be integrated with PostService in the worker implementation
      const repost = new Post({
        workspaceId: originalPost.workspaceId,
        socialAccountId: originalPost.socialAccountId,
        socialAccountIds: originalPost.socialAccountIds,
        content: modifiedContent,
        platformContent: originalPost.platformContent,
        mediaUrls: originalPost.mediaUrls,
        mediaIds: originalPost.mediaIds,
        scheduledAt: new Date(), // Immediate publishing
        status: 'scheduled',
        createdBy: originalPost.createdBy,
      });

      await repost.save();

      logger.info('Evergreen repost created', {
        originalPostId,
        repostId: repost._id.toString(),
        workspaceId,
      });

      return repost._id.toString();
    } catch (error: any) {
      logger.error('Create evergreen repost error:', {
        originalPostId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }
}
