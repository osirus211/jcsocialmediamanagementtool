/**
 * Webhook Delivery Worker
 * 
 * Processes webhook delivery jobs from the queue
 * Handles both immediate deliveries and retries
 */

import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { WebhookRetryService, WebhookDeliveryAttempt } from '../services/WebhookRetryService';

const QUEUE_NAME = 'webhook_delivery_queue';

export class WebhookDeliveryWorker {
  private worker: Worker<WebhookDeliveryAttempt> | null = null;

  start(): void {
    if (this.worker) {
      logger.warn('Webhook delivery worker already running');
      return;
    }

    const redis = getRedisClient();

    this.worker = new Worker<WebhookDeliveryAttempt>(
      QUEUE_NAME,
      async (job: Job<WebhookDeliveryAttempt>) => {
        await this.processDelivery(job);
      },
      {
        connection: redis,
        concurrency: 10, // Process up to 10 webhooks concurrently
        limiter: {
          max: 100, // Max 100 jobs per minute to prevent overwhelming endpoints
          duration: 60000,
        },
      }
    );

    this.worker.on('completed', (job) => {
      logger.debug('Webhook delivery job completed', {
        jobId: job.id,
        webhookId: job.data.webhookId,
        event: job.data.event,
        attempt: job.data.attempt,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Webhook delivery job failed', {
        jobId: job?.id,
        webhookId: job?.data.webhookId,
        event: job?.data.event,
        attempt: job?.data.attempt,
        error: error.message,
      });
    });

    logger.info('Webhook delivery worker started', {
      queue: QUEUE_NAME,
      concurrency: 10,
    });
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info('Webhook delivery worker stopped');
    }
  }

  private async processDelivery(job: Job<WebhookDeliveryAttempt>): Promise<void> {
    const { webhookId, event, attempt = 1 } = job.data;

    logger.info('Processing webhook delivery', {
      jobId: job.id,
      webhookId,
      event,
      attempt,
    });

    try {
      // Attempt delivery using the retry service
      await WebhookRetryService.attemptDelivery(job.data);
    } catch (error) {
      logger.error('Webhook delivery processing failed', {
        jobId: job.id,
        webhookId,
        event,
        attempt,
        error: error.message,
      });
      throw error; // Re-throw to mark job as failed
    }
  }
}