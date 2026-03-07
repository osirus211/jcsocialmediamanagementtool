/**
 * Analytics Scheduler Service
 * 
 * Schedules analytics collection for published posts
 * 
 * Collection schedule:
 * - 30 minutes after publish
 * - Every 6 hours for 7 days
 * - Daily until 30 days
 */

import { ScheduledPost, PostStatus } from '../models/ScheduledPost';
import { analyticsCollectionQueue } from '../queue/AnalyticsCollectionQueue';
import { logger } from '../utils/logger';

export class AnalyticsSchedulerService {
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  /**
   * Start scheduler
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Analytics scheduler already running');
      return;
    }

    logger.info('Starting analytics scheduler', {
      interval: this.CHECK_INTERVAL,
      intervalMinutes: this.CHECK_INTERVAL / 60000,
    });

    // Run immediately
    this.run();

    // Then run every 5 minutes
    this.intervalId = setInterval(() => {
      this.run();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('Analytics scheduler stopped');
    }
  }

  /**
   * Run scheduler iteration
   */
  private async run(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Analytics scheduler already running, skipping iteration');
      return;
    }

    this.isRunning = true;

    try {
      // Find recently published posts that need analytics collection scheduled
      const posts = await this.getPostsNeedingAnalytics();

      logger.info('Analytics scheduler iteration', {
        postsFound: posts.length,
      });

      for (const post of posts) {
        try {
          await this.scheduleAnalyticsForPost(post);
        } catch (error: any) {
          logger.error('Failed to schedule analytics for post', {
            postId: post._id.toString(),
            error: error.message,
          });
        }
      }
    } catch (error: any) {
      logger.error('Analytics scheduler iteration error', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get posts that need analytics collection scheduled
   */
  private async getPostsNeedingAnalytics(): Promise<any[]> {
    try {
      // Find published posts from last 30 days that don't have analytics scheduled
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const posts = await ScheduledPost.find({
        status: PostStatus.PUBLISHED,
        publishedAt: { $gte: thirtyDaysAgo },
        'metadata.analyticsScheduled': { $ne: true },
        platformPostId: { $exists: true, $ne: null },
      })
        .limit(100)
        .lean();

      return posts;
    } catch (error: any) {
      logger.error('Failed to get posts needing analytics', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Schedule analytics collection for a post
   */
  private async scheduleAnalyticsForPost(post: any): Promise<void> {
    try {
      logger.info('Scheduling analytics collection', {
        postId: post._id.toString(),
        platform: post.platform,
        publishedAt: post.publishedAt,
      });

      // Schedule collection
      await analyticsCollectionQueue.scheduleCollection({
        postId: post._id.toString(),
        platform: post.platform,
        socialAccountId: post.socialAccountId.toString(),
        workspaceId: post.workspaceId.toString(),
        platformPostId: post.platformPostId,
        publishedAt: post.publishedAt,
      });

      // Mark as scheduled
      await ScheduledPost.findByIdAndUpdate(post._id, {
        $set: {
          'metadata.analyticsScheduled': true,
          'metadata.analyticsScheduledAt': new Date(),
        },
      });

      logger.info('Analytics collection scheduled', {
        postId: post._id.toString(),
        platform: post.platform,
      });
    } catch (error: any) {
      logger.error('Failed to schedule analytics', {
        postId: post._id.toString(),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    running: boolean;
    interval: number;
    intervalMinutes: number;
  } {
    return {
      running: !!this.intervalId,
      interval: this.CHECK_INTERVAL,
      intervalMinutes: this.CHECK_INTERVAL / 60000,
    };
  }

  /**
   * Force run scheduler (for testing)
   */
  async forceRun(): Promise<void> {
    await this.run();
  }
}

export const analyticsSchedulerService = new AnalyticsSchedulerService();
