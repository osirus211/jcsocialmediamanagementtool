/**
 * Evergreen Service
 * 
 * Manages evergreen rule CRUD operations and repost creation
 * Enforces workspace isolation and content modification
 */

import mongoose from 'mongoose';
import { EvergreenRule, IEvergreenRule, ContentModification, RecyclingSchedule, RecyclingHistoryEntry } from '../models/EvergreenRule';
import { Post } from '../models/Post';
import { logger } from '../utils/logger';
import { WorkspaceActivityLog, ActivityAction } from '../models/WorkspaceActivityLog';

export interface CreateRuleInput {
  workspaceId: string;
  postId: string;
  repostInterval: number;
  maxReposts: number;
  enabled: boolean;
  paused?: boolean;
  recyclingSchedule: RecyclingSchedule;
  minDaysBetweenRecycles?: number;
  autoStopAfterPosts?: number;
  contentModification?: ContentModification;
  createdBy: string;
}

export interface UpdateRuleInput {
  repostInterval?: number;
  maxReposts?: number;
  enabled?: boolean;
  paused?: boolean;
  recyclingSchedule?: RecyclingSchedule;
  minDaysBetweenRecycles?: number;
  autoStopAfterPosts?: number;
  contentModification?: ContentModification;
}

export interface ListRulesOptions {
  page?: number;
  limit?: number;
  enabled?: boolean;
  paused?: boolean;
  sortBy?: 'createdAt' | 'lastRepostedAt' | 'repostCount' | 'averageEngagement';
  sortOrder?: 'asc' | 'desc';
}

export interface EvergreenLibraryOptions {
  page?: number;
  limit?: number;
  sortBy?: 'performance' | 'recentActivity' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  performanceThreshold?: number;
}

export interface PerformanceMetrics {
  views?: number;
  likes?: number;
  shares?: number;
  comments?: number;
  clicks?: number;
  engagement?: number;
}

export class EvergreenService {
  /**
   * Create a new evergreen rule
   */
  static async createRule(input: CreateRuleInput): Promise<IEvergreenRule> {
    try {
      const existingCount = await EvergreenRule.countDocuments({
        workspaceId: new mongoose.Types.ObjectId(input.workspaceId),
        deletedAt: { $exists: false },
      });

      if (existingCount >= 50) {
        throw new Error('Maximum of 50 evergreen rules allowed per workspace');
      }

      // Validate post exists and is published
      await this.validatePost(input.postId, input.workspaceId);

      const rule = new EvergreenRule({
        workspaceId: new mongoose.Types.ObjectId(input.workspaceId),
        postId: new mongoose.Types.ObjectId(input.postId),
        repostInterval: input.repostInterval,
        maxReposts: input.maxReposts,
        enabled: input.enabled,
        paused: input.paused || false,
        repostCount: 0,
        recyclingSchedule: input.recyclingSchedule,
        minDaysBetweenRecycles: input.minDaysBetweenRecycles || 30,
        autoStopAfterPosts: input.autoStopAfterPosts,
        contentModification: input.contentModification,
        recyclingHistory: [],
        totalPerformance: {
          totalViews: 0,
          totalLikes: 0,
          totalShares: 0,
          totalComments: 0,
          totalClicks: 0,
          averageEngagement: 0,
        },
        createdBy: new mongoose.Types.ObjectId(input.createdBy),
      });

      await rule.save();

      WorkspaceActivityLog.create({
        workspaceId: new mongoose.Types.ObjectId(input.workspaceId),
        userId: new mongoose.Types.ObjectId(input.createdBy),
        action: ActivityAction.EVERGREEN_RULE_CREATED,
        details: { ruleId: rule._id.toString() }
      }).catch(() => {});

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
        WorkspaceActivityLog.create({
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          userId: new mongoose.Types.ObjectId('000000000000000000000000'),
          action: ActivityAction.EVERGREEN_RULE_DELETED,
          details: { ruleId }
        }).catch(() => {});

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
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'desc';

      const query: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };

      if (options.enabled !== undefined) {
        query.enabled = options.enabled;
      }

      if (options.paused !== undefined) {
        query.paused = options.paused;
      }

      // Build sort object
      const sort: any = {};
      if (sortBy === 'averageEngagement') {
        sort['totalPerformance.averageEngagement'] = sortOrder === 'asc' ? 1 : -1;
      } else {
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      }

      const [rules, total] = await Promise.all([
        EvergreenRule.find(query)
          .populate('postId', 'content mediaUrls createdAt')
          .sort(sort)
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
   * Pause recycling for a specific rule
   */
  static async pauseRule(ruleId: string, workspaceId: string): Promise<boolean> {
    try {
      const result = await EvergreenRule.updateOne(
        {
          _id: new mongoose.Types.ObjectId(ruleId),
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        { $set: { paused: true } }
      );

      if (result.modifiedCount > 0) {
        logger.info('Evergreen rule paused', { ruleId, workspaceId });
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('Pause evergreen rule error:', {
        ruleId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Resume recycling for a specific rule
   */
  static async resumeRule(ruleId: string, workspaceId: string): Promise<boolean> {
    try {
      const result = await EvergreenRule.updateOne(
        {
          _id: new mongoose.Types.ObjectId(ruleId),
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        { $set: { paused: false } }
      );

      if (result.modifiedCount > 0) {
        logger.info('Evergreen rule resumed', { ruleId, workspaceId });
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('Resume evergreen rule error:', {
        ruleId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get recycling history for a specific rule
   */
  static async getRecyclingHistory(
    ruleId: string,
    workspaceId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ history: RecyclingHistoryEntry[]; total: number; page: number; limit: number }> {
    try {
      const rule = await EvergreenRule.findOne({
        _id: new mongoose.Types.ObjectId(ruleId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!rule) {
        throw new Error('Evergreen rule not found');
      }

      const skip = (page - 1) * limit;
      const history = rule.recyclingHistory
        .sort((a, b) => b.repostedAt.getTime() - a.repostedAt.getTime())
        .slice(skip, skip + limit);

      return {
        history,
        total: rule.recyclingHistory.length,
        page,
        limit,
      };
    } catch (error: any) {
      logger.error('Get recycling history error:', {
        ruleId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if enough time has passed since last repost based on minDaysBetweenRecycles
   */
  static canRecyclePost(rule: IEvergreenRule): boolean {
    if (!rule.lastRepostedAt) {
      return true;
    }

    const daysSinceLastRepost = Math.floor(
      (Date.now() - rule.lastRepostedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceLastRepost >= rule.minDaysBetweenRecycles;
  }

  /**
   * Check if rule should auto-stop based on autoStopAfterPosts
   */
  static shouldAutoStop(rule: IEvergreenRule): boolean {
    if (!rule.autoStopAfterPosts) {
      return false;
    }

    return rule.repostCount >= rule.autoStopAfterPosts;
  }

  /**
   * Get evergreen content library view with performance metrics
   */
  static async getEvergreenLibrary(
    workspaceId: string,
    options: EvergreenLibraryOptions = {}
  ): Promise<{
    rules: Array<IEvergreenRule & { post: any }>;
    total: number;
    page: number;
    limit: number;
    topPerformers: Array<IEvergreenRule & { post: any }>;
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;
      const sortBy = options.sortBy || 'performance';
      const sortOrder = options.sortOrder || 'desc';

      const query: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        enabled: true,
      };

      // Apply performance threshold filter
      if (options.performanceThreshold) {
        query['totalPerformance.averageEngagement'] = { $gte: options.performanceThreshold };
      }

      // Build sort object
      const sort: any = {};
      switch (sortBy) {
        case 'performance':
          sort['totalPerformance.averageEngagement'] = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'recentActivity':
          sort['lastRepostedAt'] = sortOrder === 'asc' ? 1 : -1;
          break;
        default:
          sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      }

      const [rules, total, topPerformers] = await Promise.all([
        EvergreenRule.find(query)
          .populate('postId', 'content mediaUrls createdAt status')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        EvergreenRule.countDocuments(query),
        EvergreenRule.find(query)
          .populate('postId', 'content mediaUrls createdAt status')
          .sort({ 'totalPerformance.averageEngagement': -1 })
          .limit(5)
          .lean(),
      ]);

      return {
        rules: rules.map(rule => ({ ...rule, post: rule.postId })) as any,
        total,
        page,
        limit,
        topPerformers: topPerformers.map(rule => ({ ...rule, post: rule.postId })) as any,
      };
    } catch (error: any) {
      logger.error('Get evergreen library error:', {
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update performance metrics for a recycled post
   */
  static async updatePerformanceMetrics(
    ruleId: string,
    workspaceId: string,
    repostId: string,
    metrics: PerformanceMetrics
  ): Promise<boolean> {
    try {
      const rule = await EvergreenRule.findOne({
        _id: new mongoose.Types.ObjectId(ruleId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!rule) {
        throw new Error('Evergreen rule not found');
      }

      // Find the history entry for this repost
      const historyEntry = rule.recyclingHistory.find(entry => entry.repostId === repostId);
      if (!historyEntry) {
        throw new Error('Recycling history entry not found');
      }

      // Update the performance metrics for this specific repost
      historyEntry.performance = {
        views: metrics.views || 0,
        likes: metrics.likes || 0,
        shares: metrics.shares || 0,
        comments: metrics.comments || 0,
        clicks: metrics.clicks || 0,
        engagement: metrics.engagement || 0,
      };

      // Recalculate total performance metrics
      const totalMetrics = rule.recyclingHistory.reduce(
        (acc, entry) => {
          if (entry.performance) {
            acc.totalViews += entry.performance.views || 0;
            acc.totalLikes += entry.performance.likes || 0;
            acc.totalShares += entry.performance.shares || 0;
            acc.totalComments += entry.performance.comments || 0;
            acc.totalClicks += entry.performance.clicks || 0;
            acc.totalEngagement += entry.performance.engagement || 0;
          }
          return acc;
        },
        { totalViews: 0, totalLikes: 0, totalShares: 0, totalComments: 0, totalClicks: 0, totalEngagement: 0 }
      );

      rule.totalPerformance = {
        totalViews: totalMetrics.totalViews,
        totalLikes: totalMetrics.totalLikes,
        totalShares: totalMetrics.totalShares,
        totalComments: totalMetrics.totalComments,
        totalClicks: totalMetrics.totalClicks,
        averageEngagement: rule.recyclingHistory.length > 0 
          ? totalMetrics.totalEngagement / rule.recyclingHistory.length 
          : 0,
      };

      await rule.save();

      logger.info('Performance metrics updated', {
        ruleId,
        workspaceId,
        repostId,
        averageEngagement: rule.totalPerformance.averageEngagement,
      });

      return true;
    } catch (error: any) {
      logger.error('Update performance metrics error:', {
        ruleId,
        workspaceId,
        repostId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get rules that are ready for recycling based on schedule
   */
  static async getRulesReadyForRecycling(): Promise<IEvergreenRule[]> {
    try {
      const now = new Date();
      
      const rules = await EvergreenRule.find({
        enabled: true,
        paused: false,
        $or: [
          { lastRepostedAt: { $exists: false } }, // Never recycled
          { 
            $expr: {
              $gte: [
                { $divide: [{ $subtract: [now, '$lastRepostedAt'] }, 1000 * 60 * 60 * 24] },
                '$minDaysBetweenRecycles'
              ]
            }
          }
        ]
      });

      // Filter rules that haven't reached auto-stop limit
      return rules.filter(rule => !this.shouldAutoStop(rule));
    } catch (error: any) {
      logger.error('Get rules ready for recycling error:', {
        error: error.message,
      });
      throw error;
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
   * Returns the new post ID and updates recycling history
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

      // Get the evergreen rule for this post
      const rule = await EvergreenRule.findOne({
        postId: new mongoose.Types.ObjectId(originalPostId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!rule) {
        throw new Error('Evergreen rule not found');
      }

      // Check if we can recycle this post
      if (!this.canRecyclePost(rule)) {
        throw new Error(`Cannot recycle post yet. Must wait ${rule.minDaysBetweenRecycles} days between recycles.`);
      }

      // Check if we should auto-stop
      if (this.shouldAutoStop(rule)) {
        // Auto-disable the rule
        rule.enabled = false;
        await rule.save();
        throw new Error('Auto-stopped recycling after reaching maximum post limit');
      }

      // Apply content modification
      const modifiedContent = this.applyContentModification(
        originalPost.content,
        contentModification || rule.contentModification
      );

      // Create new post with modified content
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

      // Update rule with recycling history
      const historyEntry: RecyclingHistoryEntry = {
        repostedAt: new Date(),
        repostId: repost._id.toString(),
        performance: {
          views: 0,
          likes: 0,
          shares: 0,
          comments: 0,
          clicks: 0,
          engagement: 0,
        },
      };

      rule.recyclingHistory.push(historyEntry);
      rule.repostCount += 1;
      rule.lastRepostedAt = new Date();

      await rule.save();

      logger.info('Evergreen repost created', {
        originalPostId,
        repostId: repost._id.toString(),
        workspaceId,
        repostCount: rule.repostCount,
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
