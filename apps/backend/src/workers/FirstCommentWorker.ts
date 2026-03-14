/**
 * First Comment Worker
 * 
 * Processes jobs from the first-comment-queue
 * Posts first comments to social media platforms
 */

import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { FirstCommentJob, FirstCommentJobData } from '../jobs/FirstCommentJob';
import { logger } from '../utils/logger';

export class FirstCommentWorker {
  private worker: Worker<FirstCommentJobData>;
  private firstCommentJob: FirstCommentJob;

  constructor() {
    this.firstCommentJob = new FirstCommentJob();
    
    const redis = getRedisClient();

    this.worker = new Worker<FirstCommentJobData>(
      'first-comment-queue',
      async (job: Job<FirstCommentJobData>) => {
        await this.firstCommentJob.process(job);
      },
      {
        connection: redis,
        concurrency: 5, // Process 5 jobs concurrently
        limiter: {
          max: 50, // Max 50 jobs
          duration: 60000, // per minute
        },
      }
    );

    this.setupEventListeners();
  }

  /**
   * Setup worker event listeners
   */
  private setupEventListeners(): void {
    this.worker.on('completed', (job) => {
      logger.info('First comment job completed', {
        jobId: job.id,
        postId: job.data.postId,
        platform: job.data.platform,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('First comment job failed', {
        jobId: job?.id,
        postId: job?.data?.postId,
        platform: job?.data?.platform,
        error: error.message,
      });
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn('First comment job stalled', {
        jobId,
        alert: 'FIRST_COMMENT_JOB_STALLED',
      });
    });
  }

  /**
   * Start the worker
   */
  start(): void {
    logger.info('First comment worker started', {
      concurrency: 5,
    });
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    await this.worker.close();
    logger.info('First comment worker stopped');
  }

  /**
   * Get worker instance
   */
  getWorker(): Worker<FirstCommentJobData> {
    return this.worker;
  }
}