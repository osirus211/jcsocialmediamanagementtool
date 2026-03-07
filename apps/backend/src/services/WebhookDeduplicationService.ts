/**
 * Webhook Deduplication Service
 * 
 * Prevents duplicate webhook event processing using Redis
 */

import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

export class WebhookDeduplicationService {
  private readonly keyPrefix = 'webhook:dedup';
  private readonly ttl = 86400; // 24 hours

  constructor(private redis: Redis) {}

  /**
   * Check if event is duplicate
   */
  async isDuplicate(provider: string, eventId: string): Promise<boolean> {
    const key = this.getKey(provider, eventId);
    
    const exists = await this.redis.exists(key);
    
    if (exists) {
      logger.debug('Duplicate webhook event detected', {
        provider,
        eventId,
      });
      return true;
    }
    
    return false;
  }

  /**
   * Mark event as processed
   */
  async markProcessed(
    provider: string,
    eventId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const key = this.getKey(provider, eventId);
    
    const value = JSON.stringify({
      processedAt: new Date().toISOString(),
      provider,
      eventId,
      ...metadata,
    });
    
    await this.redis.setex(key, this.ttl, value);
    
    logger.debug('Webhook event marked as processed', {
      provider,
      eventId,
      ttl: this.ttl,
    });
  }

  /**
   * Get deduplication key
   */
  private getKey(provider: string, eventId: string): string {
    return `${this.keyPrefix}:${provider}:${eventId}`;
  }

  /**
   * Clear deduplication record (for testing)
   */
  async clear(provider: string, eventId: string): Promise<void> {
    const key = this.getKey(provider, eventId);
    await this.redis.del(key);
  }
}
