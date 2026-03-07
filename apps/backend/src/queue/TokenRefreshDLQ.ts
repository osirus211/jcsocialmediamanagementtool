/**
 * Token Refresh Dead Letter Queue
 * 
 * Handles permanently failed token refresh jobs
 * Phase 1: Minimal implementation
 */

import { Queue, Job } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';
import { getRedisClientSafe } from '../config/redis';
import { SocialAccount, AccountStatus } from '../models/SocialAccount';

export const TOKEN_REFRESH_DLQ_NAME = 'token-refresh-dlq';

export interface TokenRefreshDLQData {
  originalJobId: string;
  connectionId: string;
  provider: string;
  attempts: number;
  error: string;
  errorStack?: string;
  failedAt: Date;
  correlationId: string;
  originalData: any;
}

export class TokenRefreshDLQ {
  private static instance: TokenRefreshDLQ;
  private queue: Queue;

  private constructor() {
    const queueManager = QueueManager.getInstance();
    
    this.queue = queueManager.getQueue(TOKEN_REFRESH_DLQ_NAME, {
      defaultJobOptions: {
        attempts: 1, // DLQ jobs are not retried
        removeOnComplete: false, // Keep completed jobs
        removeOnFail: false, // Keep failed jobs
      },
    });

    logger.info('Token refresh DLQ initialized');
  }

  static getInstance(): TokenRefreshDLQ {
    if (!TokenRefreshDLQ.instance) {
      TokenRefreshDLQ.instance = new TokenRefreshDLQ();
    }
    return TokenRefreshDLQ.instance;
  }

  /**
   * Move failed job to DLQ
   */
  async moveToDeadLetter(job: Job, error: Error): Promise<void> {
    try {
      const dlqData: TokenRefreshDLQData = {
        originalJobId: job.id || 'unknown',
        connectionId: job.data.connectionId,
        provider: job.data.provider,
        attempts: job.attemptsMade,
        error: error.message,
        errorStack: error.stack,
        failedAt: new Date(),
        correlationId: job.data.correlationId,
        originalData: job.data,
      };

      // Add to DLQ
      const dlqJob = await this.queue.add('failed-refresh', dlqData, {
        jobId: `dlq-refresh-${job.data.connectionId}-${Date.now()}`,
      });

      logger.error('Token refresh job moved to DLQ', {
        originalJobId: job.id,
        dlqJobId: dlqJob.id,
        connectionId: job.data.connectionId,
        provider: job.data.provider,
        attempts: job.attemptsMade,
        error: error.message,
        correlationId: job.data.correlationId,
      });

      // Store in Redis for quick lookup
      const redis = getRedisClientSafe();
      if (redis) {
        await redis.setex(
          `oauth:refresh:dlq:${job.data.connectionId}`,
          7 * 24 * 3600, // 7 days
          JSON.stringify({
            dlqJobId: dlqJob.id,
            failedAt: dlqData.failedAt,
            error: error.message,
          })
        );
      }

      // Mark account as requiring attention
      await this.markAccountFailed(job.data.connectionId, error.message);
    } catch (dlqError: any) {
      logger.error('CRITICAL: Failed to move job to DLQ', {
        jobId: job.id,
        connectionId: job.data.connectionId,
        error: dlqError.message,
        stack: dlqError.stack,
      });
    }
  }

  /**
   * Mark account as failed in database
   */
  private async markAccountFailed(connectionId: string, error: string): Promise<void> {
    try {
      await SocialAccount.findByIdAndUpdate(connectionId, {
        status: AccountStatus.REFRESH_FAILED,
        lastError: error,
        lastErrorAt: new Date(),
      });

      logger.info('Account marked as refresh failed', {
        connectionId,
        error,
      });
    } catch (err: any) {
      logger.error('Failed to mark account as failed', {
        connectionId,
        error: err.message,
      });
    }
  }

  /**
   * Get DLQ job by connection ID
   */
  async getByConnectionId(connectionId: string): Promise<Job | null> {
    try {
      const redis = getRedisClientSafe();
      if (!redis) return null;

      const data = await redis.get(`oauth:refresh:dlq:${connectionId}`);
      
      if (!data) {
        return null;
      }

      const { dlqJobId } = JSON.parse(data);
      return this.queue.getJob(dlqJobId);
    } catch (error: any) {
      logger.error('Failed to get DLQ job by connection ID', {
        connectionId,
        error: error.message,
      });
      return null;
    }
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
   * Get all DLQ jobs
   */
  async getAll(start: number = 0, end: number = 100): Promise<Job[]> {
    return this.queue.getJobs(['waiting', 'completed', 'failed'], start, end);
  }
}

export const tokenRefreshDLQ = TokenRefreshDLQ.getInstance();
