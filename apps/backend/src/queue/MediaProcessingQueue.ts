/**
 * Media Processing Queue
 * 
 * BullMQ queue for asynchronous media processing
 * Handles image resizing, thumbnail generation, video metadata extraction
 */

import { Queue, QueueEvents } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

export interface MediaProcessingJobData {
  mediaId: string;
  platform: string;
  mediaType: 'image' | 'video' | 'gif';
  fileUrl: string;
  storageKey: string;
  workspaceId: string;
}

const QUEUE_NAME = 'media_processing_queue';

export class MediaProcessingQueue {
  private queue: Queue<MediaProcessingJobData>;
  private queueEvents: QueueEvents;

  constructor() {
    const redis = getRedisClient();

    this.queue = new Queue<MediaProcessingJobData>(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s → 4s → 8s
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep for 24 hours
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
      logger.debug('Media processing job completed', {
        queue: QUEUE_NAME,
        jobId,
      });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Media processing job failed', {
        queue: QUEUE_NAME,
        jobId,
        failedReason,
      });
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      logger.warn('Media processing job stalled', {
        queue: QUEUE_NAME,
        jobId,
      });
    });
  }

  async add(data: MediaProcessingJobData): Promise<void> {
    await this.queue.add('process-media', data, {
      jobId: `media:${data.mediaId}`,
    });

    logger.info('Media processing job added', {
      queue: QUEUE_NAME,
      mediaId: data.mediaId,
      platform: data.platform,
      mediaType: data.mediaType,
    });
  }

  /**
   * Add a specific job type to the queue
   */
  async addJob(jobType: string, data: MediaProcessingJobData): Promise<void> {
    await this.queue.add(jobType, data, {
      jobId: `${jobType}:${data.mediaId}`,
    });

    logger.info('Media processing job added', {
      queue: QUEUE_NAME,
      jobType,
      mediaId: data.mediaId,
      platform: data.platform,
      mediaType: data.mediaType,
    });
  }

  getQueue(): Queue<MediaProcessingJobData> {
    return this.queue;
  }

  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.queueEvents.close();
    logger.info('Media processing queue closed');
  }
}
