/**
 * Analytics Collector Worker
 * 
 * Collects engagement metrics from platform APIs
 */

import { Worker, Job } from 'bullmq';
import { ANALYTICS_COLLECTION_QUEUE_NAME, AnalyticsCollectionJobData } from '../queue/AnalyticsCollectionQueue';
import { QueueManager } from '../queue/QueueManager';
import { PostAnalytics } from '../models/PostAnalytics';
import { SocialAccount } from '../models/SocialAccount';
import { logger } from '../utils/logger';
import {
  recordAnalyticsCollection,
  recordAnalyticsApiLatency,
} from '../config/analyticsMetrics';

export class AnalyticsCollectorWorker {
  private worker: Worker | null = null;
  private isRunning: boolean = false;

  private readonly CONCURRENCY = 3;

  // Metrics
  private metrics = {
    collection_success_total: 0,
    collection_failure_total: 0,
    collection_attempt_total: 0,
  };

  /**
   * Start worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Analytics collector worker already running');
      return;
    }

    const queueManager = QueueManager.getInstance();

    this.worker = queueManager.createWorker(
      ANALYTICS_COLLECTION_QUEUE_NAME,
      this.processJob.bind(this),
      {
        concurrency: this.CONCURRENCY,
      }
    );

    this.worker.on('failed', async (job, error) => {
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        logger.error('Analytics collection job exhausted all retries', {
          postId: job.data.postId,
          platform: job.data.platform,
          attempt: job.data.collectionAttempt,
          error: error.message,
        });
      }
    });

    this.isRunning = true;

    logger.info('Analytics collector worker started', {
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

    logger.info('Analytics collector worker stopped');
  }

  /**
   * Process analytics collection job
   */
  private async processJob(job: Job<AnalyticsCollectionJobData>): Promise<void> {
    const { postId, platform, socialAccountId, platformPostId, collectionAttempt, correlationId } = job.data;
    const startTime = Date.now();

    this.metrics.collection_attempt_total++;

    logger.info('Processing analytics collection job', {
      postId,
      platform,
      attempt: collectionAttempt,
      correlationId,
      jobId: job.id,
    });

    // Acquire distributed lock to prevent concurrent analytics collection
    const { distributedLockService } = await import('../services/DistributedLockService');
    const lockKey = `lock:analytics:${postId}:${platform}`;
    
    try {
      await distributedLockService.withLock(
        lockKey,
        async () => {
          // Get social account
          const account = await SocialAccount.findById(socialAccountId)
            .select('+accessToken');

          if (!account) {
            throw new Error('Social account not found');
          }

          // Get platform adapter
          const adapter = await this.getAnalyticsAdapter(platform);

          // Collect analytics from platform
          const analytics = await adapter.collectAnalytics({
            platformPostId,
            accessToken: account.getDecryptedAccessToken(),
            account,
          });

          // Save analytics to database
          await this.saveAnalytics({
            postId,
            platform,
            socialAccountId,
            workspaceId: account.workspaceId.toString(),
            collectionAttempt,
            analytics,
          });

          const duration = Date.now() - startTime;
          this.metrics.collection_success_total++;

          // Record metrics
          recordAnalyticsCollection(platform, 'success');
          recordAnalyticsApiLatency(platform, duration);

          logger.info('Analytics collection successful', {
            postId,
            platform,
            attempt: collectionAttempt,
            duration,
            metrics: analytics,
          });
        },
        {
          ttl: 60000, // 60 seconds
          retryCount: 1, // Don't retry - if another worker has it, skip
        }
      );
    } catch (error: any) {
      // Check if this is a lock acquisition error
      if (error.name === 'LockAcquisitionError') {
        logger.info('Analytics collection already in progress by another worker', {
          postId,
          platform,
          attempt: collectionAttempt,
        });
        // Skip this job - another worker is processing it
        return;
      }

      // Other errors should be handled normally
      const duration = Date.now() - startTime;
      this.metrics.collection_failure_total++;

      // Record metrics
      recordAnalyticsCollection(platform, 'failure');
      recordAnalyticsApiLatency(platform, duration);

      logger.error('Analytics collection failed', {
        postId,
        platform,
        attempt: collectionAttempt,
        error: error.message,
        duration,
      });

      throw error;
    }
  }

  /**
   * Get analytics adapter for platform
   */
  private async getAnalyticsAdapter(platform: string): Promise<any> {
    switch (platform.toLowerCase()) {
      case 'facebook':
        const { FacebookAnalyticsAdapter } = await import('../adapters/analytics/FacebookAnalyticsAdapter');
        return new FacebookAnalyticsAdapter();
        
      case 'instagram':
        const { InstagramAnalyticsAdapter } = await import('../adapters/analytics/InstagramAnalyticsAdapter');
        return new InstagramAnalyticsAdapter();
        
      case 'twitter':
        const { TwitterAnalyticsAdapter } = await import('../adapters/analytics/TwitterAnalyticsAdapter');
        return new TwitterAnalyticsAdapter();
        
      case 'linkedin':
        const { LinkedInAnalyticsAdapter } = await import('../adapters/analytics/LinkedInAnalyticsAdapter');
        return new LinkedInAnalyticsAdapter();
        
      case 'tiktok':
        const { TikTokAnalyticsAdapter } = await import('../adapters/analytics/TikTokAnalyticsAdapter');
        return new TikTokAnalyticsAdapter();
        
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Save analytics to database
   */
  private async saveAnalytics(data: {
    postId: string;
    platform: string;
    socialAccountId: string;
    workspaceId: string;
    collectionAttempt: number;
    analytics: any;
  }): Promise<void> {
    try {
      // Upsert analytics (update if exists, create if not)
      await PostAnalytics.findOneAndUpdate(
        {
          postId: data.postId,
          collectionAttempt: data.collectionAttempt,
        },
        {
          postId: data.postId,
          platform: data.platform,
          socialAccountId: data.socialAccountId,
          workspaceId: data.workspaceId,
          collectionAttempt: data.collectionAttempt,
          collectedAt: new Date(),
          ...data.analytics,
        },
        {
          upsert: true,
          new: true,
        }
      );

      logger.debug('Analytics saved to database', {
        postId: data.postId,
        attempt: data.collectionAttempt,
      });

      // Emit post.analytics.updated event for workflow automation
      try {
        const { EventDispatcherService } = await import('../services/EventDispatcherService');
        
        // Emit event for each metric that might have thresholds
        const metrics = ['likes', 'comments', 'shares', 'views', 'impressions', 'engagementRate'];
        for (const metric of metrics) {
          if (data.analytics[metric] !== undefined) {
            await EventDispatcherService.handleEvent({
              eventId: `analytics-updated-${data.postId}-${metric}-${Date.now()}`,
              eventType: 'post.analytics.updated',
              workspaceId: data.workspaceId,
              timestamp: new Date(),
              data: {
                postId: data.postId,
                platform: data.platform,
                metric,
                currentValue: data.analytics[metric],
                collectionAttempt: data.collectionAttempt,
              },
            });
          }
        }
        logger.debug('post.analytics.updated events emitted', { postId: data.postId });
      } catch (eventError: any) {
        // Event emission failure should NOT block analytics save
        logger.warn('Failed to emit post.analytics.updated event (non-blocking)', {
          postId: data.postId,
          error: eventError.message,
        });
      }
    } catch (error: any) {
      logger.error('Failed to save analytics', {
        postId: data.postId,
        error: error.message,
      });
      throw error;
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
    return { ...this.metrics };
  }
}

export const analyticsCollectorWorker = new AnalyticsCollectorWorker();
