import { postService } from './PostService';
import { PostingQueue } from '../queue/PostingQueue';
import { Post, PostStatus } from '../models/Post';
import { logger } from '../utils/logger';
import { getRedisClient } from '../config/redis';

/**
 * Scheduler Service
 *
 * FALLBACK/RECOVERY MECHANISM for scheduled posts
 * 
 * PRIMARY SCHEDULING: Posts are scheduled via delayed BullMQ jobs created in PostService.schedulePost()
 * 
 * THIS SERVICE: Provides backup polling for:
 * 1. Recovery: Posts scheduled before delayed-queue implementation
 * 2. Missed executions: Worker was down when delayed job should have executed
 * 3. Orphaned posts: Posts marked SCHEDULED but no queue job exists
 * 4. Safety net: Catches any edge cases where queue job creation failed
 * 
 * NORMAL OPERATION: This service should find ZERO eligible posts (all handled by delayed jobs)
 * 
 * HEARTBEAT ADDED (proof of execution)
 * NO LOGIC CHANGED
 */

export class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly POLL_INTERVAL = 30000;
  private readonly LOCK_KEY = 'scheduler:lock';
  private readonly LOCK_TTL = 60;
  private postingQueue: PostingQueue | null = null;
  
  // Metrics tracking
  private metrics = {
    scheduler_runs_total: 0,
    scheduler_drift_total: 0,
    scheduler_drift_sum_ms: 0,
    scheduler_drift_max_ms: 0,
    scheduler_delayed_executions_total: 0,
  };

  private checkRedisAvailability(): boolean {
    try {
      getRedisClient();
      return true;
    } catch {
      return false;
    }
  }

  private getPostingQueue(): PostingQueue {
    if (!this.postingQueue) {
      if (!this.checkRedisAvailability()) {
        throw new Error('Redis not available - cannot create posting queue');
      }
      this.postingQueue = new PostingQueue();
    }
    return this.postingQueue;
  }

  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    if (!this.checkRedisAvailability()) {
      throw new Error('Cannot start scheduler - Redis not available');
    }

    this.isRunning = true;

    console.log('📅 Scheduler Service STARTED');
    logger.info('Scheduler started', {
      pollInterval: this.POLL_INTERVAL,
    });

    // Immediate execution
    this.poll();

    // Interval execution
    this.intervalId = setInterval(() => {
      this.poll();
    }, this.POLL_INTERVAL);
  }

  stop(): void {
    if (!this.isRunning) return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  /**
   * HEARTBEAT MOVED HERE (correct place)
   */
  private async poll(): Promise<void> {
    // Increment scheduler runs metric
    this.metrics.scheduler_runs_total++;
    
    console.log('🔄 SCHEDULER HEARTBEAT', new Date().toISOString());
    console.log('🔍 SCHEDULER: Attempting to acquire lock...');

    const lockAcquired = await this.acquireLock();

    console.log('🔍 SCHEDULER: Lock acquired?', lockAcquired);

    if (!lockAcquired) {
      logger.debug('Could not acquire scheduler lock, skipping poll');
      console.log('⚠️  SCHEDULER: Could not acquire lock, skipping');
      return;
    }

    try {
      console.log('🔍 SCHEDULER: Starting poll...');
      logger.debug('Scheduler polling for eligible posts');

      await this.autoRepairStuckPosts();

      console.log('🔍 SCHEDULER: Fetching eligible posts...');
      const posts = await postService.getEligiblePostsForQueue(100);

      console.log('🔍 SCHEDULER: Found', posts.length, 'eligible posts');

      if (!posts.length) {
        logger.debug('No eligible posts found');
        return;
      }

      logger.info('Found eligible posts', { count: posts.length });

      for (const post of posts) {
        try {
          await this.enqueuePost(post);
        } catch (error: any) {
          logger.error('Failed to enqueue post', {
            postId: post._id,
            error: error.message,
          });
        }
      }

      logger.info('Scheduler poll completed', {
        processed: posts.length,
      });

    } catch (error: any) {
      console.error('❌ SCHEDULER ERROR:', error);
      logger.error('Scheduler poll error', {
        error: error.message,
      });
    } finally {
      await this.releaseLock();
    }
  }

  private async enqueuePost(post: any): Promise<void> {
    const postId = post._id.toString();
    console.log('🔍 SCHEDULER: Enqueuing post', postId);
    const redis = getRedisClient();
    const lockKey = `post:queued:${postId}`;

    try {
      const existingLock = await redis.get(lockKey);
      if (existingLock) {
        console.log('⚠️  SCHEDULER: Post already has lock', postId);
        return;
      }

      await redis.setex(lockKey, 300, Date.now().toString());

      const queue = this.getPostingQueue();

      // DRIFT DETECTION: Measure delay between scheduled time and now
      if (post.scheduledAt) {
        const scheduledTime = new Date(post.scheduledAt).getTime();
        const now = Date.now();
        const drift = now - scheduledTime;
        
        if (drift > 0) {
          // Post is late
          this.metrics.scheduler_drift_total++;
          this.metrics.scheduler_drift_sum_ms += drift;
          this.metrics.scheduler_drift_max_ms = Math.max(this.metrics.scheduler_drift_max_ms, drift);
          
          // Alert if drift > 60 seconds
          if (drift > 60000) {
            this.metrics.scheduler_delayed_executions_total++;
            logger.warn('Scheduler drift detected - post delayed', {
              postId,
              scheduledAt: post.scheduledAt,
              drift_ms: drift,
              drift_seconds: Math.floor(drift / 1000),
              alert: 'SCHEDULER_DRIFT_THRESHOLD_EXCEEDED',
            });
          } else {
            logger.debug('Scheduler drift measured', {
              postId,
              drift_ms: drift,
              drift_seconds: Math.floor(drift / 1000),
            });
          }
        }
      }

      console.log('🔍 SCHEDULER: Updating post status to queued', postId);
      await postService.updatePostStatus(postId, PostStatus.QUEUED as any);

      // MULTI-PLATFORM FANOUT: Determine which accounts to publish to
      const { SocialAccount } = await import('../models/SocialAccount');
      const accountIds = post.socialAccountIds && post.socialAccountIds.length > 0
        ? post.socialAccountIds
        : [post.socialAccountId];

      // Fetch all social accounts to get platform information
      const accounts = await SocialAccount.find({
        _id: { $in: accountIds },
        workspaceId: post.workspaceId,
      });

      if (accounts.length === 0) {
        throw new Error('No valid social accounts found');
      }

      // Create one job per account/platform
      for (const account of accounts) {
        const inQueue = await queue.isPostInQueue(postId);
        if (inQueue) {
          console.log('⚠️  SCHEDULER: Post already in queue', postId, account.provider);
          continue;
        }

        console.log('🔍 SCHEDULER: Adding post to queue', postId, account.provider);
        await queue.addPost({
          postId,
          workspaceId: post.workspaceId.toString(),
          socialAccountId: account._id.toString(),
          platform: account.provider, // Include platform for idempotency
          retryCount: post.retryCount || 0,
          scheduledAt: post.scheduledAt?.toISOString(),
        });

        logger.info('Post enqueued successfully', { 
          postId,
          platform: account.provider,
          socialAccountId: account._id,
        });
        console.log('✅ SCHEDULER: Post enqueued successfully', postId, account.provider);
      }

    } catch (error: any) {
      console.error('❌ SCHEDULER: Failed to enqueue post', postId, error);
      logger.error('Failed to enqueue post', {
        postId,
        error: error.message,
      });

      try {
        await redis.del(lockKey);
      } catch {}

      try {
        await postService.updatePostStatus(
          postId,
          PostStatus.SCHEDULED as any
        );
      } catch {}

      throw error;
    }
  }

  private async autoRepairStuckPosts(): Promise<void> {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const stuckPosts = await Post.find({
        status: PostStatus.PUBLISHING,
        updatedAt: { $lt: tenMinutesAgo },
      }).select('_id updatedAt');

      if (!stuckPosts.length) return;

      const postIds = stuckPosts.map(p => p._id);
      const now = new Date();

      await Post.updateMany(
        { _id: { $in: postIds }, status: PostStatus.PUBLISHING },
        {
          $set: {
            status: PostStatus.FAILED,
            errorMessage: 'Auto-recovered from stuck publishing state',
            'metadata.failedAt': now,
          },
        }
      );

      logger.warn('Auto-repaired stuck publishing posts', {
        repairedCount: postIds.length,
      });

    } catch (error: any) {
      logger.error('Failed to auto-repair stuck posts', {
        error: error.message,
      });
    }
  }

  private async acquireLock(): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const result = await redis.set(
        this.LOCK_KEY,
        Date.now().toString(),
        'EX',
        this.LOCK_TTL,
        'NX'
      );
      return result === 'OK';
    } catch {
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(this.LOCK_KEY);
    } catch {}
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      pollInterval: this.POLL_INTERVAL,
    };
  }

  getMetrics() {
    return { ...this.metrics };
  }

  async forcePoll(): Promise<void> {
    await this.poll();
  }
}

export const schedulerService = new SchedulerService();