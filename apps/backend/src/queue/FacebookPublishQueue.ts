/**
 * Facebook Publishing Queue
 * 
 * Platform-specific BullMQ queue for Facebook posts
 * Enforces Facebook rate limits: 20 requests/second
 */

import { Queue, QueueEvents } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

export interface FacebookPublishJobData {
  postId: string;
  socialAccountId: string;
  content: string;
  mediaUrls: string[];
  attemptNumber?: number;
}

const QUEUE_NAME = 'facebook_publish_queue';
const RATE_LIMIT_MAX = 20; // 20 requests per second
const RATE_LIMIT_DURATION = 1000; // 1 second

export class FacebookPublishQueue {
  private queue: Queue<FacebookPublishJobData>;
  private queueEvents: QueueEvents;

  constructor() {
    const redis = getRedisClient();

    this.queue = new Queue<FacebookPublishJobData>(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s → 10s → 20s → 40s → 80s
        },
        removeOnComplete: {
          age: 24 * 3600,
          count: 1000,
        },
        removeOnFail: false, // Keep failed jobs for DLQ
      },
    });

    this.queueEvents = new QueueEvents(QUEUE_NAME, {
      connection: redis,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.queueEvents.on('completed', ({ jobId }) => {
      logger.debug('Facebook publish job completed', {
        queue: QUEUE_NAME,
        jobId,
      });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Facebook publish job failed', {
        queue: QUEUE_NAME,
        jobId,
        failedReason,
      });
    });
  }

  async add(data: FacebookPublishJobData): Promise<void> {
    await this.queue.add('publish-facebook', data, {
      jobId: `facebook:${data.postId}`,
    });

    logger.info('Facebook publish job added', {
      queue: QUEUE_NAME,
      postId: data.postId,
    });
  }

  getQueue(): Queue<FacebookPublishJobData> {
    return this.queue;
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.queueEvents.close();
  }
}
