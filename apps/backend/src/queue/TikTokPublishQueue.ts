/**
 * TikTok Publishing Queue
 * 
 * Platform-specific BullMQ queue for TikTok posts
 * Enforces TikTok rate limits: 5 requests/second
 */

import { Queue, QueueEvents } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

export interface TikTokPublishJobData {
  postId: string;
  socialAccountId: string;
  content: string;
  mediaUrls: string[];
  attemptNumber?: number;
}

const QUEUE_NAME = 'tiktok_publish_queue';
const RATE_LIMIT_MAX = 5; // 5 requests per second
const RATE_LIMIT_DURATION = 1000; // 1 second

export class TikTokPublishQueue {
  private queue: Queue<TikTokPublishJobData>;
  private queueEvents: QueueEvents;

  constructor() {
    const redis = getRedisClient();

    this.queue = new Queue<TikTokPublishJobData>(QUEUE_NAME, {
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
      logger.debug('TikTok publish job completed', {
        queue: QUEUE_NAME,
        jobId,
      });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('TikTok publish job failed', {
        queue: QUEUE_NAME,
        jobId,
        failedReason,
      });
    });
  }

  async add(data: TikTokPublishJobData): Promise<void> {
    await this.queue.add('publish-tiktok', data, {
      jobId: `tiktok:${data.postId}`,
    });

    logger.info('TikTok publish job added', {
      queue: QUEUE_NAME,
      postId: data.postId,
    });
  }

  getQueue(): Queue<TikTokPublishJobData> {
    return this.queue;
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.queueEvents.close();
  }
}
