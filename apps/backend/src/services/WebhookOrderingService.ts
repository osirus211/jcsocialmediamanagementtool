/**
 * Webhook Ordering Service
 * 
 * Prevents out-of-order events from overwriting newer state
 */

import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

export class WebhookOrderingService {
  private readonly keyPrefix = 'webhook:last_timestamp';
  private readonly ttl = 2592000; // 30 days

  constructor(private redis: Redis) {}

  /**
   * Check if event is in order
   * 
   * @returns true if event should be processed, false if out of order
   */
  async isInOrder(
    provider: string,
    resourceId: string,
    eventTimestamp: Date
  ): Promise<boolean> {
    const key = this.getKey(provider, resourceId);
    const eventTs = eventTimestamp.getTime();
    
    // Get last processed timestamp
    const lastTsStr = await this.redis.get(key);
    
    if (!lastTsStr) {
      // First event for this resource
      logger.debug('First event for resource', {
        provider,
        resourceId,
        eventTimestamp: eventTimestamp.toISOString(),
      });
      return true;
    }
    
    const lastTs = parseInt(lastTsStr, 10);
    
    if (eventTs > lastTs) {
      // Newer event
      logger.debug('Event is newer', {
        provider,
        resourceId,
        eventTimestamp: eventTimestamp.toISOString(),
        lastTimestamp: new Date(lastTs).toISOString(),
        delta: eventTs - lastTs,
      });
      return true;
    }
    
    // Out of order (stale event)
    logger.warn('Out-of-order event detected', {
      provider,
      resourceId,
      eventTimestamp: eventTimestamp.toISOString(),
      lastTimestamp: new Date(lastTs).toISOString(),
      delta: eventTs - lastTs,
      alert: 'OUT_OF_ORDER_EVENT',
    });
    
    return false;
  }

  /**
   * Update last processed timestamp
   */
  async updateTimestamp(
    provider: string,
    resourceId: string,
    eventTimestamp: Date
  ): Promise<void> {
    const key = this.getKey(provider, resourceId);
    const eventTs = eventTimestamp.getTime();
    
    // Store with 30-day TTL
    await this.redis.setex(key, this.ttl, eventTs.toString());
    
    logger.debug('Updated last timestamp', {
      provider,
      resourceId,
      timestamp: eventTimestamp.toISOString(),
    });
  }

  /**
   * Get last processed timestamp
   */
  async getLastTimestamp(
    provider: string,
    resourceId: string
  ): Promise<Date | null> {
    const key = this.getKey(provider, resourceId);
    const lastTsStr = await this.redis.get(key);
    
    if (!lastTsStr) {
      return null;
    }
    
    return new Date(parseInt(lastTsStr, 10));
  }

  /**
   * Get ordering key
   */
  private getKey(provider: string, resourceId: string): string {
    return `${this.keyPrefix}:${provider}:${resourceId}`;
  }

  /**
   * Clear ordering record (for testing)
   */
  async clear(provider: string, resourceId: string): Promise<void> {
    const key = this.getKey(provider, resourceId);
    await this.redis.del(key);
  }
}
