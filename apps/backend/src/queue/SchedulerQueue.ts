import { Queue, Job } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';

/**
 * Scheduler Queue
 * 
 * Manages scheduled post processing jobs
 * 
 * Features:
 * - Repeatable job (every 60 seconds)
 * - Single concurrency (one scheduler at a time)
 * - Idempotent operations
 */

export const SCHEDULER_QUEUE_NAME = 'scheduler-queue';

export interface SchedulerJobData {
  timestamp: string;
  runId: string;
}

export class SchedulerQueue {
  private queue: Queue;

  constructor() {
    const queueManager = QueueManager.getInstance();
    this.queue = queueManager.getQueue(SCHEDULER_QUEUE_NAME, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 24 * 3600, // 24 hours
          count: 100,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // 7 days
        },
      },
    });

    logger.info('Scheduler queue initialized');
  }

  /**
   * Add repeatable scheduler job
   * Runs every 60 seconds
   */
  async addRepeatableJob(): Promise<void> {
    try {
      // Remove any existing repeatable jobs first
      const repeatableJobs = await this.queue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        await this.queue.removeRepeatableByKey(job.key);
      }

      // Add new repeatable job
      await this.queue.add(
        'process-scheduled-posts',
        {
          timestamp: new Date().toISOString(),
          runId: `scheduler-${Date.now()}`,
        },
        {
          repeat: {
            every: 60000, // 60 seconds
          },
          jobId: 'scheduler-repeatable',
        }
      );

      logger.info('Scheduler repeatable job added', {
        interval: '60 seconds',
      });
    } catch (error: any) {
      logger.error('Failed to add scheduler repeatable job', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove repeatable job
   */
  async removeRepeatableJob(): Promise<void> {
    try {
      const repeatableJobs = await this.queue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        await this.queue.removeRepeatableByKey(job.key);
      }

      logger.info('Scheduler repeatable job removed');
    } catch (error: any) {
      logger.error('Failed to remove scheduler repeatable job', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<any> {
    const queueManager = QueueManager.getInstance();
    return queueManager.getQueueStats(SCHEDULER_QUEUE_NAME);
  }

  /**
   * Pause queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    logger.info('Scheduler queue paused');
  }

  /**
   * Resume queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info('Scheduler queue resumed');
  }
}
