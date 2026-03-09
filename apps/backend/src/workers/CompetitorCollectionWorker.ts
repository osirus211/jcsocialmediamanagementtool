/**
 * Competitor Collection Worker
 * 
 * Processes competitor metrics collection jobs
 * Reuses existing analytics infrastructure
 */

import { Worker, Job } from 'bullmq';
import { COMPETITOR_COLLECTION_QUEUE_NAME, CompetitorCollectionJobData } from '../queue/CompetitorCollectionQueue';
import { QueueManager } from '../queue/QueueManager';
import { AnalyticsCollectionService } from '../services/AnalyticsCollectionService';
import { logger } from '../utils/logger';

export class CompetitorCollectionWorker {
  private worker: Worker | null = null;
  private isRunning: boolean = false;

  private readonly CONCURRENCY = 2;

  /**
   * Start worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Competitor collection worker already running');
      return;
    }

    const queueManager = QueueManager.getInstance();

    this.worker = queueManager.createWorker(
      COMPETITOR_COLLECTION_QUEUE_NAME,
      this.processJob.bind(this),
      {
        concurrency: this.CONCURRENCY,
      }
    );

    this.worker.on('failed', async (job, error) => {
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        logger.error('Competitor collection job exhausted all retries', {
          workspaceId: job.data.workspaceId,
          error: error.message,
        });
      }
    });

    this.isRunning = true;

    logger.info('Competitor collection worker started', {
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

    logger.info('Competitor collection worker stopped');
  }

  /**
   * Process competitor collection job
   */
  private async processJob(job: Job<CompetitorCollectionJobData>): Promise<void> {
    const { workspaceId } = job.data;

    logger.info('Processing competitor collection job', {
      workspaceId,
      jobId: job.id,
    });

    try {
      await AnalyticsCollectionService.collectCompetitorMetrics(workspaceId);

      logger.info('Competitor collection completed', {
        workspaceId,
      });
    } catch (error: any) {
      logger.error('Competitor collection failed', {
        workspaceId,
        error: error.message,
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
    };
  }
}

export const competitorCollectionWorker = new CompetitorCollectionWorker();
