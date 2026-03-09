/**
 * Evergreen Worker
 * 
 * Automatically republishes evergreen content according to EvergreenRule configuration
 * 
 * Features:
 * - Periodic rule evaluation
 * - Interval-based repost triggering
 * - Content modification (prefix, suffix, hashtag replacement)
 * - Repost counter management
 * - Auto-disable when max reposts reached
 * - Distributed locking to prevent duplicate reposts
 * - Retry with exponential backoff
 * - Metrics tracking
 */

import { Worker, Job } from 'bullmq';
import mongoose from 'mongoose';
import { EVERGREEN_QUEUE_NAME, EvergreenJobData } from '../queue/EvergreenQueue';
import { QueueManager } from '../queue/QueueManager';
import { EvergreenRule, IEvergreenRule } from '../models/EvergreenRule';
import { Post } from '../models/Post';
import { EvergreenService } from '../services/EvergreenService';
import { logger } from '../utils/logger';

export class EvergreenWorker {
  private worker: Worker | null = null;
  private isRunning: boolean = false;

  private readonly CONCURRENCY = 5;

  // Metrics
  private metrics = {
    evergreen_rules_evaluated: 0,
    evergreen_reposts_total: 0,
    evergreen_reposts_success: 0,
    evergreen_reposts_failed: 0,
    evergreen_rules_auto_disabled: 0,
  };

  /**
   * Start worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Evergreen worker already running');
      return;
    }

    const queueManager = QueueManager.getInstance();

    this.worker = queueManager.createWorker(
      EVERGREEN_QUEUE_NAME,
      this.processJob.bind(this),
      {
        concurrency: this.CONCURRENCY,
      }
    );

    this.worker.on('completed', (job) => {
      logger.info('Evergreen evaluation job completed', {
        jobId: job.id,
        ruleId: job.data.ruleId,
      });
    });

    this.worker.on('failed', async (job, error) => {
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        logger.error('Evergreen evaluation job exhausted all retries', {
          jobId: job.id,
          ruleId: job.data.ruleId,
          postId: job.data.postId,
          error: error.message,
        });
      }
    });

    this.isRunning = true;

    logger.info('Evergreen worker started', {
      concurrency: this.CONCURRENCY,
    });
  }

  /**
   * Stop worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.worker) return;

    await this.worker.close();
    this.worker = null;
    this.isRunning = false;

    logger.info('Evergreen worker stopped');
  }

  /**
   * Process evergreen rule evaluation job
   */
  private async processJob(job: Job<EvergreenJobData>): Promise<void> {
    const { ruleId, workspaceId, postId } = job.data;
    const startTime = Date.now();

    this.metrics.evergreen_rules_evaluated++;

    logger.info('Processing evergreen evaluation job', {
      jobId: job.id,
      ruleId,
      postId,
    });

    // Acquire distributed lock to prevent concurrent evaluation of same rule
    const { distributedLockService } = await import('../services/DistributedLockService');
    const lockKey = `lock:evergreen-rule:${ruleId}`;

    try {
      await distributedLockService.withLock(
        lockKey,
        async () => {
          // Load evergreen rule
          const rule = await EvergreenRule.findById(ruleId);
          if (!rule) {
            throw new Error('Evergreen rule not found');
          }

          // Check if rule is still enabled
          if (!rule.enabled) {
            logger.info('Evergreen rule is disabled, skipping evaluation', {
              ruleId,
              postId,
            });
            return;
          }

          // Verify workspace isolation
          if (rule.workspaceId.toString() !== workspaceId) {
            throw new Error('Workspace mismatch');
          }

          // Verify original post still exists
          const originalPost = await Post.findOne({
            _id: new mongoose.Types.ObjectId(postId),
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
          });

          if (!originalPost) {
            logger.warn('Original post not found, disabling rule', {
              ruleId,
              postId,
            });
            await EvergreenRule.findByIdAndUpdate(ruleId, {
              enabled: false,
            });
            return;
          }

          // Check if original post is published
          if (originalPost.status !== 'published') {
            logger.warn('Original post is not published, skipping repost', {
              ruleId,
              postId,
              status: originalPost.status,
            });
            return;
          }

          // Evaluate if repost should be created
          const shouldRepost = this.shouldRepost(rule);

          if (!shouldRepost) {
            logger.debug('Repost interval not elapsed or max reposts reached', {
              ruleId,
              postId,
              repostCount: rule.repostCount,
              maxReposts: rule.maxReposts,
              lastRepostedAt: rule.lastRepostedAt,
            });
            return;
          }

          logger.info('Creating evergreen repost', {
            ruleId,
            postId,
            repostCount: rule.repostCount,
            maxReposts: rule.maxReposts,
          });

          this.metrics.evergreen_reposts_total++;

          // Create repost using EvergreenService
          const repostId = await EvergreenService.createRepost(
            postId,
            workspaceId,
            rule.contentModification
          );

          // Update rule counters
          const updates: any = {
            $inc: { repostCount: 1 },
            lastRepostedAt: new Date(),
          };

          // Auto-disable if max reposts reached
          if (rule.maxReposts !== -1 && rule.repostCount + 1 >= rule.maxReposts) {
            updates.enabled = false;
            this.metrics.evergreen_rules_auto_disabled++;
            
            logger.info('Evergreen rule auto-disabled (max reposts reached)', {
              ruleId,
              postId,
              repostCount: rule.repostCount + 1,
              maxReposts: rule.maxReposts,
            });
          }

          await EvergreenRule.findByIdAndUpdate(ruleId, updates);

          this.metrics.evergreen_reposts_success++;

          const duration = Date.now() - startTime;

          logger.info('Evergreen repost created', {
            ruleId,
            postId,
            repostId,
            repostCount: rule.repostCount + 1,
            duration,
          });
        },
        {
          ttl: 120000, // 2 minutes
          retryCount: 1,
        }
      );
    } catch (error: any) {
      // Check if this is a lock acquisition error
      if (error.name === 'LockAcquisitionError') {
        logger.info('Evergreen evaluation already in progress by another worker', {
          ruleId,
          postId,
        });
        return;
      }

      // Other errors
      this.metrics.evergreen_reposts_failed++;

      const duration = Date.now() - startTime;

      logger.error('Evergreen evaluation failed', {
        ruleId,
        postId,
        error: error.message,
        duration,
      });

      throw error;
    }
  }

  /**
   * Evaluate if repost should be created
   * 
   * Checks:
   * 1. Repost interval has elapsed
   * 2. Repost count has not exceeded max reposts
   */
  private shouldRepost(rule: IEvergreenRule): boolean {
    // Check if max reposts reached (unless unlimited)
    if (rule.maxReposts !== -1 && rule.repostCount >= rule.maxReposts) {
      return false;
    }

    // Check if repost interval has elapsed
    if (!rule.lastRepostedAt) {
      // Never reposted before, allow repost
      return true;
    }

    const now = Date.now();
    const lastRepostedAt = rule.lastRepostedAt.getTime();
    const repostIntervalMs = rule.repostInterval * 24 * 60 * 60 * 1000; // Convert days to ms
    const timeSinceLastRepost = now - lastRepostedAt;

    return timeSinceLastRepost >= repostIntervalMs;
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      concurrency: this.CONCURRENCY,
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

export const evergreenWorker = new EvergreenWorker();
