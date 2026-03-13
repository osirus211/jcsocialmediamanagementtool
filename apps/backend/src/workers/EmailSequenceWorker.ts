import { Worker, Job } from 'bullmq';
import { QueueManager } from '../queue/QueueManager';
import { emailSequenceService } from '../services/EmailSequenceService';
import { logger } from '../utils/logger';
import { captureException, addBreadcrumb } from '../monitoring/sentry';

/**
 * Email Sequence Worker
 * 
 * Processes welcome email sequence jobs
 * 
 * Features:
 * - Processes delayed sequence emails
 * - Handles job failures with retry logic
 * - Integrates with monitoring and error tracking
 */

export class EmailSequenceWorker {
  private worker: Worker;

  constructor() {
    const queueManager = QueueManager.getInstance();
    
    this.worker = new Worker(
      'email-sequence-queue',
      async (job: Job) => {
        return this.processJob(job);
      },
      {
        connection: queueManager.getConnection(),
        concurrency: 5, // Process up to 5 sequence emails concurrently
        maxStalledCount: 3,
        stalledInterval: 30 * 1000, // 30 seconds
      }
    );

    this.setupEventHandlers();
    logger.info('Email sequence worker initialized');
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job: Job) => {
      logger.info('Email sequence job completed', {
        jobId: job.id,
        userId: job.data.userId,
        step: job.data.step,
        duration: Date.now() - job.processedOn!,
      });

      addBreadcrumb(
        'Email sequence job completed',
        'worker',
        {
          jobId: job.id,
          userId: job.data.userId,
          step: job.data.step,
        }
      );
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error('Email sequence job failed', {
        jobId: job?.id,
        userId: job?.data?.userId,
        step: job?.data?.step,
        error: err.message,
        attemptsMade: job?.attemptsMade,
        attemptsTotal: job?.opts?.attempts,
      });

      addBreadcrumb(
        'Email sequence job failed',
        'worker',
        {
          jobId: job?.id,
          userId: job?.data?.userId,
          step: job?.data?.step,
          error: err.message,
        }
      );

      captureException(err, {
        tags: {
          worker: 'email-sequence',
          jobId: job?.id,
        },
        extra: {
          jobData: job?.data,
          attemptsMade: job?.attemptsMade,
        },
      });
    });

    this.worker.on('stalled', (jobId: string) => {
      logger.warn('Email sequence job stalled', { jobId });
    });

    this.worker.on('error', (err: Error) => {
      logger.error('Email sequence worker error', { error: err.message });
      captureException(err, {
        tags: {
          worker: 'email-sequence',
        },
      });
    });
  }

  private async processJob(job: Job): Promise<void> {
    const { userId, step, templateType, subject } = job.data;

    logger.info('Processing email sequence job', {
      jobId: job.id,
      userId,
      step,
      templateType,
    });

    addBreadcrumb(
      'Processing email sequence job',
      'worker',
      {
        jobId: job.id,
        userId,
        step,
        templateType,
      }
    );

    try {
      await emailSequenceService.processSequenceEmail({
        userId,
        step,
        templateType,
        subject,
      });

      logger.info('Email sequence job processed successfully', {
        jobId: job.id,
        userId,
        step,
      });
    } catch (error: any) {
      logger.error('Failed to process email sequence job', {
        jobId: job.id,
        userId,
        step,
        error: error.message,
      });

      // Re-throw to trigger BullMQ retry logic
      throw error;
    }
  }

  /**
   * Gracefully close the worker
   */
  async close(): Promise<void> {
    logger.info('Closing email sequence worker...');
    await this.worker.close();
    logger.info('Email sequence worker closed');
  }

  /**
   * Get worker statistics
   */
  getStats(): any {
    return {
      isRunning: !this.worker.closing,
      concurrency: this.worker.opts.concurrency,
      // Note: processed and failed are not available on Worker instance
      // These would need to be tracked manually if needed
    };
  }
}

export const emailSequenceWorker = new EmailSequenceWorker();