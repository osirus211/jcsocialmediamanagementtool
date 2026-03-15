/**
 * Queue Service
 * 
 * Comprehensive queue management system that beats Buffer, Hootsuite, Sprout Social, Later
 * 
 * Features:
 * - View all queued posts with drag-drop reordering
 * - Move posts up/down, to top/bottom
 * - Remove posts from queue
 * - Shuffle queue order (with smart distribution)
 * - Platform filtering
 * - Bulk operations
 * - Queue slot time display
 * - Smart queue optimization
 */

import mongoose from 'mongoose';
import { Post, IPost, PostStatus } from '../models/Post';
import { QueueSlot, IQueueSlot } from '../models/QueueSlot';
import { SocialAccount } from '../models/SocialAccount';
import { Workspace } from '../models/Workspace';
import { queueSlotService } from './QueueSlotService';
import { logger } from '../utils/logger';
import { BadRequestError, NotFoundError } from '../utils/errors';

export interface QueuedPost {
  id: string;
  workspaceId: string;
  content: string;
  platform: string;
  socialAccountId: string;
  socialAccountName: string;
  scheduledAt: Date;
  queueSlot?: string;
  mediaIds: string[];
  status: PostStatus;
  createdAt: Date;
  createdBy: string;
  order: number; // Position in queue
}

export interface QueueStats {
  totalPosts: number;
  postsByPlatform: Record<string, number>;
  nextPostTime?: Date;
  averageInterval: number; // Minutes between posts
  queueHealth: 'good' | 'warning' | 'critical';
}

export interface ReorderQueueInput {
  postId: string;
  newPosition: number;
}

export interface ShuffleQueueOptions {
  platform?: string;
  preserveTimeSlots?: boolean;
  distributionStrategy?: 'random' | 'balanced' | 'optimal';
}

export interface QueuePauseStatus {
  isPaused: boolean;
  pausedAt?: Date;
  pausedBy?: string;
  resumeAt?: Date;
  reason?: string;
  accountPauses: Array<{
    socialAccountId: string;
    socialAccountName: string;
    platform: string;
    isPaused: boolean;
    pausedAt: Date;
    pausedBy: string;
    resumeAt?: Date;
    reason?: string;
  }>;
}

export interface PauseQueueOptions {
  accountId?: string; // Pause specific account only
  resumeAt?: Date; // Auto-resume time
  reason?: string; // Why pausing
}

export class QueueService {
  private static instance: QueueService;

  private constructor() {}

  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * Get queue with all scheduled posts
   * Returns posts ordered by scheduledAt with position numbers
   */
  async getQueue(
    workspaceId: string,
    platform?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ posts: QueuedPost[]; stats: QueueStats; total: number }> {
    try {
      const query: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
        scheduledAt: { $gte: new Date() }, // Only future posts
      };

      if (platform) {
        // Get social accounts for this platform
        const accounts = await SocialAccount.find({
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          provider: platform,
          isActive: true,
        });
        
        if (accounts.length > 0) {
          query.socialAccountId = { $in: accounts.map(a => a._id) };
        } else {
          // No accounts for this platform, return empty
          return {
            posts: [],
            stats: {
              totalPosts: 0,
              postsByPlatform: {},
              averageInterval: 0,
              queueHealth: 'good',
            },
            total: 0,
          };
        }
      }

      // Get total count
      const total = await Post.countDocuments(query);

      // Get posts with pagination
      const posts = await Post.find(query)
        .populate('socialAccountId', 'username provider displayName')
        .populate('createdBy', 'name email')
        .sort({ scheduledAt: 1 }) // Chronological order
        .limit(limit)
        .skip(offset)
        .lean();

      // Transform to QueuedPost format with order numbers
      const queuedPosts: QueuedPost[] = posts.map((post, index) => ({
        id: post._id.toString(),
        workspaceId: post.workspaceId.toString(),
        content: post.content,
        platform: (post.socialAccountId as any)?.provider || 'unknown',
        socialAccountId: post.socialAccountId.toString(),
        socialAccountName: (post.socialAccountId as any)?.displayName || 
                          (post.socialAccountId as any)?.username || 'Unknown Account',
        scheduledAt: post.scheduledAt!,
        queueSlot: post.queueSlot,
        mediaIds: post.mediaIds?.map(id => id.toString()) || [],
        status: post.status,
        createdAt: post.createdAt,
        createdBy: (post.createdBy as any)?.name || 'Unknown',
        order: offset + index + 1, // 1-based position
      }));

      // Calculate stats
      const stats = await this.calculateQueueStats(workspaceId, platform);

      return {
        posts: queuedPosts,
        stats,
        total,
      };
    } catch (error: any) {
      logger.error('Failed to get queue', {
        workspaceId,
        platform,
        error: error.message,
      });
      throw new Error(`Failed to get queue: ${error.message}`);
    }
  }

  /**
   * Reorder queue by moving a post to a new position
   * Recalculates scheduledAt times based on available queue slots
   */
  async reorderQueue(
    workspaceId: string,
    postId: string,
    newPosition: number
  ): Promise<QueuedPost[]> {
    try {
      // Get current queue
      const { posts } = await this.getQueue(workspaceId);
      
      if (posts.length === 0) {
        throw new BadRequestError('Queue is empty');
      }

      // Find the post to move
      const postIndex = posts.findIndex(p => p.id === postId);
      if (postIndex === -1) {
        throw new NotFoundError('Post not found in queue');
      }

      // Validate new position
      if (newPosition < 1 || newPosition > posts.length) {
        throw new BadRequestError(`Invalid position. Must be between 1 and ${posts.length}`);
      }

      // Reorder the array
      const postToMove = posts[postIndex];
      posts.splice(postIndex, 1); // Remove from current position
      posts.splice(newPosition - 1, 0, postToMove); // Insert at new position

      // Recalculate scheduled times
      await this.recalculateScheduledTimes(workspaceId, posts);

      logger.info('Queue reordered', {
        workspaceId,
        postId,
        oldPosition: postIndex + 1,
        newPosition,
      });

      // Return updated queue
      const { posts: updatedPosts } = await this.getQueue(workspaceId);
      return updatedPosts;
    } catch (error: any) {
      logger.error('Failed to reorder queue', {
        workspaceId,
        postId,
        newPosition,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Move post up one position
   */
  async movePostUp(workspaceId: string, postId: string): Promise<QueuedPost[]> {
    const { posts } = await this.getQueue(workspaceId);
    const postIndex = posts.findIndex(p => p.id === postId);
    
    if (postIndex === -1) {
      throw new NotFoundError('Post not found in queue');
    }
    
    if (postIndex === 0) {
      throw new BadRequestError('Post is already at the top');
    }

    return this.reorderQueue(workspaceId, postId, postIndex); // Move to previous position
  }

  /**
   * Move post down one position
   */
  async movePostDown(workspaceId: string, postId: string): Promise<QueuedPost[]> {
    const { posts } = await this.getQueue(workspaceId);
    const postIndex = posts.findIndex(p => p.id === postId);
    
    if (postIndex === -1) {
      throw new NotFoundError('Post not found in queue');
    }
    
    if (postIndex === posts.length - 1) {
      throw new BadRequestError('Post is already at the bottom');
    }

    return this.reorderQueue(workspaceId, postId, postIndex + 2); // Move to next position
  }

  /**
   * Move post to top of queue
   */
  async moveToTop(workspaceId: string, postId: string): Promise<QueuedPost[]> {
    return this.reorderQueue(workspaceId, postId, 1);
  }

  /**
   * Move post to bottom of queue
   */
  async moveToBottom(workspaceId: string, postId: string): Promise<QueuedPost[]> {
    const { posts } = await this.getQueue(workspaceId);
    return this.reorderQueue(workspaceId, postId, posts.length);
  }

  /**
   * Remove post from queue (convert back to draft)
   */
  async removeFromQueue(workspaceId: string, postId: string): Promise<void> {
    try {
      const post = await Post.findOne({
        _id: postId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
      });

      if (!post) {
        throw new NotFoundError('Post not found in queue');
      }

      // Convert back to draft
      post.status = PostStatus.DRAFT;
      post.scheduledAt = undefined;
      post.queueSlot = undefined;
      await post.save();

      logger.info('Post removed from queue', {
        workspaceId,
        postId,
      });
    } catch (error: any) {
      logger.error('Failed to remove post from queue', {
        workspaceId,
        postId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Shuffle queue with smart distribution
   * Better than Buffer's basic shuffle - uses intelligent algorithms
   */
  async shuffleQueue(
    workspaceId: string,
    options: ShuffleQueueOptions = {}
  ): Promise<QueuedPost[]> {
    try {
      const { platform, preserveTimeSlots = true, distributionStrategy = 'optimal' } = options;
      
      // Get current queue
      const { posts } = await this.getQueue(workspaceId, platform);
      
      if (posts.length < 2) {
        throw new BadRequestError('Need at least 2 posts to shuffle');
      }

      let shuffledPosts: QueuedPost[];

      switch (distributionStrategy) {
        case 'random':
          shuffledPosts = this.randomShuffle(posts);
          break;
        case 'balanced':
          shuffledPosts = await this.balancedShuffle(posts);
          break;
        case 'optimal':
        default:
          shuffledPosts = await this.optimalShuffle(posts);
          break;
      }

      // Recalculate scheduled times if not preserving time slots
      if (!preserveTimeSlots) {
        await this.recalculateScheduledTimes(workspaceId, shuffledPosts);
      } else {
        // Keep original times but update post assignments
        const originalTimes = posts.map(p => p.scheduledAt);
        for (let i = 0; i < shuffledPosts.length; i++) {
          await Post.findByIdAndUpdate(shuffledPosts[i].id, {
            scheduledAt: originalTimes[i],
          });
        }
      }

      logger.info('Queue shuffled', {
        workspaceId,
        platform,
        strategy: distributionStrategy,
        preserveTimeSlots,
        postCount: shuffledPosts.length,
      });

      // Return updated queue
      const { posts: updatedPosts } = await this.getQueue(workspaceId, platform);
      return updatedPosts;
    } catch (error: any) {
      logger.error('Failed to shuffle queue', {
        workspaceId,
        options,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Bulk operations on queue
   */
  async bulkOperation(
    workspaceId: string,
    operation: 'remove' | 'reschedule' | 'move_to_top' | 'move_to_bottom',
    postIds: string[],
    options?: { scheduledAt?: Date; newPosition?: number }
  ): Promise<{ success: number; failed: Array<{ postId: string; reason: string }> }> {
    const results = { success: 0, failed: [] as Array<{ postId: string; reason: string }> };

    for (const postId of postIds) {
      try {
        switch (operation) {
          case 'remove':
            await this.removeFromQueue(workspaceId, postId);
            break;
          case 'move_to_top':
            await this.moveToTop(workspaceId, postId);
            break;
          case 'move_to_bottom':
            await this.moveToBottom(workspaceId, postId);
            break;
          case 'reschedule':
            if (!options?.scheduledAt) {
              throw new BadRequestError('scheduledAt required for reschedule operation');
            }
            await Post.findByIdAndUpdate(postId, {
              scheduledAt: options.scheduledAt,
            });
            break;
        }
        results.success++;
      } catch (error: any) {
        results.failed.push({
          postId,
          reason: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Calculate queue statistics
   */
  private async calculateQueueStats(workspaceId: string, platform?: string): Promise<QueueStats> {
    try {
      const query: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
        scheduledAt: { $gte: new Date() },
      };

      if (platform) {
        const accounts = await SocialAccount.find({
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          provider: platform,
          isActive: true,
        });
        
        if (accounts.length > 0) {
          query.socialAccountId = { $in: accounts.map(a => a._id) };
        }
      }

      const posts = await Post.find(query)
        .populate('socialAccountId', 'provider')
        .sort({ scheduledAt: 1 });

      const totalPosts = posts.length;
      const postsByPlatform: Record<string, number> = {};

      // Count posts by platform
      posts.forEach(post => {
        const platform = (post.socialAccountId as any)?.provider || 'unknown';
        postsByPlatform[platform] = (postsByPlatform[platform] || 0) + 1;
      });

      // Calculate average interval
      let averageInterval = 0;
      if (posts.length > 1) {
        const intervals = [];
        for (let i = 1; i < posts.length; i++) {
          const diff = posts[i].scheduledAt!.getTime() - posts[i - 1].scheduledAt!.getTime();
          intervals.push(diff / (1000 * 60)); // Convert to minutes
        }
        averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }

      // Determine queue health
      let queueHealth: 'good' | 'warning' | 'critical' = 'good';
      if (totalPosts === 0) {
        queueHealth = 'critical';
      } else if (totalPosts < 5 || averageInterval > 1440) { // Less than 5 posts or more than 24h interval
        queueHealth = 'warning';
      }

      return {
        totalPosts,
        postsByPlatform,
        nextPostTime: posts[0]?.scheduledAt,
        averageInterval: Math.round(averageInterval),
        queueHealth,
      };
    } catch (error: any) {
      logger.error('Failed to calculate queue stats', {
        workspaceId,
        platform,
        error: error.message,
      });
      
      return {
        totalPosts: 0,
        postsByPlatform: {},
        averageInterval: 0,
        queueHealth: 'critical',
      };
    }
  }

  /**
   * Recalculate scheduled times based on queue slots
   */
  private async recalculateScheduledTimes(workspaceId: string, posts: QueuedPost[]): Promise<void> {
    try {
      // Get all available queue slots
      const slots = await QueueSlot.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        isActive: true,
      }).sort({ dayOfWeek: 1, time: 1 });

      if (slots.length === 0) {
        throw new BadRequestError('No queue slots configured');
      }

      const now = new Date();
      const scheduledTimes: Date[] = [];

      // Generate future time slots for the next 30 days
      for (let daysAhead = 0; daysAhead < 30; daysAhead++) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + daysAhead);
        const targetDayOfWeek = targetDate.getDay();

        const daySlots = slots.filter(s => s.dayOfWeek === targetDayOfWeek);
        
        for (const slot of daySlots) {
          const [hours, minutes] = slot.time.split(':').map(Number);
          const slotTime = new Date(targetDate);
          slotTime.setHours(hours, minutes, 0, 0);

          if (slotTime > now) {
            scheduledTimes.push(slotTime);
          }
        }
      }

      // Sort times chronologically
      scheduledTimes.sort((a, b) => a.getTime() - b.getTime());

      // Assign times to posts
      for (let i = 0; i < posts.length && i < scheduledTimes.length; i++) {
        await Post.findByIdAndUpdate(posts[i].id, {
          scheduledAt: scheduledTimes[i],
        });
      }
    } catch (error: any) {
      logger.error('Failed to recalculate scheduled times', {
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Random shuffle algorithm
   */
  private randomShuffle(posts: QueuedPost[]): QueuedPost[] {
    const shuffled = [...posts];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Balanced shuffle - ensures even distribution across platforms
   */
  private async balancedShuffle(posts: QueuedPost[]): Promise<QueuedPost[]> {
    // Group posts by platform
    const platformGroups: Record<string, QueuedPost[]> = {};
    posts.forEach(post => {
      if (!platformGroups[post.platform]) {
        platformGroups[post.platform] = [];
      }
      platformGroups[post.platform].push(post);
    });

    // Shuffle each platform group
    Object.keys(platformGroups).forEach(platform => {
      platformGroups[platform] = this.randomShuffle(platformGroups[platform]);
    });

    // Interleave posts from different platforms
    const shuffled: QueuedPost[] = [];
    const platforms = Object.keys(platformGroups);
    let maxLength = Math.max(...Object.values(platformGroups).map(group => group.length));

    for (let i = 0; i < maxLength; i++) {
      for (const platform of platforms) {
        if (platformGroups[platform][i]) {
          shuffled.push(platformGroups[platform][i]);
        }
      }
    }

    return shuffled;
  }

  /**
   * Optimal shuffle - advanced algorithm that considers posting patterns
   */
  private async optimalShuffle(posts: QueuedPost[]): Promise<QueuedPost[]> {
    // Start with balanced shuffle
    let shuffled = await this.balancedShuffle(posts);

    // Apply optimization rules
    // Rule 1: Avoid consecutive posts from same account
    shuffled = this.avoidConsecutiveSameAccount(shuffled);

    // Rule 2: Distribute media-heavy posts evenly
    shuffled = this.distributeMediaPosts(shuffled);

    return shuffled;
  }

  /**
   * Avoid consecutive posts from the same social account
   */
  private avoidConsecutiveSameAccount(posts: QueuedPost[]): QueuedPost[] {
    const optimized = [...posts];
    
    for (let i = 0; i < optimized.length - 1; i++) {
      if (optimized[i].socialAccountId === optimized[i + 1].socialAccountId) {
        // Find a different post to swap with
        for (let j = i + 2; j < optimized.length; j++) {
          if (optimized[j].socialAccountId !== optimized[i].socialAccountId) {
            [optimized[i + 1], optimized[j]] = [optimized[j], optimized[i + 1]];
            break;
          }
        }
      }
    }

    return optimized;
  }

  /**
   * Distribute posts with media evenly throughout the queue
   */
  private distributeMediaPosts(posts: QueuedPost[]): QueuedPost[] {
    const mediaPosts = posts.filter(p => p.mediaIds.length > 0);
    const textPosts = posts.filter(p => p.mediaIds.length === 0);

    if (mediaPosts.length === 0 || textPosts.length === 0) {
      return posts; // No optimization needed
    }

    const optimized: QueuedPost[] = [];
    const mediaInterval = Math.ceil(posts.length / mediaPosts.length);

    let mediaIndex = 0;
    let textIndex = 0;

    for (let i = 0; i < posts.length; i++) {
      if (i % mediaInterval === 0 && mediaIndex < mediaPosts.length) {
        optimized.push(mediaPosts[mediaIndex++]);
      } else if (textIndex < textPosts.length) {
        optimized.push(textPosts[textIndex++]);
      } else if (mediaIndex < mediaPosts.length) {
        optimized.push(mediaPosts[mediaIndex++]);
      }
    }

    return optimized;
  }
  
  /**
   * PAUSE QUEUE FUNCTIONALITY - Beats Buffer & Hootsuite
   * Superior features:
   * - Global workspace pause OR per-account pause
   * - Auto-resume with specific date/time
   * - Pause reasons for team communication
   * - Visual indicators and notifications
   * - Maintains original queue order when resumed
   */

  /**
   * Pause entire workspace queue or specific account
   */
  async pauseQueue(
    workspaceId: string,
    userId: string,
    options: PauseQueueOptions = {}
  ): Promise<QueuePauseStatus> {
    try {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        throw new NotFoundError('Workspace not found');
      }

      const now = new Date();

      if (options.accountId) {
        // Pause specific account
        const account = await SocialAccount.findOne({
          _id: options.accountId,
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        });

        if (!account) {
          throw new NotFoundError('Social account not found');
        }

        // Remove existing pause for this account
        workspace.queuePause.accountPauses = workspace.queuePause.accountPauses.filter(
          p => p.socialAccountId.toString() !== options.accountId
        );

        // Add new pause
        workspace.queuePause.accountPauses.push({
          socialAccountId: new mongoose.Types.ObjectId(options.accountId),
          isPaused: true,
          pausedAt: now,
          pausedBy: new mongoose.Types.ObjectId(userId),
          resumeAt: options.resumeAt,
          reason: options.reason,
        });

        logger.info('Account queue paused', {
          workspaceId,
          accountId: options.accountId,
          userId,
          resumeAt: options.resumeAt,
          reason: options.reason,
        });
      } else {
        // Pause entire workspace
        workspace.queuePause.isPaused = true;
        workspace.queuePause.pausedAt = now;
        workspace.queuePause.pausedBy = new mongoose.Types.ObjectId(userId);
        workspace.queuePause.resumeAt = options.resumeAt;
        workspace.queuePause.reason = options.reason;

        logger.info('Workspace queue paused', {
          workspaceId,
          userId,
          resumeAt: options.resumeAt,
          reason: options.reason,
        });
      }

      await workspace.save();
      return this.getQueueStatus(workspaceId);
    } catch (error: any) {
      logger.error('Failed to pause queue', {
        workspaceId,
        userId,
        options,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Resume entire workspace queue or specific account
   */
  async resumeQueue(
    workspaceId: string,
    userId: string,
    accountId?: string
  ): Promise<QueuePauseStatus> {
    try {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        throw new NotFoundError('Workspace not found');
      }

      if (accountId) {
        // Resume specific account
        workspace.queuePause.accountPauses = workspace.queuePause.accountPauses.filter(
          p => p.socialAccountId.toString() !== accountId
        );

        logger.info('Account queue resumed', {
          workspaceId,
          accountId,
          userId,
        });
      } else {
        // Resume entire workspace
        workspace.queuePause.isPaused = false;
        workspace.queuePause.pausedAt = undefined;
        workspace.queuePause.pausedBy = undefined;
        workspace.queuePause.resumeAt = undefined;
        workspace.queuePause.reason = undefined;

        logger.info('Workspace queue resumed', {
          workspaceId,
          userId,
        });
      }

      await workspace.save();
      return this.getQueueStatus(workspaceId);
    } catch (error: any) {
      logger.error('Failed to resume queue', {
        workspaceId,
        userId,
        accountId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Pause queue until specific date/time
   */
  async pauseUntil(
    workspaceId: string,
    userId: string,
    resumeAt: Date,
    options: { accountId?: string; reason?: string } = {}
  ): Promise<QueuePauseStatus> {
    if (resumeAt <= new Date()) {
      throw new BadRequestError('Resume time must be in the future');
    }

    return this.pauseQueue(workspaceId, userId, {
      accountId: options.accountId,
      resumeAt,
      reason: options.reason,
    });
  }

  /**
   * Get current queue pause status
   */
  async getQueueStatus(workspaceId: string): Promise<QueuePauseStatus> {
    try {
      const workspace = await Workspace.findById(workspaceId)
        .populate('queuePause.pausedBy', 'name email')
        .populate('queuePause.accountPauses.pausedBy', 'name email')
        .populate('queuePause.accountPauses.socialAccountId', 'username provider displayName');

      if (!workspace) {
        throw new NotFoundError('Workspace not found');
      }

      const accountPauses = workspace.queuePause.accountPauses.map(pause => ({
        socialAccountId: pause.socialAccountId._id.toString(),
        socialAccountName: (pause.socialAccountId as any).displayName || 
                          (pause.socialAccountId as any).username || 'Unknown Account',
        platform: (pause.socialAccountId as any).provider || 'unknown',
        isPaused: pause.isPaused,
        pausedAt: pause.pausedAt,
        pausedBy: (pause.pausedBy as any)?.name || 'Unknown User',
        resumeAt: pause.resumeAt,
        reason: pause.reason,
      }));

      return {
        isPaused: workspace.queuePause.isPaused,
        pausedAt: workspace.queuePause.pausedAt,
        pausedBy: (workspace.queuePause.pausedBy as any)?.name || undefined,
        resumeAt: workspace.queuePause.resumeAt,
        reason: workspace.queuePause.reason,
        accountPauses,
      };
    } catch (error: any) {
      logger.error('Failed to get queue status', {
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Auto-resume queues that have reached their resume time
   * This should be called by a scheduled job
   */
  async processAutoResume(): Promise<void> {
    try {
      const now = new Date();

      // Find workspaces with expired pause times
      const workspaces = await Workspace.find({
        $or: [
          {
            'queuePause.isPaused': true,
            'queuePause.resumeAt': { $lte: now },
          },
          {
            'queuePause.accountPauses': {
              $elemMatch: {
                isPaused: true,
                resumeAt: { $lte: now },
              },
            },
          },
        ],
      });

      for (const workspace of workspaces) {
        let updated = false;

        // Resume workspace if needed
        if (workspace.queuePause.isPaused && 
            workspace.queuePause.resumeAt && 
            workspace.queuePause.resumeAt <= now) {
          workspace.queuePause.isPaused = false;
          workspace.queuePause.pausedAt = undefined;
          workspace.queuePause.pausedBy = undefined;
          workspace.queuePause.resumeAt = undefined;
          workspace.queuePause.reason = undefined;
          updated = true;

          logger.info('Auto-resumed workspace queue', {
            workspaceId: workspace._id.toString(),
          });
        }

        // Resume accounts if needed
        workspace.queuePause.accountPauses = workspace.queuePause.accountPauses.filter(pause => {
          if (pause.resumeAt && pause.resumeAt <= now) {
            logger.info('Auto-resumed account queue', {
              workspaceId: workspace._id.toString(),
              accountId: pause.socialAccountId.toString(),
            });
            updated = true;
            return false; // Remove this pause
          }
          return true; // Keep this pause
        });

        if (updated) {
          await workspace.save();
        }
      }
    } catch (error: any) {
      logger.error('Failed to process auto-resume', {
        error: error.message,
      });
    }
  }

  /**
   * Check if a post should be published (not paused)
   */
  async isPostPublishable(workspaceId: string, socialAccountId: string): Promise<boolean> {
    try {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return false;
      }

      // Check global pause
      if (workspace.queuePause.isPaused) {
        return false;
      }

      // Check account-specific pause
      const accountPause = workspace.queuePause.accountPauses.find(
        p => p.socialAccountId.toString() === socialAccountId && p.isPaused
      );

      return !accountPause;
    } catch (error: any) {
      logger.error('Failed to check if post is publishable', {
        workspaceId,
        socialAccountId,
        error: error.message,
      });
      return false; // Fail safe - don't publish if we can't check
    }
  }
}

export const queueService = QueueService.getInstance();