/**
 * Facebook Webhook Provider
 * 
 * Handles Facebook webhook events
 */

import { IncomingHttpHeaders } from 'http';
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

export class FacebookWebhookProvider extends BaseWebhookProvider {
  readonly name = 'facebook';

  async verifySignature(
    headers: IncomingHttpHeaders,
    rawBody: Buffer,
    cache?: WebhookVerificationCache
  ): Promise<boolean> {
    const signature = headers['x-hub-signature-256'] as string;
    
    if (!signature) {
      throw new WebhookSignatureError('Missing x-hub-signature-256 header');
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

    // Perform HMAC verification
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
      throw new Error('FACEBOOK_APP_SECRET not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    const isValid = signature === `sha256=${expectedSignature}`;
    
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
    // Facebook webhook structure:
    // { object: 'user', entry: [{ id: '...', changes: [...] }] }
    
    if (!payload.entry || !Array.isArray(payload.entry)) {
      throw new WebhookPayloadError('Invalid Facebook webhook payload');
    }

    const entry = payload.entry[0];
    const change = entry.changes?.[0];

    return {
      id: entry.id || `fb_${Date.now()}`,
      type: change?.field || 'unknown',
      timestamp: new Date(entry.time * 1000),
      data: payload,
    };
  }

  async normalizeEvent(event: WebhookEvent): Promise<NormalizedWebhookEvent> {
    // Map Facebook event types to our internal types
    const eventTypeMap: Record<string, WebhookEventType> = {
      'permissions': WebhookEventType.PERMISSION_CHANGED,
      'deauthorize': WebhookEventType.TOKEN_REVOKED,
      'delete': WebhookEventType.ACCOUNT_DELETED,
      'feed': WebhookEventType.MEDIA_PUBLISHED,
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
        normalized: this.normalizeData(event.data, normalizedType),
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
    return event.data.entry?.[0]?.id;
  }

  extractResourceId(event: WebhookEvent): string | undefined {
    return event.data.entry?.[0]?.id;
  }

  private normalizeData(data: any, eventType: WebhookEventType): any {
    switch (eventType) {
      case WebhookEventType.TOKEN_REVOKED:
        return {
          userId: data.entry?.[0]?.id,
          reason: 'user_deauthorized',
        };
      case WebhookEventType.PERMISSION_CHANGED:
        return {
          userId: data.entry?.[0]?.id,
          permissions: data.entry?.[0]?.changes?.[0]?.value,
        };
      default:
        return data;
    }
  }
}
