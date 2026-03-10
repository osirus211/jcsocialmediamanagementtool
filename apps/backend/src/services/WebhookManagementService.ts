/**
 * Webhook Management Service
 * 
 * Manages outbound webhook endpoints for workspaces
 */

import crypto from 'crypto';
import axios from 'axios';
import { Webhook, IWebhook } from '../models/Webhook';
import { logger } from '../utils/logger';

export class WebhookManagementService {
  /**
   * Create a new webhook endpoint
   */
  static async createEndpoint(
    workspaceId: string,
    url: string,
    events: string[],
    description?: string
  ): Promise<IWebhook> {
    // Validate URL format
    if (!url.startsWith('https://')) {
      throw new Error('Webhook URL must use HTTPS');
    }

    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Auto-generate secret
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = new Webhook({
      workspaceId,
      url,
      secret,
      events,
      description,
      enabled: true,
      successCount: 0,
      failureCount: 0,
    });

    await webhook.save();

    logger.info('Webhook endpoint created', {
      webhookId: webhook._id.toString(),
      workspaceId,
      url,
      events,
    });

    return webhook;
  }

  /**
   * List all webhook endpoints for workspace
   */
  static async listEndpoints(workspaceId: string): Promise<IWebhook[]> {
    return await Webhook.find({ workspaceId }).sort({ createdAt: -1 });
  }

  /**
   * Update webhook endpoint
   */
  static async updateEndpoint(
    id: string,
    workspaceId: string,
    updates: Partial<{
      url: string;
      events: string[];
      description: string;
      enabled: boolean;
    }>
  ): Promise<IWebhook> {
    // Validate URL if provided
    if (updates.url) {
      if (!updates.url.startsWith('https://')) {
        throw new Error('Webhook URL must use HTTPS');
      }

      try {
        new URL(updates.url);
      } catch {
        throw new Error('Invalid URL format');
      }
    }

    const webhook = await Webhook.findOne({ _id: id, workspaceId });
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    Object.assign(webhook, updates);
    await webhook.save();

    logger.info('Webhook endpoint updated', {
      webhookId: id,
      workspaceId,
      updates,
    });

    return webhook;
  }

  /**
   * Delete webhook endpoint
   */
  static async deleteEndpoint(id: string, workspaceId: string): Promise<void> {
    const result = await Webhook.deleteOne({ _id: id, workspaceId });
    
    if (result.deletedCount === 0) {
      throw new Error('Webhook not found');
    }

    logger.info('Webhook endpoint deleted', {
      webhookId: id,
      workspaceId,
    });
  }

  /**
   * Rotate webhook secret
   */
  static async rotateSecret(id: string, workspaceId: string): Promise<{ secret: string }> {
    const webhook = await Webhook.findOne({ _id: id, workspaceId });
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const newSecret = crypto.randomBytes(32).toString('hex');
    webhook.secret = newSecret;
    await webhook.save();

    logger.info('Webhook secret rotated', {
      webhookId: id,
      workspaceId,
    });

    return { secret: newSecret };
  }

  /**
   * Test webhook endpoint
   */
  static async testEndpoint(
    id: string,
    workspaceId: string
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const webhook = await Webhook.findOne({ _id: id, workspaceId });
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const payload = {
      event: 'ping',
      timestamp: new Date().toISOString(),
      workspaceId,
    };

    try {
      // Generate signature
      const hmac = crypto.createHmac('sha256', webhook.secret);
      hmac.update(JSON.stringify(payload));
      const signature = hmac.digest('hex');

      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        timeout: 10000, // 10 seconds
      });

      logger.info('Webhook test successful', {
        webhookId: id,
        workspaceId,
        statusCode: response.status,
      });

      return {
        success: true,
        statusCode: response.status,
      };
    } catch (error: any) {
      logger.error('Webhook test failed', {
        webhookId: id,
        workspaceId,
        error: error.message,
      });

      return {
        success: false,
        statusCode: error.response?.status,
        error: error.message,
      };
    }
  }
}