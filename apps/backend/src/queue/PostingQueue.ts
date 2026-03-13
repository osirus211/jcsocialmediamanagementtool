import { Queue, Job } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';

/**
 * Posting Queue
 * 
 * Manages post publishing jobs
 * 
 * Features:
 * - Job deduplication (one job per post)
 * - Retry with exponential backoff
 * - Idempotent operations
 * - Multi-worker safe
 * - Crash-safe persistence
 */

export const POSTING_QUEUE_NAME = 'posting-queue';

export interface PostingJobData {
  postId: string;
  workspaceId: string;
  socialAccountId: string;
  platform?: string; // NEW: Platform identifier for multi-platform fanout
  retryCount: number;
  scheduledAt?: string;
  forceFail?: boolean; // TEMPORARY: For retry testing
  isReplay?: boolean; // For replay detection
}

export class PostingQueue {
  private queue: Queue;

  constructor() {
    const queueManager = QueueManager.getInstance();
    this.queue = queueManager.getQueue(POSTING_QUEUE_NAME, {
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
        },
      },
    });

    logger.info('Posting queue initialized');
  }

  /**
   * Add post to publishing queue
   * Uses postId + platform as jobId for deduplication
   */
  async addPost(data: PostingJobData): Promise<Job> {
    try {
      // Include platform in jobId for multi-platform support
      const jobId = data.platform 
        ? `post-${data.postId}-${data.platform}`
        : `post-${data.postId}`;

      // Check if job already exists
      const existingJob = await this.queue.getJob(jobId);
      if (existingJob) {
        const state = await existingJob.getState();
        
        // If job is waiting, delayed, or active, don't add duplicate
        if (['waiting', 'delayed', 'active'].includes(state)) {
          logger.warn('Post already in queue', {
            postId: data.postId,
            platform: data.platform,
            jobId,
            state,
          });
          return existingJob;
        }
      }

      // Add job to queue
      const job = await this.queue.add('publish-post', data, {
        jobId,
        priority: 1,
      });

      logger.info('Post added to publishing queue', {
        postId: data.postId,
        platform: data.platform,
        workspaceId: data.workspaceId,
        jobId: job.id,
      });

      return job;
    } catch (error: any) {
      logger.error('Failed to add post to queue', {
        error: error.message,
        postId: data.postId,
        platform: data.platform,
      });
      throw error;
    }
  }

  /**
   * Add delayed post (for scheduled publishing)
   */
  async addDelayedPost(data: PostingJobData, delay: number): Promise<Job> {
    try {
      // Include platform in jobId for multi-platform support
      const jobId = data.platform 
        ? `post-${data.postId}-${data.platform}`
        : `post-${data.postId}`;

      const job = await this.queue.add('publish-post', data, {
        jobId,
        delay,
        priority: 1,
      });

      logger.info('Delayed post added to queue', {
        postId: data.postId,
        platform: data.platform,
        delay,
        jobId: job.id,
      });

      return job;
    } catch (error: any) {
      logger.error('Failed to add delayed post to queue', {
        error: error.message,
        postId: data.postId,
        platform: data.platform,
      });
      throw error;
    }
  }

  /**
   * Remove post from queue
   */
  async removePost(postId: string): Promise<void> {
    try {
      const jobId = `post-${postId}`;
      const job = await this.queue.getJob(jobId);

      if (job) {
        await job.remove();
        logger.info('Post removed from queue', {
          postId,
          jobId,
        });
      }
    } catch (error: any) {
      logger.error('Failed to remove post from queue', {
        error: error.message,
        postId,
      });
      throw error;
    }
  }

  /**
   * Get job for post
   */
  async getPostJob(postId: string): Promise<Job | undefined> {
    const jobId = `post-${postId}`;
    return this.queue.getJob(jobId);
  }

  /**
   * Check if post is in queue
   */
  async isPostInQueue(postId: string): Promise<boolean> {
    const job = await this.getPostJob(postId);
    if (!job) return false;

    const state = await job.getState();
    return ['waiting', 'delayed', 'active'].includes(state);
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<any> {
    const queueManager = QueueManager.getInstance();
    return queueManager.getQueueStats(POSTING_QUEUE_NAME);
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
    logger.info('Posting queue paused');
  }

  /**
   * Resume queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info('Posting queue resumed');
  }

  /**
   * Clean old jobs
   */
  async clean(grace: number = 24 * 3600 * 1000): Promise<void> {
    const completed = await this.queue.clean(grace, 1000, 'completed');
    const failed = await this.queue.clean(grace * 7, 1000, 'failed');

    logger.info('Posting queue cleaned', {
      completedRemoved: completed.length,
      failedRemoved: failed.length,
    });
  }
}

// Singleton should be created after Redis is connected
