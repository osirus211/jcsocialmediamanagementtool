/**
 * Unified Webhook Controller
 * 
 * Handles webhook events from all social media platforms
 * using a provider-driven architecture
 */

import { Request, Response } from 'express';
import { WebhookProviderRegistry } from '../providers/webhooks/WebhookProviderRegistry';
import { WebhookDeduplicationService } from '../services/WebhookDeduplicationService';
import { WebhookVerificationCache } from '../services/WebhookVerificationCache';
import { WebhookOrderingService } from '../services/WebhookOrderingService';
import { WebhookRateLimiter } from '../services/WebhookRateLimiter';
import { WebhookReplayProtectionService } from '../services/WebhookReplayProtectionService';
import { WebhookIngestQueue } from '../queue/WebhookIngestQueue';
import { AuditLog } from '../models/AuditLog';
import { logger } from '../utils/logger';
import { withTimeout, TimeoutError } from '../utils/timeoutGuard';
import { 
  WebhookSignatureError, 
  WebhookProviderNotFoundError 
} from '../types/webhook.types';
import crypto from 'crypto';

const SYSTEM_USER_ID = '000000000000000000000000';
const SYSTEM_WORKSPACE_ID = '000000000000000000000000';
const QUEUE_BACKPRESSURE_THRESHOLD = 10000;
const PROVIDER_TIMEOUT_MS = 1000;

export class WebhookController {
  constructor(
    private providerRegistry: WebhookProviderRegistry,
    private deduplicationService: WebhookDeduplicationService,
    private verificationCache: WebhookVerificationCache,
    private orderingService: WebhookOrderingService,
    private rateLimiter: WebhookRateLimiter,
    private replayProtection: WebhookReplayProtectionService,
    private ingestQueue: WebhookIngestQueue
  ) {}

  /**
   * Handle webhook from any provider
   * 
   * POST /api/v1/webhooks/:provider
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const providerName = req.params.provider;
    const correlationId = this.generateCorrelationId();

    try {
      // STEP 0A: Rate limiting check
      const isAllowed = await this.rateLimiter.isAllowed(providerName);
      if (!isAllowed) {
        logger.warn('Webhook rate limit exceeded', {
          provider: providerName,
          correlationId,
        });
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Limit: 100 requests per second per provider.',
          provider: providerName,
        });
        return;
      }

      // STEP 0B: Queue backpressure check
      const queueSize = await this.ingestQueue.getQueue().getWaitingCount();
      if (queueSize >= QUEUE_BACKPRESSURE_THRESHOLD) {
        logger.error('Queue backpressure threshold exceeded', {
          provider: providerName,
          queueSize,
          threshold: QUEUE_BACKPRESSURE_THRESHOLD,
          correlationId,
          alert: 'QUEUE_BACKPRESSURE',
        });
        res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'System is under heavy load. Please retry later.',
          provider: providerName,
        });
        return;
      }

      // STEP 1: Resolve provider
      const provider = this.providerRegistry.getProvider(providerName);

      // Handle platform-specific challenges (e.g., Twitter CRC)
      if (provider.handleChallenge) {
        const handled = await provider.handleChallenge(req, res);
        if (handled) {
          logger.info('Challenge handled', { provider: providerName });
          return;
        }
      }

      // STEP 2: Verify signature (with cache and timeout)
      if (!req.rawBody) {
        throw new Error('Raw body not available - ensure rawBodyParser middleware is used');
      }

      const isValid = await withTimeout(
        'signature-verification',
        () => provider.verifySignature(req.headers, req.rawBody!, this.verificationCache),
        PROVIDER_TIMEOUT_MS
      );

      if (!isValid) {
        throw new WebhookSignatureError('Invalid signature');
      }

      // STEP 2.5: Replay protection check
      const signature = req.headers['x-hub-signature-256'] || 
                       req.headers['x-twitter-webhooks-signature'] || 
                       req.headers['authorization'] || 
                       '';
      
      // Extract timestamp from provider headers or use current time
      const timestamp = this.replayProtection.extractTimestamp(providerName, req.headers) || new Date();
      
      const isReplay = await this.replayProtection.isReplay(
        providerName,
        signature.toString(),
        timestamp
      );

      if (isReplay) {
        logger.warn('Webhook replay attack detected', {
          provider: providerName,
          correlationId,
          alert: 'WEBHOOK_REPLAY_DETECTED',
        });

        await AuditLog.log({
          userId: SYSTEM_USER_ID,
          workspaceId: SYSTEM_WORKSPACE_ID,
          action: 'webhook.replay_detected',
          entityType: 'webhook_event',
          entityId: correlationId,
          metadata: { provider: providerName, correlationId },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });

        res.status(409).json({
          error: 'Replay attack detected',
          message: 'This webhook event has already been processed or is too old.',
          provider: providerName,
        });
        return;
      }

      // STEP 3: Extract event
      const rawEvent = await provider.extractEvent(req.body);

      // STEP 4: Normalize event
      const normalizedEvent = await provider.normalizeEvent(rawEvent);
      normalizedEvent.metadata.correlationId = correlationId;
      normalizedEvent.metadata.ipAddress = req.ip;
      normalizedEvent.metadata.userAgent = req.headers['user-agent'];

      // STEP 5: Check idempotency
      const isDuplicate = await this.deduplicationService.isDuplicate(
        providerName,
        normalizedEvent.eventId
      );

      if (isDuplicate) {
        logger.info('Duplicate webhook event', {
          provider: providerName,
          eventId: normalizedEvent.eventId,
          correlationId,
        });

        await AuditLog.log({
          userId: SYSTEM_USER_ID,
          workspaceId: normalizedEvent.workspaceId || SYSTEM_WORKSPACE_ID,
          action: 'webhook.duplicate',
          entityType: 'webhook_event',
          entityId: normalizedEvent.eventId,
          metadata: { provider: providerName, correlationId },
        });

        res.status(202).json({
          received: true,
          duplicate: true,
          eventId: normalizedEvent.eventId,
        });
        return;
      }

      // STEP 6: Check event ordering
      const resourceId = provider.extractResourceId?.(rawEvent);
      
      if (resourceId) {
        const isInOrder = await this.orderingService.isInOrder(
          providerName,
          resourceId,
          normalizedEvent.timestamp
        );

        if (!isInOrder) {
          logger.warn('Out-of-order webhook event', {
            provider: providerName,
            eventId: normalizedEvent.eventId,
            resourceId,
            timestamp: normalizedEvent.timestamp,
            correlationId,
          });

          await AuditLog.log({
            userId: SYSTEM_USER_ID,
            workspaceId: normalizedEvent.workspaceId || SYSTEM_WORKSPACE_ID,
            action: 'webhook.out_of_order',
            entityType: 'webhook_event',
            entityId: normalizedEvent.eventId,
            metadata: {
              provider: providerName,
              resourceId,
              timestamp: normalizedEvent.timestamp,
              correlationId,
            },
          });

          res.status(202).json({
            received: true,
            outOfOrder: true,
            eventId: normalizedEvent.eventId,
          });
          return;
        }
      }

      // STEP 7: Mark as processed (idempotency)
      await this.deduplicationService.markProcessed(
        providerName,
        normalizedEvent.eventId,
        { correlationId }
      );

      // STEP 8: Enqueue to Stage 1
      await this.ingestQueue.add('webhook-ingest', {
        eventId: normalizedEvent.eventId,
        provider: providerName,
        rawEvent,
        normalizedEvent,
        metadata: {
          receivedAt: new Date(),
          correlationId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      }, {
        jobId: `webhook-ingest:${providerName}:${normalizedEvent.eventId}`,
      });

      // STEP 9: Update ordering timestamp
      if (resourceId) {
        await this.orderingService.updateTimestamp(
          providerName,
          resourceId,
          normalizedEvent.timestamp
        );
      }

      // STEP 10: Audit log
      await AuditLog.log({
        userId: SYSTEM_USER_ID,
        workspaceId: normalizedEvent.workspaceId || SYSTEM_WORKSPACE_ID,
        action: 'webhook.received',
        entityType: 'webhook_event',
        entityId: normalizedEvent.eventId,
        metadata: {
          provider: providerName,
          eventType: normalizedEvent.eventType,
          correlationId,
        },
      });

      // STEP 11: Return 200 OK
      res.status(200).json({
        received: true,
        eventId: normalizedEvent.eventId,
      });

    } catch (error: any) {
      logger.error('Webhook processing error', {
        provider: providerName,
        error: error.message,
        stack: error.stack,
        correlationId,
      });

      // Handle specific errors
      if (error instanceof WebhookProviderNotFoundError) {
        res.status(404).json({
          error: 'Provider not found',
          provider: providerName,
          availableProviders: this.providerRegistry.listProviders(),
        });
        return;
      }

      if (error instanceof WebhookSignatureError) {
        res.status(401).json({
          error: 'Invalid signature',
          provider: providerName,
        });
        return;
      }

      if (error instanceof TimeoutError) {
        res.status(408).json({
          error: 'Request timeout',
          message: 'Provider verification timed out',
          provider: providerName,
        });
        return;
      }

      // Generic error
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  /**
   * Generate correlation ID for tracking
   */
  private generateCorrelationId(): string {
    return `webhook_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
}
