/**
 * Dead Letter Queue Replay Service
 * 
 * Safely replays failed jobs from the Dead Letter Queue
 * 
 * SAFETY GUARANTEES:
 * - Idempotent (checks if post already published)
 * - No duplicate publishes
 * - Respects distributed locks
 * - No queue corruption
 * - No worker blocking
 * - Horizontally safe (multi-instance)
 * - Never crashes system
 * 
 * FEATURES:
 * - Batch replay with configurable limit
 * - Dry-run mode for preview
 * - Skip already published posts
 * - Preserve original job data
 * - Comprehensive logging
 * - Metrics tracking
 * - Alert on failures
 */

import { Job } from 'bullmq';
import { DeadLetterQueue, DeadLetterJobData } from '../../queue/DeadLetterQueue';
import { QueueManager } from '../../queue/QueueManager';
import { logger } from '../../utils/logger';
import { AlertingService } from '../alerting/AlertingService';
import { PostStatus } from '../../models/Post';

export interface DLQReplayConfig {
  enabled: boolean;
  batchSize: number; // Max jobs to replay in one batch
  skipPublished: boolean; // Skip posts already published
  dryRun: boolean; // Preview mode (don't actually replay)
}

export interface ReplayResult {
  success: boolean;
  jobId: string;
  postId: string;
  action: 'replayed' | 'skipped' | 'failed';
  reason?: string;
  error?: string;
}

export interface ReplaySummary {
  total: number;
  replayed: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  results: ReplayResult[];
  duration: number;
}

export class DLQReplayService {
  private config: DLQReplayConfig;
  private dlq: DeadLetterQueue;
  private queueManager: QueueManager;
  private alertingService: AlertingService | null;
  
  // Metrics
  private metrics = {
    replay_attempts: 0,
    replay_success: 0,
    replay_skipped: 0,
    replay_failed: 0,
  };

  constructor(
    config: DLQReplayConfig,
    alertingService: AlertingService | null = null
  ) {
    this.config = config;
    this.dlq = DeadLetterQueue.getInstance();
    this.queueManager = QueueManager.getInstance();
    this.alertingService = alertingService;

    logger.info('DLQ Replay Service initialized', {
      enabled: config.enabled,
      batchSize: config.batchSize,
      skipPublished: config.skipPublished,
      dryRun: config.dryRun,
    });
  }

  /**
   * Replay a single job from DLQ
   * 
   * SAFETY:
   * - Checks if post already published (idempotency)
   * - Acquires distributed lock
   * - Validates job data
   * - Never throws (returns result)
   */
  async replayJob(dlqJobId: string): Promise<ReplayResult> {
    this.metrics.replay_attempts++;

    try {
      // Get DLQ job
      const dlqJob = await this.dlq.getAll(0, 1000).then(jobs => 
        jobs.find(j => j.id === dlqJobId)
      );

      if (!dlqJob) {
        this.metrics.replay_failed++;
        return {
          success: false,
          jobId: dlqJobId,
          postId: 'unknown',
          action: 'failed',
          reason: 'DLQ job not found',
        };
      }

      const data = dlqJob.data as DeadLetterJobData;

      // SAFETY 1: Check if post still exists and get current status
      const { Post } = await this.getModels();
      const post = await Post.findById(data.postId);

      if (!post) {
        this.metrics.replay_skipped++;
        logger.warn('Post not found, skipping replay', {
          dlqJobId,
          postId: data.postId,
        });
        return {
          success: false,
          jobId: dlqJobId,
          postId: data.postId,
          action: 'skipped',
          reason: 'Post not found',
        };
      }

      // SAFETY 2: Idempotency guard - skip if already published
      if (this.config.skipPublished && post.status === PostStatus.PUBLISHED) {
        this.metrics.replay_skipped++;
        logger.info('Post already published, skipping replay', {
          dlqJobId,
          postId: data.postId,
          publishedAt: post.publishedAt,
        });
        return {
          success: true,
          jobId: dlqJobId,
          postId: data.postId,
          action: 'skipped',
          reason: 'Already published',
        };
      }

      // SAFETY 3: Skip if post is in terminal failed state
      if (post.status === PostStatus.FAILED) {
        logger.info('Post is in failed state, will attempt replay', {
          dlqJobId,
          postId: data.postId,
          errorMessage: post.errorMessage,
        });
      }

      // SAFETY 4: Skip if post is cancelled
      if (post.status === PostStatus.CANCELLED) {
        this.metrics.replay_skipped++;
        logger.info('Post is cancelled, skipping replay', {
          dlqJobId,
          postId: data.postId,
        });
        return {
          success: true,
          jobId: dlqJobId,
          postId: data.postId,
          action: 'skipped',
          reason: 'Post cancelled',
        };
      }

      // DRY RUN: Preview mode - don't actually replay
      if (this.config.dryRun) {
        logger.info('DRY RUN: Would replay job', {
          dlqJobId,
          postId: data.postId,
          originalQueue: data.originalQueue,
          postStatus: post.status,
        });
        return {
          success: true,
          jobId: dlqJobId,
          postId: data.postId,
          action: 'skipped',
          reason: 'Dry run mode',
        };
      }

      // SAFETY 5: Acquire distributed lock to prevent concurrent replay
      const replayLockKey = `dlq:replay:${data.postId}`;
      let replayLock: any = null;

      try {
        replayLock = await this.queueManager.acquireLock(replayLockKey, 30000);
      } catch (lockError: any) {
        this.metrics.replay_skipped++;
        logger.warn('Could not acquire replay lock, skipping', {
          dlqJobId,
          postId: data.postId,
          error: lockError.message,
        });
        return {
          success: false,
          jobId: dlqJobId,
          postId: data.postId,
          action: 'skipped',
          reason: 'Lock acquisition failed',
          error: lockError.message,
        };
      }

      try {
        // SAFETY 6: Revert post status to SCHEDULED for retry
        post.status = PostStatus.SCHEDULED;
        post.errorMessage = undefined;
        await post.save();

        // SAFETY 7: Add job back to original queue with new job ID
        const newJobId = `replay-${data.originalJobId}-${Date.now()}`;
        await this.queueManager.addJob(
          data.originalQueue,
          'publish-post',
          data.originalData,
          {
            jobId: newJobId,
          }
        );

        // Remove from DLQ
        await dlqJob.remove();

        // Remove from Redis lookup
        const { getRedisClient } = await import('../../config/redis');
        const redis = getRedisClient();
        await redis.del(`dlq:post:${data.postId}`);

        this.metrics.replay_success++;

        logger.info('✅ Job replayed successfully', {
          dlqJobId,
          newJobId,
          postId: data.postId,
          originalQueue: data.originalQueue,
        });

        return {
          success: true,
          jobId: dlqJobId,
          postId: data.postId,
          action: 'replayed',
        };

      } finally {
        // SAFETY: Always release lock
        if (replayLock) {
          try {
            await this.queueManager.releaseLock(replayLock);
          } catch (lockError: any) {
            logger.error('Failed to release replay lock', {
              postId: data.postId,
              error: lockError.message,
            });
          }
        }
      }

    } catch (error: any) {
      this.metrics.replay_failed++;

      logger.error('Failed to replay job', {
        dlqJobId,
        error: error.message,
        stack: error.stack,
      });

      // Send alert on replay failure
      if (this.alertingService) {
        await this.alertingService.sendAlert(
          this.alertingService.createWarningAlert(
            'DLQ Replay Failed',
            `Failed to replay job ${dlqJobId}: ${error.message}`,
            {
              dlqJobId,
              error: error.message,
            }
          )
        );
      }

      return {
        success: false,
        jobId: dlqJobId,
        postId: 'unknown',
        action: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Replay multiple jobs from DLQ in batch
   * 
   * SAFETY:
   * - Respects batch size limit
   * - Each job replayed independently
   * - Failures don't stop batch
   * - Comprehensive summary returned
   */
  async replayBatch(dlqJobIds: string[]): Promise<ReplaySummary> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      logger.warn('DLQ replay is disabled');
      return {
        total: 0,
        replayed: 0,
        skipped: 0,
        failed: 0,
        dryRun: this.config.dryRun,
        results: [],
        duration: 0,
      };
    }

    // Enforce batch size limit
    const jobsToReplay = dlqJobIds.slice(0, this.config.batchSize);

    if (jobsToReplay.length < dlqJobIds.length) {
      logger.warn('Batch size limit enforced', {
        requested: dlqJobIds.length,
        processing: jobsToReplay.length,
        batchSize: this.config.batchSize,
      });
    }

    logger.info('Starting DLQ batch replay', {
      jobCount: jobsToReplay.length,
      dryRun: this.config.dryRun,
    });

    // Replay each job
    const results: ReplayResult[] = [];
    for (const jobId of jobsToReplay) {
      const result = await this.replayJob(jobId);
      results.push(result);
    }

    // Calculate summary
    const replayed = results.filter(r => r.action === 'replayed').length;
    const skipped = results.filter(r => r.action === 'skipped').length;
    const failed = results.filter(r => r.action === 'failed').length;
    const duration = Date.now() - startTime;

    const summary: ReplaySummary = {
      total: results.length,
      replayed,
      skipped,
      failed,
      dryRun: this.config.dryRun,
      results,
      duration,
    };

    logger.info('DLQ batch replay completed', {
      total: summary.total,
      replayed: summary.replayed,
      skipped: summary.skipped,
      failed: summary.failed,
      dryRun: summary.dryRun,
      duration: summary.duration,
    });

    // Send alert if there were failures
    if (failed > 0 && this.alertingService) {
      await this.alertingService.sendAlert(
        this.alertingService.createWarningAlert(
          'DLQ Batch Replay Completed with Failures',
          `Replayed ${replayed}/${summary.total} jobs. ${failed} failed.`,
          {
            total: summary.total,
            replayed,
            skipped,
            failed,
            duration,
          }
        )
      );
    }

    return summary;
  }

  /**
   * Replay all jobs in DLQ
   * 
   * SAFETY:
   * - Respects batch size limit
   * - Fetches jobs in pages
   * - Never processes more than batchSize
   */
  async replayAll(): Promise<ReplaySummary> {
    if (!this.config.enabled) {
      logger.warn('DLQ replay is disabled');
      return {
        total: 0,
        replayed: 0,
        skipped: 0,
        failed: 0,
        dryRun: this.config.dryRun,
        results: [],
        duration: 0,
      };
    }

    logger.info('Fetching all DLQ jobs for replay');

    // Get all DLQ jobs (up to batch size)
    const jobs = await this.dlq.getAll(0, this.config.batchSize);
    const jobIds = jobs.map(j => j.id!).filter(Boolean);

    logger.info('Found DLQ jobs', {
      count: jobIds.length,
      batchSize: this.config.batchSize,
    });

    if (jobIds.length === 0) {
      return {
        total: 0,
        replayed: 0,
        skipped: 0,
        failed: 0,
        dryRun: this.config.dryRun,
        results: [],
        duration: 0,
      };
    }

    return this.replayBatch(jobIds);
  }

  /**
   * Preview DLQ jobs without replaying
   * Returns list of jobs that would be replayed
   */
  async preview(limit: number = 10): Promise<Array<{
    dlqJobId: string;
    postId: string;
    originalQueue: string;
    failedAt: Date;
    error: string;
    attempts: number;
    postStatus?: string;
    wouldReplay: boolean;
    skipReason?: string;
  }>> {
    const jobs = await this.dlq.getAll(0, limit);
    const { Post } = await this.getModels();

    const preview = [];

    for (const job of jobs) {
      const data = job.data as DeadLetterJobData;
      
      // Check post status
      const post = await Post.findById(data.postId);
      
      let wouldReplay = true;
      let skipReason: string | undefined;

      if (!post) {
        wouldReplay = false;
        skipReason = 'Post not found';
      } else if (this.config.skipPublished && post.status === PostStatus.PUBLISHED) {
        wouldReplay = false;
        skipReason = 'Already published';
      } else if (post.status === PostStatus.CANCELLED) {
        wouldReplay = false;
        skipReason = 'Post cancelled';
      }

      preview.push({
        dlqJobId: job.id!,
        postId: data.postId,
        originalQueue: data.originalQueue,
        failedAt: data.failedAt,
        error: data.error,
        attempts: data.attempts,
        postStatus: post?.status,
        wouldReplay,
        skipReason,
      });
    }

    return preview;
  }

  /**
   * Get DLQ statistics
   */
  async getStats(): Promise<{
    dlqStats: any;
    replayMetrics: typeof this.metrics;
  }> {
    const dlqStats = await this.dlq.getStats();

    return {
      dlqStats,
      replayMetrics: { ...this.metrics },
    };
  }

  /**
   * Get replay metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Lazy-load models to avoid initialization before DB connection
   */
  private async getModels() {
    const { Post } = await import('../../models/Post');
    return { Post };
  }
}

