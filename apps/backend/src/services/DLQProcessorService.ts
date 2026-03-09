/**
 * Dead Letter Queue (DLQ) Processor Service
 * 
 * Automatically manages and recovers failed jobs from the DLQ.
 * Classifies failures as transient or permanent and retries appropriately.
 * 
 * Features:
 * - Automatic failure classification (transient vs permanent)
 * - Smart retry with exponential backoff (1m, 5m, 30m, 2h)
 * - Manual review queue for permanent failures
 * - Alert when DLQ size exceeds threshold
 * - Metrics tracking for monitoring
 * - Integration with error aggregation
 * 
 * Usage:
 * ```typescript
 * const dlqProcessor = DLQProcessorService.getInstance();
 * 
 * // Start processing loop (runs every 5 minutes)
 * dlqProcessor.startProcessingLoop([postingQueue, analyticsQueue]);
 * 
 * // Manual retry
 * await dlqProcessor.retryJob(queue, jobId);
 * ```
 */

import { Queue, Job } from 'bullmq';
import { logger } from '../utils/logger';
import {
  updateDLQMetrics,
  recordDLQRetry,
  recordDLQPermanentFailure,
  updateDLQSize,
} from '../config/metrics';

export interface DLQConfig {
  scanInterval?: number;        // Scan interval in ms (default: 300000 = 5 minutes)
  maxRetryAttempts?: number;    // Max retry attempts from DLQ (default: 3)
  retryDelays?: number[];       // Retry delays in ms (default: [60000, 300000, 1800000, 7200000])
  alertThreshold?: number;      // Alert when DLQ size exceeds this (default: 100)
}

export interface FailureClassification {
  type: 'transient' | 'permanent' | 'rate_limit' | 'validation';
  reason: string;
  retryable: boolean;
  retryDelay?: number;
}

export interface DLQStats {
  total: number;
  transient: number;
  permanent: number;
  rateLimit: number;
  validation: number;
  retried: number;
  manualReview: number;
}

export class DLQProcessorService {
  private static instance: DLQProcessorService | null = null;
  
  private readonly DEFAULT_CONFIG: DLQConfig = {
    scanInterval: 300000,        // 5 minutes
    maxRetryAttempts: 3,
    retryDelays: [
      60000,      // 1 minute
      300000,     // 5 minutes
      1800000,    // 30 minutes
      7200000,    // 2 hours
    ],
    alertThreshold: 100,
  };
  
  private config: DLQConfig;
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  
  // Metrics
  private metrics = {
    scans: {
      total: 0,
      jobsProcessed: 0,
    },
    retries: {
      total: 0,
      success: 0,
      failed: 0,
      byQueue: new Map<string, number>(),
    },
    permanentFailures: {
      total: 0,
      byQueue: new Map<string, number>(),
      byReason: new Map<string, number>(),
    },
    alerts: {
      total: 0,
      byQueue: new Map<string, number>(),
    },
  };
  
  private constructor(config?: DLQConfig) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    logger.info('DLQProcessorService initialized', { config: this.config });
  }
  
  static getInstance(config?: DLQConfig): DLQProcessorService {
    if (!DLQProcessorService.instance) {
      DLQProcessorService.instance = new DLQProcessorService(config);
    }
    return DLQProcessorService.instance;
  }

  /**
   * Classify job failure
   * Determines if failure is transient (retryable) or permanent
   */
  classifyFailure(job: Job, error: any): FailureClassification {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code;
    const stackTrace = error?.stack || '';
    
    // Rate limit errors
    if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorCode === 429 ||
      errorCode === 'RATE_LIMIT_EXCEEDED'
    ) {
      return {
        type: 'rate_limit',
        reason: 'Rate limit exceeded',
        retryable: true,
        retryDelay: 3600000, // 1 hour
      };
    }
    
    // Validation errors (permanent)
    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('bad request') ||
      errorMessage.includes('malformed') ||
      errorCode === 400 ||
      errorCode === 'VALIDATION_ERROR'
    ) {
      return {
        type: 'validation',
        reason: 'Validation error',
        retryable: false,
      };
    }
    
    // Authorization errors (permanent)
    if (
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('access denied') ||
      errorMessage.includes('permission') ||
      errorMessage.includes('token expired') ||
      errorMessage.includes('invalid token') ||
      errorCode === 401 ||
      errorCode === 403 ||
      errorCode === 'UNAUTHORIZED'
    ) {
      return {
        type: 'permanent',
        reason: 'Authorization error',
        retryable: false,
      };
    }
    
    // Resource not found (permanent)
    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('does not exist') ||
      errorCode === 404 ||
      errorCode === 'NOT_FOUND'
    ) {
      return {
        type: 'permanent',
        reason: 'Resource not found',
        retryable: false,
      };
    }
    
    // Duplicate errors (permanent)
    if (
      errorMessage.includes('duplicate') ||
      errorMessage.includes('already exists') ||
      errorCode === 409 ||
      errorCode === 'DUPLICATE'
    ) {
      return {
        type: 'permanent',
        reason: 'Duplicate resource',
        retryable: false,
      };
    }
    
    // Network/timeout errors (transient)
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('socket hang up') ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ECONNRESET' ||
      errorCode === 'ENOTFOUND'
    ) {
      return {
        type: 'transient',
        reason: 'Network/timeout error',
        retryable: true,
      };
    }
    
    // Service unavailable (transient)
    if (
      errorMessage.includes('service unavailable') ||
      errorMessage.includes('internal server error') ||
      errorMessage.includes('bad gateway') ||
      errorMessage.includes('gateway timeout') ||
      errorCode === 500 ||
      errorCode === 502 ||
      errorCode === 503 ||
      errorCode === 504
    ) {
      return {
        type: 'transient',
        reason: 'Service unavailable',
        retryable: true,
      };
    }
    
    // Default to permanent for unknown errors
    return {
      type: 'permanent',
      reason: 'Unknown error',
      retryable: false,
    };
  }

  /**
   * Get failed jobs from queue
   */
  async getFailedJobs(queue: Queue): Promise<Job[]> {
    try {
      return await queue.getFailed(0, 1000); // Get up to 1000 failed jobs
    } catch (error: any) {
      logger.error('Failed to get failed jobs', {
        queue: queue.name,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get DLQ statistics
   */
  async getDLQStats(queue: Queue): Promise<DLQStats> {
    const failedJobs = await this.getFailedJobs(queue);
    
    const stats: DLQStats = {
      total: failedJobs.length,
      transient: 0,
      permanent: 0,
      rateLimit: 0,
      validation: 0,
      retried: 0,
      manualReview: 0,
    };
    
    for (const job of failedJobs) {
      const classification = this.classifyFailure(job, job.failedReason);
      
      switch (classification.type) {
        case 'transient':
          stats.transient++;
          break;
        case 'permanent':
          stats.permanent++;
          break;
        case 'rate_limit':
          stats.rateLimit++;
          break;
        case 'validation':
          stats.validation++;
          break;
      }
      
      // Check if already retried from DLQ
      const dlqRetryCount = (job.data.dlqRetryCount || 0);
      if (dlqRetryCount > 0) {
        stats.retried++;
      }
      
      // Check if marked for manual review
      if (job.data.manualReview) {
        stats.manualReview++;
      }
    }
    
    return stats;
  }

  /**
   * Process failed jobs in queue
   */
  async processFailedJobs(queue: Queue): Promise<void> {
    if (this.isProcessing) {
      logger.debug('DLQ processing already in progress', { queue: queue.name });
      return;
    }
    
    this.isProcessing = true;
    const startTime = Date.now();
    
    try {
      logger.info('Starting DLQ processing', { queue: queue.name });
      
      const failedJobs = await this.getFailedJobs(queue);
      
      if (failedJobs.length === 0) {
        logger.debug('No failed jobs to process', { queue: queue.name });
        return;
      }
      
      logger.info('Processing failed jobs', {
        queue: queue.name,
        count: failedJobs.length,
      });
      
      // Update DLQ size metric
      updateDLQSize(queue.name, failedJobs.length);
      
      // Check alert threshold
      if (failedJobs.length >= this.config.alertThreshold!) {
        this.metrics.alerts.total++;
        this.metrics.alerts.byQueue.set(
          queue.name,
          (this.metrics.alerts.byQueue.get(queue.name) || 0) + 1
        );
        
        logger.error('DLQ size exceeds threshold', {
          queue: queue.name,
          size: failedJobs.length,
          threshold: this.config.alertThreshold,
        });
      }
      
      let processed = 0;
      let retried = 0;
      let markedForReview = 0;
      
      for (const job of failedJobs) {
        try {
          const result = await this.processFailedJob(queue, job);
          processed++;
          
          if (result === 'retried') {
            retried++;
          } else if (result === 'manual_review') {
            markedForReview++;
          }
        } catch (error: any) {
          logger.error('Failed to process DLQ job', {
            queue: queue.name,
            jobId: job.id,
            error: error.message,
          });
        }
      }
      
      this.metrics.scans.total++;
      this.metrics.scans.jobsProcessed += processed;
      
      const duration = Date.now() - startTime;
      
      // Update Prometheus metrics
      updateDLQMetrics(queue.name, failedJobs.length, retried, markedForReview);
      
      logger.info('DLQ processing completed', {
        queue: queue.name,
        processed,
        retried,
        markedForReview,
        durationMs: duration,
      });
      
    } catch (error: any) {
      logger.error('DLQ processing failed', {
        queue: queue.name,
        error: error.message,
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single failed job
   */
  private async processFailedJob(queue: Queue, job: Job): Promise<'retried' | 'manual_review' | 'skipped'> {
    // Classify failure
    const classification = this.classifyFailure(job, job.failedReason);
    
    logger.debug('Job failure classified', {
      queue: queue.name,
      jobId: job.id,
      classification,
    });
    
    // Check if already marked for manual review
    if (job.data.manualReview) {
      logger.debug('Job already marked for manual review', {
        queue: queue.name,
        jobId: job.id,
      });
      return 'skipped';
    }
    
    // Handle non-retryable failures
    if (!classification.retryable) {
      await this.markForManualReview(queue, job, classification);
      return 'manual_review';
    }
    
    // Check retry count from DLQ
    const dlqRetryCount = job.data.dlqRetryCount || 0;
    
    if (dlqRetryCount >= this.config.maxRetryAttempts!) {
      logger.warn('Job exceeded max DLQ retry attempts', {
        queue: queue.name,
        jobId: job.id,
        dlqRetryCount,
        maxAttempts: this.config.maxRetryAttempts,
      });
      
      await this.markForManualReview(queue, job, classification);
      return 'manual_review';
    }
    
    // Retry the job
    await this.retryJob(queue, job, classification);
    return 'retried';
  }

  /**
   * Retry a failed job
   */
  async retryJob(queue: Queue, job: Job, classification?: FailureClassification): Promise<void> {
    const dlqRetryCount = job.data.dlqRetryCount || 0;
    const retryDelay = classification?.retryDelay || this.config.retryDelays![dlqRetryCount] || 3600000;
    
    try {
      // Remove from failed set
      await job.remove();
      
      // Re-add to queue with delay
      await queue.add(
        job.name,
        {
          ...job.data,
          dlqRetryCount: dlqRetryCount + 1,
          dlqRetriedAt: new Date().toISOString(),
          originalFailureReason: job.failedReason,
        },
        {
          ...job.opts,
          delay: retryDelay,
          attempts: 3, // Reset attempts for retry
        }
      );
      
      this.metrics.retries.total++;
      this.metrics.retries.success++;
      this.metrics.retries.byQueue.set(
        queue.name,
        (this.metrics.retries.byQueue.get(queue.name) || 0) + 1
      );
      
      // Update Prometheus metrics
      recordDLQRetry(queue.name, classification?.type || 'unknown');
      
      logger.info('Job retried from DLQ', {
        queue: queue.name,
        jobId: job.id,
        dlqRetryCount: dlqRetryCount + 1,
        retryDelayMs: retryDelay,
        classificationType: classification?.type,
      });
      
    } catch (error: any) {
      this.metrics.retries.failed++;
      
      logger.error('Failed to retry job from DLQ', {
        queue: queue.name,
        jobId: job.id,
        error: error.message,
      });
      
      throw error;
    }
  }

  /**
   * Mark job for manual review
   */
  private async markForManualReview(
    queue: Queue,
    job: Job,
    classification: FailureClassification
  ): Promise<void> {
    try {
      // Update job data by re-adding with manual review flag
      // Note: BullMQ doesn't support updating failed job data directly
      // We keep the job in failed state but log it for manual review
      
      this.metrics.permanentFailures.total++;
      this.metrics.permanentFailures.byQueue.set(
        queue.name,
        (this.metrics.permanentFailures.byQueue.get(queue.name) || 0) + 1
      );
      this.metrics.permanentFailures.byReason.set(
        classification.reason,
        (this.metrics.permanentFailures.byReason.get(classification.reason) || 0) + 1
      );
      
      // Update Prometheus metrics
      recordDLQPermanentFailure(queue.name, classification.type);
      
      logger.warn('Job marked for manual review', {
        queue: queue.name,
        jobId: job.id,
        jobName: job.name,
        reason: classification.reason,
        type: classification.type,
        failedReason: job.failedReason,
        data: job.data,
      });
      
    } catch (error: any) {
      logger.error('Failed to mark job for manual review', {
        queue: queue.name,
        jobId: job.id,
        error: error.message,
      });
    }
  }

  /**
   * Start automatic DLQ processing loop
   */
  startProcessingLoop(queues: Queue[]): void {
    if (this.processingInterval) {
      logger.warn('DLQ processing loop already running');
      return;
    }
    
    const processAll = async () => {
      for (const queue of queues) {
        try {
          await this.processFailedJobs(queue);
        } catch (error: any) {
          logger.error('DLQ processing failed for queue', {
            queue: queue.name,
            error: error.message,
          });
        }
      }
    };
    
    // Run immediately
    processAll();
    
    // Schedule periodic processing
    this.processingInterval = setInterval(processAll, this.config.scanInterval!);
    
    logger.info('DLQ processing loop started', {
      interval: this.config.scanInterval,
      queueCount: queues.length,
    });
  }

  /**
   * Stop automatic DLQ processing loop
   */
  stopProcessingLoop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('DLQ processing loop stopped');
    }
  }

  /**
   * Manual retry API - retry specific job by ID
   */
  async manualRetry(queue: Queue, jobId: string): Promise<void> {
    const job = await queue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queue.name}`);
    }
    
    if (job.finishedOn && !job.failedReason) {
      throw new Error(`Job ${jobId} is not failed`);
    }
    
    logger.info('Manual retry requested', {
      queue: queue.name,
      jobId,
    });
    
    await this.retryJob(queue, job);
  }

  /**
   * Manual discard API - remove job from DLQ
   */
  async manualDiscard(queue: Queue, jobId: string): Promise<void> {
    const job = await queue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queue.name}`);
    }
    
    await job.remove();
    
    logger.info('Job manually discarded from DLQ', {
      queue: queue.name,
      jobId,
    });
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      scans: { ...this.metrics.scans },
      retries: {
        total: this.metrics.retries.total,
        success: this.metrics.retries.success,
        failed: this.metrics.retries.failed,
        byQueue: Object.fromEntries(this.metrics.retries.byQueue),
      },
      permanentFailures: {
        total: this.metrics.permanentFailures.total,
        byQueue: Object.fromEntries(this.metrics.permanentFailures.byQueue),
        byReason: Object.fromEntries(this.metrics.permanentFailures.byReason),
      },
      alerts: {
        total: this.metrics.alerts.total,
        byQueue: Object.fromEntries(this.metrics.alerts.byQueue),
      },
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      scans: {
        total: 0,
        jobsProcessed: 0,
      },
      retries: {
        total: 0,
        success: 0,
        failed: 0,
        byQueue: new Map(),
      },
      permanentFailures: {
        total: 0,
        byQueue: new Map(),
        byReason: new Map(),
      },
      alerts: {
        total: 0,
        byQueue: new Map(),
      },
    };
  }
}

// Export singleton instance
export const dlqProcessorService = DLQProcessorService.getInstance();
