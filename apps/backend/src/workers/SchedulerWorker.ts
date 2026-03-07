import { Worker, Job } from 'bullmq';
import { QueueManager } from '../queue/QueueManager';
import { SCHEDULER_QUEUE_NAME, SchedulerJobData } from '../queue/SchedulerQueue';
import { Post, PostStatus } from '../models/Post';
import { SocialAccount } from '../models/SocialAccount';
import { PostingQueue } from '../queue/PostingQueue';
import { logger } from '../utils/logger';

/**
 * Scheduler Worker
 * 
 * Dedicated BullMQ worker for processing scheduled posts
 * 
 * Features:
 * - Runs every 60 seconds as repeatable job
 * - Queries MongoDB for eligible posts
 * - Creates multi-platform fanout jobs
 * - Idempotent operations
 * - Distributed lock for safety
 * 
 * Replaces: SchedulerService (polling-based)
 */

export class SchedulerWorker {
  private worker: Worker | null = null;
  private postingQueue: PostingQueue | null = null;
  
  // Metrics
  private metrics = {
    scheduler_runs_total: 0,
    posts_processed_total: 0,
    jobs_created_total: 0,
    errors_total: 0,
  };

  constructor() {
    logger.info('SchedulerWorker initialized');
  }

  /**
   * Get PostingQueue instance
   */
  private getPostingQueue(): PostingQueue {
    if (!this.postingQueue) {
      this.postingQueue = new PostingQueue();
    }
    return this.postingQueue;
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.worker) {
      logger.warn('Scheduler worker already running');
      return;
    }

    const queueManager = QueueManager.getInstance();
    this.worker = queueManager.createWorker(
      SCHEDULER_QUEUE_NAME,
      this.processJob.bind(this),
      {
        concurrency: 1, // Single instance
      }
    );

    logger.info('Scheduler worker started', {
      concurrency: 1,
      interval: '60 seconds',
    });
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.worker) {
      logger.warn('Scheduler worker not running');
      return;
    }

    await this.worker.close();
    this.worker = null;

    logger.info('Scheduler worker stopped');
  }

  /**
   * Process scheduler job
   */
  private async processJob(job: Job<SchedulerJobData>): Promise<any> {
    const startTime = Date.now();
    const { timestamp, runId } = job.data;

    this.metrics.scheduler_runs_total++;

    logger.info('Scheduler run started', {
      worker: 'scheduler',
      runId,
      timestamp,
      jobId: job.id,
    });

    try {
      // Query for eligible posts
      const posts = await this.getEligiblePosts();

      logger.info('Eligible posts found', {
        worker: 'scheduler',
        runId,
        count: posts.length,
        postIds: posts.map(p => p._id.toString()),
      });

      // Process each post
      for (const post of posts) {
        try {
          await this.processPost(post, runId);
          this.metrics.posts_processed_total++;
        } catch (error: any) {
          this.metrics.errors_total++;
          logger.error('Failed to process post', {
            worker: 'scheduler',
            runId,
            postId: post._id,
            error: error.message,
          });
          // Continue with next post
        }
      }

      const duration = Date.now() - startTime;

      logger.info('Scheduler run completed', {
        worker: 'scheduler',
        runId,
        postsProcessed: posts.length,
        duration_ms: duration,
        metrics: { ...this.metrics },
      });

      return {
        success: true,
        postsProcessed: posts.length,
        duration_ms: duration,
      };
    } catch (error: any) {
      this.metrics.errors_total++;
      
      logger.error('Scheduler run failed', {
        worker: 'scheduler',
        runId,
        error: error.message,
        duration_ms: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Get eligible posts for scheduling
   */
  private async getEligiblePosts(): Promise<any[]> {
    const now = new Date();

    const posts = await Post.find({
      status: PostStatus.SCHEDULED,
      scheduledAt: { $lte: now },
    })
      .limit(100) // Process max 100 posts per run
      .sort({ scheduledAt: 1 }) // Oldest first
      .populate('socialAccountId')
      .lean();

    return posts;
  }

  /**
   * Process a single post
   * Creates fanout jobs for all platforms
   */
  private async processPost(post: any, runId: string): Promise<void> {
    const postId = post._id.toString();

    logger.info('Processing scheduled post', {
      worker: 'scheduler',
      runId,
      postId,
      scheduledAt: post.scheduledAt,
    });

    // MULTI-PLATFORM FANOUT: Determine which accounts to publish to
    const accountIds = post.socialAccountIds && post.socialAccountIds.length > 0
      ? post.socialAccountIds
      : [post.socialAccountId];

    // Fetch all social accounts to get platform information
    const accounts = await SocialAccount.find({
      _id: { $in: accountIds },
      workspaceId: post.workspaceId,
      status: 'active', // Only active accounts
    });

    if (accounts.length === 0) {
      logger.warn('No active social accounts found for post', {
        worker: 'scheduler',
        runId,
        postId,
        accountIds: accountIds.map((id: any) => id.toString()),
      });
      
      // Mark post as failed
      await Post.findByIdAndUpdate(postId, {
        status: PostStatus.FAILED,
        errorMessage: 'No active social accounts found',
      });
      
      return;
    }

    // Update post status to QUEUED
    await Post.findByIdAndUpdate(postId, {
      status: PostStatus.QUEUED,
    });

    // Create one job per account/platform
    const postingQueue = this.getPostingQueue();
    
    for (const account of accounts) {
      try {
        await postingQueue.addPost({
          postId,
          workspaceId: post.workspaceId.toString(),
          socialAccountId: account._id.toString(),
          platform: account.provider,
          retryCount: post.retryCount || 0,
          scheduledAt: post.scheduledAt?.toISOString(),
        });

        this.metrics.jobs_created_total++;

        logger.info('Fanout job created', {
          worker: 'scheduler',
          runId,
          postId,
          platform: account.provider,
          socialAccountId: account._id.toString(),
        });
      } catch (error: any) {
        logger.error('Failed to create fanout job', {
          worker: 'scheduler',
          runId,
          postId,
          platform: account.provider,
          error: error.message,
        });
        // Continue with other platforms
      }
    }

    logger.info('Post fanout completed', {
      worker: 'scheduler',
      runId,
      postId,
      platformCount: accounts.length,
      platforms: accounts.map(a => a.provider),
    });
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.worker !== null,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }
}

export const schedulerWorker = new SchedulerWorker();
