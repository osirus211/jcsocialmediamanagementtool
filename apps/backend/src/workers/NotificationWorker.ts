/**
 * Notification Worker
 * 
 * Processes notification jobs from the queue
 */

import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { NotificationJob } from '../queue/NotificationQueue';
import { notificationService } from '../services/NotificationService';
import { emailNotificationService } from '../services/EmailNotificationService';
import { webhookService } from '../services/WebhookService';
import { SystemEvent } from '../services/EventService';
import { logger } from '../utils/logger';
import {
  recordNotificationSent,
  recordNotificationFailed,
  recordNotificationLatency,
} from '../config/notificationMetrics';

export class NotificationWorker {
  private worker: Worker<NotificationJob>;

  constructor() {
    this.worker = new Worker<NotificationJob>(
      'notification-queue',
      async (job: Job<NotificationJob>) => {
        return this.processNotification(job);
      },
      {
        connection: getRedisClient(),
        concurrency: 10,
      }
    );

    this.worker.on('completed', (job) => {
      logger.info(`Notification processed: ${job.id}`, {
        eventType: job.data.eventType,
        workspaceId: job.data.workspaceId,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error(`Notification failed: ${job?.id}`, {
        eventType: job?.data.eventType,
        error: error.message,
      });
    });
  }

  /**
   * Process notification job
   */
  private async processNotification(job: Job<NotificationJob>): Promise<void> {
    const startTime = Date.now();
    const { eventType, workspaceId, userId, payload } = job.data;

    try {
      logger.debug(`Processing notification: ${eventType}`, {
        workspaceId,
        userId,
      });

      // Create in-app notification
      await notificationService.createNotification({
        eventType,
        workspaceId,
        userId,
        payload,
      });

      // Send email notification for critical events
      if (this.shouldSendEmail(eventType)) {
        await emailNotificationService.sendNotification({
          eventType,
          workspaceId,
          userId,
          payload,
        });
      }

      // Send webhook notification
      await webhookService.sendWebhookEvent({
        workspaceId,
        event: eventType,
        payload,
      });

      // Record metrics
      const latency = (Date.now() - startTime) / 1000;
      recordNotificationSent(eventType);
      recordNotificationLatency(eventType, latency);
    } catch (error: unknown) {
      recordNotificationFailed(eventType);
      logger.error('Failed to process notification:', error);
      throw error;
    }
  }

  /**
   * Determine if email should be sent for event type
   */
  private shouldSendEmail(eventType: SystemEvent): boolean {
    const emailEvents = [
      SystemEvent.POST_FAILED,
      SystemEvent.APPROVAL_REQUIRED,
      SystemEvent.CONNECTION_EXPIRED,
      SystemEvent.SUBSCRIPTION_FAILED,
      SystemEvent.PAYMENT_FAILED,
      SystemEvent.TRIAL_ENDING,
      SystemEvent.LIMIT_REACHED,
    ];

    return emailEvents.includes(eventType);
  }

  /**
   * Close worker
   */
  async close(): Promise<void> {
    await this.worker.close();
  }
}

export const notificationWorker = new NotificationWorker();
