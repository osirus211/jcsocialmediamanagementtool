/**
 * LinkedIn Webhook Provider
 * 
 * Handles LinkedIn webhook events with HMAC-SHA256 signature verification
 * Documentation: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/webhooks
 */

import { IncomingHttpHeaders } from 'http';
import crypto from 'crypto';
import { config } from '../../config';
import { BaseWebhookProvider } from './BaseWebhookProvider';
import { WebhookEvent, NormalizedWebhookEvent, WebhookEventType, WebhookSignatureError } from '../../types/webhook.types';
import { WebhookVerificationCache } from '../../services/WebhookVerificationCache';
import { logger } from '../../utils/logger';

export class LinkedInWebhookProvider extends BaseWebhookProvider {
  readonly name = 'linkedin';

  async verifySignature(headers: IncomingHttpHeaders, rawBody: Buffer, cache?: WebhookVerificationCache): Promise<boolean> {
    const signature = headers['x-li-signature'] as string;
    
    if (!signature) {
      throw new WebhookSignatureError('Missing x-li-signature header');
    }

    // Check cache first
    if (cache) {
      const isCached = await cache.isVerified(this.name, signature);
      if (isCached) {
        logger.info('Signature verification skipped (cached)', {
          provider: this.name,
        });
        return true;
      }
    }

    // Perform HMAC-SHA256 verification with base64 encoding
    const secret = process.env.LINKEDIN_CLIENT_SECRET || config.oauth?.linkedin?.clientSecret;
    if (!secret) {
      throw new Error('LINKEDIN_CLIENT_SECRET not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    // Use timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    
    if (!isValid) {
      throw new WebhookSignatureError('Invalid signature');
    }

    // Cache successful verification
    if (cache) {
      await cache.cacheVerification(this.name, signature);
    }

    return true;
  }

  async extractEvent(payload: any): Promise<WebhookEvent> {
    return {
      id: `li_${Date.now()}`,
      type: payload.eventType || 'unknown',
      timestamp: new Date(),
      data: payload,
    };
  }

  async normalizeEvent(event: WebhookEvent): Promise<NormalizedWebhookEvent> {
    const normalized: NormalizedWebhookEvent = {
      eventId: event.id,
      provider: this.name,
      eventType: WebhookEventType.UNKNOWN,
      timestamp: event.timestamp,
      data: { raw: event.data, normalized: {} },
      metadata: { receivedAt: new Date(), correlationId: this.generateCorrelationId() },
    };
    this.validateNormalizedEvent(normalized);
    return normalized;
  }
}
