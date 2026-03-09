/**
 * Follower Collection Worker
 * 
 * Processes follower count collection jobs
 * Reuses existing analytics infrastructure
 */

import { Worker, Job } from 'bullmq';
import { FOLLOWER_COLLECTION_QUEUE_NAME, FollowerCollectionJobData } from '../queue/FollowerCollectionQueue';
import { QueueManager } from '../queue/QueueManager';
import { AnalyticsCollectionService } from '../services/AnalyticsCollectionService';
import { logger } from '../utils/logger';

export class FollowerCollectionWorker {
  private worker: Worker | null = null;
  private isRunning: boolean = false;

  private readonly CONCURRENCY = 2;

  /**
   * Start worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Follower collection worker already running');
      return;
    }

    const queueManager = QueueManager.getInstance();

    this.worker = queueManager.createWorker(
      FOLLOWER_COLLECTION_QUEUE_NAME,
      this.processJob.bind(this),
      {
        concurrency: this.CONCURRENCY,
      }
    );

    this.worker.on('failed', async (job, error) => {
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        logger.error('Follower collection job exhausted all retries', {
          workspaceId: job.data.workspaceId,
          error: error.message,
        });
      }
    });

    this.isRunning = true;

    logger.info('Follower collection worker started', {
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

    logger.info('Follower collection worker stopped');
  }

  /**
   * Process follower collection job
   */
  private async processJob(job: Job<FollowerCollectionJobData>): Promise<void> {
    const { workspaceId } = job.data;

    logger.info('Processing follower collection job', {
      workspaceId,
      jobId: job.id,
    });

    try {
      await AnalyticsCollectionService.scheduleFollowerCollection(workspaceId);

      logger.info('Follower collection completed', {
        workspaceId,
      });
    } catch (error: any) {
      logger.error('Follower collection failed', {
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

export const followerCollectionWorker = new FollowerCollectionWorker();
