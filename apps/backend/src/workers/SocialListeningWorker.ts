/**
 * Social Listening Worker
 * 
 * Processes social listening collection jobs
 * Reuses existing worker infrastructure and patterns
 */

import { Worker, Job } from 'bullmq';
import { SOCIAL_LISTENING_QUEUE_NAME, SocialListeningJobData } from '../queue/SocialListeningQueue';
import { QueueManager } from '../queue/QueueManager';
import { ListeningCollectorService } from '../services/ListeningCollectorService';
import { TrendAnalyzerService } from '../services/TrendAnalyzerService';
import { logger } from '../utils/logger';

export class SocialListeningWorker {
  private worker: Worker | null = null;
  private isRunning: boolean = false;

  private readonly CONCURRENCY = 3;

  // Metrics
  private metrics = {
    jobs_processed_total: 0,
    jobs_success_total: 0,
    jobs_failure_total: 0,
    mentions_collected_total: 0,
    trends_calculated_total: 0,
  };

  /**
   * Start worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Social listening worker already running');
      return;
    }

    const queueManager = QueueManager.getInstance();

    this.worker = queueManager.createWorker(
      SOCIAL_LISTENING_QUEUE_NAME,
      this.processJob.bind(this),
      {
        concurrency: this.CONCURRENCY,
        // Retry policy: 3 attempts with exponential backoff
        settings: {
          backoffStrategy: (attemptsMade: number) => {
            return Math.min(1000 * Math.pow(2, attemptsMade), 30000); // Max 30 seconds
          },
        },
      }
    );

    this.worker.on('completed', (job) => {
      this.metrics.jobs_success_total++;
      logger.debug('Social listening job completed', {
        jobId: job.id,
        jobType: job.data.jobType,
      });
    });

    this.worker.on('failed', async (job, error) => {
      this.metrics.jobs_failure_total++;
      
      if (job && job.attemptsMade >= 3) {
        logger.error('Social listening job exhausted all retries', {
          jobId: job.id,
          jobType: job.data.jobType,
          workspaceId: job.data.workspaceId,
          platform: job.data.platform,
          error: error.message,
        });
        
        // Job will automatically go to Dead Letter Queue (DLQ)
        // if configured in QueueManager
      }
    });

    this.isRunning = true;

    logger.info('Social listening worker started', {
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

    logger.info('Social listening worker stopped');
  }

  /**
   * Process social listening job
   */
  private async processJob(job: Job<SocialListeningJobData>): Promise<void> {
    const { workspaceId, platform, jobType } = job.data;
    const startTime = Date.now();

    this.metrics.jobs_processed_total++;

    logger.info('Processing social listening job', {
      jobId: job.id,
      workspaceId,
      platform,
      jobType,
    });

    // Acquire distributed lock to prevent concurrent collection
    const { distributedLockService } = await import('../services/DistributedLockService');
    const lockKey = `lock:listening:${workspaceId}:${platform}:${jobType}`;

    try {
      await distributedLockService.withLock(
        lockKey,
        async () => {
          let result: number = 0;

          switch (jobType) {
            case 'keyword':
              result = await ListeningCollectorService.collectKeywordMentions(workspaceId, platform);
              this.metrics.mentions_collected_total += result;
              break;

            case 'hashtag':
              result = await ListeningCollectorService.collectHashtagMentions(workspaceId, platform);
              this.metrics.mentions_collected_total += result;
              break;

            case 'competitor':
              result = await ListeningCollectorService.collectCompetitorMentions(workspaceId, platform);
              this.metrics.mentions_collected_total += result;
              break;

            case 'trends':
              result = await TrendAnalyzerService.calculateTrends(workspaceId);
              this.metrics.trends_calculated_total += result;
              break;

            default:
              throw new Error(`Unknown job type: ${jobType}`);
          }

          const duration = Date.now() - startTime;

          logger.info('Social listening job completed', {
            jobId: job.id,
            workspaceId,
            platform,
            jobType,
            result,
            duration,
          });
        },
        {
          ttl: 120000, // 2 minutes
          retryCount: 1,
        }
      );
    } catch (error: unknown) {
      // Check if this is a lock acquisition error
      if (error instanceof Error && error.name === 'LockAcquisitionError') {
        logger.info('Social listening job already in progress by another worker', {
          jobId: job.id,
          workspaceId,
          platform,
          jobType,
        });
        // Skip this job - another worker is processing it
        return;
      }

      // Other errors should be handled normally
      const duration = Date.now() - startTime;

      logger.error('Social listening job failed', {
        jobId: job.id,
        workspaceId,
        platform,
        jobType,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      throw error;
    }
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

export const socialListeningWorker = new SocialListeningWorker();
