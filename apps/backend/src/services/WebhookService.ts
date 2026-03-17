/**
 * Webhook Service
 * 
 * Emits webhook events for connection health changes
 * Supports multiple webhook endpoints per workspace
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { Webhook } from '../models/Webhook';

export enum WebhookEventType {
  POST_PUBLISHED = 'post.published',
  POST_FAILED = 'post.failed',
  ANALYTICS_UPDATED = 'analytics.updated',
  FOLLOWER_MILESTONE = 'follower.milestone',
  ENGAGEMENT_SPIKE = 'engagement.spike',
  REPORT_GENERATED = 'report.generated',
  COMPETITOR_UPDATED = 'competitor.updated',
}

export interface WebhookEvent {
  event: string;
  workspaceId: string;
  data: any;
}

export class WebhookService {
  /**
   * Emit webhook event to all registered endpoints
   */
  async emit(event: WebhookEvent): Promise<void> {
    try {
      // Get all webhooks for workspace
      const webhooks = await Webhook.find({
        workspaceId: event.workspaceId,
        enabled: true,
        events: event.event,
      });

      if (webhooks.length === 0) {
        logger.debug('No webhooks registered for event', {
          event: event.event,
          workspaceId: event.workspaceId,
        });
        return;
      }

      // Send to all webhooks
      const promises = webhooks.map((webhook) =>
        this.sendWebhook(webhook, event)
      );

      await Promise.allSettled(promises);

      logger.info('Webhook event emitted', {
        event: event.event,
        workspaceId: event.workspaceId,
        webhookCount: webhooks.length,
      });
    } catch (error: any) {
      logger.error('Failed to emit webhook event', {
        event: event.event,
        error: error.message,
      });
    }
  }

  /**
   * Send webhook to endpoint using retry service
   */
  private async sendWebhook(webhook: any, event: WebhookEvent): Promise<void> {
    try {
      // Use the new retry service instead of direct HTTP calls
      const { WebhookDeliveryQueue } = await import('../queue/WebhookDeliveryQueue');
      const queue = WebhookDeliveryQueue.getInstance();

      await queue.addDelivery({
        webhookId: webhook._id.toString(),
        workspaceId: event.workspaceId,
        event: event.event,
        payload: event.data,
        url: webhook.url,
        secret: webhook.secret,
        attempt: 1,
        maxAttempts: 5,
      });

      logger.info('Webhook delivery queued', {
        webhookId: webhook._id.toString(),
        url: webhook.url,
        event: event.event,
      });
    } catch (error: any) {
      logger.error('Failed to queue webhook delivery', {
        webhookId: webhook._id.toString(),
        url: webhook.url,
        event: event.event,
        error: error.message,
      });
    }
  }

  /**
   * Send webhook for system event
   */
  async sendWebhookEvent(params: {
    workspaceId: string;
    event: string;
    payload: Record<string, any>;
  }): Promise<void> {
    await this.emit({
      event: params.event,
      workspaceId: params.workspaceId,
      data: params.payload,
    });
  }

  /**
   * Generate HMAC signature for webhook
   */
  private generateSignature(secret: string, payload: any): string {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempt: number): number {
    // Exponential backoff: 2^attempt * 1000ms
    return Math.pow(2, attempt) * 1000;
  }

  /**
   * Process failed delivery with retry logic
   */
  async processFailedDelivery(deliveryId: string): Promise<void> {
    // Implementation for processing failed deliveries
    logger.info('Processing failed delivery', { deliveryId });
  }

  /**
   * Deliver webhook to endpoint
   */
  async deliverWebhook(delivery: any): Promise<void> {
    // Implementation for delivering webhook
    logger.info('Delivering webhook', { deliveryId: delivery.id });
  }

  /**
   * Attempt delivery with retry logic
   */
  async attemptDelivery(delivery: any): Promise<void> {
    // Implementation for attempting delivery
    logger.info('Attempting delivery', { deliveryId: delivery.id });
  }

  /**
   * Generate HMAC signature for webhook (public method)
   */
  generateHmacSignature(secret: string, payload: any): string {
    return this.generateSignature(secret, payload);
  }

  /**
   * Validate webhook URL
   */
  validateWebhookUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Build webhook headers
   */
  buildWebhookHeaders(secret: string, payload: any): Record<string, string> {
    const signature = this.generateSignature(secret, payload);
    return {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': `sha256=${signature}`,
      'User-Agent': 'SocialMediaManager-Webhooks/1.0',
    };
  }
}

export const webhookService = new WebhookService();
