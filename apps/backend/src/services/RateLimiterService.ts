/**
 * Enhanced Rate Limiter Service
 * 
 * Provides rate limiting for different scopes:
 * - OAuth endpoints: 20 requests/minute per IP
 * - Webhook endpoints: 100 requests/second per provider (already implemented in WebhookRateLimiter)
 * - Admin APIs: 60 requests/minute per user
 */

import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

export type RateLimitScope = 'oauth' | 'webhook' | 'admin';

interface RateLimitConfig {
  limit: number;
  window: number; // seconds
}

const RATE_LIMIT_CONFIGS: Record<RateLimitScope, RateLimitConfig> = {
  oauth: {
    limit: 20,
    window: 60, // 20 requests per minute
  },
  webhook: {
    limit: 100,
    window: 1, // 100 requests per second
  },
  admin: {
    limit: 60,
    window: 60, // 60 requests per minute
  },
};

export class RateLimiterService {
  private readonly keyPrefix = 'ratelimit';

  constructor(private redis: Redis) {}

  /**
   * Check if request is within rate limit
   * 
   * @param scope - Rate limit scope (oauth, webhook, admin)
   * @param identifier - Unique identifier (IP, provider, userId)
   * @returns true if allowed, false if rate limit exceeded
   */
  async isAllowed(scope: RateLimitScope, identifier: string): Promise<boolean> {
    const config = RATE_LIMIT_CONFIGS[scope];
    const key = this.getKey(scope, identifier);
    const now = Date.now();
    const windowStart = now - (config.window * 1000);

    try {
      // Use Redis sorted set with timestamps as scores
      // Remove old entries outside the window
      await this.redis.zremrangebyscore(key, 0, windowStart);

      // Count requests in current window
      const count = await this.redis.zcard(key);

      if (count >= config.limit) {
        logger.warn('Rate limit exceeded', {
          scope,
          identifier,
          count,
          limit: config.limit,
          window: config.window,
          alert: 'RATE_LIMIT_EXCEEDED',
        });
        return false;
      }

      // Add current request
      await this.redis.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiry on key (cleanup)
      await this.redis.expire(key, config.window * 2);

      logger.debug('Rate limit check passed', {
        scope,
        identifier,
        count: count + 1,
        limit: config.limit,
      });

      return true;
    } catch (error: any) {
      logger.error('Rate limiter error', {
        scope,
        identifier,
        error: error.message,
      });
      // Fail open - allow request if rate limiter fails
      return true;
    }
  }

  /**
   * Get current request count for identifier
   * 
   * @param scope - Rate limit scope
   * @param identifier - Unique identifier
   * @returns Current request count in window
   */
  async getCount(scope: RateLimitScope, identifier: string): Promise<number> {
    const config = RATE_LIMIT_CONFIGS[scope];
    const key = this.getKey(scope, identifier);
    const now = Date.now();
    const windowStart = now - (config.window * 1000);

    try {
      await this.redis.zremrangebyscore(key, 0, windowStart);
      return await this.redis.zcard(key);
    } catch (error: any) {
      logger.error('Failed to get rate limit count', {
        scope,
        identifier,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Get remaining requests in window
   * 
   * @param scope - Rate limit scope
   * @param identifier - Unique identifier
   * @returns Remaining requests allowed
   */
  async getRemaining(scope: RateLimitScope, identifier: string): Promise<number> {
    const config = RATE_LIMIT_CONFIGS[scope];
    const count = await this.getCount(scope, identifier);
    return Math.max(0, config.limit - count);
  }

  /**
   * Get time until rate limit resets (in seconds)
   * 
   * @param scope - Rate limit scope
   * @param identifier - Unique identifier
   * @returns Seconds until reset
   */
  async getResetTime(scope: RateLimitScope, identifier: string): Promise<number> {
    const config = RATE_LIMIT_CONFIGS[scope];
    const key = this.getKey(scope, identifier);

    try {
      // Get oldest entry in window
      const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      if (oldest.length === 0) {
        return 0;
      }

      const oldestTimestamp = parseInt(oldest[1]);
      const resetTime = oldestTimestamp + (config.window * 1000);
      const now = Date.now();

      return Math.max(0, Math.ceil((resetTime - now) / 1000));
    } catch (error: any) {
      logger.error('Failed to get reset time', {
        scope,
        identifier,
        error: error.message,
      });
      return config.window;
    }
  }

  /**
   * Get Redis key for rate limit
   */
  private getKey(scope: RateLimitScope, identifier: string): string {
    return `${this.keyPrefix}:${scope}:${identifier}`;
  }

  /**
   * Clear rate limit for identifier (for testing)
   */
  async clear(scope: RateLimitScope, identifier: string): Promise<void> {
    const key = this.getKey(scope, identifier);
    await this.redis.del(key);
  }

  /**
   * Clear all rate limits for scope (for testing)
   */
  async clearScope(scope: RateLimitScope): Promise<void> {
    const pattern = `${this.keyPrefix}:${scope}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
