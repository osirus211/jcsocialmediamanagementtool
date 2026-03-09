/**
 * Twitter Webhook Provider
 * 
 * Handles Twitter webhook events
 * NOTE: Placeholder implementation - full implementation in Phase 3
 */

import { IncomingHttpHeaders } from 'http';
import { config } from '../../config';
import { Request, Response } from 'express';
import crypto from 'crypto';
import { BaseWebhookProvider } from './BaseWebhookProvider';
import { 
  WebhookEvent, 
  NormalizedWebhookEvent, 
  WebhookEventType,
  WebhookSignatureError,
  WebhookPayloadError 
} from '../../types/webhook.types';
import { WebhookVerificationCache } from '../../services/WebhookVerificationCache';
import { logger } from '../../utils/logger';

export class TwitterWebhookProvider extends BaseWebhookProvider {
  readonly name = 'twitter';

  async verifySignature(
    headers: IncomingHttpHeaders,
    rawBody: Buffer,
    cache?: WebhookVerificationCache
  ): Promise<boolean> {
    const signature = headers['x-twitter-webhooks-signature'] as string;
    
    if (!signature) {
      throw new WebhookSignatureError('Missing x-twitter-webhooks-signature header');
    }

    if (cache) {
      const isCached = await cache.isVerified(this.name, signature);
      if (isCached) return true;
    }

    const consumerSecret = config.oauth.twitter.clientSecret;
    if (!consumerSecret) {
      throw new Error('TWITTER_CONSUMER_SECRET not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', consumerSecret)
      .update(rawBody)
      .digest('base64');

    const isValid = signature === `sha256=${expectedSignature}`;
    
    if (!isValid) {
      throw new WebhookSignatureError('Invalid signature');
    }

    if (cache) {
      await cache.cacheVerification(this.name, signature);
    }

    return true;
  }

  async extractEvent(payload: any): Promise<WebhookEvent> {
    let eventType = 'unknown';
    let eventId = `tw_${Date.now()}`;

    if (payload.revoke) {
      eventType = 'revoke';
      eventId = payload.revoke.source.user_id;
    } else if (payload.user_event) {
      eventType = payload.user_event;
    }

    return {
      id: eventId,
      type: eventType,
      timestamp: new Date(),
      data: payload,
    };
  }

  async normalizeEvent(event: WebhookEvent): Promise<NormalizedWebhookEvent> {
    const eventTypeMap: Record<string, WebhookEventType> = {
      'revoke': WebhookEventType.TOKEN_REVOKED,
      'account_suspended': WebhookEventType.ACCOUNT_SUSPENDED,
      'profile_update': WebhookEventType.PROFILE_UPDATED,
    };

    const normalizedType = eventTypeMap[event.type] || WebhookEventType.UNKNOWN;
    const accountId = this.extractAccountId(event);
    const workspaceId = accountId ? await this.extractWorkspaceId(accountId) : undefined;

    const normalized: NormalizedWebhookEvent = {
      eventId: event.id,
      provider: this.name,
      eventType: normalizedType,
      timestamp: event.timestamp,
      accountId,
      workspaceId,
      data: {
        raw: event.data,
        normalized: {},
      },
      metadata: {
        receivedAt: new Date(),
        correlationId: this.generateCorrelationId(),
      },
    };

    this.validateNormalizedEvent(normalized);
    return normalized;
  }

  protected extractAccountId(event: WebhookEvent): string | undefined {
    return event.data.for_user_id || event.data.revoke?.source?.user_id;
  }

  extractResourceId(event: WebhookEvent): string | undefined {
    return this.extractAccountId(event);
  }

  async handleChallenge(req: Request, res: Response): Promise<boolean> {
    const crcToken = req.query.crc_token as string;
    
    if (!crcToken) {
      return false;
    }

    const consumerSecret = config.oauth.twitter.clientSecret;
    if (!consumerSecret) {
      throw new Error('TWITTER_CONSUMER_SECRET not configured');
    }

    const responseToken = crypto
      .createHmac('sha256', consumerSecret)
      .update(crcToken)
      .digest('base64');

    res.json({ response_token: `sha256=${responseToken}` });
    return true;
  }
}
