/**
 * Webhook Retry Service
 * 
 * Handles webhook delivery retry logic with exponential backoff
 * Retry schedule: 1min, 5min, 30min, 2hr, 8hr (5 attempts total)
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { WebhookDelivery, IWebhookDelivery } from '../models/WebhookDelivery';
import { Webhook } from '../models/Webhook';

export interface WebhookDeliveryAttempt {
  webhookId: string;
  workspaceId: string;
  event: string;
  payload: Record<string, any>;
  url: string;
  secret: string;
  attempt?: number;
  maxAttempts?: number;
}

export class WebhookRetryService {
  // Retry delays in milliseconds: 1min, 5min, 30min, 2hr, 8hr
  private static readonly RETRY_DELAYS = [
    1 * 60 * 1000,      // 1 minute
    5 * 60 * 1000,      // 5 minutes
    30 * 60 * 1000,     // 30 minutes
    2 * 60 * 60 * 1000, // 2 hours
    8 * 60 * 60 * 1000, // 8 hours
  ];

  private static readonly MAX_ATTEMPTS = 5;
  private static readonly TIMEOUT_MS = 10000; // 10 seconds

  /**
   * Attempt webhook delivery with retry logic
   */
  static async attemptDelivery(params: WebhookDeliveryAttempt): Promise<IWebhookDelivery> {
    const {
      webhookId,
      workspaceId,
      event,
      payload,
      url,
      secret,
      attempt = 1,
      maxAttempts = this.MAX_ATTEMPTS,
    } = params;

    // Create or update delivery record
    let delivery = await WebhookDelivery.findOne({
      webhookId,
      event,
      payload: payload, // This might need adjustment for exact matching
      attempt,
    });

    if (!delivery) {
      delivery = new WebhookDelivery({
        webhookId,
        workspaceId,
        event,
        payload,
        url,
        attempt,
        maxAttempts,
        status: 'pending',
      });
    }

    try {
      // Prepare webhook payload with timestamp
      const webhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      };

      // Generate HMAC signature
      const signature = this.generateSignature(secret, webhookPayload);

      // Generate delivery metadata
      const crypto = require('crypto');
      const deliveryTimestamp = Date.now().toString();
      const deliveryId = crypto.randomUUID();

      // Attempt delivery
      const response = await axios.post(url, webhookPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': deliveryTimestamp,
          'X-Webhook-Delivery-Id': deliveryId,
          'User-Agent': 'SocialMediaManager-Webhook/1.0',
        },
        timeout: this.TIMEOUT_MS,
        validateStatus: (status) => status >= 200 && status < 300, // Only 2xx is success
      });

      // Success - update delivery record
      delivery.status = 'success';
      delivery.statusCode = response.status;
      delivery.responseBody = JSON.stringify(response.data).substring(0, 1000); // Limit size
      delivery.deliveredAt = new Date();
      delivery.deliveryTimestamp = parseInt(deliveryTimestamp, 10);
      delivery.nextRetryAt = undefined;

      await delivery.save();

      // Update webhook success stats
      await this.updateWebhookStats(webhookId, true);

      logger.info('Webhook delivered successfully', {
        webhookId,
        event,
        attempt,
        statusCode: response.status,
        url,
      });

      return delivery;
    } catch (error: any) {
      // Failure - determine if we should retry
      const statusCode = error.response?.status;
      const errorMessage = error.message;
      const responseBody = error.response?.data ? JSON.stringify(error.response.data).substring(0, 1000) : undefined;

      // Update delivery record with failure info
      delivery.statusCode = statusCode;
      delivery.errorMessage = errorMessage;
      delivery.responseBody = responseBody;

      // Determine if this is a retryable error
      const isRetryable = this.isRetryableError(error);
      const shouldRetry = isRetryable && attempt < maxAttempts;

      if (shouldRetry) {
        // Schedule retry
        const retryDelay = this.RETRY_DELAYS[attempt - 1] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
        const nextRetryAt = new Date(Date.now() + retryDelay);

        delivery.status = 'failed';
        delivery.nextRetryAt = nextRetryAt;

        await delivery.save();

        logger.warn('Webhook delivery failed, scheduling retry', {
          webhookId,
          event,
          attempt,
          maxAttempts,
          nextRetryAt,
          statusCode,
          errorMessage,
          url,
        });

        // Schedule retry job (this will be handled by the queue worker)
        await this.scheduleRetry(params, attempt + 1, retryDelay);
      } else {
        // No more retries - move to dead letter
        delivery.status = 'dead_letter';
        delivery.nextRetryAt = undefined;

        await delivery.save();

        // Update webhook failure stats
        await this.updateWebhookStats(webhookId, false);

        logger.error('Webhook delivery failed permanently', {
          webhookId,
          event,
          attempt,
          maxAttempts,
          statusCode,
          errorMessage,
          isRetryable,
          url,
        });
      }

      return delivery;
    }
  }

  /**
   * Schedule a retry attempt
   */
  private static async scheduleRetry(
    params: WebhookDeliveryAttempt,
    nextAttempt: number,
    delay: number
  ): Promise<void> {
    try {
      // Import queue dynamically to avoid circular dependencies
      const { WebhookDeliveryQueue } = await import('../queue/WebhookDeliveryQueue');
      const queue = WebhookDeliveryQueue.getInstance();

      await queue.scheduleRetry({
        ...params,
        attempt: nextAttempt,
      }, delay);

      logger.debug('Webhook retry scheduled', {
        webhookId: params.webhookId,
        event: params.event,
        attempt: nextAttempt,
        delay,
      });
    } catch (error) {
      logger.error('Failed to schedule webhook retry', {
        webhookId: params.webhookId,
        event: params.event,
        attempt: nextAttempt,
        error: error.message,
      });
    }
  }

  /**
   * Determine if an error is retryable
   */
  private static isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // HTTP status codes that are retryable
    const statusCode = error.response?.status;
    if (statusCode) {
      // 5xx server errors are retryable
      if (statusCode >= 500 && statusCode < 600) {
        return true;
      }

      // 429 rate limit is retryable
      if (statusCode === 429) {
        return true;
      }

      // 408 request timeout is retryable
      if (statusCode === 408) {
        return true;
      }

      // 4xx client errors (except above) are not retryable
      if (statusCode >= 400 && statusCode < 500) {
        return false;
      }
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Generate HMAC signature for webhook
   */
  private static generateSignature(secret: string, payload: any): string {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  /**
   * Update webhook success/failure statistics
   */
  private static async updateWebhookStats(webhookId: string, success: boolean): Promise<void> {
    try {
      const update = success
        ? {
            $inc: { successCount: 1 },
            $set: { lastTriggeredAt: new Date() },
          }
        : {
            $inc: { failureCount: 1 },
          };

      await Webhook.findByIdAndUpdate(webhookId, update);
    } catch (error) {
      logger.error('Failed to update webhook stats', {
        webhookId,
        success,
        error: error.message,
      });
    }
  }

  /**
   * Get delivery history for a webhook
   */
  static async getDeliveryHistory(
    webhookId: string,
    workspaceId: string,
    options: {
      limit?: number;
      skip?: number;
      event?: string;
      status?: string;
    } = {}
  ): Promise<{
    deliveries: IWebhookDelivery[];
    total: number;
    stats: {
      totalDeliveries: number;
      successfulDeliveries: number;
      failedDeliveries: number;
      deadLetterDeliveries: number;
    };
  }> {
    const { limit = 50, skip = 0, event, status } = options;

    // Build query
    const query: any = { webhookId, workspaceId };
    if (event) query.event = event;
    if (status) query.status = status;

    // Get deliveries with pagination
    const deliveries = await WebhookDelivery.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    // Get total count
    const total = await WebhookDelivery.countDocuments(query);

    // Get stats
    const stats = await WebhookDelivery.aggregate([
      { $match: { webhookId, workspaceId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statsMap = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    return {
      deliveries: deliveries as unknown as IWebhookDelivery[],
      total,
      stats: {
        totalDeliveries: total,
        successfulDeliveries: (statsMap as any).success || 0,
        failedDeliveries: (statsMap as any).failed || 0,
        deadLetterDeliveries: (statsMap as any).dead_letter || 0,
      },
    };
  }

  /**
   * Get pending retries that are ready to be processed
   */
  static async getPendingRetries(limit: number = 100): Promise<IWebhookDelivery[]> {
    const deliveries = await WebhookDelivery.find({
      status: 'failed',
      nextRetryAt: { $lte: new Date() },
    })
      .sort({ nextRetryAt: 1 })
      .limit(limit)
      .lean();
    
    return deliveries as unknown as IWebhookDelivery[];
  }

  /**
   * Clean up old delivery records
   */
  static async cleanupOldDeliveries(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await WebhookDelivery.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: { $in: ['success', 'dead_letter'] }, // Keep failed ones for retry
    });

    logger.info('Cleaned up old webhook deliveries', {
      deletedCount: result.deletedCount,
      olderThanDays,
    });

    return result.deletedCount;
  }
}