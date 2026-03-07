/**
 * Webhook Ingest Queue (Stage 1)
 * 
 * Fast ingestion and storage of webhook events
 */

import { Queue, Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { WebhookIngestJob } from '../types/webhook.types';
import { AuditLog } from '../models/AuditLog';

const SYSTEM_USER_ID = '000000000000000000000000';
const SYSTEM_WORKSPACE_ID = '000000000000000000000000';

export class WebhookIngestQueue {
  private queue: Queue;
  private worker: Worker | null = null;

  constructor() {
    const redis = getRedisClient();

    this.queue = new Queue('webhook-ingest-queue', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // 1s, 5s, 25s
        },
        removeOnComplete: {
          age: 3600, // 1 hour
          count: 1000,
        },
        removeOnFail: {
          age: 86400, // 24 hours
          count: 5000,
        },
      },
    });

    logger.info('Webhook ingest queue created');
  }

  /**
   * Add job to ingest queue
   */
  async add(
    jobName: string,
    data: WebhookIngestJob,
    options?: any
  ): Promise<Job<WebhookIngestJob>> {
    const job = await this.queue.add(jobName, data, options);
    
    logger.debug('Job added to ingest queue', {
      jobId: job.id,
      eventId: data.eventId,
      provider: data.provider,
    });

    return job;
  }

  /**
   * Start worker to process ingest jobs
   */
  startWorker(processingQueue: any): void {
    if (this.worker) {
      logger.warn('Ingest worker already started');
      return;
    }

    const redis = getRedisClient();

    this.worker = new Worker(
      'webhook-ingest-queue',
      async (job: Job<WebhookIngestJob>) => {
        return this.processIngestJob(job, processingQueue);
      },
      {
        connection: redis,
        concurrency: 20, // High concurrency for fast ingestion
        limiter: {
          max: 1000, // Max 1000 jobs per minute
          duration: 60000,
        },
        lockDuration: 10000, // 10 second lock (fast processing)
        lockRenewTime: 5000,
      }
    );

    // Worker event handlers
    this.worker.on('completed', (job) => {
      logger.info('Ingest job completed', {
        jobId: job.id,
        eventId: job.data.eventId,
        provider: job.data.provider,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Ingest job failed', {
        jobId: job?.id,
        eventId: job?.data.eventId,
        provider: job?.data.provider,
        error: error.message,
        stack: error.stack,
      });
    });

    this.worker.on('error', (error) => {
      logger.error('Ingest worker error', {
        error: error.message,
        stack: error.stack,
      });
    });

    logger.info('Webhook ingest worker started', { concurrency: 20 });
  }

  /**
   * Process ingest job
   */
  private async processIngestJob(
    job: Job<WebhookIngestJob>,
    processingQueue: any
  ): Promise<void> {
    const { eventId, provider, normalizedEvent } = job.data;

    logger.info('Processing webhook ingest', {
      eventId,
      provider,
      eventType: normalizedEvent.eventType,
    });

    // 1. Store in audit log
    await AuditLog.log({
      userId: SYSTEM_USER_ID,
      workspaceId: normalizedEvent.workspaceId || SYSTEM_WORKSPACE_ID,
      action: 'webhook.ingested',
      entityType: 'webhook_event',
      entityId: eventId,
      metadata: {
        provider,
        eventType: normalizedEvent.eventType,
        payload: normalizedEvent.data.raw,
        correlationId: normalizedEvent.metadata.correlationId,
      },
    });

    // 2. Enqueue to Stage 2 (processing queue)
    await processingQueue.add('process-webhook-event', {
      eventId,
      provider,
      normalizedEvent,
    }, {
      jobId: `webhook-process:${provider}:${eventId}`,
      priority: this.getPriority(normalizedEvent.eventType),
    });

    logger.info('Webhook ingested and queued for processing', {
      eventId,
      provider,
      eventType: normalizedEvent.eventType,
    });
  }

  /**
   * Get priority based on event type
   */
  private getPriority(eventType: string): number {
    const priorityMap: Record<string, number> = {
      'token_revoked': 1,
      'token_expired': 1,
      'account_disconnected': 2,
      'account_deleted': 2,
      'account_suspended': 2,
      'permission_changed': 3,
      'profile_updated': 4,
      'media_published': 5,
      'media_deleted': 5,
      'comment_received': 6,
      'message_received': 6,
      'unknown': 10,
    };

    return priorityMap[eventType] || 10;
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
      logger.info('Ingest worker closed');
    }
    await this.queue.close();
    logger.info('Ingest queue closed');
  }
}
