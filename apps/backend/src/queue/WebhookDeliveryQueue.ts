/**
 * Webhook Delivery Queue
 * 
 * BullMQ queue for webhook delivery with retry logic
 * Handles immediate delivery and scheduled retries
 */

import { Queue, QueueEvents } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { WebhookDeliveryAttempt } from '../services/WebhookRetryService';

const QUEUE_NAME = 'webhook_delivery_queue';

export class WebhookDeliveryQueue {
  private static instance: WebhookDeliveryQueue;
  private queue: Queue<WebhookDeliveryAttempt>;
  private queueEvents: QueueEvents;

  private constructor() {
    const redis = getRedisClient();

    this.queue = new Queue<WebhookDeliveryAttempt>(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 1, // We handle retries manually with exponential backoff
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          count: 5000,
        },
      },
    });

    this.queueEvents = new QueueEvents(QUEUE_NAME, {
      connection: redis,
    });

    this.setupEventListeners();
  }

  static getInstance(): WebhookDeliveryQueue {
    if (!WebhookDeliveryQueue.instance) {
      WebhookDeliveryQueue.instance = new WebhookDeliveryQueue();
    }
    return WebhookDeliveryQueue.instance;
  }

  private setupEventListeners(): void {
    this.queueEvents.on('completed', ({ jobId }) => {
      logger.debug('Webhook delivery job completed', {
        queue: QUEUE_NAME,
        jobId,
      });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Webhook delivery job failed', {
        queue: QUEUE_NAME,
        jobId,
        failedReason,
      });
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      logger.warn('Webhook delivery job stalled', {
        queue: QUEUE_NAME,
        jobId,
      });
    });
  }

  /**
   * Add immediate webhook delivery job
   */
  async addDelivery(data: WebhookDeliveryAttempt): Promise<void> {
    const jobId = `webhook:${data.webhookId}:${data.event}:${Date.now()}`;

    await this.queue.add('deliver-webhook', data, {
      jobId,
      priority: data.attempt === 1 ? 10 : 5, // Higher priority for first attempts
    });

    logger.info('Webhook delivery job added', {
      queue: QUEUE_NAME,
      webhookId: data.webhookId,
      event: data.event,
      attempt: data.attempt || 1,
      url: data.url,
    });
  }

  /**
   * Schedule a retry delivery job
   */
  async scheduleRetry(data: WebhookDeliveryAttempt, delayMs: number): Promise<void> {
    const jobId = `webhook:${data.webhookId}:${data.event}:retry:${data.attempt}:${Date.now()}`;

    await this.queue.add('deliver-webhook', data, {
      jobId,
      delay: delayMs,
      priority: 5, // Lower priority for retries
    });

    logger.info('Webhook retry job scheduled', {
      queue: QUEUE_NAME,
      webhookId: data.webhookId,
      event: data.event,
      attempt: data.attempt,
      delayMs,
      delayMinutes: Math.round(delayMs / 60000),
    });
  }

  /**
   * Process pending retries (called by scheduler)
   */
  async processPendingRetries(): Promise<void> {
    try {
      const { WebhookRetryService } = await import('../services/WebhookRetryService');
      const pendingRetries = await WebhookRetryService.getPendingRetries(50);

      for (const delivery of pendingRetries) {
        // Get webhook details for retry
        const { Webhook } = await import('../models/Webhook');
        const webhook = await Webhook.findById(delivery.webhookId);

        if (!webhook || !webhook.enabled) {
          logger.warn('Skipping retry for disabled/deleted webhook', {
            webhookId: delivery.webhookId,
            deliveryId: delivery._id,
          });
          continue;
        }

        // Add retry job
        await this.addDelivery({
          webhookId: delivery.webhookId.toString(),
          workspaceId: delivery.workspaceId.toString(),
          event: delivery.event,
          payload: delivery.payload,
          url: delivery.url,
          secret: webhook.secret,
          attempt: delivery.attempt + 1,
          maxAttempts: delivery.maxAttempts,
        });

        logger.debug('Pending retry processed', {
          webhookId: delivery.webhookId,
          event: delivery.event,
          attempt: delivery.attempt + 1,
        });
      }

      if (pendingRetries.length > 0) {
        logger.info('Processed pending webhook retries', {
          count: pendingRetries.length,
        });
      }
    } catch (error) {
      logger.error('Failed to process pending webhook retries', {
        error: error.message,
      });
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Get the underlying queue instance
   */
  getQueue(): Queue<WebhookDeliveryAttempt> {
    return this.queue;
  }

  /**
   * Close the queue and events
   */
  async close(): Promise<void> {
    await this.queue.close();
    await this.queueEvents.close();
    logger.info('Webhook delivery queue closed');
  }
}