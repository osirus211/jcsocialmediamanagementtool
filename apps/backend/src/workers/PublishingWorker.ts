import { Worker, Job } from 'bullmq';
import { QueueManager } from '../queue/QueueManager';
import { POSTING_QUEUE_NAME, PostingJobData } from '../queue/PostingQueue';
import { PostStatus } from '../models/Post';
import { logger } from '../utils/logger';
import { captureException, addBreadcrumb } from '../monitoring/sentry';
import { createWorkerHeartbeatService } from '../services/WorkerHeartbeatService';
import { config } from '../config';
// import { publishingWorkerWrapper } from '../../../../.kiro/execution/reliability/PublishingWorkerWrapper';

// Mock publishingWorkerWrapper for Docker environment
const publishingWorkerWrapper = {
  shutdown: () => {},
  wrapTokenRefresh: async (fn: any, ...args: any[]) => fn(...args),
  wrapAICaption: async (fn: any, ...args: any[]) => ({ success: true, result: args[0] }),
  wrapEmail: async (fn: any, ...args: any[]) => ({ success: true }),
  wrapAnalytics: async (fn: any, ...args: any[]) => ({ success: true }),
  wrapMediaUpload: async (fn: any, ...args: any[]) => ({ success: true, result: args[0] }),
  wrapPlatformPublish: async (fn: any, ...args: any[]) => fn(...args),
};

/**
 * Publishing Worker
 * 
 * Processes post publishing jobs from the queue
 * 
 * Features:
 * - Idempotent operations
 * - Retry with exponential backoff
 * - Platform-specific publishing (placeholder)
 * - Status tracking
 * - Error handling
 * - Sentry error tracking
 * 
 * NOTE: Models are lazy-loaded to avoid initialization before DB connection
 */

export class PublishingWorker {
  private worker: Worker | null = null;
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map(); // Track heartbeats by postId
  private heartbeatService = createWorkerHeartbeatService('publishing-worker');
  
  // Feature flag for graceful degradation
  private gracefulDegradationEnabled: boolean;
  
  // OBSERVABILITY: Metrics counters
  private metrics = {
    publish_success_total: 0,
    publish_failed_total: 0,
    publish_retry_total: 0,
    publish_skipped_total: 0,
    queue_jobs_processed_total: 0,
    queue_jobs_failed_total: 0,
    // TASK 1.2.1: Idempotency metrics
    idempotency_check_status_published: 0,
    idempotency_check_status_failed: 0,
    idempotency_check_status_cancelled: 0,
    idempotency_check_status_publishing: 0,
    idempotency_check_atomic_update_failed: 0,
    idempotency_check_race_condition_resolved: 0,
    // TASK 1.2.2: Platform post ID deduplication metrics
    idempotency_check_platform_post_id_exists: 0,
    duplicate_publish_attempts_total: 0,
    platform_duplicate_errors_total: 0,
  };
  
  // OBSERVABILITY: Queue health monitor
  private queueHealthInterval: NodeJS.Timeout | null = null;
  private workerHeartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Read feature flag from environment
    this.gracefulDegradationEnabled = config.features.gracefulDegradation;
    
    logger.info('PublishingWorker initialized', {
      gracefulDegradationEnabled: this.gracefulDegradationEnabled,
    });
  }

  /**
   * Lazy-load models to avoid initialization before DB connection
   */
  private async getModels() {
    const { Post } = await import('../models/Post');
    const { SocialAccount } = await import('../models/SocialAccount');
    const { postService } = await import('../services/PostService');
    return { Post, SocialAccount, postService };
  }

  /**
   * Send post success email notification
   */
  private async sendPostSuccessEmail(post: any, account: any, platformPostId?: string): Promise<void> {
    try {
      const { emailNotificationService } = await import('../services/EmailNotificationService');
      const { User } = await import('../models/User');
      const { Workspace } = await import('../models/Workspace');

      // Get workspace to find owner email
      const workspace = await Workspace.findById(post.workspaceId);
      if (!workspace) {
        logger.warn('Workspace not found for email notification', { workspaceId: post.workspaceId });
        return;
      }

      // Get workspace owner
      const owner = await User.findById(workspace.ownerId);
      if (!owner) {
        logger.warn('Workspace owner not found for email notification', { ownerId: workspace.ownerId });
        return;
      }

      await emailNotificationService.sendPostSuccess({
        to: owner.email,
        platform: account.provider,
        postTitle: post.content.substring(0, 50) + (post.content.length > 50 ? '...' : ''),
        platformUrl: platformPostId ? `https://${account.provider}.com/post/${platformPostId}` : undefined,
        userId: owner._id.toString(),
        workspaceId: post.workspaceId.toString(),
      });
    } catch (error: any) {
      logger.error('Error sending post success email', { error: error.message });
      // Don't throw - email failures should not affect publishing
    }
  }

  /**
   * Send post failure email notification
   */
  private async sendPostFailureEmail(post: any, errorMessage: string): Promise<void> {
    try {
      const { emailNotificationService } = await import('../services/EmailNotificationService');
      const { User } = await import('../models/User');
      const { Workspace } = await import('../models/Workspace');
      const { SocialAccount } = await import('../models/SocialAccount');

      // Get workspace to find owner email
      const workspace = await Workspace.findById(post.workspaceId);
      if (!workspace) {
        logger.warn('Workspace not found for email notification', { workspaceId: post.workspaceId });
        return;
      }

      // Get workspace owner
      const owner = await User.findById(workspace.ownerId);
      if (!owner) {
        logger.warn('Workspace owner not found for email notification', { ownerId: workspace.ownerId });
        return;
      }

      // Get social account for platform name
      const account = await SocialAccount.findById(post.socialAccountId);
      const platform = account?.provider || 'social media';

      await emailNotificationService.sendPostFailure({
        to: owner.email,
        platform,
        postTitle: post.content.substring(0, 50) + (post.content.length > 50 ? '...' : ''),
        error: errorMessage,
        userId: owner._id.toString(),
        workspaceId: post.workspaceId.toString(),
      });
    } catch (error: any) {
      logger.error('Error sending post failure email', { error: error.message });
      // Don't throw - email failures should not affect publishing
    }
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.worker) {
      logger.warn('Publishing worker already running');
      return;
    }

    const queueManager = QueueManager.getInstance();
    this.worker = queueManager.createWorker(
      POSTING_QUEUE_NAME,
      this.processJob.bind(this),
      {
        concurrency: 5, // Process 5 jobs concurrently
        limiter: {
          max: 10, // Max 10 jobs
          duration: 1000, // per second
        },
      }
    );

    // Setup Sentry error handlers for worker
    this.setupSentryHandlers();

    // OBSERVABILITY: Start monitoring
    this.startQueueHealthMonitor();
    this.startWorkerHeartbeat();

    // Start worker heartbeat service
    this.heartbeatService.startHeartbeat();
    this.heartbeatService.startMonitoring();

    logger.info('Publishing worker started with observability');
  }

  /**
   * Setup Sentry error handlers for worker
   */
  private setupSentryHandlers(): void {
    if (!this.worker) return;

    // Capture worker-level errors
    this.worker.on('error', (error: Error) => {
      logger.error('Publishing worker error', { error: error.message });
      
      captureException(error, {
        level: 'error',
        tags: {
          worker: 'publishing',
          queue: POSTING_QUEUE_NAME,
        },
        extra: {
          workerStatus: this.getStatus(),
          activeJobs: this.heartbeatIntervals.size,
        },
      });
    });

    // Capture failed jobs (after all retries exhausted)
    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      if (!job) return;

      const { postId, workspaceId, socialAccountId } = job.data as PostingJobData;
      const currentAttempt = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts || 3;

      // Only capture to Sentry if this is the final failure
      if (currentAttempt >= maxAttempts) {
        addBreadcrumb(
          'Publishing job failed after all retries',
          'worker',
          {
            jobId: job.id,
            postId,
            workspaceId,
            socialAccountId,
            attemptsMade: job.attemptsMade,
            maxAttempts,
          }
        );

        captureException(error, {
          level: 'error',
          tags: {
            worker: 'publishing',
            queue: POSTING_QUEUE_NAME,
            jobId: job.id || 'unknown',
            postId: postId || 'unknown',
            workspaceId: workspaceId || 'unknown',
            finalFailure: 'true',
          },
          extra: {
            jobData: job.data,
            attemptsMade: job.attemptsMade,
            maxAttempts,
            errorClassification: this.classifyError(error),
          },
        });
      }
    });
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.worker) {
      logger.warn('Publishing worker not running');
      return;
    }

    // OBSERVABILITY: Stop monitoring
    this.stopQueueHealthMonitor();
    this.stopWorkerHeartbeat();

    // Stop worker heartbeat service
    await this.heartbeatService.shutdown();

    // Stop all heartbeats
    for (const [postId, interval] of this.heartbeatIntervals.entries()) {
      clearInterval(interval);
      logger.debug('Stopped heartbeat during worker shutdown', { postId });
    }
    this.heartbeatIntervals.clear();

    // Shutdown wrapper (cleanup circuit breakers)
    if (this.gracefulDegradationEnabled) {
      try {
        publishingWorkerWrapper.shutdown();
        logger.debug('Publishing worker wrapper shutdown complete');
      } catch (error: any) {
        logger.warn('Error shutting down publishing worker wrapper', { error: error.message });
        // Don't throw - wrapper shutdown should not block worker shutdown
      }
    }

    await this.worker.close();
    this.worker = null;

    logger.info('Publishing worker stopped');
  }

  /**
   * Classify error for observability
   */
  private classifyError(error: any): 'retryable' | 'permanent' {
    // If provider set explicit retryable flag, use it
    if (typeof error.retryable === 'boolean') {
      return error.retryable ? 'retryable' : 'permanent';
    }

    // Fallback to message-based classification
    const errorMessage = error.message?.toLowerCase() || '';
    
    // RETRYABLE errors (network, timeout, rate limit)
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('service unavailable') ||
      errorMessage.includes('internal server error') ||
      errorMessage.includes('bad gateway') ||
      errorMessage.includes('gateway timeout') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('etimedout')
    ) {
      return 'retryable';
    }
    
    // PERMANENT errors (invalid token, account issues, content rejection)
    if (
      errorMessage.includes('invalid token') ||
      errorMessage.includes('token expired') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('account suspended') ||
      errorMessage.includes('account disconnected') ||
      errorMessage.includes('content rejected') ||
      errorMessage.includes('content blocked') ||
      errorMessage.includes('duplicate content') ||
      errorMessage.includes('social account is') || // "social account is connected/expired/etc"
      errorMessage.includes('not found') ||
      errorMessage.includes('bad request')
    ) {
      return 'permanent';
    }
    
    // Default to retryable for unknown errors
    return 'retryable';
  }

  /**
   * TASK 1.2.2: Check if error is a platform duplicate detection error
   */
  private isPlatformDuplicateError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code;

    // Twitter/X duplicate detection
    if (errorMessage.includes('duplicate') || errorCode === 187) {
      return true;
    }

    // LinkedIn duplicate detection
    if (errorMessage.includes('duplicate content') || errorCode === 'DUPLICATE_SHARE') {
      return true;
    }

    // Facebook duplicate detection
    if (errorMessage.includes('duplicate status message') || errorCode === 506) {
      return true;
    }

    // Instagram duplicate detection
    if (errorMessage.includes('media already posted') || errorMessage.includes('duplicate media')) {
      return true;
    }

    // Generic duplicate patterns
    if (
      errorMessage.includes('already published') ||
      errorMessage.includes('already posted') ||
      errorMessage.includes('already exists')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Start queue health monitoring
   */
  private startQueueHealthMonitor(): void {
    if (this.queueHealthInterval) {
      return;
    }

    this.queueHealthInterval = setInterval(async () => {
      try {
        const queueManager = QueueManager.getInstance();
        const stats = await queueManager.getQueueStats('posting-queue');
        
        logger.info('Queue health monitor', {
          queue: 'posting-queue',
          waiting: stats.waiting,
          active: stats.active,
          completed: stats.completed,
          failed: stats.failed,
          delayed: stats.delayed,
          total: stats.total,
          failureRate: stats.failureRate,
          health: stats.health,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        logger.error('Queue health monitor failed', {
          error: error.message,
        });
      }
    }, 30000); // Every 30 seconds

    logger.info('Queue health monitor started');
  }

  /**
   * Stop queue health monitoring
   */
  private stopQueueHealthMonitor(): void {
    if (this.queueHealthInterval) {
      clearInterval(this.queueHealthInterval);
      this.queueHealthInterval = null;
      logger.info('Queue health monitor stopped');
    }
  }

  /**
   * Start worker heartbeat logging
   */
  private startWorkerHeartbeat(): void {
    if (this.workerHeartbeatInterval) {
      return;
    }

    this.workerHeartbeatInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const uptimeSeconds = Math.floor(process.uptime());
      
      logger.info('Worker heartbeat', {
        worker_alive: true,
        active_jobs: this.heartbeatIntervals.size,
        memory_usage: {
          rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
          heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external_mb: Math.round(memoryUsage.external / 1024 / 1024),
        },
        uptime_seconds: uptimeSeconds,
        metrics: { ...this.metrics },
        timestamp: new Date().toISOString(),
      });
    }, 60000); // Every 60 seconds

    logger.info('Worker heartbeat started');
  }

  /**
   * Stop worker heartbeat logging
   */
  private stopWorkerHeartbeat(): void {
    if (this.workerHeartbeatInterval) {
      clearInterval(this.workerHeartbeatInterval);
      this.workerHeartbeatInterval = null;
      logger.info('Worker heartbeat stopped');
    }
  }

  /**
   * Start heartbeat to prevent auto-repair from marking post as stuck
   */
  private startHeartbeat(postId: string): void {
    // Stop any existing heartbeat for this post
    this.stopHeartbeat(postId);

    const heartbeatInterval = setInterval(async () => {
      try {
        const { Post } = await this.getModels();
        
        // Only update if post is still in publishing status
        const result = await Post.updateOne(
          { 
            _id: postId, 
            status: PostStatus.PUBLISHING 
          },
          { 
            $set: { updatedAt: new Date() } 
          }
        );

        if (result.matchedCount === 0) {
          // Post is no longer in publishing status, stop heartbeat
          this.stopHeartbeat(postId);
        }
      } catch (error: any) {
        // Don't throw - heartbeat failures shouldn't crash the worker
        logger.debug('Heartbeat update failed (non-critical)', {
          postId,
          error: error.message,
        });
      }
    }, 5000); // Every 5 seconds

    this.heartbeatIntervals.set(postId, heartbeatInterval);
    
    logger.debug('Started heartbeat for post', { postId });
  }

  /**
   * Stop heartbeat for a post
   */
  private stopHeartbeat(postId: string): void {
    const interval = this.heartbeatIntervals.get(postId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(postId);
      logger.debug('Stopped heartbeat for post', { postId });
    }
  }

  /**
   * Process a publishing job with idempotency
   */
  private async processJob(job: Job<PostingJobData>): Promise<any> {
    const { postId, workspaceId, socialAccountId, platform } = job.data;
    const currentAttempt = job.attemptsMade + 1;
    
    // OBSERVABILITY: Start duration tracking
    const startTime = Date.now();

    // DEAD-LETTER QUEUE REPLAY SAFETY: Check if this is a replayed job
    const isReplay = job.opts.repeat !== undefined || job.data.isReplay === true;
    
    if (isReplay) {
      logger.info('Processing replayed job from DLQ', {
        jobId: job.id,
        postId,
        platform,
        workspaceId,
        attemptsMade: job.attemptsMade,
        currentAttempt,
      });
    } else {
      logger.info('Processing publishing job', {
        jobId: job.id,
        postId,
        platform,
        workspaceId,
        attemptsMade: job.attemptsMade,
        currentAttempt,
      });
    }

    // Lazy-load models
    const { Post, SocialAccount, postService } = await this.getModels();

    // SAFETY 1: Acquire Redis processing lock to prevent duplicate worker execution
    // Include platform in lock key for multi-platform support
    const queueMgr = QueueManager.getInstance();
    const processingLockKey = platform 
      ? `post:processing:${postId}:${platform}`
      : `post:processing:${postId}`;
    let processingLock: any = null;
    
    try {
      processingLock = await queueMgr.acquireLock(processingLockKey, 120000); // 2 minutes
    } catch (error: any) {
      // OBSERVABILITY: Increment skipped counter
      this.metrics.publish_skipped_total++;
      
      logger.warn('Could not acquire processing lock - another worker may be processing this post', {
        postId,
        platform,
        error: error.message,
      });
      return {
        success: false,
        message: 'Skipped - another worker processing',
        skipped: true,
      };
    }

    // SAFETY 2: Acquire distributed publish lock to prevent duplicate processing
    // Include platform in lock key for multi-platform support
    const { distributedLockService } = await import('../services/DistributedLockService');
    const publishLockKey = platform 
      ? `publish:${postId}:${platform}`
      : `publish:${postId}`;
    const publishLock = await distributedLockService.acquireLock(publishLockKey, {
      ttl: 120000, // 2 minutes
      retryAttempts: 1, // Don't retry - if another worker has it, skip
    });

    if (!publishLock) {
      // OBSERVABILITY: Increment skipped counter
      this.metrics.publish_skipped_total++;
      
      logger.warn('Could not acquire publish lock - another worker may be processing this post', {
        postId,
        platform,
      });
      return {
        success: false,
        message: 'Skipped - another worker processing',
        skipped: true,
      };
    }

    try {
      // Fetch post
      const post = await Post.findOne({
        _id: postId,
        workspaceId,
      });

      if (!post) {
        logger.error('Post not found', { postId, workspaceId });
        throw new Error('Post not found');
      }

      // SAFETY 3: Idempotency guard - prevent double publish
      if (post.status === PostStatus.PUBLISHED) {
        // OBSERVABILITY: Increment skipped counter and idempotency metric
        this.metrics.publish_skipped_total++;
        this.metrics.idempotency_check_status_published++;
        
        const duration = Date.now() - startTime;
        logger.warn('Post already published (idempotency guard)', { 
          postId,
          publishedAt: post.publishedAt,
          publish_duration_ms: duration,
          attempt: currentAttempt,
          status: 'skipped_published',
          idempotency_check: 'status_published',
        });
        return { 
          success: true, 
          message: 'Already published',
          idempotent: true,
        };
      }

      // TASK 1.2.2: Check if platformPostId already exists (already published to platform)
      if (post.metadata?.platformPostId) {
        // OBSERVABILITY: Increment skipped counter and new metric
        this.metrics.publish_skipped_total++;
        this.metrics.idempotency_check_platform_post_id_exists++;
        
        const duration = Date.now() - startTime;
        logger.warn('Post already has platformPostId (idempotency guard)', { 
          postId,
          platformPostId: post.metadata.platformPostId,
          publish_duration_ms: duration,
          attempt: currentAttempt,
          status: 'skipped_platform_post_id_exists',
          idempotency_check: 'platform_post_id_exists',
        });
        
        // Update status to PUBLISHED if not already (data consistency)
        if (post.status !== PostStatus.PUBLISHED) {
          await Post.findByIdAndUpdate(postId, {
            status: PostStatus.PUBLISHED,
            publishedAt: post.publishedAt || new Date(),
          });
          logger.info('Updated post status to PUBLISHED based on platformPostId', { postId });
        }
        
        return { 
          success: true, 
          message: 'Already published to platform',
          idempotent: true,
          platformPostId: post.metadata.platformPostId,
        };
      }

      if (post.status === PostStatus.FAILED) {
        // OBSERVABILITY: Increment skipped counter and idempotency metric
        this.metrics.publish_skipped_total++;
        this.metrics.idempotency_check_status_failed++;
        
        const duration = Date.now() - startTime;
        logger.warn('Post is in failed status (idempotency guard)', { 
          postId,
          errorMessage: post.errorMessage,
          publish_duration_ms: duration,
          attempt: currentAttempt,
          status: 'skipped_failed',
          idempotency_check: 'status_failed',
        });
        return { 
          success: false, 
          message: 'Post is failed',
          idempotent: true,
        };
      }

      // Check if post was cancelled
      if (post.status === PostStatus.CANCELLED) {
        // OBSERVABILITY: Increment skipped counter and idempotency metric
        this.metrics.publish_skipped_total++;
        this.metrics.idempotency_check_status_cancelled++;
        
        const duration = Date.now() - startTime;
        logger.warn('Post was cancelled', { 
          postId,
          publish_duration_ms: duration,
          attempt: currentAttempt,
          status: 'skipped_cancelled',
          idempotency_check: 'status_cancelled',
        });
        return { success: false, message: 'Post cancelled' };
      }

      // Check if post is already being published (race condition check)
      if (post.status === PostStatus.PUBLISHING) {
        this.metrics.idempotency_check_status_publishing++;
        
        logger.warn('Post is already being published', { 
          postId,
          idempotency_check: 'status_publishing',
        });
        // Wait a bit and check again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const updatedPost = await Post.findById(postId);
        if (updatedPost?.status === PostStatus.PUBLISHED) {
          // OBSERVABILITY: Increment skipped counter and race condition metric
          this.metrics.publish_skipped_total++;
          this.metrics.idempotency_check_race_condition_resolved++;
          
          const duration = Date.now() - startTime;
          logger.warn('Post published by another process', {
            postId,
            publish_duration_ms: duration,
            attempt: currentAttempt,
            status: 'skipped_race_condition',
            idempotency_check: 'race_condition_resolved',
          });
          return { 
            success: true, 
            message: 'Already published',
            idempotent: true,
          };
        }
      }

      // TASK 1.2.1: Atomic status update with optimistic locking
      // Only update status if post is in SCHEDULED or QUEUED state
      // This prevents race conditions where multiple workers try to publish the same post
      const atomicUpdate = await Post.findOneAndUpdate(
        {
          _id: postId,
          status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
          version: post.version, // Optimistic locking
        },
        {
          $set: {
            status: PostStatus.PUBLISHING,
            'metadata.publishingStartedAt': new Date(),
          },
          $inc: { version: 1 },
        },
        { new: true }
      );

      if (!atomicUpdate) {
        // Status check failed - post is no longer in scheduled/queued state
        // This could mean another worker already picked it up, or status changed
        this.metrics.publish_skipped_total++;
        this.metrics.idempotency_check_atomic_update_failed++;
        
        const currentPost = await Post.findById(postId);
        const duration = Date.now() - startTime;
        
        logger.warn('Atomic status update failed - post status changed', {
          postId,
          expectedStatus: 'scheduled/queued',
          actualStatus: currentPost?.status,
          expectedVersion: post.version,
          actualVersion: currentPost?.version,
          publish_duration_ms: duration,
          attempt: currentAttempt,
          status: 'skipped_status_changed',
          idempotency_check: 'atomic_update_failed',
        });

        // If post is already published, return success
        if (currentPost?.status === PostStatus.PUBLISHED) {
          return {
            success: true,
            message: 'Already published by another worker',
            idempotent: true,
          };
        }

        // Otherwise, skip this job
        return {
          success: false,
          message: 'Post status changed, skipping',
          skipped: true,
        };
      }

      // Update local post reference with the atomically updated version
      Object.assign(post, atomicUpdate);

      // SAFETY 4: Start heartbeat to prevent auto-repair false positives
      this.startHeartbeat(postId);

      // EXTERNAL PUBLISH IDEMPOTENCY: Generate and store publish hash BEFORE API call
      // This ensures we can detect partial publishes after crash
      const { publishHashService } = await import('../services/PublishHashService');
      const publishHash = publishHashService.generatePublishHash({
        postId,
        content: post.content,
        socialAccountId: account._id.toString(),
        platform: account.provider, // Include platform for multi-platform idempotency
        mediaUrls: post.mediaUrls,
        scheduledAt: post.scheduledAt,
      });

      // Store publish hash atomically before external API call
      await Post.findByIdAndUpdate(postId, {
        'metadata.publishHash': publishHash,
        'metadata.publishAttemptedAt': new Date(),
      });

      logger.info('Publish hash stored before external API call', {
        postId,
        publishHash: publishHash.substring(0, 16) + '...',
      });

      // Fetch social account with tokens
      const account = await SocialAccount.findOne({
        _id: socialAccountId,
        workspaceId,
      }).select('+accessToken +refreshToken');

      if (!account) {
        throw new Error('Social account not found');
      }

      logger.info('Publishing post', {
        accountId: account._id,
        provider: account.provider,
        postId: post._id,
      });

      // Check if account is active
      if (account.status !== 'active') {
        throw new Error(`Social account is ${account.status}`);
      }

      // Check if token is expired
      if (account.isTokenExpired()) {
        logger.info('Token expired, attempting refresh', {
          accountId: account._id,
          provider: account.provider,
          expiresAt: account.tokenExpiresAt,
        });
        
        if (this.gracefulDegradationEnabled) {
          // Use wrapper with circuit breaker protection
          try {
            // Attempt token refresh through reliability layer
            const refreshResult = await publishingWorkerWrapper.wrapTokenRefresh(
              account._id.toString(),
              account.provider,
              account.getDecryptedRefreshToken()
            );
            
            if (!refreshResult.success) {
              // Refresh failed - throw to trigger BullMQ retry
              logger.error('Token refresh failed', {
                accountId: account._id,
                provider: account.provider,
                error: refreshResult.error,
              });
              throw new Error('Social account token expired and refresh failed');
            }
            
            // Refresh succeeded - reload account with new token
            logger.info('Token refresh succeeded, reloading account', {
              accountId: account._id,
              provider: account.provider,
            });
            
            const refreshedAccount = await SocialAccount.findById(account._id)
              .select('+accessToken +refreshToken');
            
            if (!refreshedAccount) {
              throw new Error('Failed to reload account after token refresh');
            }
            
            // Replace account with refreshed version
            Object.assign(account, refreshedAccount);
            
          } catch (error: any) {
            // Token refresh failed - throw to trigger BullMQ retry
            logger.error('Token refresh error', {
              accountId: account._id,
              provider: account.provider,
              error: error.message,
            });
            throw new Error('Social account token expired');
          }
        } else {
          // Original behavior: throw immediately without refresh attempt
          throw new Error('Social account token expired');
        }
      }

      // TEMPORARY: Failure injection for retry testing
      if (job.data.forceFail === true) {
        throw new Error('FORCED_RETRY_TEST_FAILURE');
      }

      // AI Caption Generation (optional enhancement with graceful degradation)
      // If AI caption is requested, attempt generation with fallback to original
      if (post.metadata?.useAICaption && this.gracefulDegradationEnabled) {
        const aiResult = await publishingWorkerWrapper.wrapAICaption(
          post.content,
          {
            postId: post._id.toString(),
            workspaceId: post.workspaceId.toString(),
            socialAccountId: account._id.toString(),
            attemptNumber: currentAttempt
          }
        );
        
        // Update post content with AI-generated caption (or original if degraded)
        post.content = aiResult.caption;
        
        if (aiResult.degraded) {
          // Record AI caption degradation in metadata
          if (!post.metadata) {
            post.metadata = {};
          }
          post.metadata.aiCaptionDegraded = true;
          post.metadata.aiDegradationReason = aiResult.reason;
          
          logger.warn('AI caption generation failed - using original caption', {
            postId: post._id,
            reason: aiResult.reason,
            fallbackUsed: aiResult.fallbackUsed
          });
        } else {
          logger.info('AI caption generated successfully', {
            postId: post._id,
            captionLength: aiResult.caption.length
          });
        }
      }

      // Publish to platform
      let result;
      try {
        result = await this.publishToPlatform(post, account);
      } catch (publishError: any) {
        // TASK 1.2.2: Handle platform duplicate detection errors
        const isDuplicateError = this.isPlatformDuplicateError(publishError);
        
        if (isDuplicateError) {
          this.metrics.platform_duplicate_errors_total++;
          this.metrics.duplicate_publish_attempts_total++;
          
          logger.warn('Platform detected duplicate post', {
            postId,
            platform: account.provider,
            error: publishError.message,
            idempotency_check: 'platform_duplicate_detected',
          });
          
          // Mark as published since platform already has it
          await Post.findByIdAndUpdate(postId, {
            status: PostStatus.PUBLISHED,
            publishedAt: new Date(),
            'metadata.platformDuplicateDetected': true,
            'metadata.platformDuplicateError': publishError.message,
          });
          
          return {
            success: true,
            message: 'Platform detected duplicate, marked as published',
            idempotent: true,
          };
        }
        
        // Not a duplicate error, re-throw for normal error handling
        throw publishError;
      }

      // Update post status to published (atomic operation)
      const updated = await Post.findOneAndUpdate(
        {
          _id: postId,
          status: PostStatus.PUBLISHING, // Only update if still publishing
        },
        {
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(),
          'metadata.platformPostId': result.platformPostId,
        },
        { new: true }
      );

      // TASK 1.2.2: Validate platformPostId was stored
      if (updated && !updated.metadata?.platformPostId) {
        logger.error('Failed to store platformPostId', {
          postId,
          platform: account.provider,
          resultHadPlatformPostId: !!result.platformPostId,
        });
      } else if (updated) {
        logger.info('Platform post ID stored successfully', {
          postId,
          platformPostId: updated.metadata.platformPostId,
          platform: account.provider,
        });
      }

      if (!updated) {
        logger.warn('Post status changed during publishing', { postId });
        // Check if it was published by another process
        const currentPost = await Post.findById(postId);
        if (currentPost?.status === PostStatus.PUBLISHED) {
          // OBSERVABILITY: Increment success counter
          this.metrics.publish_success_total++;
          
          const duration = Date.now() - startTime;
          logger.info('Post published by another process', {
            postId,
            publish_duration_ms: duration,
            attempt: currentAttempt,
            status: 'success_race_condition',
          });
          return {
            success: true,
            message: 'Published by another process',
            idempotent: true,
          };
        }
        throw new Error('Failed to update post status');
      }

      // OBSERVABILITY: Increment success counter and log duration
      this.metrics.publish_success_total++;
      this.metrics.queue_jobs_processed_total++;
      this.heartbeatService.incrementProcessedJobs();
      this.heartbeatService.updateJobCounters(this.heartbeatIntervals.size);
      const duration = Date.now() - startTime;

      logger.info('Post published successfully', {
        postId,
        platform: account.provider,
        platformPostId: result.platformPostId,
        publish_duration_ms: duration,
        attempt: currentAttempt,
        status: 'success',
      });

      // Fire webhook event for successful publish
      try {
        const { webhookService, WebhookEventType } = await import('../services/WebhookService');
        await webhookService.sendWebhook({
          workspaceId: post.workspaceId.toString(),
          event: WebhookEventType.POST_PUBLISHED,
          payload: {
            postId: postId.toString(),
            platform: account.provider,
            publishedAt: updated.publishedAt || new Date(),
            url: result.platformPostId ? `https://${account.provider}.com/post/${result.platformPostId}` : undefined,
            platformPostId: result.platformPostId,
            content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
          },
        });
      } catch (webhookError: any) {
        logger.warn('Failed to send POST_PUBLISHED webhook (non-blocking)', {
          postId,
          error: webhookError.message,
        });
      }

      // Emit post.published event for workflow automation
      try {
        const { EventDispatcherService } = await import('../services/EventDispatcherService');
        await EventDispatcherService.handleEvent({
          eventId: `post-published-${postId}-${Date.now()}`,
          eventType: 'post.published',
          workspaceId: post.workspaceId.toString(),
          timestamp: new Date(),
          data: {
            postId: postId.toString(),
            platform: account.provider,
            content: post.content,
            publishedAt: updated.publishedAt || new Date(),
            socialAccountId: account._id.toString(),
            platformPostId: result.platformPostId,
          },
        });
        logger.debug('post.published event emitted', { postId });
      } catch (eventError: any) {
        // Event emission failure should NOT block publish success
        logger.warn('Failed to emit post.published event (non-blocking)', {
          postId,
          error: eventError.message,
        });
      }

      // FIX 1: Schedule analytics collection immediately after successful publish
      // This ensures analytics are scheduled right away instead of waiting for scheduler polling
      if (result.platformPostId && updated) {
        try {
          const { analyticsCollectionQueue } = await import('../queue/AnalyticsCollectionQueue');
          
          // Only schedule if not already scheduled (prevent duplicates)
          if (!updated.metadata?.analyticsScheduled) {
            await analyticsCollectionQueue.scheduleCollection({
              postId: postId.toString(),
              platform: account.provider,
              socialAccountId: account._id.toString(),
              workspaceId: post.workspaceId.toString(),
              platformPostId: result.platformPostId,
              publishedAt: updated.publishedAt || new Date(),
            });
            
            // Mark as scheduled to prevent duplicate scheduling by scheduler service
            await Post.findByIdAndUpdate(postId, {
              $set: {
                'metadata.analyticsScheduled': true,
                'metadata.analyticsScheduledAt': new Date(),
              },
            });
            
            logger.info('Analytics collection scheduled immediately after publish', {
              postId,
              platform: account.provider,
              platformPostId: result.platformPostId,
            });
          } else {
            logger.debug('Analytics already scheduled, skipping duplicate', {
              postId,
              platform: account.provider,
            });
          }
        } catch (analyticsScheduleError: any) {
          // Analytics scheduling failure should NOT block publish success
          logger.warn('Failed to schedule analytics (non-blocking)', {
            postId,
            platform: account.provider,
            error: analyticsScheduleError.message,
          });
        }
      }

      // Send success email notification with graceful degradation
      // Email failure will NOT block publish success
      if (this.gracefulDegradationEnabled) {
        try {
          const { User } = await import('../models/User');
          const { Workspace } = await import('../models/Workspace');
          
          // Get workspace and owner for email
          const workspace = await Workspace.findById(post.workspaceId);
          const owner = workspace ? await User.findById(workspace.ownerId) : null;
          
          if (owner) {
            const emailResult = await publishingWorkerWrapper.wrapEmail(
              'post_published',
              {
                userEmail: owner.email,
                userName: owner.name || owner.email,
                postTitle: post.content.substring(0, 50) + (post.content.length > 50 ? '...' : ''),
                platforms: [account.provider],
                platformUrl: result.platformPostId ? `https://${account.provider}.com/post/${result.platformPostId}` : undefined
              },
              {
                postId: post._id.toString(),
                workspaceId: post.workspaceId.toString(),
                socialAccountId: account._id.toString(),
                attemptNumber: currentAttempt
              }
            );
            
            if (emailResult.degraded) {
              logger.debug('Email notification skipped due to degradation', {
                postId,
                reason: emailResult.reason,
                skipped: emailResult.skipped
              });
            }
          }
        } catch (emailError: any) {
          // Email errors should never block publish
          logger.warn('Email notification error (non-blocking)', {
            postId,
            error: emailError.message
          });
        }
      }

      // Record analytics with graceful degradation
      // Analytics failure will NOT block publish success
      if (this.gracefulDegradationEnabled) {
        try {
          const analyticsResult = await publishingWorkerWrapper.wrapAnalytics(
            {
              platform: account.provider,
              postId: post._id.toString(),
              publishedAt: result.publishedAt || new Date(),
              platformPostId: result.platformPostId,
              impressions: 0,
              clicks: 0,
              shares: 0,
              comments: 0,
              likes: 0,
              saves: 0
            },
            {
              postId: post._id.toString(),
              workspaceId: post.workspaceId.toString(),
              socialAccountId: account._id.toString(),
              attemptNumber: currentAttempt
            }
          );
          
          if (analyticsResult.degraded) {
            logger.debug('Analytics recording skipped due to degradation', {
              postId,
            reason: analyticsResult.reason,
            skipped: analyticsResult.skipped
          });
        }
        } catch (analyticsError: any) {
          // Analytics errors should never block publish
          logger.debug('Analytics recording error (non-blocking)', {
            postId,
            error: analyticsError.message
          });
        }
      }

      return {
        success: true,
        platformPostId: result.platformPostId,
      };
    } catch (error: any) {
      // Calculate current attempt number (attemptsMade is 0-based, so add 1)
      const currentAttempt = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts || 3;
      const duration = Date.now() - startTime;

      // OBSERVABILITY: Classify error
      const errorClassification = this.classifyError(error);

      logger.error('Publishing job failed', {
        jobId: job.id,
        postId,
        error: error.message,
        stack: error.stack,
        currentAttempt,
        maxAttempts,
        publish_duration_ms: duration,
        error_classification: errorClassification,
      });

      // Update post status and retry count based on whether this is the final attempt
      try {
        // Get models for database operations
        const { Post } = await this.getModels();

        if (currentAttempt === maxAttempts) {
          // OBSERVABILITY: Increment failed counter
          this.metrics.publish_failed_total++;
          this.metrics.queue_jobs_failed_total++;
          this.heartbeatService.incrementFailedJobs();
          this.heartbeatService.updateJobCounters(this.heartbeatIntervals.size);

          // Final attempt - mark as failed and increment retry count
          const post = await Post.findById(postId);
          if (post) {
            post.status = PostStatus.FAILED;
            post.errorMessage = error.message;
            post.retryCount = (post.retryCount || 0) + 1;
            post.metadata.failedAt = new Date();
            await post.save();
          }

          logger.error('Post marked as failed after all retries', {
            postId,
            currentAttempt,
            maxAttempts,
            retryCount: (post?.retryCount || 0),
            error: error.message,
            publish_duration_ms: duration,
            status: 'failed_final',
            error_classification: errorClassification,
          });

          // Fire webhook event for failed publish
          try {
            const { webhookService, WebhookEventType } = await import('../services/WebhookService');
            await webhookService.sendWebhook({
              workspaceId: post.workspaceId.toString(),
              event: WebhookEventType.POST_FAILED,
              payload: {
                postId: postId.toString(),
                platform: platform || 'unknown',
                error: error.message,
                retryCount: (post?.retryCount || 0),
                failedAt: new Date(),
                content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
              },
            });
          } catch (webhookError: any) {
            logger.warn('Failed to send POST_FAILED webhook (non-blocking)', {
              postId,
              error: webhookError.message,
            });
          }

          // PHASE 6.3: Explicit dead letter queue event
          logger.error('Job moved to dead letter queue', {
            event: 'publish_dead_letter',
            postId,
            platform: platform || 'unknown',
            workspaceId,
            socialAccountId,
            error: error.message,
            error_classification: errorClassification,
            attempts: maxAttempts,
            retryCount: (post?.retryCount || 0),
            timestamp: new Date().toISOString(),
          });

          // Send failure email notification (non-blocking)
          if (post) {
            this.sendPostFailureEmail(post, error.message).catch(err => {
              logger.warn('Failed to send post failure email', { postId, error: err.message });
            });
          }
        } else {
          // OBSERVABILITY: Increment retry counter
          this.metrics.publish_retry_total++;

          // Not final attempt - revert to scheduled for retry and increment retry count
          const post = await Post.findById(postId);
          if (post) {
            post.status = PostStatus.SCHEDULED;
            post.errorMessage = `Attempt ${currentAttempt} failed: ${error.message}`;
            post.retryCount = (post.retryCount || 0) + 1;
            await post.save();
          }

          logger.warn('Post reverted to scheduled for retry', {
            postId,
            currentAttempt,
            maxAttempts,
            retryCount: (post?.retryCount || 0),
            error: error.message,
            publish_duration_ms: duration,
            status: 'retry',
            error_classification: errorClassification,
          });
        }
      } catch (updateError: any) {
        logger.error('FATAL: Failed to update post status after error - this is a critical system failure', {
          postId,
          currentAttempt,
          maxAttempts,
          originalError: error.message,
          updateError: updateError.message,
          stack: updateError.stack,
          publish_duration_ms: duration,
          error_classification: errorClassification,
        });
      }

      // ALWAYS throw error - let BullMQ handle retry vs final failure
      throw error;
    } finally {
      // SAFETY: Always stop heartbeat
      this.stopHeartbeat(postId);
      
      // SAFETY: Always release both locks (guaranteed crash safety)
      if (publishLock) {
        try {
          await distributedLockService.releaseLock(publishLock);
        } catch (lockError: any) {
          logger.error('Failed to release publish lock', {
            postId,
            error: lockError.message,
          });
        }
      }
      
      if (processingLock) {
        try {
          await queueMgr.releaseLock(processingLock);
        } catch (lockError: any) {
          logger.error('Failed to release processing lock', {
            postId,
            error: lockError.message,
          });
        }
      }
    }
  }

  /**
   * Prepare media for publishing
   * Checks for pre-uploaded platform media IDs, falls back to URLs if needed
   * 
   * IMPORTANT: Only uses media where:
   * - uploadStatus = 'uploaded'
   * - processingStatus = 'completed'
   */
  private async prepareMedia(post: any, account: any): Promise<{ mediaIds: string[], mediaUrls: string[], preUploaded: boolean }> {
    // If post has no media, return empty
    if ((!post.mediaIds || post.mediaIds.length === 0) && (!post.mediaUrls || post.mediaUrls.length === 0)) {
      return { mediaIds: [], mediaUrls: [], preUploaded: false };
    }

    // Try to get pre-uploaded platform media IDs
    if (post.mediaIds && post.mediaIds.length > 0) {
      try {
        const { Media, UploadStatus, ProcessingStatus } = await import('../models/Media');
        
        // CRITICAL: Only fetch media that is fully uploaded and processed
        const mediaDocuments = await Media.find({
          _id: { $in: post.mediaIds },
          workspaceId: post.workspaceId,
          uploadStatus: UploadStatus.UPLOADED, // Must be uploaded
          processingStatus: ProcessingStatus.COMPLETED, // Must be processed
        });

        // Log if any media was filtered out
        if (mediaDocuments.length < post.mediaIds.length) {
          logger.warn('Some media not ready for publishing', {
            postId: post._id,
            requestedCount: post.mediaIds.length,
            readyCount: mediaDocuments.length,
            message: 'Media must be uploaded and processed before publishing',
          });
        }

        // If no media is ready, throw error
        if (mediaDocuments.length === 0) {
          throw new Error('No media ready for publishing. Media must be uploaded and processed.');
        }

        // Extract platform-specific media IDs for this account's platform
        const platformMediaIds: string[] = [];
        
        for (const media of mediaDocuments) {
          if (media.platformMediaIds && media.platformMediaIds.length > 0) {
            const platformMedia = media.platformMediaIds.find(
              (pm: any) => pm.platform === account.provider
            );
            
            if (platformMedia && platformMedia.mediaId) {
              platformMediaIds.push(platformMedia.mediaId);
            }
          }
        }

        // If we found pre-uploaded media IDs, use them
        if (platformMediaIds.length > 0) {
          logger.info('Using pre-uploaded platform media', {
            postId: post._id,
            platform: account.provider,
            mediaCount: platformMediaIds.length,
            preUploaded: true,
          });

          return {
            mediaIds: platformMediaIds,
            mediaUrls: [],
            preUploaded: true,
          };
        }

        // No pre-uploaded media found, fall back to URLs
        logger.info('No pre-uploaded media found, will upload during publish', {
          postId: post._id,
          platform: account.provider,
          mediaCount: mediaDocuments.length,
          preUploaded: false,
        });

        // Get storage URLs from media documents (only ready media)
        const mediaUrls = mediaDocuments.map(m => m.storageUrl).filter(Boolean);
        return {
          mediaIds: [],
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : (post.mediaUrls || []),
          preUploaded: false,
        };
      } catch (error: any) {
        logger.warn('Failed to fetch media documents, falling back to URLs', {
          postId: post._id,
          platform: account.provider,
          error: error.message,
        });
        
        return {
          mediaIds: [],
          mediaUrls: post.mediaUrls || [],
          preUploaded: false,
        };
      }
    }

    // Legacy: post only has mediaUrls
    return {
      mediaIds: [],
      mediaUrls: post.mediaUrls || [],
      preUploaded: false,
    };
  }

  /**
   * Publish post to platform
   * TODO: Implement platform-specific adapters
   */
  private async publishToPlatform(post: any, account: any): Promise<any> {
    const { providerFactory } = await import('../providers/ProviderFactory');
    
    // Get provider for this platform
    const provider = providerFactory.getProvider(account.provider);
    
    // PHASE 6.2: Prepare media (check for pre-uploaded platform media IDs)
    const mediaPrep = await this.prepareMedia(post, account);
    
    logger.info('Publishing to platform via provider', {
      postId: post._id,
      provider: account.provider,
      contentLength: post.content.length,
      mediaCount: mediaPrep.mediaIds.length + mediaPrep.mediaUrls.length,
      preUploadedMedia: mediaPrep.preUploaded,
    });

    // Determine final media to use
    let finalMediaUrls = mediaPrep.mediaUrls;
    let finalMediaIds = mediaPrep.mediaIds;
    
    // If using pre-uploaded media, skip upload step
    if (mediaPrep.preUploaded) {
      logger.info('Using pre-uploaded platform media IDs', {
        postId: post._id,
        provider: account.provider,
        mediaIdCount: finalMediaIds.length,
      });
    } else if (this.gracefulDegradationEnabled && mediaPrep.mediaUrls.length > 0) {
      // BACKWARD COMPATIBILITY: Upload media if not pre-uploaded
      const mediaResult = await publishingWorkerWrapper.wrapMediaUpload(
        mediaPrep.mediaUrls,
        {
          postId: post._id.toString(),
          workspaceId: post.workspaceId.toString(),
          socialAccountId: account._id.toString(),
          attemptNumber: 1
        }
      );

      if (mediaResult.degraded) {
        // Fallback to text-only publish
        finalMediaUrls = [];
        
        // Record degradation in post metadata
        if (!post.metadata) {
          post.metadata = {};
        }
        post.metadata.mediaDegraded = true;
        post.metadata.degradationReason = mediaResult.reason;
        
        logger.warn('Media upload failed - degrading to text-only publish', {
          postId: post._id,
          provider: account.provider,
          reason: mediaResult.reason,
          originalMediaCount: mediaPrep.mediaUrls.length
        });
      } else {
        // Media upload succeeded
        finalMediaUrls = mediaResult.mediaUrls || [];
        
        logger.info('Media upload succeeded (fallback)', {
          postId: post._id,
          provider: account.provider,
          mediaCount: finalMediaUrls.length
        });
      }
    }

    // Wrap platform publish call with circuit breaker protection (if enabled)
    // This preserves existing error handling and retry logic
    let result;
    if (this.gracefulDegradationEnabled) {
      result = await publishingWorkerWrapper.wrapPlatformPublish(
        async () => {
          // Call provider's publish method
          // Use mediaIds if available (pre-uploaded), otherwise use mediaUrls
          return await provider.publish({
            postId: post._id,
            accountId: account._id,
            content: post.content,
            mediaUrls: finalMediaIds.length > 0 ? [] : finalMediaUrls,
            mediaIds: finalMediaIds.length > 0 ? finalMediaIds : undefined,
            metadata: post.metadata,
          });
        },
        {
          postId: post._id.toString(),
          platform: account.provider
        }
      );
    } else {
      // Original behavior: direct call without wrapper
      result = await provider.publish({
        postId: post._id,
        accountId: account._id,
        content: post.content,
        mediaUrls: finalMediaIds.length > 0 ? [] : finalMediaUrls,
        mediaIds: finalMediaIds.length > 0 ? finalMediaIds : undefined,
        metadata: post.metadata,
      });
    }

    // Handle result
    if (result.success) {
      logger.info('Provider publish success', {
        postId: post._id,
        provider: account.provider,
        platformPostId: result.platformPostId,
      });
      
      return {
        success: true,
        platformPostId: result.platformPostId,
        publishedAt: result.publishedAt || new Date(),
        url: result.url,
      };
    } else {
      // Provider returned error result
      logger.error('Provider publish failed', {
        postId: post._id,
        provider: account.provider,
        errorCategory: result.errorCategory,
        errorMessage: result.error,
        retryable: result.retryable,
      });

      // Create error with retryable flag
      const error: any = new Error(result.error || 'Provider publish failed');
      error.retryable = result.retryable;
      error.errorCategory = result.errorCategory;
      
      throw error;
    }
  }

  /**
   * Get worker status
   */
  getStatus(): { isRunning: boolean } {
    return {
      isRunning: this.worker !== null,
    };
  }

  /**
   * Get worker metrics
   * TASK 1.2.1: Expose idempotency metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeJobs: this.heartbeatIntervals.size,
    };
  }
}

// Note: Do not create singleton here - let worker-standalone.ts create instance
// after DB/Redis connections are established
