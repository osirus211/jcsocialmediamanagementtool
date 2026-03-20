/**
 * YouTube Webhook Provider
 * 
 * Handles YouTube webhook events via PubSubHubbub (WebSub)
 * Documentation: https://developers.google.com/youtube/v3/guides/push_notifications
 */

import { IncomingHttpHeaders } from 'http';
import crypto from 'crypto';
import { config } from '../../config';
import { BaseWebhookProvider } from './BaseWebhookProvider';
import { WebhookEvent, NormalizedWebhookEvent, WebhookEventType, WebhookSignatureError } from '../../types/webhook.types';
import { WebhookVerificationCache } from '../../services/WebhookVerificationCache';
import { logger } from '../../utils/logger';

export class YouTubeWebhookProvider extends BaseWebhookProvider {
  readonly name = 'youtube';

  async verifySignature(headers: IncomingHttpHeaders, rawBody: Buffer, cache?: WebhookVerificationCache): Promise<boolean> {
    const signature = headers['x-hub-signature'] as string;
    
    if (!signature) {
      throw new WebhookSignatureError('Missing x-hub-signature header');
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

    // Perform HMAC-SHA1 verification (YouTube uses SHA1 for WebSub)
    const secret = process.env.YOUTUBE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('YOUTUBE_WEBHOOK_SECRET not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha1', secret)
      .update(rawBody)
      .digest('hex');

    const signatureValue = signature.startsWith('sha1=') ? signature.slice(5) : signature;

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
      id: `yt_${Date.now()}`,
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
