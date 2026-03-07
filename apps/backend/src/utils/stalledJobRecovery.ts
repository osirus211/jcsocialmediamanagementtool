import { Queue, Job } from 'bullmq';
import { logger } from './logger';

/**
 * Stalled Job Auto-Recovery
 * 
 * Detects and recovers stalled jobs after worker restart
 * Preserves retry count and prevents double publishing
 */

export class StalledJobRecovery {
  private queue: Queue;

  constructor(queue: Queue) {
    this.queue = queue;
  }

  /**
   * Recover stalled jobs
   * 
   * Called on worker startup
   */
  async recoverStalledJobs(): Promise<void> {
    try {
      logger.info('Starting stalled job recovery...');

      // Get all active jobs (jobs that were being processed)
      const activeJobs = await this.queue.getActive();

      if (activeJobs.length === 0) {
        logger.info('No stalled jobs found');
        return;
      }

      logger.info('Found potentially stalled jobs', {
        count: activeJobs.length,
      });

      let recoveredCount = 0;
      let skippedCount = 0;

      for (const job of activeJobs) {
        try {
          // Check if job is truly stalled
          const isStalled = await this.isJobStalled(job);

          if (isStalled) {
            await this.recoverJob(job);
            recoveredCount++;
          } else {
            skippedCount++;
          }
        } catch (error: any) {
          logger.error('Failed to recover job', {
            jobId: job.id,
            error: error.message,
          });
        }
      }

      logger.info('Stalled job recovery completed', {
        total: activeJobs.length,
        recovered: recoveredCount,
        skipped: skippedCount,
      });
    } catch (error: any) {
      logger.error('Stalled job recovery failed', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Check if job is truly stalled
   */
  private async isJobStalled(job: Job): Promise<boolean> {
    try {
      // Get job state
      const state = await job.getState();

      // If job is no longer active, it's not stalled
      if (state !== 'active') {
        return false;
      }

      // Check job's processedOn timestamp
      if (job.processedOn) {
        const now = Date.now();
        const processingTime = now - job.processedOn;
        
        // If processing for > 10 minutes, consider stalled
        if (processingTime > 10 * 60 * 1000) {
          logger.warn('Job processing time exceeded', {
            jobId: job.id,
            processingTime: Math.floor(processingTime / 1000),
          });
          return true;
        }
      }

      return false;
    } catch (error: any) {
      logger.error('Error checking if job is stalled', {
        jobId: job.id,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Recover a stalled job
   */
  private async recoverJob(job: Job): Promise<void> {
    try {
      logger.info('Recovering stalled job', {
        jobId: job.id,
        postId: job.data.postId,
        attemptsMade: job.attemptsMade,
      });

      // Check if job has exceeded max attempts
      const maxAttempts = job.opts.attempts || 3;
      
      if (job.attemptsMade >= maxAttempts) {
        // Job has failed all retries, move to failed
        logger.warn('Stalled job exceeded max attempts, marking as failed', {
          jobId: job.id,
          attemptsMade: job.attemptsMade,
          maxAttempts,
        });

        await job.moveToFailed(
          new Error('Job stalled after max attempts'),
          job.token || '',
          false
        );

        // Update post status to failed
        await this.updatePostStatus(job.data.postId, 'failed');

        return;
      }

      // Check if post was already published
      const wasPublished = await this.checkIfPublished(job.data.postId);

      if (wasPublished) {
        // Post was published, mark job as completed
        logger.info('Stalled job was already published, marking as completed', {
          jobId: job.id,
          postId: job.data.postId,
        });

        await job.moveToCompleted(
          { success: true, recovered: true },
          job.token || '',
          false
        );

        return;
      }

      // Requeue job with preserved retry count
      logger.info('Requeuing stalled job', {
        jobId: job.id,
        postId: job.data.postId,
        attemptsMade: job.attemptsMade,
      });

      // Move job back to waiting state by retrying
      await job.moveToWaitingChildren(job.token || '');

      // Reset post status to scheduled
      await this.updatePostStatus(job.data.postId, 'scheduled');

      logger.info('Stalled job recovered successfully', {
        jobId: job.id,
        postId: job.data.postId,
      });
    } catch (error: any) {
      logger.error('Failed to recover stalled job', {
        jobId: job.id,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Check if post was already published
   */
  private async checkIfPublished(postId: string): Promise<boolean> {
    try {
      // Import Post model dynamically
      const { Post } = await import('../models/Post');

      const post = await Post.findById(postId);

      if (!post) {
        return false;
      }

      // Check if post status is published
      if (post.status === 'published') {
        return true;
      }

      // Check if post has publishedAt timestamp
      if (post.publishedAt) {
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('Error checking if post was published', {
        postId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Update post status
   */
  private async updatePostStatus(postId: string, status: string): Promise<void> {
    try {
      // Import Post model dynamically
      const { Post } = await import('../models/Post');

      await Post.findByIdAndUpdate(postId, {
        status,
        updatedAt: new Date(),
      });

      logger.debug('Post status updated', {
        postId,
        status,
      });
    } catch (error: any) {
      logger.error('Error updating post status', {
        postId,
        status,
        error: error.message,
      });
    }
  }

  /**
   * Monitor for stalled jobs (run periodically)
   */
  async monitorStalledJobs(): Promise<void> {
    try {
      const activeJobs = await this.queue.getActive();

      for (const job of activeJobs) {
        const isStalled = await this.isJobStalled(job);

        if (isStalled) {
          logger.warn('Detected stalled job during monitoring', {
            jobId: job.id,
            postId: job.data.postId,
          });

          await this.recoverJob(job);
        }
      }
    } catch (error: any) {
      logger.error('Error monitoring stalled jobs', {
        error: error.message,
      });
    }
  }
}

/**
 * Start stalled job monitoring
 */
export function startStalledJobMonitoring(queue: Queue): NodeJS.Timeout {
  const recovery = new StalledJobRecovery(queue);

  // Run recovery on startup
  recovery.recoverStalledJobs();

  // Monitor every 5 minutes
  const interval = setInterval(() => {
    recovery.monitorStalledJobs();
  }, 5 * 60 * 1000);

  logger.info('Stalled job monitoring started');

  return interval;
}
