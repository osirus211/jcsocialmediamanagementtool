/**
 * Analytics Collection Queue
 * 
 * BullMQ queue for collecting post analytics from platform APIs
 */

import { Queue } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';

export const ANALYTICS_COLLECTION_QUEUE_NAME = 'analytics-collection-queue';

export interface AnalyticsCollectionJobData {
  postId: string;
  platform: string;
  socialAccountId: string;
  workspaceId: string;
  platformPostId: string; // Platform-specific post ID
  publishedAt: Date;
  collectionAttempt: number; // 1st, 2nd, 3rd, etc.
  correlationId: string;
}

export class AnalyticsCollectionQueue {
  private static instance: AnalyticsCollectionQueue;
  private queue: Queue<AnalyticsCollectionJobData>;

  private constructor() {
    const queueManager = QueueManager.getInstance();
    
    this.queue = queueManager.getQueue(ANALYTICS_COLLECTION_QUEUE_NAME, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000, // 10s, 100s, 1000s
        },
        removeOnComplete: {
          age: 7 * 24 * 3600, // Keep for 7 days
          count: 10000,
        },
        removeOnFail: {
          age: 30 * 24 * 3600, // Keep failed for 30 days
          count: 5000,
        },
      },
    });

    logger.info('Analytics collection queue initialized');
  }

  static getInstance(): AnalyticsCollectionQueue {
    if (!AnalyticsCollectionQueue.instance) {
      AnalyticsCollectionQueue.instance = new AnalyticsCollectionQueue();
    }
    return AnalyticsCollectionQueue.instance;
  }

  /**
   * Schedule analytics collection for a post
   * 
   * Collection schedule:
   * - 30 minutes after publish
   * - Every 6 hours for 7 days
   * - Daily until 30 days
   */
  async scheduleCollection(data: Omit<AnalyticsCollectionJobData, 'collectionAttempt' | 'correlationId'>): Promise<void> {
    try {
      const publishedAt = new Date(data.publishedAt);
      const now = new Date();
      
      // Collection schedule
      const schedule = [
        { delay: 30 * 60 * 1000, attempt: 1 }, // 30 minutes
        { delay: 6 * 60 * 60 * 1000, attempt: 2 }, // 6 hours
        { delay: 12 * 60 * 60 * 1000, attempt: 3 }, // 12 hours
        { delay: 18 * 60 * 60 * 1000, attempt: 4 }, // 18 hours
        { delay: 24 * 60 * 60 * 1000, attempt: 5 }, // 1 day
        { delay: 2 * 24 * 60 * 60 * 1000, attempt: 6 }, // 2 days
        { delay: 3 * 24 * 60 * 60 * 1000, attempt: 7 }, // 3 days
        { delay: 4 * 24 * 60 * 60 * 1000, attempt: 8 }, // 4 days
        { delay: 5 * 24 * 60 * 60 * 1000, attempt: 9 }, // 5 days
        { delay: 6 * 24 * 60 * 60 * 1000, attempt: 10 }, // 6 days
        { delay: 7 * 24 * 60 * 60 * 1000, attempt: 11 }, // 7 days
        { delay: 14 * 24 * 60 * 60 * 1000, attempt: 12 }, // 14 days
        { delay: 21 * 24 * 60 * 60 * 1000, attempt: 13 }, // 21 days
        { delay: 30 * 24 * 60 * 60 * 1000, attempt: 14 }, // 30 days
      ];

      // Schedule all collection jobs
      for (const { delay, attempt } of schedule) {
        const collectionTime = new Date(publishedAt.getTime() + delay);
        
        // Only schedule if collection time is in the future
        if (collectionTime > now) {
          const delayMs = collectionTime.getTime() - now.getTime();
          
          await this.addCollectionJob({
            ...data,
            collectionAttempt: attempt,
            correlationId: `analytics-${data.postId}-${attempt}`,
          }, delayMs);
        }
      }

      logger.info('Analytics collection scheduled', {
        postId: data.postId,
        platform: data.platform,
        scheduledJobs: schedule.length,
      });
    } catch (error: any) {
      logger.error('Failed to schedule analytics collection', {
        postId: data.postId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add single analytics collection job
   */
  async addCollectionJob(data: AnalyticsCollectionJobData, delayMs: number = 0): Promise<void> {
    try {
      const jobOptions: any = {
        jobId: `analytics-${data.postId}-${data.collectionAttempt}`,
        delay: delayMs,
      };

      await this.queue.add('collect-analytics', data, jobOptions);

      logger.debug('Analytics collection job enqueued', {
        postId: data.postId,
        platform: data.platform,
        attempt: data.collectionAttempt,
        delayMs,
      });
    } catch (error: any) {
      logger.error('Failed to enqueue analytics collection job', {
        postId: data.postId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get queue stats
   */
  async getStats(): Promise<any> {
    const queueManager = QueueManager.getInstance();
    return queueManager.getQueueStats(ANALYTICS_COLLECTION_QUEUE_NAME);
  }

  /**
   * Get queue instance
   */
  getQueue(): Queue<AnalyticsCollectionJobData> {
    return this.queue;
  }
}

export const analyticsCollectionQueue = AnalyticsCollectionQueue.getInstance();
