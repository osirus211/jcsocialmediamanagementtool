/**
 * Dead Letter Queue (DLQ)
 * 
 * Stores permanently failed jobs for analysis and manual recovery
 * Prevents job loss and enables debugging
 */

import { Queue, Job } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';
import { getRedisClient } from '../config/redis';

export const DLQ_NAME = 'dead-letter-queue';

export interface DeadLetterJobData {
  originalQueue: string;
  originalJobId: string;
  postId: string;
  workspaceId: string;
  socialAccountId?: string;
  attempts: number;
  error: string;
  errorStack?: string;
  failedAt: Date;
  originalData: any;
  metadata: {
    lastAttemptAt?: Date;
    retryHistory?: Array<{
      attempt: number;
      error: string;
      timestamp: Date;
    }>;
  };
}

export class DeadLetterQueue {
  private queue: Queue;
  private static instance: DeadLetterQueue;

  private constructor() {
    const queueManager = QueueManager.getInstance();
    this.queue = queueManager.getQueue(DLQ_NAME, {
      defaultJobOptions: {
        attempts: 1, // DLQ jobs are not retried
        removeOnComplete: false, // Keep completed jobs
        removeOnFail: false, // Keep failed jobs
      },
    });

    logger.info('Dead Letter Queue initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DeadLetterQueue {
    if (!DeadLetterQueue.instance) {
      DeadLetterQueue.instance = new DeadLetterQueue();
    }
    return DeadLetterQueue.instance;
  }

  /**
   * Move failed job to DLQ
   */
  async moveToDeadLetter(
    originalQueue: string,
    job: Job,
    error: Error
  ): Promise<void> {
    try {
      const dlqData: DeadLetterJobData = {
        originalQueue,
        originalJobId: job.id || 'unknown',
        postId: job.data.postId,
        workspaceId: job.data.workspaceId,
        socialAccountId: job.data.socialAccountId,
        attempts: job.attemptsMade,
        error: error.message,
        errorStack: error.stack,
        failedAt: new Date(),
        originalData: job.data,
        metadata: {
          lastAttemptAt: job.processedOn ? new Date(job.processedOn) : undefined,
          retryHistory: [],
        },
      };

      // Add to DLQ
      const dlqJob = await this.queue.add('failed-job', dlqData, {
        jobId: `dlq-${originalQueue}-${job.id}`,
      });

      logger.warn('Job moved to Dead Letter Queue', {
        originalQueue,
        originalJobId: job.id,
        dlqJobId: dlqJob.id,
        postId: job.data.postId,
        attempts: job.attemptsMade,
        error: error.message,
      });

      // Store in Redis for quick lookup
      const redis = getRedisClient();
      await redis.setex(
        `dlq:post:${job.data.postId}`,
        7 * 24 * 3600, // 7 days
        JSON.stringify({
          dlqJobId: dlqJob.id,
          failedAt: dlqData.failedAt,
          error: error.message,
        })
      );
    } catch (dlqError: any) {
      logger.error('CRITICAL: Failed to move job to DLQ', {
        originalQueue,
        jobId: job.id,
        postId: job.data.postId,
        error: dlqError.message,
        stack: dlqError.stack,
      });
    }
  }

  /**
   * Get DLQ job by post ID
   */
  async getByPostId(postId: string): Promise<Job | null> {
    try {
      const redis = getRedisClient();
      const data = await redis.get(`dlq:post:${postId}`);
      
      if (!data) {
        return null;
      }

      const { dlqJobId } = JSON.parse(data);
      return this.queue.getJob(dlqJobId);
    } catch (error: any) {
      logger.error('Failed to get DLQ job by post ID', {
        postId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get all DLQ jobs
   */
  async getAll(start: number = 0, end: number = 100): Promise<Job[]> {
    return this.queue.getJobs(['waiting', 'completed', 'failed'], start, end);
  }

  /**
   * Get DLQ statistics
   */
  async getStats(): Promise<any> {
    const [waiting, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return {
      total: waiting + completed + failed,
      waiting,
      completed,
      failed,
    };
  }

  /**
   * Retry job from DLQ
   * Moves job back to original queue
   */
  async retryJob(dlqJobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(dlqJobId);
      
      if (!job) {
        logger.error('DLQ job not found', { dlqJobId });
        return false;
      }

      const data = job.data as DeadLetterJobData;
      
      // Add back to original queue
      const queueManager = QueueManager.getInstance();
      await queueManager.addJob(
        data.originalQueue,
        'publish-post',
        data.originalData,
        {
          jobId: `retry-${data.originalJobId}-${Date.now()}`,
        }
      );

      // Remove from DLQ
      await job.remove();

      // Remove from Redis
      const redis = getRedisClient();
      await redis.del(`dlq:post:${data.postId}`);

      logger.info('Job retried from DLQ', {
        dlqJobId,
        originalQueue: data.originalQueue,
        postId: data.postId,
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to retry job from DLQ', {
        dlqJobId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Clean old DLQ jobs
   */
  async clean(olderThanDays: number = 30): Promise<number> {
    const grace = olderThanDays * 24 * 3600 * 1000;
    const jobs = await this.queue.clean(grace, 1000, 'completed');
    
    logger.info('DLQ cleaned', {
      removed: jobs.length,
      olderThanDays,
    });

    return jobs.length;
  }
}
