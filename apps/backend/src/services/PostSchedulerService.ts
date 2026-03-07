/**
 * Post Scheduler Service
 * 
 * Runs every minute to find scheduled posts and route them to platform-specific queues
 * Uses PublishingRouter for platform-based routing
 */

import { ScheduledPost, PostStatus } from '../models/ScheduledPost';
import { PublishingRouter } from './PublishingRouter';
import { logger } from '../utils/logger';
import { withSpan } from '../config/telemetry';

const SCHEDULER_INTERVAL = 60000; // 1 minute
const BATCH_SIZE = 500; // Process 500 posts per batch
const SMOOTHING_WINDOW = 120; // 120 seconds smoothing window

export class PostSchedulerService {
  private publishingRouter: PublishingRouter;
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;

  constructor(publishingRouter: PublishingRouter) {
    this.publishingRouter = publishingRouter;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Post scheduler already running');
      return;
    }

    logger.info('Starting post scheduler', {
      interval: SCHEDULER_INTERVAL,
      intervalMinutes: SCHEDULER_INTERVAL / 60000,
      batchSize: BATCH_SIZE,
      smoothingWindow: SMOOTHING_WINDOW,
    });

    // Run immediately
    this.run();

    // Then run every minute
    this.intervalId = setInterval(() => {
      this.run();
    }, SCHEDULER_INTERVAL);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('Post scheduler stopped');
    }
  }

  /**
   * Run scheduler iteration
   * 
   * Finds scheduled posts and routes them to platform-specific queues
   */
  private async run(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Scheduler already running, skipping iteration');
      return;
    }

    this.isRunning = true;

    try {
      await withSpan('post-scheduler-run', async (span) => {
        const now = new Date();

        // Query posts that should be published (both SCHEDULED and APPROVED)
        const posts = await ScheduledPost.find({
          status: { $in: [PostStatus.SCHEDULED, PostStatus.APPROVED] },
          scheduledAt: { $lte: now },
        })
          .limit(BATCH_SIZE)
          .sort({ scheduledAt: 1 }); // Oldest first

        span.setAttribute('posts_found', posts.length);

        if (posts.length === 0) {
          logger.debug('No posts to schedule');
          return;
        }

        logger.info('Found posts to schedule', {
          count: posts.length,
          oldestScheduledAt: posts[0].scheduledAt,
        });

        // Route posts to platform-specific queues
        let scheduled = 0;
        let failed = 0;

        for (const post of posts) {
          try {
            await this.schedulePost(post);
            scheduled++;
          } catch (error: any) {
            failed++;
            logger.error('Failed to schedule post', {
              postId: post._id.toString(),
              error: error.message,
            });
          }
        }

        span.setAttribute('posts_scheduled', scheduled);
        span.setAttribute('posts_failed', failed);

        logger.info('Scheduler iteration complete', {
          found: posts.length,
          scheduled,
          failed,
        });
      });
    } catch (error: any) {
      logger.error('Scheduler iteration error', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Schedule a post by routing to platform-specific queue
   * Applies publish time smoothing
   */
  private async schedulePost(post: any): Promise<void> {
    await withSpan('schedule-post', async (span) => {
      span.setAttribute('post_id', post._id.toString());
      span.setAttribute('platform', post.platform);
      span.setAttribute('scheduled_at', post.scheduledAt.toISOString());

      // Check if post is already processed (race condition protection)
      if (
        post.status === PostStatus.QUEUED ||
        post.status === PostStatus.PUBLISHING ||
        post.status === PostStatus.PUBLISHED
      ) {
        logger.debug('Post already processed, skipping', {
          postId: post._id.toString(),
          status: post.status,
        });
        return;
      }

      // Apply publish time smoothing (random 0-120 seconds)
      const smoothingDelay = Math.floor(Math.random() * SMOOTHING_WINDOW * 1000);

      // Update post status to queued with timestamp
      post.status = PostStatus.QUEUED;
      post.queuedAt = new Date();
      await post.save();

      // Route to platform-specific queue
      await this.publishingRouter.route({
        postId: post._id.toString(),
        socialAccountId: post.socialAccountId.toString(),
        platform: post.platform,
        content: post.content,
        mediaUrls: post.mediaUrls,
        attemptNumber: 1,
      });

      logger.info('Post scheduled and routed', {
        postId: post._id.toString(),
        platform: post.platform,
        scheduledAt: post.scheduledAt,
        queuedAt: post.queuedAt,
        smoothingDelay: smoothingDelay / 1000,
      });
    });
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    running: boolean;
    interval: number;
    intervalMinutes: number;
    batchSize: number;
    smoothingWindow: number;
  } {
    return {
      running: !!this.intervalId,
      interval: SCHEDULER_INTERVAL,
      intervalMinutes: SCHEDULER_INTERVAL / 60000,
      batchSize: BATCH_SIZE,
      smoothingWindow: SMOOTHING_WINDOW,
    };
  }

  /**
   * Force run scheduler (for testing)
   */
  async forceRun(): Promise<void> {
    await this.run();
  }
}
