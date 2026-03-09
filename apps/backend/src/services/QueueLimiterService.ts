/**
 * Queue Limiter Service
 * 
 * Prevents queue overload and runaway job creation by enforcing limits
 * on queue size, job retention, and cleanup policies.
 * 
 * Features:
 * - Queue size limits (10k standard, 20k critical)
 * - Job retention policies (100 completed, 1000 failed)
 * - Automatic cleanup of old jobs
 * - Queue pressure monitoring
 * - Integration with QueueMonitoringService for alerts
 * - Graceful degradation when Redis unavailable
 * 
 * Usage:
 * ```typescript
 * const limiter = QueueLimiterService.getInstance();
 * 
 * // Check if queue can accept new jobs
 * const canAdd = await limiter.canAddJob('posting-queue');
 * if (!canAdd) {
 *   throw new QueueFullError('Queue is full');
 * }
 * 
 * // Add job with limit check
 * await limiter.addJobWithLimitCheck(queue, 'job-name', jobData);
 * ```
 */

import { Queue } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';
import { config } from '../config';
import {
import { config } from '../config';
  updateQueueLimiterMetrics,
  recordQueueRejection,
  updateQueuePressure,
} from '../config/metrics';

export interface QueueLimits {
  maxJobs: number;                  // Max total jobs in queue
  maxCompletedRetention: number;    // Keep last N completed jobs
  maxFailedRetention: number;       // Keep last N failed jobs
  completedJobTTL: number;          // Completed job TTL in seconds (24 hours)
  failedJobTTL: number;             // Failed job TTL in seconds (7 days)
  alertThreshold: number;           // Alert when queue reaches this % (0.8 = 80%)
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
  pressure: number;  // 0-1 ratio of current/max
}

export interface CleanupResult {
  completedRemoved: number;
  failedRemoved: number;
  totalRemoved: number;
  bytesFreed: number;
}

export class QueueFullError extends Error {
  constructor(queueName: string, currentSize: number, maxSize: number) {
    super(`Queue ${queueName} is full (${currentSize}/${maxSize} jobs)`);
    this.name = 'QueueFullError';
  }
}

export class QueueLimiterService {
  private static instance: QueueLimiterService | null = null;
  
  // Default limits for standard queues
  private readonly DEFAULT_LIMITS: QueueLimits = {
    maxJobs: 10000,
    maxCompletedRetention: 100,
    maxFailedRetention: 1000,
    completedJobTTL: 86400,      // 24 hours
    failedJobTTL: 604800,         // 7 days
    alertThreshold: 0.8,          // 80%
  };
  
  // Critical queues get higher limits
  private readonly CRITICAL_LIMITS: QueueLimits = {
    maxJobs: 20000,
    maxCompletedRetention: 100,
    maxFailedRetention: 1000,
    completedJobTTL: 86400,
    failedJobTTL: 604800,
    alertThreshold: 0.8,
  };
  
  // Critical queue names
  private readonly CRITICAL_QUEUES = new Set([
    'posting-queue',
    'publishing-queue',
    'billing-queue',
  ]);
  
  // Custom limits per queue
  private queueLimits: Map<string, QueueLimits> = new Map();
  
  // Metrics
  private metrics = {
    rejections: {
      total: 0,
      byQueue: new Map<string, number>(),
    },
    cleanups: {
      total: 0,
      completedRemoved: 0,
      failedRemoved: 0,
    },
    alerts: {
      total: 0,
      byQueue: new Map<string, number>(),
    },
  };
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    logger.info('QueueLimiterService initialized');
  }
  
  static getInstance(): QueueLimiterService {
    if (!QueueLimiterService.instance) {
      QueueLimiterService.instance = new QueueLimiterService();
    }
    return QueueLimiterService.instance;
  }

  /**
   * Get limits for a queue
   */
  getLimits(queueName: string): QueueLimits {
    // Check custom limits first
    if (this.queueLimits.has(queueName)) {
      return this.queueLimits.get(queueName)!;
    }
    
    // Check if critical queue
    if (this.CRITICAL_QUEUES.has(queueName)) {
      return this.CRITICAL_LIMITS;
    }
    
    // Return default limits
    return this.DEFAULT_LIMITS;
  }

  /**
   * Set custom limits for a queue
   */
  setLimits(queueName: string, limits: Partial<QueueLimits>): void {
    const currentLimits = this.getLimits(queueName);
    const newLimits = { ...currentLimits, ...limits };
    this.queueLimits.set(queueName, newLimits);
    
    logger.info('Queue limits updated', {
      queueName,
      limits: newLimits,
    });
  }

  /**
   * Apply limits to a BullMQ queue configuration
   */
  applyLimits(queueName: string): Partial<any> {
    const limits = this.getLimits(queueName);
    
    return {
      defaultJobOptions: {
        removeOnComplete: {
          age: limits.completedJobTTL,
          count: limits.maxCompletedRetention,
        },
        removeOnFail: {
          age: limits.failedJobTTL,
          count: limits.maxFailedRetention,
        },
      },
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queue: Queue): Promise<QueueStats> {
    try {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed'
      );
      
      const total = counts.waiting + counts.active + counts.delayed;
      const limits = this.getLimits(queue.name);
      const pressure = total / limits.maxJobs;
      
      return {
        waiting: counts.waiting,
        active: counts.active,
        completed: counts.completed,
        failed: counts.failed,
        delayed: counts.delayed,
        total,
        pressure,
      };
    } catch (error: any) {
      logger.error('Failed to get queue stats', {
        queue: queue.name,
        error: error.message,
      });
      
      // Return safe defaults on error
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
        pressure: 0,
      };
    }
  }

  /**
   * Check if queue is full
   */
  async isQueueFull(queue: Queue): Promise<boolean> {
    const stats = await this.getQueueStats(queue);
    const limits = this.getLimits(queue.name);
    
    return stats.total >= limits.maxJobs;
  }

  /**
   * Check if queue can accept new jobs
   */
  async canAddJob(queue: Queue): Promise<boolean> {
    // Check if feature is enabled
    const enabled = process.env.QUEUE_LIMITS_ENABLED !== 'false';
    if (!enabled) {
      return true;
    }
    
    return !(await this.isQueueFull(queue));
  }

  /**
   * Calculate queue pressure (0-1 ratio)
   */
  async calculateQueuePressure(queue: Queue): Promise<number> {
    const stats = await this.getQueueStats(queue);
    return stats.pressure;
  }

  /**
   * Check if queue pressure exceeds alert threshold
   */
  async checkAlertThreshold(queue: Queue): Promise<boolean> {
    const pressure = await this.calculateQueuePressure(queue);
    const limits = this.getLimits(queue.name);
    
    if (pressure >= limits.alertThreshold) {
      this.metrics.alerts.total++;
      this.metrics.alerts.byQueue.set(
        queue.name,
        (this.metrics.alerts.byQueue.get(queue.name) || 0) + 1
      );
      
      logger.warn('Queue pressure threshold exceeded', {
        queue: queue.name,
        pressure: pressure.toFixed(2),
        threshold: limits.alertThreshold,
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Add job with limit check
   * Throws QueueFullError if queue is full
   */
  async addJobWithLimitCheck(
    queue: Queue,
    jobName: string,
    data: any,
    options?: any
  ): Promise<any> {
    // Check if queue can accept jobs
    const canAdd = await this.canAddJob(queue);
    
    if (!canAdd) {
      const stats = await this.getQueueStats(queue);
      const limits = this.getLimits(queue.name);
      
      // Increment rejection metrics
      this.metrics.rejections.total++;
      this.metrics.rejections.byQueue.set(
        queue.name,
        (this.metrics.rejections.byQueue.get(queue.name) || 0) + 1
      );
      
      // Update Prometheus metrics
      recordQueueRejection(queue.name);
      
      logger.error('Queue full - job rejected', {
        queue: queue.name,
        jobName,
        currentSize: stats.total,
        maxSize: limits.maxJobs,
      });
      
      throw new QueueFullError(queue.name, stats.total, limits.maxJobs);
    }
    
    // Add job to queue
    const job = await queue.add(jobName, data, options);
    
    // Update pressure metrics
    const pressure = await this.calculateQueuePressure(queue);
    updateQueuePressure(queue.name, pressure);
    
    // Check alert threshold
    await this.checkAlertThreshold(queue);
    
    return job;
  }

  /**
   * Clean up old jobs from queue
   */
  async cleanupOldJobs(queue: Queue): Promise<CleanupResult> {
    const limits = this.getLimits(queue.name);
    const startTime = Date.now();
    
    logger.info('Starting queue cleanup', {
      queue: queue.name,
      limits,
    });
    
    try {
      // Clean completed jobs
      const completedRemoved = await queue.clean(
        limits.completedJobTTL * 1000, // Convert to milliseconds
        limits.maxCompletedRetention,
        'completed'
      );
      
      // Clean failed jobs
      const failedRemoved = await queue.clean(
        limits.failedJobTTL * 1000,
        limits.maxFailedRetention,
        'failed'
      );
      
      const totalRemoved = completedRemoved.length + failedRemoved.length;
      
      // Estimate bytes freed (rough estimate: 1KB per job)
      const bytesFreed = totalRemoved * 1024;
      
      // Update metrics
      this.metrics.cleanups.total++;
      this.metrics.cleanups.completedRemoved += completedRemoved.length;
      this.metrics.cleanups.failedRemoved += failedRemoved.length;
      
      // Update Prometheus metrics
      updateQueueLimiterMetrics(
        queue.name,
        'cleanup',
        totalRemoved,
        Date.now() - startTime
      );
      
      logger.info('Queue cleanup completed', {
        queue: queue.name,
        completedRemoved: completedRemoved.length,
        failedRemoved: failedRemoved.length,
        totalRemoved,
        bytesFreed,
        durationMs: Date.now() - startTime,
      });
      
      return {
        completedRemoved: completedRemoved.length,
        failedRemoved: failedRemoved.length,
        totalRemoved,
        bytesFreed,
      };
      
    } catch (error: any) {
      logger.error('Queue cleanup failed', {
        queue: queue.name,
        error: error.message,
      });
      
      return {
        completedRemoved: 0,
        failedRemoved: 0,
        totalRemoved: 0,
        bytesFreed: 0,
      };
    }
  }

  /**
   * Start automatic cleanup worker
   * Runs every hour to clean up old jobs
   */
  startCleanupWorker(queues: Queue[]): void {
    if (this.cleanupInterval) {
      logger.warn('Cleanup worker already running');
      return;
    }
    
    const runCleanup = async () => {
      logger.info('Running scheduled queue cleanup', {
        queueCount: queues.length,
      });
      
      for (const queue of queues) {
        try {
          await this.cleanupOldJobs(queue);
        } catch (error: any) {
          logger.error('Cleanup failed for queue', {
            queue: queue.name,
            error: error.message,
          });
        }
      }
    };
    
    // Run immediately
    runCleanup();
    
    // Schedule hourly cleanup
    this.cleanupInterval = setInterval(runCleanup, 3600000); // 1 hour
    
    logger.info('Cleanup worker started', {
      interval: '1 hour',
      queueCount: queues.length,
    });
  }

  /**
   * Stop automatic cleanup worker
   */
  stopCleanupWorker(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Cleanup worker stopped');
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      rejections: {
        total: this.metrics.rejections.total,
        byQueue: Object.fromEntries(this.metrics.rejections.byQueue),
      },
      cleanups: {
        total: this.metrics.cleanups.total,
        completedRemoved: this.metrics.cleanups.completedRemoved,
        failedRemoved: this.metrics.cleanups.failedRemoved,
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
      rejections: {
        total: 0,
        byQueue: new Map(),
      },
      cleanups: {
        total: 0,
        completedRemoved: 0,
        failedRemoved: 0,
      },
      alerts: {
        total: 0,
        byQueue: new Map(),
      },
    };
  }
}

// Export singleton instance
export const queueLimiterService = QueueLimiterService.getInstance();

