/**
 * Twitter Publishing Queue
 * 
 * Platform-specific BullMQ queue for Twitter posts
 * Enforces Twitter rate limits: 10 requests/second
 */

import { Queue, QueueEvents } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

export interface TwitterPublishJobData {
  postId: string;
  socialAccountId: string;
  content: string;
  mediaUrls: string[];
  attemptNumber?: number;
}

const QUEUE_NAME = 'twitter_publish_queue';
const RATE_LIMIT_MAX = 10; // 10 requests per second
const RATE_LIMIT_DURATION = 1000; // 1 second

export class TwitterPublishQueue {
  private queue: Queue<TwitterPublishJobData>;
  private queueEvents: QueueEvents;

  constructor() {
    const redis = getRedisClient();

    this.queue = new Queue<TwitterPublishJobData>(QUEUE_NAME, {
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
      logger.debug('Twitter publish job completed', {
        queue: QUEUE_NAME,
        jobId,
      });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Twitter publish job failed', {
        queue: QUEUE_NAME,
        jobId,
        failedReason,
      });
    });
  }

  async add(data: TwitterPublishJobData): Promise<void> {
    await this.queue.add('publish-twitter', data, {
      jobId: `twitter:${data.postId}`,
    });

    logger.info('Twitter publish job added', {
      queue: QUEUE_NAME,
      postId: data.postId,
    });
  }

  getQueue(): Queue<TwitterPublishJobData> {
    return this.queue;
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.queueEvents.close();
  }
}
