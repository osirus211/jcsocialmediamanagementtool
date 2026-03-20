/**
 * TikTok Webhook Provider
 * 
 * Handles TikTok webhook events with HMAC-SHA256 signature verification
 * Documentation: https://developers.tiktok.com/doc/webhooks-overview
 */

import { IncomingHttpHeaders } from 'http';
import crypto from 'crypto';
import { config } from '../../config';
import { BaseWebhookProvider } from './BaseWebhookProvider';
import { WebhookEvent, NormalizedWebhookEvent, WebhookEventType, WebhookSignatureError } from '../../types/webhook.types';
import { WebhookVerificationCache } from '../../services/WebhookVerificationCache';
import { logger } from '../../utils/logger';

export class TikTokWebhookProvider extends BaseWebhookProvider {
  readonly name = 'tiktok';

  async verifySignature(headers: IncomingHttpHeaders, rawBody: Buffer, cache?: WebhookVerificationCache): Promise<boolean> {
    // TikTok uses either x-tiktok-signature or x-tt-signature header
    const signature = (headers['x-tiktok-signature'] || headers['x-tt-signature']) as string;
    
    if (!signature) {
      throw new WebhookSignatureError('Missing x-tiktok-signature or x-tt-signature header');
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

    // Perform HMAC-SHA256 verification
    const secret = process.env.TIKTOK_WEBHOOK_SECRET || config.oauth?.tiktok?.clientSecret;
    if (!secret) {
      throw new Error('TIKTOK_WEBHOOK_SECRET not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Remove 'sha256=' prefix if present
    const signatureValue = signature.startsWith('sha256=') ? signature.slice(7) : signature;

    // Use timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signatureValue),
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
      id: `tt_${Date.now()}`,
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
