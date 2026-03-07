import { Queue, Job } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';

/**
 * Refresh Queue
 * 
 * Separate queue for token refresh operations
 * 
 * Features:
 * - Dedicated queue for token refresh (separate from publish queue)
 * - Priority-based refresh (urgent vs scheduled)
 * - Deduplication (prevent duplicate refresh jobs)
 * - Retry with exponential backoff
 * - Refresh scheduling (proactive refresh before expiry)
 * 
 * Why separate queue?
 * - Token refresh is critical infrastructure
 * - Should not compete with publish jobs for resources
 * - Different retry strategies (more aggressive for refresh)
 * - Different monitoring and alerting
 */

export const REFRESH_QUEUE_NAME = 'token-refresh-queue';

export interface RefreshJobData {
  accountId: string;
  workspaceId: string;
  platform: string;
  priority: 'urgent' | 'scheduled'; // urgent = token expired, scheduled = proactive refresh
  triggeredBy: 'expiry' | 'publish' | 'scheduled' | 'manual';
  expiresAt?: Date;
}

export class RefreshQueue {
  private static instance: RefreshQueue;
  private queue: Queue;

  private constructor() {
    const queueManager = QueueManager.getInstance();
    this.queue = queueManager.getQueue(REFRESH_QUEUE_NAME, {
      defaultJobOptions: {
        attempts: 5, // More retries for refresh (critical operation)
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s, 4s, 8s, 16s, 32s
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed for 7 days
          count: 5000,
        },
      },
    });

    logger.info('RefreshQueue initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RefreshQueue {
    if (!RefreshQueue.instance) {
      RefreshQueue.instance = new RefreshQueue();
    }
    return RefreshQueue.instance;
  }

  /**
   * Add urgent refresh job
   * 
   * Used when token is expired or about to expire
   * High priority, processed immediately
   */
  async addUrgentRefresh(data: Omit<RefreshJobData, 'priority'>): Promise<Job> {
    const jobId = `refresh:urgent:${data.accountId}`;

    const job = await this.queue.add(
      'urgent-refresh',
      {
        ...data,
        priority: 'urgent',
      },
      {
        jobId,
        priority: 1, // Highest priority
        attempts: 5,
      }
    );

    logger.info('Urgent refresh job added', {
      accountId: data.accountId,
      platform: data.platform,
      triggeredBy: data.triggeredBy,
      jobId: job.id,
    });

    return job;
  }

  /**
   * Add scheduled refresh job
   * 
   * Used for proactive token refresh before expiry
   * Lower priority, can be delayed
   */
  async addScheduledRefresh(
    data: Omit<RefreshJobData, 'priority'>,
    delay?: number
  ): Promise<Job> {
    const jobId = `refresh:scheduled:${data.accountId}`;

    const job = await this.queue.add(
      'scheduled-refresh',
      {
        ...data,
        priority: 'scheduled',
      },
      {
        jobId,
        priority: 5, // Lower priority
        delay, // Optional delay
        attempts: 3, // Fewer retries for scheduled
      }
    );

    logger.info('Scheduled refresh job added', {
      accountId: data.accountId,
      platform: data.platform,
      delay,
      jobId: job.id,
    });

    return job;
  }

  /**
   * Schedule proactive refresh
   * 
   * Schedules refresh job to run before token expires
   * Default: 5 minutes before expiry
   */
  async scheduleProactiveRefresh(
    accountId: string,
    workspaceId: string,
    platform: string,
    expiresAt: Date,
    thresholdMinutes: number = 5
  ): Promise<Job | null> {
    const now = new Date();
    const expiryTime = new Date(expiresAt);
    const refreshTime = new Date(expiryTime.getTime() - thresholdMinutes * 60 * 1000);

    // If refresh time is in the past, schedule immediately
    if (refreshTime <= now) {
      return this.addUrgentRefresh({
        accountId,
        workspaceId,
        platform,
        triggeredBy: 'expiry',
        expiresAt,
      });
    }

    // Calculate delay
    const delay = refreshTime.getTime() - now.getTime();

    return this.addScheduledRefresh(
      {
        accountId,
        workspaceId,
        platform,
        triggeredBy: 'scheduled',
        expiresAt,
      },
      delay
    );
  }

  /**
   * Cancel refresh job
   */
  async cancelRefresh(accountId: string, priority: 'urgent' | 'scheduled'): Promise<void> {
    const jobId = `refresh:${priority}:${accountId}`;
    const job = await this.queue.getJob(jobId);

    if (job) {
      await job.remove();
      logger.info('Refresh job cancelled', { accountId, priority, jobId });
    }
  }

  /**
   * Get refresh job status
   */
  async getRefreshStatus(accountId: string): Promise<any> {
    const urgentJobId = `refresh:urgent:${accountId}`;
    const scheduledJobId = `refresh:scheduled:${accountId}`;

    const [urgentJob, scheduledJob] = await Promise.all([
      this.queue.getJob(urgentJobId),
      this.queue.getJob(scheduledJobId),
    ]);

    const result: any = {
      hasUrgent: false,
      hasScheduled: false,
    };

    if (urgentJob) {
      result.hasUrgent = true;
      result.urgentState = await urgentJob.getState();
      result.urgentAttempts = urgentJob.attemptsMade;
    }

    if (scheduledJob) {
      result.hasScheduled = true;
      result.scheduledState = await scheduledJob.getState();
      result.scheduledDelay = scheduledJob.opts.delay;
    }

    return result;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<any> {
    const queueManager = QueueManager.getInstance();
    return queueManager.getQueueStats(REFRESH_QUEUE_NAME);
  }

  /**
   * Get queue instance (for worker creation)
   */
  getQueue(): Queue {
    return this.queue;
  }
}

// Export singleton instance
export const refreshQueue = RefreshQueue.getInstance();
