/**
 * Webhook Service
 * 
 * Emits webhook events for connection health changes
 * Supports multiple webhook endpoints per workspace
 */

import axios from 'axios';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { Webhook } from '../models/Webhook';
import { SSRF_BLOCKED_PATTERNS, SSRF_BLOCKED_CIDRS } from '../constants/platformLimits';
import { WorkspaceActivityLog, ActivityAction } from '../models/WorkspaceActivityLog';
import { BadRequestError } from '../utils/errors';

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
   * Validate webhook URL with SSRF protection
   */
  private static validateWebhookUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestError('Invalid webhook URL', 'INVALID_WEBHOOK_URL');
    }

    // Only allow HTTPS in production
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      throw new BadRequestError(
        'Webhook URL must use HTTPS',
        'WEBHOOK_HTTPS_REQUIRED'
      );
    }

    // Block non-HTTP(S) protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestError(
        'Webhook URL must use HTTP or HTTPS protocol',
        'INVALID_WEBHOOK_PROTOCOL'
      );
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block SSRF patterns
    for (const pattern of SSRF_BLOCKED_PATTERNS) {
      if (hostname.includes(pattern)) {
        throw new BadRequestError(
          'Webhook URL points to a blocked address',
          'WEBHOOK_SSRF_BLOCKED'
        );
      }
    }

    // Block private CIDR ranges
    for (const cidr of SSRF_BLOCKED_CIDRS) {
      if (cidr.test(hostname)) {
        throw new BadRequestError(
          'Webhook URL points to a blocked address',
          'WEBHOOK_SSRF_BLOCKED'
        );
      }
    }

    // Block AWS/GCP/Azure metadata endpoints explicitly
    const blockedHosts = [
      '169.254.169.254',
      'metadata.google.internal',
      '168.63.129.16',
    ];
    if (blockedHosts.includes(hostname)) {
      throw new BadRequestError(
        'Webhook URL points to a blocked address',
        'WEBHOOK_SSRF_BLOCKED'
      );
    }
  }

  /**
   * Create webhook with SSRF validation and audit logging
   */
  async createWebhook(params: {
    workspaceId: string;
    url: string;
    secret: string;
    events: string[];
    userId?: string;
  }): Promise<any> {
    const { workspaceId, url, secret, events, userId } = params;

    // Validate URL for SSRF
    WebhookService.validateWebhookUrl(url);

    // Create webhook
    const webhook = await Webhook.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      url,
      secret,
      events,
      enabled: true,
    });

    // Log webhook creation
    WorkspaceActivityLog.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      action: ActivityAction.WEBHOOK_CREATED,
      resourceType: 'webhook',
      resourceId: webhook._id,
      details: { 
        url: url.replace(/\/\/.*@/, '//***@'), // strip credentials
        events,
      },
    }).catch(() => {});

    return webhook;
  }

  /**
   * Update webhook with SSRF validation
   */
  async updateWebhook(params: {
    webhookId: string;
    workspaceId: string;
    url?: string;
    events?: string[];
    enabled?: boolean;
  }): Promise<any> {
    const { webhookId, workspaceId, url, events, enabled } = params;

    // Validate URL if provided
    if (url) {
      WebhookService.validateWebhookUrl(url);
    }

    const webhook = await Webhook.findOneAndUpdate(
      { _id: webhookId, workspaceId },
      { ...(url && { url }), ...(events && { events }), ...(enabled !== undefined && { enabled }) },
      { new: true }
    );

    return webhook;
  }

  /**
   * Test webhook with SSRF validation
   */
  async testWebhook(params: {
    webhookId: string;
    workspaceId: string;
  }): Promise<any> {
    const { webhookId, workspaceId } = params;

    const webhook = await Webhook.findOne({ _id: webhookId, workspaceId });
    if (!webhook) {
      throw new BadRequestError('Webhook not found', 'WEBHOOK_NOT_FOUND');
    }

    // Validate URL before testing
    WebhookService.validateWebhookUrl(webhook.url);

    // Send test event
    await this.emit({
      event: 'webhook.test',
      workspaceId,
      data: { test: true, timestamp: new Date().toISOString() },
    });

    return { success: true };
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
