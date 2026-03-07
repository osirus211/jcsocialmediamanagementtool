import { Worker, Job } from 'bullmq';
import { QueueManager } from '../queue/QueueManager';
import { REFRESH_QUEUE_NAME, RefreshJobData } from '../queue/RefreshQueue';
import { logger } from '../utils/logger';
import { captureException, addBreadcrumb } from '../monitoring/sentry';

/**
 * Refresh Worker
 * 
 * Processes token refresh jobs from the refresh queue
 * 
 * Features:
 * - Dedicated worker for token refresh operations
 * - Priority-based processing (urgent vs scheduled)
 * - Distributed lock to prevent concurrent refresh
 * - Retry with exponential backoff
 * - Metrics tracking
 * - Sentry error tracking
 */

export class RefreshWorker {
  private worker: Worker | null = null;

  // Metrics counters
  private metrics = {
    refresh_success_total: 0,
    refresh_failed_total: 0,
    refresh_retry_total: 0,
    refresh_skipped_total: 0,
    urgent_refresh_total: 0,
    scheduled_refresh_total: 0,
  };

  constructor() {
    logger.info('RefreshWorker initialized');
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.worker) {
      logger.warn('Refresh worker already running');
      return;
    }

    const queueManager = QueueManager.getInstance();
    this.worker = queueManager.createWorker(
      REFRESH_QUEUE_NAME,
      this.processJob.bind(this),
      {
        concurrency: 3, // Process 3 refresh jobs concurrently
        limiter: {
          max: 5, // Max 5 jobs
          duration: 1000, // per second
        },
      }
    );

    // Setup Sentry error handlers
    this.setupSentryHandlers();

    logger.info('Refresh worker started');
  }

  /**
   * Setup Sentry error handlers for worker
   */
  private setupSentryHandlers(): void {
    if (!this.worker) return;

    this.worker.on('error', (error: Error) => {
      logger.error('Refresh worker error', { error: error.message });

      captureException(error, {
        level: 'error',
        tags: {
          worker: 'refresh',
          queue: REFRESH_QUEUE_NAME,
        },
      });
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      if (!job) return;

      const { accountId, platform, priority } = job.data as RefreshJobData;
      const currentAttempt = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts || 5;

      // Only capture to Sentry if this is the final failure
      if (currentAttempt >= maxAttempts) {
        addBreadcrumb('Refresh job failed after all retries', 'worker', {
          jobId: job.id,
          accountId,
          platform,
          priority,
          attemptsMade: job.attemptsMade,
          maxAttempts,
        });

        captureException(error, {
          level: 'error',
          tags: {
            worker: 'refresh',
            queue: REFRESH_QUEUE_NAME,
            jobId: job.id || 'unknown',
            accountId: accountId || 'unknown',
            platform: platform || 'unknown',
            priority: priority || 'unknown',
            finalFailure: 'true',
          },
          extra: {
            jobData: job.data,
            attemptsMade: job.attemptsMade,
            maxAttempts,
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
      logger.warn('Refresh worker not running');
      return;
    }

    await this.worker.close();
    this.worker = null;

    logger.info('Refresh worker stopped');
  }

  /**
   * Process a refresh job
   */
  private async processJob(job: Job<RefreshJobData>): Promise<any> {
    const { accountId, workspaceId, platform, priority, triggeredBy } = job.data;
    const currentAttempt = job.attemptsMade + 1;
    const startTime = Date.now();

    logger.info('Processing refresh job', {
      jobId: job.id,
      accountId,
      platform,
      priority,
      triggeredBy,
      attemptsMade: job.attemptsMade,
      currentAttempt,
    });

    // Track priority metrics
    if (priority === 'urgent') {
      this.metrics.urgent_refresh_total++;
    } else {
      this.metrics.scheduled_refresh_total++;
    }

    // Acquire distributed lock to prevent concurrent refresh
    const { distributedLockService } = await import('../services/DistributedLockService');
    const refreshLock = await distributedLockService.acquireLock(`refresh:${accountId}`, {
      ttl: 60000, // 1 minute
      retryAttempts: 1,
    });

    if (!refreshLock) {
      this.metrics.refresh_skipped_total++;

      logger.warn('Could not acquire refresh lock - another worker may be refreshing', {
        accountId,
      });

      return {
        success: false,
        message: 'Skipped - another worker refreshing',
        skipped: true,
      };
    }

    try {
      // Get provider for this platform
      const { providerFactory } = await import('../providers/ProviderFactory');
      const provider = providerFactory.getProvider(platform);

      // Refresh token
      const result = await provider.refreshToken({ accountId });

      const duration = Date.now() - startTime;

      if (result.success) {
        this.metrics.refresh_success_total++;

        logger.info('Token refresh successful', {
          accountId,
          platform,
          priority,
          expiresAt: result.expiresAt,
          duration,
        });

        return {
          success: true,
          expiresAt: result.expiresAt,
        };
      } else {
        this.metrics.refresh_failed_total++;

        logger.error('Token refresh failed', {
          accountId,
          platform,
          priority,
          error: result.error,
          shouldReconnect: result.shouldReconnect,
          duration,
        });

        // If should reconnect, don't retry
        if (result.shouldReconnect) {
          throw new Error(`Token refresh failed - reconnect required: ${result.error}`);
        }

        // Otherwise, throw for retry
        throw new Error(`Token refresh failed: ${result.error}`);
      }
    } catch (error: any) {
      const currentAttempt = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts || 5;
      const duration = Date.now() - startTime;

      logger.error('Refresh job failed', {
        jobId: job.id,
        accountId,
        platform,
        error: error.message,
        currentAttempt,
        maxAttempts,
        duration,
      });

      if (currentAttempt < maxAttempts) {
        this.metrics.refresh_retry_total++;
      } else {
        this.metrics.refresh_failed_total++;
      }

      throw error;
    } finally {
      // Always release lock
      if (refreshLock) {
        try {
          await distributedLockService.releaseLock(refreshLock);
        } catch (lockError: any) {
          logger.error('Failed to release refresh lock', {
            accountId,
            error: lockError.message,
          });
        }
      }
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
   */
  getMetrics() {
    return { ...this.metrics };
  }
}
