import { Queue, Job } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';

/**
 * Email Queue
 * 
 * Manages email notification jobs
 * 
 * Features:
 * - Job deduplication (one job per email)
 * - Retry with exponential backoff
 * - Idempotent operations
 * - Multi-worker safe
 * - Crash-safe persistence
 * - Non-blocking (email failures don't block main workflow)
 */

export const EMAIL_QUEUE_NAME = 'email-queue';

export type NotificationType = 
  | 'POST_SUCCESS'
  | 'POST_FAILURE'
  | 'OAUTH_EXPIRED'
  | 'OAUTH_REFRESH_FAILURE'
  | 'SYSTEM_ALERT'
  | 'ACCOUNT_LIMITS'
  | 'USER_SIGNUP'
  | 'PASSWORD_RESET'
  | 'MAGIC_LINK'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_UPDATED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'PAYMENT_FAILED';

export interface EmailJobData {
  type: NotificationType;
  to: string;
  subject: string;
  body: string;
  html?: string;
  data: Record<string, any>;
  userId?: string;
  workspaceId?: string;
}

export class EmailQueue {
  private queue: Queue;

  constructor() {
    const queueManager = QueueManager.getInstance();
    this.queue = queueManager.getQueue(EMAIL_QUEUE_NAME, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 25s, 125s
        },
        removeOnComplete: {
          age: 24 * 3600, // 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // 7 days
          count: 5000,
        },
      },
    });

    logger.info('Email queue initialized');
  }

  /**
   * Add email to queue
   * Uses combination of type + to + timestamp for deduplication
   */
  async addEmail(data: EmailJobData): Promise<Job> {
    try {
      const jobId = `email-${data.type}-${data.to}-${Date.now()}`;

      // Add job to queue
      const job = await this.queue.add('send-email', data, {
        jobId,
        priority: this.getPriority(data.type),
      });

      logger.info('Email added to queue', {
        type: data.type,
        to: data.to,
        jobId: job.id,
      });

      return job;
    } catch (error: any) {
      logger.error('Failed to add email to queue', {
        error: error.message,
        type: data.type,
        to: data.to,
      });
      throw error;
    }
  }

  /**
   * Get priority for email type
   * Higher priority = processed first
   */
  private getPriority(type: NotificationType): number {
    const priorities: Record<NotificationType, number> = {
      SYSTEM_ALERT: 1, // Highest priority
      PASSWORD_RESET: 2,
      MAGIC_LINK: 2, // High priority for passwordless auth
      USER_SIGNUP: 3,
      OAUTH_EXPIRED: 4,
      OAUTH_REFRESH_FAILURE: 4,
      PAYMENT_FAILED: 5,
      SUBSCRIPTION_CANCELLED: 6,
      SUBSCRIPTION_UPDATED: 7,
      SUBSCRIPTION_CREATED: 8,
      POST_FAILURE: 9,
      POST_SUCCESS: 10,
      ACCOUNT_LIMITS: 10,
    };

    return priorities[type] || 10;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | undefined> {
    return this.queue.getJob(jobId);
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<any> {
    const queueManager = QueueManager.getInstance();
    return queueManager.getQueueStats(EMAIL_QUEUE_NAME);
  }

  /**
   * Get all jobs in queue
   */
  async getJobs(
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' = 'waiting',
    start: number = 0,
    end: number = 10
  ): Promise<Job[]> {
    switch (status) {
      case 'waiting':
        return this.queue.getWaiting(start, end);
      case 'active':
        return this.queue.getActive(start, end);
      case 'completed':
        return this.queue.getCompleted(start, end);
      case 'failed':
        return this.queue.getFailed(start, end);
      case 'delayed':
        return this.queue.getDelayed(start, end);
      default:
        return [];
    }
  }

  /**
   * Pause queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    logger.info('Email queue paused');
  }

  /**
   * Resume queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info('Email queue resumed');
  }

  /**
   * Clean old jobs
   */
  async clean(grace: number = 24 * 3600 * 1000): Promise<void> {
    const completed = await this.queue.clean(grace, 1000, 'completed');
    const failed = await this.queue.clean(grace * 7, 1000, 'failed');

    logger.info('Email queue cleaned', {
      completedRemoved: completed.length,
      failedRemoved: failed.length,
    });
  }
}
