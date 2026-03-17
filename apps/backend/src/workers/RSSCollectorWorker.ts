/**
 * RSS Collector Worker
 * 
 * Polls RSS feeds, detects new items, stores them, and emits events
 * 
 * Features:
 * - Periodic RSS feed polling
 * - Deduplication by guid/link
 * - Event emission for new items
 * - Distributed locking to prevent duplicate polling
 * - Retry with exponential backoff
 * - Metrics tracking
 * - DLQ integration for failed jobs
 */

import { Worker, Job } from 'bullmq';
import mongoose from 'mongoose';
import { RSS_QUEUE_NAME, RSSJobData } from '../queue/RSSQueue';
import { QueueManager } from '../queue/QueueManager';
import { RSSFeed, IRSSFeed } from '../models/RSSFeed';
import { RSSFeedService } from '../services/RSSFeedService';
import { logger } from '../utils/logger';

export class RSSCollectorWorker {
  private worker: Worker | null = null;
  private isRunning: boolean = false;

  private readonly CONCURRENCY = 3;

  // Metrics
  private metrics = {
    rss_fetch_total: 0,
    rss_fetch_success: 0,
    rss_fetch_errors_total: 0,
    rss_items_fetched_total: 0,
    rss_items_new_total: 0,
    rss_fetch_duration_sum: 0,
    rss_fetch_duration_count: 0,
  };

  /**
   * Start worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('RSS collector worker already running');
      return;
    }

    const queueManager = QueueManager.getInstance();

    this.worker = queueManager.createWorker(
      RSS_QUEUE_NAME,
      this.processJob.bind(this),
      {
        concurrency: this.CONCURRENCY,
      }
    );

    this.worker.on('completed', (job) => {
      logger.info('RSS collection job completed', {
        jobId: job.id,
        feedId: job.data.feedId,
      });
    });

    this.worker.on('failed', async (job, error) => {
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        logger.error('RSS collection job exhausted all retries', {
          jobId: job.id,
          feedId: job.data.feedId,
          feedUrl: job.data.feedUrl,
          error: error.message,
        });
        
        // Update feed failure count
        try {
          await this.incrementFeedFailureCount(job.data.feedId);
        } catch (updateError: unknown) {
          logger.error('Failed to update feed failure count', {
            feedId: job.data.feedId,
            error: updateError instanceof Error ? updateError.message : String(updateError),
          });
        }
      }
    });

    this.isRunning = true;

    logger.info('RSS collector worker started', {
      concurrency: this.CONCURRENCY,
    });
  }

  /**
   * Stop worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.worker) return;

    await this.worker.close();
    this.worker = null;
    this.isRunning = false;

    logger.info('RSS collector worker stopped');
  }

  /**
   * Process RSS collection job
   */
  private async processJob(job: Job<RSSJobData>): Promise<void> {
    const { feedId, workspaceId, feedUrl } = job.data;
    const startTime = Date.now();

    this.metrics.rss_fetch_total++;

    logger.info('Processing RSS collection job', {
      jobId: job.id,
      feedId,
      feedUrl,
    });

    // Acquire distributed lock to prevent concurrent polling of same feed
    const { distributedLockService } = await import('../services/DistributedLockService');
    const lockKey = `lock:rss-feed:${feedId}`;

    try {
      await distributedLockService.withLock(
        lockKey,
        async () => {
          // Load feed configuration
          const feed = await RSSFeed.findById(feedId);
          if (!feed) {
            throw new Error('RSS feed not found');
          }

          // Check if feed is still enabled
          if (!feed.enabled) {
            logger.info('RSS feed is disabled, skipping collection', {
              feedId,
              feedUrl,
            });
            return;
          }

          // Check if feed should be polled (based on individual refreshIntervalHours)
          if (feed.lastFetchedAt) {
            const refreshIntervalHours = feed.pollingInterval / 60; // Convert minutes to hours
            const nextFetchDue = new Date(feed.lastFetchedAt.getTime() + refreshIntervalHours * 60 * 60 * 1000);
            if (nextFetchDue > new Date()) {
              logger.debug('RSS feed not due for polling yet', {
                feedId,
                lastFetchedAt: feed.lastFetchedAt,
                refreshIntervalHours,
                nextFetchDue,
              });
              return;
            }
          }

          logger.info('Fetching RSS feed', {
            feedId,
            feedUrl,
          });

          // Parse RSS feed
          const items = await RSSFeedService.parseFeed(feedUrl);
          
          this.metrics.rss_items_fetched_total += items.length;

          logger.info('RSS feed parsed', {
            feedId,
            feedUrl,
            itemCount: items.length,
          });

          // Store new items (deduplication handled by RSSFeedService)
          const newItemCount = await RSSFeedService.storeFeedItems(
            feedId,
            workspaceId,
            items
          );

          this.metrics.rss_items_new_total += newItemCount;

          // Update feed lastFetchedAt and reset failure count
          await RSSFeed.findByIdAndUpdate(feedId, {
            lastFetchedAt: new Date(),
            failureCount: 0,
            lastError: null,
          });

          this.metrics.rss_fetch_success++;

          const duration = Date.now() - startTime;
          this.metrics.rss_fetch_duration_sum += duration;
          this.metrics.rss_fetch_duration_count++;

          logger.info('RSS collection completed', {
            feedId,
            feedUrl,
            itemsFetched: items.length,
            newItems: newItemCount,
            duration,
          });
        },
        {
          ttl: 120000, // 2 minutes
          retryCount: 1,
        }
      );
    } catch (error: unknown) {
      // Check if this is a lock acquisition error
      if (error instanceof Error && error.name === 'LockAcquisitionError') {
        logger.info('RSS collection already in progress by another worker', {
          feedId,
          feedUrl,
        });
        return;
      }

      // Other errors
      this.metrics.rss_fetch_errors_total++;

      const duration = Date.now() - startTime;

      logger.error('RSS collection failed', {
        feedId,
        feedUrl,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      // Update feed with error information
      try {
        await RSSFeed.findByIdAndUpdate(feedId, {
          lastError: error instanceof Error ? error.message : String(error),
          $inc: { failureCount: 1 },
        });

        // Check if feed should be disabled due to repeated failures
        const feed = await RSSFeed.findById(feedId);
        if (feed && feed.failureCount >= 3) {
          await RSSFeed.findByIdAndUpdate(feedId, {
            enabled: false,
          });
          
          logger.warn('RSS feed disabled due to repeated failures', {
            feedId,
            feedUrl,
            failureCount: feed.failureCount,
          });
        }
      } catch (updateError: unknown) {
        logger.error('Failed to update feed error information', {
          feedId,
          error: updateError instanceof Error ? updateError.message : String(updateError),
        });
      }

      throw error;
    }
  }

  /**
   * Increment feed failure count
   */
  private async incrementFeedFailureCount(feedId: string): Promise<void> {
    try {
      const feed = await RSSFeed.findByIdAndUpdate(
        feedId,
        { $inc: { failureCount: 1 } },
        { new: true }
      );

      if (feed && feed.failureCount >= 3) {
        await RSSFeed.findByIdAndUpdate(feedId, {
          enabled: false,
        });
        
        logger.warn('RSS feed disabled due to repeated failures', {
          feedId,
          feedUrl: feed.feedUrl,
          failureCount: feed.failureCount,
        });
      }
    } catch (error: unknown) {
      logger.error('Failed to increment feed failure count', {
        feedId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      concurrency: this.CONCURRENCY,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Get metrics
   */
  getMetrics() {
    const avgDuration = this.metrics.rss_fetch_duration_count > 0
      ? this.metrics.rss_fetch_duration_sum / this.metrics.rss_fetch_duration_count
      : 0;

    return {
      ...this.metrics,
      rss_fetch_duration_avg_ms: Math.round(avgDuration),
    };
  }
}

export const rssCollectorWorker = new RSSCollectorWorker();
