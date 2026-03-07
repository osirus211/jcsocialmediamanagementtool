/**
 * Webhook Rate Limiter
 * 
 * Redis-based rate limiting for webhook endpoints
 * Limit: 100 requests per second per provider
 */

import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

export class WebhookRateLimiter {
  private readonly keyPrefix = 'webhook:ratelimit';
  private readonly limit = 100; // requests per second
  private readonly window = 1; // 1 second window

  constructor(private redis: Redis) {}

  /**
   * Check if request is within rate limit
   * 
   * @param provider - Provider name
   * @returns true if allowed, false if rate limit exceeded
   */
  async isAllowed(provider: string): Promise<boolean> {
    const key = this.getKey(provider);
    const now = Date.now();
    const windowStart = now - (this.window * 1000);

    try {
      // Use Redis sorted set with timestamps as scores
      // Remove old entries outside the window
      await this.redis.zremrangebyscore(key, 0, windowStart);

      // Count requests in current window
      const count = await this.redis.zcard(key);

      if (count >= this.limit) {
        logger.warn('Webhook rate limit exceeded', {
          provider,
          count,
          limit: this.limit,
          alert: 'RATE_LIMIT_EXCEEDED',
        });
        return false;
      }

      // Add current request
      await this.redis.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiry on key (cleanup)
      await this.redis.expire(key, this.window * 2);

      logger.debug('Webhook rate limit check passed', {
        provider,
        count: count + 1,
        limit: this.limit,
      });

      return true;
    } catch (error: any) {
      logger.error('Rate limiter error', {
        provider,
        error: error.message,
      });
      // Fail open - allow request if rate limiter fails
      return true;
    }
  }

  /**
   * Get current request count for provider
   */
  async getCount(provider: string): Promise<number> {
    const key = this.getKey(provider);
    const now = Date.now();
    const windowStart = now - (this.window * 1000);

    await this.redis.zremrangebyscore(key, 0, windowStart);
    return await this.redis.zcard(key);
  }

  /**
   * Get rate limit key
   */
  private getKey(provider: string): string {
    const second = Math.floor(Date.now() / 1000);
    return `${this.keyPrefix}:${provider}:${second}`;
  }

  /**
   * Clear rate limit for provider (for testing)
   */
  async clear(provider: string): Promise<void> {
    const key = this.getKey(provider);
    await this.redis.del(key);
  }
}
