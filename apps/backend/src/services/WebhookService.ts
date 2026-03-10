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
   * Send webhook to endpoint
   */
  private async sendWebhook(webhook: any, event: WebhookEvent): Promise<void> {
    try {
      const payload = {
        event: event.event,
        timestamp: new Date().toISOString(),
        data: event.data,
      };

      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': this.generateSignature(webhook.secret, payload),
        },
        timeout: 10000, // 10 seconds
      });

      logger.info('Webhook sent successfully', {
        webhookId: webhook._id.toString(),
        url: webhook.url,
        event: event.event,
        status: response.status,
      });

      // Update webhook stats
      webhook.lastTriggeredAt = new Date();
      webhook.successCount = (webhook.successCount || 0) + 1;
      await webhook.save();
    } catch (error: any) {
      logger.error('Failed to send webhook', {
        webhookId: webhook._id.toString(),
        url: webhook.url,
        event: event.event,
        error: error.message,
      });

      // Update webhook stats
      webhook.failureCount = (webhook.failureCount || 0) + 1;
      await webhook.save();
    }
  }

  /**
   * Send webhook for system event
   */
  async sendWebhook(params: {
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
}

export const webhookService = new WebhookService();
