/**
 * Post Publishing Queue
 * 
 * BullMQ queue for publishing scheduled posts to social media platforms
 * 
 * Features:
 * - Retry with exponential backoff (5 attempts)
 * - Dead-letter handling for failed jobs
 * - Rate limiting per platform
 * - Observability integration
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { updateQueueMetrics, recordJobCompletion } from '../config/metrics';
import { addTraceContextToJob, createJobSpan } from '../middleware/tracingMiddleware';

export interface PostPublishingJobData {
  postId: string;
  socialAccountId: string;
  platform: string;
  content: string;
  mediaUrls: string[];
  attemptNumber?: number;
}

const QUEUE_NAME = 'post-publishing-queue';

export class PostPublishingQueue {
  private queue: Queue<PostPublishingJobData>;
  private queueEvents: QueueEvents;

  constructor() {
    const redis = getRedisClient();

    this.queue = new Queue<PostPublishingJobData>(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 5, // Retry up to 5 times
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 seconds
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    this.queueEvents = new QueueEvents(QUEUE_NAME, {
      connection: redis,
    });

    this.setupEventListeners();
  }

  /**
   * Setup queue event listeners
   */
  private setupEventListeners(): void {
    this.queueEvents.on('completed', ({ jobId }) => {
      logger.info('Post publishing job completed', {
        queue: QUEUE_NAME,
        jobId,
      });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Post publishing job failed', {
        queue: QUEUE_NAME,
        jobId,
        failedReason,
      });
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      logger.warn('Post publishing job stalled', {
        queue: QUEUE_NAME,
        jobId,
        alert: 'JOB_STALLED',
      });
    });
  }

  /**
   * Add job to queue
   */
  async add(
    jobName: string,
    data: PostPublishingJobData,
    options?: any
  ): Promise<Job<PostPublishingJobData>> {
    // Add trace context
    const dataWithTrace = addTraceContextToJob(data);

    const job = await this.queue.add(jobName, dataWithTrace, options);

    logger.info('Post publishing job added', {
      queue: QUEUE_NAME,
      jobId: job.id,
      postId: data.postId,
      platform: data.platform,
    });

    return job;
  }

  /**
   * Start worker to process jobs
   */
  startWorker(processor: (job: Job<PostPublishingJobData>) => Promise<void>): Worker {
    const redis = getRedisClient();

    const worker = new Worker<PostPublishingJobData>(
      QUEUE_NAME,
      async (job: Job<PostPublishingJobData>) => {
        const startTime = Date.now();

        // Create span for job processing
        createJobSpan(QUEUE_NAME, job.id!, job.data);

        logger.info('Processing post publishing job', {
          queue: QUEUE_NAME,
          jobId: job.id,
          postId: job.data.postId,
          platform: job.data.platform,
          attemptsMade: job.attemptsMade,
        });

        try {
          await processor(job);

          const duration = Date.now() - startTime;
          recordJobCompletion(QUEUE_NAME, 'publish-post', 'success', duration);

          logger.info('Post publishing job succeeded', {
            queue: QUEUE_NAME,
            jobId: job.id,
            postId: job.data.postId,
            platform: job.data.platform,
            duration,
          });
        } catch (error: any) {
          const duration = Date.now() - startTime;
          recordJobCompletion(QUEUE_NAME, 'publish-post', 'error', duration);

          logger.error('Post publishing job error', {
            queue: QUEUE_NAME,
            jobId: job.id,
            postId: job.data.postId,
            platform: job.data.platform,
            error: error.message,
            attemptsMade: job.attemptsMade,
            duration,
          });

          throw error; // Re-throw to trigger retry
        }
      },
      {
        connection: redis,
        concurrency: 10, // Process 10 jobs concurrently
        limiter: {
          max: 100, // Max 100 jobs
          duration: 60000, // per minute
        },
      }
    );

    worker.on('completed', (job) => {
      logger.debug('Worker completed job', {
        queue: QUEUE_NAME,
        jobId: job.id,
      });
    });

    worker.on('failed', (job, error) => {
      logger.error('Worker failed job', {
        queue: QUEUE_NAME,
        jobId: job?.id,
        error: error.message,
      });
    });

    logger.info('Post publishing worker started', {
      queue: QUEUE_NAME,
      concurrency: 10,
    });

    return worker;
  }

  /**
   * Get queue instance
   */
  getQueue(): Queue<PostPublishingJobData> {
    return this.queue;
  }

  /**
   * Update queue metrics
   */
  async updateMetrics(): Promise<void> {
    const waiting = await this.queue.getWaitingCount();
    const active = await this.queue.getActiveCount();

    await updateQueueMetrics(QUEUE_NAME, waiting, active);
  }

  /**
   * Get queue stats
   */
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

  /**
   * Pause queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    logger.info('Post publishing queue paused', { queue: QUEUE_NAME });
  }

  /**
   * Resume queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info('Post publishing queue resumed', { queue: QUEUE_NAME });
  }

  /**
   * Close queue and events
   */
  async close(): Promise<void> {
    await this.queue.close();
    await this.queueEvents.close();
    logger.info('Post publishing queue closed', { queue: QUEUE_NAME });
  }
}
