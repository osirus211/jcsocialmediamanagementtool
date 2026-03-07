import { Queue, QueueOptions, Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import Redlock from 'redlock';

/**
 * Queue Manager
 * 
 * Manages BullMQ queues with Redis
 * 
 * Features:
 * - Queue creation and management
 * - Job persistence in Redis
 * - Retry with exponential backoff
 * - Job deduplication
 * - Crash-safe recovery
 * - Multi-worker safe
 * - Distributed locks
 * - Health monitoring
 */

export interface QueueConfig {
  name: string;
  options?: Partial<QueueOptions>;
}

export class QueueManager {
  private static instance: QueueManager;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private redlock: Redlock;
  private isShuttingDown: boolean = false;
  
  // Queue lag metrics
  private metrics = {
    queue_lag_sum_ms: 0,
    queue_lag_count: 0,
    queue_lag_max_ms: 0,
    queue_lag_threshold_exceeded_total: 0,
  };

  private constructor() {
    // Initialize Redlock for distributed locking
    const redis = getRedisClient();
    this.redlock = new Redlock([redis], {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 200,
      automaticExtensionThreshold: 500,
    });

    this.redlock.on('error', (error) => {
      logger.error('Redlock error:', error);
    });

    // Setup graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /**
   * Acquire distributed lock
   */
  async acquireLock(resource: string, ttl: number = 10000): Promise<any> {
    try {
      return await this.redlock.acquire([`lock:${resource}`], ttl);
    } catch (error) {
      logger.error('Failed to acquire lock', { resource, error });
      throw error;
    }
  }

  /**
   * Release distributed lock
   */
  async releaseLock(lock: any): Promise<void> {
    try {
      await lock.release();
    } catch (error) {
      logger.error('Failed to release lock', { error });
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      
      this.isShuttingDown = true;
      logger.info(`${signal} received - starting graceful shutdown`);

      try {
        await this.closeAll();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Create or get a queue with enhanced options
   */
  getQueue(name: string, options?: Partial<QueueOptions>): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const redis = getRedisClient();
    const defaultOptions: QueueOptions = {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 25s, 125s
        },
        removeOnComplete: {
          age: 1 * 3600, // Keep completed jobs for 1 hour only
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          count: 1000, // Keep last 1000 failed jobs
        },
      },
      ...options,
    };

    const queue = new Queue(name, defaultOptions);

    // Queue event handlers
    queue.on('error', (error) => {
      logger.error('Queue error', { name, error: error.message });
    });

    queue.on('waiting', (job) => {
      logger.debug('Job waiting', { queue: name, jobId: job.id });
    });

    this.queues.set(name, queue);

    logger.info('Queue created', { name });

    return queue;
  }

  /**
   * Get posting queue (convenience method)
   */
  getPostingQueue(): Queue {
    return this.getQueue('posting-queue');
  }

  /**
   * Create a worker for a queue with enhanced error handling
   * 
   * QUEUE STARVATION PROTECTION:
   * - lockDuration: 30 seconds (prevents long-running jobs from blocking)
   * - lockRenewTime: 15 seconds (auto-renew for legitimate long jobs)
   * - If job exceeds lockDuration without renewal, it's marked as stalled
   * - Stalled jobs are automatically retried by BullMQ
   */
  createWorker(
    queueName: string,
    processor: (job: Job) => Promise<any>,
    options?: any
  ): Worker {
    if (this.workers.has(queueName)) {
      logger.warn('Worker already exists for queue', { queueName });
      return this.workers.get(queueName)!;
    }

    const redis = getRedisClient();
    const worker = new Worker(queueName, processor, {
      connection: redis,
      concurrency: options?.concurrency || 5,
      limiter: options?.limiter,
      lockDuration: 30000, // 30 seconds lock duration (STARVATION PROTECTION)
      lockRenewTime: 15000, // Renew lock every 15 seconds
      ...options,
    });

    // Worker event handlers
    worker.on('completed', (job) => {
      logger.info('Job completed', {
        queue: queueName,
        jobId: job.id,
        jobName: job.name,
        duration: job.finishedOn ? job.finishedOn - job.processedOn! : 0,
      });
    });

    worker.on('failed', (job, error) => {
      logger.error('Job failed', {
        queue: queueName,
        jobId: job?.id,
        jobName: job?.name,
        error: error.message,
        stack: error.stack,
        attemptsMade: job?.attemptsMade,
        attemptsTotal: job?.opts.attempts,
      });
    });

    worker.on('error', (error) => {
      logger.error('Worker error', {
        queue: queueName,
        error: error.message,
        stack: error.stack,
      });
    });

    worker.on('stalled', (jobId) => {
      logger.warn('Job stalled', {
        queue: queueName,
        jobId,
      });
    });

    worker.on('active', (job) => {
      // QUEUE LAG METRICS: Measure time between job scheduled and job started
      const now = Date.now();
      const jobCreatedAt = job.timestamp; // BullMQ timestamp when job was added
      
      if (jobCreatedAt) {
        const lag = now - jobCreatedAt;
        
        // Update metrics
        this.metrics.queue_lag_sum_ms += lag;
        this.metrics.queue_lag_count++;
        this.metrics.queue_lag_max_ms = Math.max(this.metrics.queue_lag_max_ms, lag);
        
        // Alert if lag > 60 seconds
        if (lag > 60000) {
          this.metrics.queue_lag_threshold_exceeded_total++;
          logger.warn('Queue lag threshold exceeded', {
            queue: queueName,
            jobId: job.id,
            jobName: job.name,
            lag_ms: lag,
            lag_seconds: Math.floor(lag / 1000),
            alert: 'QUEUE_LAG_THRESHOLD_EXCEEDED',
          });
        }
        
        logger.debug('Job active with lag measurement', {
          queue: queueName,
          jobId: job.id,
          jobName: job.name,
          lag_ms: lag,
          lag_seconds: Math.floor(lag / 1000),
        });
      } else {
        logger.debug('Job active', {
          queue: queueName,
          jobId: job.id,
          jobName: job.name,
        });
      }
    });

    this.workers.set(queueName, worker);

    logger.info('Worker created', { queueName, concurrency: options?.concurrency || 5 });

    return worker;
  }

  /**
   * Add a job to queue with deduplication and distributed lock
   */
  async addJob(
    queueName: string,
    jobName: string,
    data: any,
    options?: any
  ): Promise<Job> {
    const queue = this.getQueue(queueName);

    // Use jobId for deduplication
    const jobId = options?.jobId || `${jobName}-${data.postId || Date.now()}`;

    // Acquire lock to prevent race conditions
    const lock = await this.acquireLock(`job:${jobId}`, 5000);

    try {
      // Check if job already exists
      const existingJob = await queue.getJob(jobId);
      if (existingJob) {
        const state = await existingJob.getState();
        
        // If job is in active state, don't add duplicate
        if (['waiting', 'delayed', 'active', 'paused'].includes(state)) {
          logger.warn('Job already exists in queue', {
            queue: queueName,
            jobId,
            state,
          });
          return existingJob;
        }
      }

      // Add job to queue
      const job = await queue.add(jobName, data, {
        ...options,
        jobId,
      });

      logger.info('Job added to queue', {
        queue: queueName,
        jobId: job.id,
        jobName,
      });

      return job;
    } catch (error: any) {
      // If job already exists, return existing job
      if (error.message?.includes('already exists')) {
        logger.warn('Job already exists in queue (race condition)', {
          queue: queueName,
          jobId,
        });
        const existingJob = await queue.getJob(jobId);
        if (existingJob) {
          return existingJob;
        }
      }
      throw error;
    } finally {
      await this.releaseLock(lock);
    }
  }

  /**
   * Add a delayed job
   */
  async addDelayedJob(
    queueName: string,
    jobName: string,
    data: any,
    delay: number,
    options?: any
  ): Promise<Job> {
    return this.addJob(queueName, jobName, data, {
      ...options,
      delay,
    });
  }

  /**
   * Get job by ID
   */
  async getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  /**
   * Remove job from queue
   */
  async removeJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    
    if (job) {
      await job.remove();
      logger.info('Job removed from queue', {
        queue: queueName,
        jobId,
      });
    }
  }

  /**
   * Get queue statistics with health status
   */
  async getQueueStats(queueName: string): Promise<any> {
    const queue = this.getQueue(queueName);

    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    const total = waiting + active + completed + failed + delayed;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total,
      failureRate: failureRate.toFixed(2),
      health: failureRate < 5 ? 'healthy' : failureRate < 20 ? 'degraded' : 'unhealthy',
    };
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    
    for (const queueName of this.getQueueNames()) {
      stats[queueName] = await this.getQueueStats(queueName);
    }
    
    return stats;
  }

  /**
   * Get worker health status
   */
  getWorkerHealth(): Record<string, any> {
    const health: Record<string, any> = {};
    
    for (const [name, worker] of this.workers.entries()) {
      health[name] = {
        isRunning: worker.isRunning(),
        isPaused: worker.isPaused(),
      };
    }
    
    return health;
  }

  /**
   * Pause queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    logger.info('Queue paused', { queueName });
  }

  /**
   * Resume queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    logger.info('Queue resumed', { queueName });
  }

  /**
   * Clean old jobs
   */
  async cleanQueue(
    queueName: string,
    grace: number = 24 * 3600 * 1000,
    status: 'completed' | 'failed' = 'completed'
  ): Promise<string[]> {
    const queue = this.getQueue(queueName);
    const jobs = await queue.clean(grace, 1000, status);
    
    logger.info('Queue cleaned', {
      queueName,
      status,
      count: jobs.length,
    });

    return jobs;
  }

  /**
   * Close all queues and workers gracefully
   */
  async closeAll(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Already shutting down');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Closing all queues and workers');

    // Close all workers first (stop processing)
    for (const [name, worker] of this.workers.entries()) {
      try {
        await worker.close();
        logger.info('Worker closed', { name });
      } catch (error) {
        logger.error('Error closing worker', { name, error });
      }
    }

    // Close all queues
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
        logger.info('Queue closed', { name });
      } catch (error) {
        logger.error('Error closing queue', { name, error });
      }
    }

    this.workers.clear();
    this.queues.clear();

    logger.info('All queues and workers closed');
  }

  /**
   * Get all queue names
   */
  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Check if queue exists
   */
  hasQueue(name: string): boolean {
    return this.queues.has(name);
  }

  /**
   * Get queue lag metrics
   */
  getQueueLagMetrics(): any {
    const avgLag = this.metrics.queue_lag_count > 0 
      ? this.metrics.queue_lag_sum_ms / this.metrics.queue_lag_count 
      : 0;
    
    return {
      average_lag_ms: Math.round(avgLag),
      average_lag_seconds: Math.round(avgLag / 1000),
      max_lag_ms: this.metrics.queue_lag_max_ms,
      max_lag_seconds: Math.round(this.metrics.queue_lag_max_ms / 1000),
      total_jobs_measured: this.metrics.queue_lag_count,
      threshold_exceeded_count: this.metrics.queue_lag_threshold_exceeded_total,
    };
  }

  /**
   * Check if shutting down
   */
  isShutdown(): boolean {
    return this.isShuttingDown;
  }
}

// Singleton should be created after Redis is connected
