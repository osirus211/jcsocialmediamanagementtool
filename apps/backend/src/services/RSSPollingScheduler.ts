/**
 * RSS Polling Scheduler
 * 
 * Periodically schedules RSS feed polling jobs
 * 
 * Features:
 * - Polls every 10 minutes
 * - Queries enabled RSS feeds
 * - Respects feed-specific pollingInterval
 * - Prevents duplicate jobs per feed
 * - Uses distributed locking for coordination
 * - Tracks metrics
 */

import { RSSFeed } from '../models/RSSFeed';
import { RSSQueue } from '../queue/RSSQueue';
import { logger } from '../utils/logger';
import { getRedisClient } from '../config/redis';

export class RSSPollingScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly POLL_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private readonly LOCK_KEY = 'rss-scheduler:lock';
  private readonly LOCK_TTL = 120; // 2 minutes

  // Metrics
  private metrics = {
    scheduler_runs_total: 0,
    feeds_evaluated_total: 0,
    feeds_scheduled_total: 0,
    feeds_skipped_total: 0,
  };

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('RSS polling scheduler already running');
      return;
    }

    this.isRunning = true;

    logger.info('RSS polling scheduler started', {
      pollInterval: this.POLL_INTERVAL,
    });

    // Immediate execution
    this.poll();

    // Interval execution
    this.intervalId = setInterval(() => {
      this.poll();
    }, this.POLL_INTERVAL);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('RSS polling scheduler stopped');
  }

  /**
   * Poll for feeds that need polling
   */
  private async poll(): Promise<void> {
    this.metrics.scheduler_runs_total++;

    logger.debug('RSS polling scheduler heartbeat');

    // Acquire distributed lock
    const lockAcquired = await this.acquireLock();

    if (!lockAcquired) {
      logger.debug('Could not acquire RSS scheduler lock, skipping poll');
      return;
    }

    try {
      logger.debug('RSS polling scheduler: evaluating feeds');

      // Query all enabled RSS feeds
      const feeds = await RSSFeed.find({ enabled: true }).lean();

      this.metrics.feeds_evaluated_total += feeds.length;

      if (!feeds.length) {
        logger.debug('No enabled RSS feeds found');
        return;
      }

      logger.info('RSS polling scheduler: found enabled feeds', {
        count: feeds.length,
      });

      const now = Date.now();

      for (const feed of feeds) {
        try {
          // Check if feed needs polling based on pollingInterval
          const shouldPoll = this.shouldPollFeed(feed, now);

          if (!shouldPoll) {
            this.metrics.feeds_skipped_total++;
            logger.debug('RSS feed polling interval not elapsed', {
              feedId: feed._id.toString(),
              pollingInterval: feed.pollingInterval,
              lastFetchedAt: feed.lastFetchedAt,
            });
            continue;
          }

          // Enqueue polling job
          await this.enqueueFeedPoll(feed);
          this.metrics.feeds_scheduled_total++;

        } catch (error: any) {
          logger.error('Failed to schedule RSS feed poll', {
            feedId: feed._id.toString(),
            error: error.message,
          });
        }
      }

      logger.info('RSS polling scheduler: poll completed', {
        evaluated: feeds.length,
        scheduled: this.metrics.feeds_scheduled_total,
        skipped: this.metrics.feeds_skipped_total,
      });

    } catch (error: any) {
      logger.error('RSS polling scheduler error', {
        error: error.message,
      });
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Check if feed should be polled based on pollingInterval
   */
  private shouldPollFeed(feed: any, now: number): boolean {
    // If never fetched, poll immediately
    if (!feed.lastFetchedAt) {
      return true;
    }

    // Calculate time since last fetch
    const lastFetchedAt = new Date(feed.lastFetchedAt).getTime();
    const pollingIntervalMs = feed.pollingInterval * 60 * 1000; // Convert minutes to ms
    const timeSinceLastFetch = now - lastFetchedAt;

    // Poll if interval has elapsed
    return timeSinceLastFetch >= pollingIntervalMs;
  }

  /**
   * Enqueue feed polling job
   * Prevents duplicate jobs using Redis lock
   */
  private async enqueueFeedPoll(feed: any): Promise<void> {
    const feedId = feed._id.toString();
    const redis = getRedisClient();
    const lockKey = `rss-feed:polling:${feedId}`;

    try {
      // Check if feed is already being polled
      const existingLock = await redis.get(lockKey);
      if (existingLock) {
        logger.debug('RSS feed already has polling lock', {
          feedId,
        });
        return;
      }

      // Set lock (expires in 30 minutes - longer than any single poll should take)
      await redis.setex(lockKey, 30 * 60, Date.now().toString());

      // Enqueue polling job
      await RSSQueue.addFeedPoll({
        feedId,
        workspaceId: feed.workspaceId.toString(),
        feedUrl: feed.feedUrl,
      });

      logger.info('RSS feed polling job enqueued', {
        feedId,
        workspaceId: feed.workspaceId.toString(),
        feedUrl: feed.feedUrl,
      });

    } catch (error: any) {
      logger.error('Failed to enqueue RSS feed poll', {
        feedId,
        error: error.message,
      });

      // Release lock on error
      try {
        await redis.del(lockKey);
      } catch {}

      throw error;
    }
  }

  /**
   * Acquire distributed lock
   */
  private async acquireLock(): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const result = await redis.set(
        this.LOCK_KEY,
        Date.now().toString(),
        'EX',
        this.LOCK_TTL,
        'NX'
      );
      return result === 'OK';
    } catch (error: any) {
      logger.error('Failed to acquire RSS scheduler lock', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(this.LOCK_KEY);
    } catch (error: any) {
      logger.error('Failed to release RSS scheduler lock', {
        error: error.message,
      });
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      pollInterval: this.POLL_INTERVAL,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Force immediate poll (for testing/debugging)
   */
  async forcePoll(): Promise<void> {
    await this.poll();
  }
}

export const rssPollingScheduler = new RSSPollingScheduler();
