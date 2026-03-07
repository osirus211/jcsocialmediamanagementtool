/**
 * Webhook Processing Queue (Stage 2)
 * 
 * Executes business logic for webhook events
 * 
 * NOTE: Worker implementation will be completed in Phase 3
 * This file creates the queue infrastructure only
 */

import { Queue, Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { WebhookProcessingJob } from '../types/webhook.types';
import { AuditLog } from '../models/AuditLog';

const SYSTEM_USER_ID = '000000000000000000000000';
const SYSTEM_WORKSPACE_ID = '000000000000000000000000';

export class WebhookProcessingQueue {
  private queue: Queue;
  private worker: Worker | null = null;

  constructor() {
    const redis = getRedisClient();

    this.queue = new Queue('webhook-processing-queue', {
      connection: redis,
      defaultJobOptions: {
        attempts: 5, // More retries for business logic
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 25s, 125s, 625s, 3125s
        },
        removeOnComplete: {
          age: 86400, // 24 hours
          count: 10000,
        },
        removeOnFail: {
          age: 604800, // 7 days
          count: 10000,
        },
      },
    });

    logger.info('Webhook processing queue created');
  }

  /**
   * Add job to processing queue
   */
  async add(
    jobName: string,
    data: WebhookProcessingJob,
    options?: any
  ): Promise<Job<WebhookProcessingJob>> {
    const job = await this.queue.add(jobName, data, options);
    
    logger.debug('Job added to processing queue', {
      jobId: job.id,
      eventId: data.eventId,
      provider: data.provider,
    });

    return job;
  }

  /**
   * Start worker to process webhook events
   * 
   * NOTE: This is a placeholder implementation
   * Full business logic will be implemented in Phase 3
   */
  startWorker(): void {
    if (this.worker) {
      logger.warn('Processing worker already started');
      return;
    }

    const redis = getRedisClient();

    this.worker = new Worker(
      'webhook-processing-queue',
      async (job: Job<WebhookProcessingJob>) => {
        return this.processWebhookEvent(job);
      },
      {
        connection: redis,
        concurrency: 10, // Lower concurrency for complex processing
        limiter: {
          max: 100, // Max 100 jobs per minute
          duration: 60000,
        },
        lockDuration: 60000, // 60 second lock (complex processing)
        lockRenewTime: 30000,
      }
    );

    // Worker event handlers
    this.worker.on('completed', (job) => {
      logger.info('Processing job completed', {
        jobId: job.id,
        eventId: job.data.eventId,
        provider: job.data.provider,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Processing job failed', {
        jobId: job?.id,
        eventId: job?.data.eventId,
        provider: job?.data.provider,
        error: error.message,
        stack: error.stack,
      });
    });

    this.worker.on('error', (error) => {
      logger.error('Processing worker error', {
        error: error.message,
        stack: error.stack,
      });
    });

    logger.info('Webhook processing worker started', { concurrency: 10 });
  }

  /**
   * Process webhook event
   * 
   * PLACEHOLDER: Full implementation in Phase 3
   * Currently just logs the event
   */
  private async processWebhookEvent(job: Job<WebhookProcessingJob>): Promise<void> {
    const { eventId, provider, normalizedEvent } = job.data;

    logger.info('Processing webhook event (Phase 2 - placeholder)', {
      eventId,
      provider,
      eventType: normalizedEvent.eventType,
    });

    try {
      // PHASE 3 TODO: Implement event handlers
      // - TokenRevokedHandler
      // - PermissionChangedHandler
      // - AccountDisconnectedHandler
      // - MediaPublishedHandler
      // etc.

      // For now, just log success
      await AuditLog.log({
        userId: SYSTEM_USER_ID,
        workspaceId: normalizedEvent.workspaceId || SYSTEM_WORKSPACE_ID,
        action: 'webhook.processed',
        entityType: 'webhook_event',
        entityId: eventId,
        metadata: {
          provider,
          eventType: normalizedEvent.eventType,
          status: 'success',
          note: 'Phase 2 placeholder - full implementation in Phase 3',
        },
      });

      logger.info('Webhook event processed successfully (placeholder)', {
        eventId,
        provider,
        eventType: normalizedEvent.eventType,
      });
    } catch (error: any) {
      logger.error('Webhook event processing failed', {
        eventId,
        provider,
        eventType: normalizedEvent.eventType,
        error: error.message,
        stack: error.stack,
      });

      // Audit log failure
      await AuditLog.log({
        userId: SYSTEM_USER_ID,
        workspaceId: normalizedEvent.workspaceId || SYSTEM_WORKSPACE_ID,
        action: 'webhook.failed',
        entityType: 'webhook_event',
        entityId: eventId,
        metadata: {
          provider,
          eventType: normalizedEvent.eventType,
          status: 'failed',
          error: error.message,
        },
      });

      throw error; // Re-throw for BullMQ retry
    }
  }

  /**
   * Get queue instance
   */
  getQueue(): Queue {
    return this.queue;
  }

  /**
   * Close queue and worker
   */
  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      logger.info('Processing worker closed');
    }
    await this.queue.close();
    logger.info('Processing queue closed');
  }
}
