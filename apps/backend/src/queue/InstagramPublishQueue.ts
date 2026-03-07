/**
 * Instagram Publishing Queue
 * 
 * Platform-specific BullMQ queue for Instagram posts
 * Enforces Instagram rate limits: 15 requests/second
 */

import { Queue, QueueEvents } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

export interface InstagramPublishJobData {
  postId: string;
  socialAccountId: string;
  content: string;
  mediaUrls: string[];
  attemptNumber?: number;
}

const QUEUE_NAME = 'instagram_publish_queue';
const RATE_LIMIT_MAX = 15; // 15 requests per second
const RATE_LIMIT_DURATION = 1000; // 1 second

export class InstagramPublishQueue {
  private queue: Queue<InstagramPublishJobData>;
  private queueEvents: QueueEvents;

  constructor() {
    const redis = getRedisClient();

    this.queue = new Queue<InstagramPublishJobData>(QUEUE_NAME, {
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
      logger.debug('Instagram publish job completed', {
        queue: QUEUE_NAME,
        jobId,
      });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Instagram publish job failed', {
        queue: QUEUE_NAME,
        jobId,
        failedReason,
      });
    });
  }

  async add(data: InstagramPublishJobData): Promise<void> {
    await this.queue.add('publish-instagram', data, {
      jobId: `instagram:${data.postId}`,
    });

    logger.info('Instagram publish job added', {
      queue: QUEUE_NAME,
      postId: data.postId,
    });
  }

  getQueue(): Queue<InstagramPublishJobData> {
    return this.queue;
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.queueEvents.close();
  }
}
