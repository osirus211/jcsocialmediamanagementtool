import { Worker, Job } from 'bullmq';
import { QueueManager } from '../queue/QueueManager';
import { PostAnalytics } from '../models/PostAnalytics';
import { HashtagAnalytics } from '../models/HashtagAnalytics';
import { LinkClickAnalytics } from '../models/LinkClickAnalytics';
import { logger } from '../utils/logger';

/**
 * Analytics Cleanup Worker
 * 
 * Dedicated BullMQ worker for cleaning up old analytics data
 * 
 * Features:
 * - Runs daily at 2 AM UTC
 * - Cleans up old PostAnalytics (365+ days)
 * - Cleans up old HashtagAnalytics (365+ days)
 * - Cleans up old LinkClickAnalytics (90+ days)
 * - Error handling and retry logic
 * - Each cleanup wrapped in try/catch (RULE 15)
 */

export class AnalyticsCleanupWorker {
  private worker: Worker | null = null;
  
  // Metrics
  private metrics = {
    cleanup_runs_total: 0,
    records_cleaned_total: 0,
    errors_total: 0,
  };

  constructor() {
    logger.info('AnalyticsCleanupWorker initialized');
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    try {
      const queueManager = QueueManager.getInstance();
      const queue = queueManager.getQueue('analytics_cleanup_queue');

      this.worker = new Worker(
        'analytics_cleanup_queue',
        async (job: Job) => {
          return this.processCleanup(job);
        },
        {
          connection: queueManager.getConnection(),
          concurrency: 1, // Process one at a time
          removeOnComplete: 10 as any,
          removeOnFail: 50 as any,
        }
      );

      this.worker.on('completed', (job) => {
        logger.info('Analytics cleanup job completed', {
          jobId: job.id,
          recordsCleaned: job.returnvalue?.recordsCleaned || 0,
        });
      });

      this.worker.on('failed', (job, err) => {
        this.metrics.errors_total++;
        logger.error('Analytics cleanup job failed', {
          jobId: job?.id,
          error: err.message,
        });
      });

      // Add repeatable job to run daily at 2 AM UTC
      await queue.add(
        'cleanup-analytics-records',
        {},
        {
          repeat: {
            pattern: '0 2 * * *', // Daily at 2 AM UTC
          },
          jobId: 'analytics-cleanup-daily',
        }
      );

      logger.info('AnalyticsCleanupWorker started successfully');
    } catch (error: unknown) {
      logger.error('Failed to start AnalyticsCleanupWorker', { 
        error: error instanceof Error ? (error as Error).message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info('AnalyticsCleanupWorker stopped');
    }
  }

  /**
   * Process cleanup
   */
  private async processCleanup(job: Job): Promise<{ recordsCleaned: number }> {
    const startTime = Date.now();
    this.metrics.cleanup_runs_total++;
    
    try {
      logger.info('Starting analytics cleanup', { jobId: job.id });

      let totalRecordsCleaned = 0;

      // Cleanup PostAnalytics (RULE 15: wrapped in try/catch)
      try {
        const postAnalyticsResult = await (PostAnalytics as any).cleanup();
        totalRecordsCleaned += postAnalyticsResult.deletedCount || 0;
        logger.info('PostAnalytics cleanup completed', {
          recordsCleaned: postAnalyticsResult.deletedCount || 0
        });
      } catch (error: unknown) {
        logger.error('PostAnalytics cleanup failed (non-blocking)', {
          error: error instanceof Error ? (error as Error).message : String(error)
        });
        // Continue with other cleanups
      }

      // Cleanup HashtagAnalytics (RULE 15: wrapped in try/catch)
      try {
        const hashtagAnalyticsResult = await (HashtagAnalytics as any).cleanup();
        totalRecordsCleaned += hashtagAnalyticsResult.deletedCount || 0;
        logger.info('HashtagAnalytics cleanup completed', {
          recordsCleaned: hashtagAnalyticsResult.deletedCount || 0
        });
      } catch (error: unknown) {
        logger.error('HashtagAnalytics cleanup failed (non-blocking)', {
          error: error instanceof Error ? (error as Error).message : String(error)
        });
        // Continue with other cleanups
      }

      // Cleanup LinkClickAnalytics (RULE 15: wrapped in try/catch)
      try {
        const linkClickAnalyticsResult = await (LinkClickAnalytics as any).cleanup();
        totalRecordsCleaned += linkClickAnalyticsResult.deletedCount || 0;
        logger.info('LinkClickAnalytics cleanup completed', {
          recordsCleaned: linkClickAnalyticsResult.deletedCount || 0
        });
      } catch (error: unknown) {
        logger.error('LinkClickAnalytics cleanup failed (non-blocking)', {
          error: error instanceof Error ? (error as Error).message : String(error)
        });
        // Continue - this is the last cleanup
      }

      this.metrics.records_cleaned_total += totalRecordsCleaned;

      const duration = Date.now() - startTime;
      logger.info('Analytics cleanup completed', {
        totalRecordsCleaned,
        duration: `${duration}ms`,
      });

      return { recordsCleaned: totalRecordsCleaned };
    } catch (error: unknown) {
      this.metrics.errors_total++;
      logger.error('Analytics cleanup failed', {
        error: error instanceof Error ? (error as Error).message : String(error),
        duration: `${Date.now() - startTime}ms`,
      });
      throw error;
    }
  }

  /**
   * Get worker metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Health check
   */
  isHealthy(): boolean {
    return this.worker !== null;
  }
}

export const analyticsCleanupWorker = new AnalyticsCleanupWorker();
