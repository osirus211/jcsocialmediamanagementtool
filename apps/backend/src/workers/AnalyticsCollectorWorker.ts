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
  private refreshScheduler: NodeJS.Timeout | null = null;

  private readonly CONCURRENCY = 3;
  private readonly REFRESH_INTERVAL_HOURS = 6;

  // Metrics
  private metrics = {
    collection_success_total: 0,
    collection_failure_total: 0,
    collection_attempt_total: 0,
  };

  /**
   * Start worker and refresh scheduler
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

    // Start the 6-hour refresh scheduler
    this.startRefreshScheduler();

    this.isRunning = true;

    logger.info('Analytics collector worker started', {
      concurrency: this.CONCURRENCY,
      refreshIntervalHours: this.REFRESH_INTERVAL_HOURS,
    });
  }

  /**
   * Start the 6-hour refresh scheduler
   */
  private startRefreshScheduler(): void {
    // Run immediately on start
    this.scheduleRefreshJobs();
    
    // Then run every hour to check for posts needing refresh
    this.refreshScheduler = setInterval(() => {
      this.scheduleRefreshJobs();
    }, 60 * 60 * 1000); // Check every hour
  }

  /**
   * Schedule refresh jobs for posts that need updating
   */
  private async scheduleRefreshJobs(): Promise<void> {
    try {
      const { ScheduledPost } = await import('../models/ScheduledPost');
      const mongoose = await import('mongoose');

      // Find posts that need refresh (published posts with no recent analytics)
      const sixHoursAgo = new Date(Date.now() - this.REFRESH_INTERVAL_HOURS * 60 * 60 * 1000);
      
      const postsNeedingRefresh = await ScheduledPost.aggregate([
        {
          $match: {
            status: 'published',
            publishedAt: { $exists: true, $ne: null }
          }
        },
        {
          $lookup: {
            from: 'postanalytics',
            localField: '_id',
            foreignField: 'postId',
            as: 'analytics'
          }
        },
        {
          $match: {
            $or: [
              { analytics: { $size: 0 } }, // No analytics yet
              { 
                'analytics.lastRefreshedAt': { 
                  $not: { $gte: sixHoursAgo } 
                } 
              } // Last refresh was more than 6 hours ago
            ]
          }
        },
        {
          $project: {
            _id: 1,
            platform: 1,
            socialAccountId: 1,
            platformPostId: 1,
            publishedAt: 1
          }
        },
        { $limit: 100 } // Process max 100 posts per run to avoid overwhelming
      ]);

      logger.info(`Found ${postsNeedingRefresh.length} posts needing analytics refresh`);

      // Queue refresh jobs for each post
      const { AnalyticsCollectionQueue } = await import('../queue/AnalyticsCollectionQueue');
      const queue = AnalyticsCollectionQueue.getInstance();

      for (const post of postsNeedingRefresh) {
        if (post.platformPostId) {
          await queue.addCollectionJob({
            postId: post._id.toString(),
            platform: post.platform,
            socialAccountId: post.socialAccountId.toString(),
            workspaceId: post.workspaceId.toString(),
            platformPostId: post.platformPostId,
            publishedAt: post.publishedAt || new Date(),
            collectionAttempt: 1,
            correlationId: `refresh-${Date.now()}-${post._id}`
          });
        }
      }

      if (postsNeedingRefresh.length > 0) {
        logger.info(`Scheduled ${postsNeedingRefresh.length} analytics refresh jobs`);
      }
    } catch (error: any) {
      logger.error('Error scheduling refresh jobs:', error);
    }
  }

  /**
   * Stop worker and refresh scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.worker) return;

    // Stop refresh scheduler
    if (this.refreshScheduler) {
      clearInterval(this.refreshScheduler);
      this.refreshScheduler = null;
    }

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

          // Update lastRefreshedAt timestamp
          await PostAnalytics.findOneAndUpdate(
            { postId, collectionAttempt },
            { lastRefreshedAt: new Date() }
          );

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
