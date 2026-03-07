/**
 * Worker Crash Recovery
 * 
 * Recovers stalled jobs on worker startup
 * Prevents job loss and double publishing
 */

import { Queue } from 'bullmq';
import { logger } from './logger';
import { QueueManager } from '../queue/QueueManager';

export interface RecoveryStats {
  stalledJobs: number;
  recovered: number;
  skipped: number;
  failed: number;
}

export class WorkerCrashRecovery {
  private queueName: string;

  constructor(queueName: string) {
    this.queueName = queueName;
  }

  /**
   * Recover stalled jobs on worker startup
   */
  async recover(): Promise<RecoveryStats> {
    const stats: RecoveryStats = {
      stalledJobs: 0,
      recovered: 0,
      skipped: 0,
      failed: 0,
    };

    try {
      logger.info('Starting worker crash recovery', {
        queueName: this.queueName,
      });

      const queueManager = QueueManager.getInstance();
      const queue = queueManager.getQueue(this.queueName);

      // Get stalled jobs
      const stalledJobs = await queue.getJobs(['active'], 0, 1000);
      stats.stalledJobs = stalledJobs.length;

      if (stalledJobs.length === 0) {
        logger.info('No stalled jobs found', {
          queueName: this.queueName,
        });
        return stats;
      }

      logger.warn('Found stalled jobs', {
        queueName: this.queueName,
        count: stalledJobs.length,
      });

      // Lazy-load models
      const { Post } = await import('../models/Post');
      const { PostStatus } = await import('../models/Post');

      // Process each stalled job
      for (const job of stalledJobs) {
        try {
          const postId = job.data.postId;

          // Check if post was already published
          const post = await Post.findById(postId);

          if (!post) {
            logger.warn('Stalled job post not found', {
              jobId: job.id,
              postId,
            });
            await job.moveToFailed(new Error('Post not found'), '0', true);
            stats.failed++;
            continue;
          }

          // IDEMPOTENCY CHECK: Skip if already published
          if (post.status === PostStatus.PUBLISHED) {
            logger.info('Stalled job already published - skipping', {
              jobId: job.id,
              postId,
              publishedAt: post.publishedAt,
            });
            await job.moveToCompleted('Already published', '0', true);
            stats.skipped++;
            continue;
          }

          // IDEMPOTENCY CHECK: Skip if already failed
          if (post.status === PostStatus.FAILED) {
            logger.info('Stalled job already failed - skipping', {
              jobId: job.id,
              postId,
              errorMessage: post.errorMessage,
            });
            await job.moveToFailed(new Error(post.errorMessage || 'Already failed'), '0', true);
            stats.skipped++;
            continue;
          }

          // IDEMPOTENCY CHECK: Skip if cancelled
          if (post.status === PostStatus.CANCELLED) {
            logger.info('Stalled job cancelled - skipping', {
              jobId: job.id,
              postId,
            });
            await job.moveToFailed(new Error('Post cancelled'), '0', true);
            stats.skipped++;
            continue;
          }

          // Revert post status to scheduled for retry
          post.status = PostStatus.SCHEDULED;
          post.errorMessage = 'Worker crashed - recovering';
          await post.save();

          // Move job to waiting for retry
          // PRESERVE RETRY COUNT: Don't reset attemptsMade
          await job.moveToWaitingChildren('0', {
            child: {
              id: job.id,
              queue: this.queueName,
            },
          });

          logger.info('Stalled job recovered', {
            jobId: job.id,
            postId,
            attemptsMade: job.attemptsMade,
            retryCount: post.retryCount,
          });

          stats.recovered++;
        } catch (error: any) {
          logger.error('Failed to recover stalled job', {
            jobId: job.id,
            error: error.message,
          });
          stats.failed++;
        }
      }

      logger.info('Worker crash recovery completed', {
        queueName: this.queueName,
        stats,
      });

      return stats;
    } catch (error: any) {
      logger.error('Worker crash recovery failed', {
        queueName: this.queueName,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Check for stalled jobs without recovery
   */
  async checkStalled(): Promise<number> {
    try {
      const queueManager = QueueManager.getInstance();
      const queue = queueManager.getQueue(this.queueName);

      const stalledJobs = await queue.getJobs(['active'], 0, 1000);
      
      if (stalledJobs.length > 0) {
        logger.warn('Stalled jobs detected', {
          queueName: this.queueName,
          count: stalledJobs.length,
        });
      }

      return stalledJobs.length;
    } catch (error: any) {
      logger.error('Failed to check stalled jobs', {
        queueName: this.queueName,
        error: error.message,
      });
      return 0;
    }
  }
}
