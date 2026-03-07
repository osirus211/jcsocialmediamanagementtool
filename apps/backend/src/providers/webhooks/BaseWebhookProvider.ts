/**
 * Base Webhook Provider
 * 
 * Abstract base class providing common functionality for all webhook providers
 */

import { IWebhookProvider } from './IWebhookProvider';
import { WebhookEvent, NormalizedWebhookEvent } from '../../types/webhook.types';
import { SocialAccount } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

export abstract class BaseWebhookProvider implements IWebhookProvider {
  abstract readonly name: string;

  abstract verifySignature(
    headers: any,
    rawBody: Buffer,
    cache?: any
  ): Promise<boolean>;

  abstract extractEvent(payload: any): Promise<WebhookEvent>;

  abstract normalizeEvent(event: WebhookEvent): Promise<NormalizedWebhookEvent>;

  /**
   * Extract resource ID from event (override in subclass if supported)
   */
  extractResourceId?(event: WebhookEvent): string | undefined {
    return undefined;
  }

  /**
   * Extract account ID from normalized event
   * Used to lookup SocialAccount in database
   */
  protected extractAccountId(event: WebhookEvent): string | undefined {
    // Override in subclass
    return undefined;
  }

  /**
   * Extract workspace ID from normalized event
   * Used for multi-tenant isolation
   */
  protected async extractWorkspaceId(accountId: string): Promise<string | undefined> {
    if (!accountId) return undefined;

    try {
      // Lookup SocialAccount to get workspaceId
      const account = await SocialAccount.findOne({
        provider: this.name,
        providerUserId: accountId,
      });

      return account?.workspaceId?.toString();
    } catch (error: any) {
      logger.error('Failed to extract workspaceId', {
        provider: this.name,
        accountId,
        error: error.message,
      });
      return undefined;
    }
  }

  /**
   * Generate correlation ID for tracking
   */
  protected generateCorrelationId(): string {
    return `webhook_${this.name}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Validate normalized event structure
   */
  protected validateNormalizedEvent(event: NormalizedWebhookEvent): void {
    if (!event.eventId) throw new Error('Missing eventId');
    if (!event.provider) throw new Error('Missing provider');
    if (!event.eventType) throw new Error('Missing eventType');
    if (!event.timestamp) throw new Error('Missing timestamp');
    if (!(event.timestamp instanceof Date)) throw new Error('Invalid timestamp');
    if (!event.metadata?.correlationId) throw new Error('Missing correlationId');
  }
}
