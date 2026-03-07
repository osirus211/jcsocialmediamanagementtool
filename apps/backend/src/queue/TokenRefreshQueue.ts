/**
 * Token Refresh Queue
 * 
 * BullMQ queue for distributed token refresh
 * Phase 1: Minimal production-safe implementation
 */

import { Queue } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';

export const TOKEN_REFRESH_QUEUE_NAME = 'token-refresh-queue';

export interface TokenRefreshJobData {
  connectionId: string;
  provider: string;
  expiresAt: Date;
  correlationId: string;
}

export class TokenRefreshQueue {
  private static instance: TokenRefreshQueue;
  private queue: Queue<TokenRefreshJobData>;

  private constructor() {
    const queueManager = QueueManager.getInstance();
    
    this.queue = queueManager.getQueue(TOKEN_REFRESH_QUEUE_NAME, {
      defaultJobOptions: {
        attempts: 3, // Step 3: Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 25s, 125s
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000,
        },
        removeOnFail: false, // Keep failed jobs for debugging
      },
    });

    logger.info('Token refresh queue initialized');
  }

  static getInstance(): TokenRefreshQueue {
    if (!TokenRefreshQueue.instance) {
      TokenRefreshQueue.instance = new TokenRefreshQueue();
    }
    return TokenRefreshQueue.instance;
  }

  /**
   * Add token refresh job to queue
   */
  async addRefreshJob(data: TokenRefreshJobData, delayMs: number = 0): Promise<void> {
    try {
      const jobOptions: any = {
        jobId: `refresh-${data.connectionId}`, // Prevent duplicate jobs
      };

      // Add delay if specified (for jitter/storm protection)
      if (delayMs > 0) {
        jobOptions.delay = delayMs;
      }

      await this.queue.add('refresh-token', data, jobOptions);

      logger.debug('Token refresh job enqueued', {
        connectionId: data.connectionId,
        provider: data.provider,
        correlationId: data.correlationId,
        delayMs,
      });
    } catch (error: any) {
      logger.error('Failed to enqueue token refresh job', {
        connectionId: data.connectionId,
        provider: data.provider,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get queue stats
   */
  async getStats(): Promise<any> {
    const queueManager = QueueManager.getInstance();
    return queueManager.getQueueStats(TOKEN_REFRESH_QUEUE_NAME);
  }

  /**
   * Get queue instance (for worker)
   */
  getQueue(): Queue<TokenRefreshJobData> {
    return this.queue;
  }
}

export const tokenRefreshQueue = TokenRefreshQueue.getInstance();
