/**
 * TikTok Webhook Provider
 * NOTE: Placeholder - full implementation in Phase 3
 */

import { IncomingHttpHeaders } from 'http';
import { BaseWebhookProvider } from './BaseWebhookProvider';
import { WebhookEvent, NormalizedWebhookEvent, WebhookEventType } from '../../types/webhook.types';
import { WebhookVerificationCache } from '../../services/WebhookVerificationCache';

export class TikTokWebhookProvider extends BaseWebhookProvider {
  readonly name = 'tiktok';

  async verifySignature(headers: IncomingHttpHeaders, rawBody: Buffer, cache?: WebhookVerificationCache): Promise<boolean> {
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
