/**
 * Publishing Rate Limiter
 * 
 * Enforces platform-specific publishing rate limits
 * Prevents exceeding API limits
 */

import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

interface PlatformLimits {
  maxPosts: number;
  windowSeconds: number;
}

// Platform-specific rate limits
const PLATFORM_LIMITS: Record<string, PlatformLimits> = {
  twitter: {
    maxPosts: 300, // 300 posts per 3 hours
    windowSeconds: 3 * 60 * 60,
  },
  facebook: {
    maxPosts: 50, // 50 posts per hour
    windowSeconds: 60 * 60,
  },
  instagram: {
    maxPosts: 25, // 25 posts per day
    windowSeconds: 24 * 60 * 60,
  },
  linkedin: {
    maxPosts: 100, // 100 posts per day
    windowSeconds: 24 * 60 * 60,
  },
  tiktok: {
    maxPosts: 10, // 10 posts per day
    windowSeconds: 24 * 60 * 60,
  },
};

export class PublishingRateLimiter {
  private readonly keyPrefix = 'publish:rate';

  constructor(private redis: Redis) {}

  /**
   * Check if publishing is allowed for account
   * 
   * @param platform - Platform name
   * @param accountId - Social account ID
   * @returns true if allowed, false if rate limit exceeded
   */
  async isAllowed(platform: string, accountId: string): Promise<boolean> {
    const limits = PLATFORM_LIMITS[platform.toLowerCase()];

    if (!limits) {
      logger.warn('No rate limits defined for platform', { platform });
      return true; // Allow if no limits defined
    }

    const key = this.getKey(platform, accountId);
    const now = Date.now();
    const windowStart = now - limits.windowSeconds * 1000;

    try {
      // Remove old entries outside window
      await this.redis.zremrangebyscore(key, 0, windowStart);

      // Count posts in current window
      const count = await this.redis.zcard(key);

      if (count >= limits.maxPosts) {
        logger.warn('Publishing rate limit exceeded', {
          platform,
          accountId,
          count,
          limit: limits.maxPosts,
          windowSeconds: limits.windowSeconds,
          alert: 'PUBLISH_RATE_LIMIT_EXCEEDED',
        });
        return false;
      }

      // Add current publish attempt
      await this.redis.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiry
      await this.redis.expire(key, limits.windowSeconds * 2);

      logger.debug('Publishing rate limit check passed', {
        platform,
        accountId,
        count: count + 1,
        limit: limits.maxPosts,
      });

      return true;
    } catch (error: any) {
      logger.error('Publishing rate limiter error', {
        platform,
        accountId,
        error: error.message,
      });
      // Fail open - allow if rate limiter fails
      return true;
    }
  }

  /**
   * Get current publish count for account
   */
  async getCount(platform: string, accountId: string): Promise<number> {
    const limits = PLATFORM_LIMITS[platform.toLowerCase()];
    if (!limits) return 0;

    const key = this.getKey(platform, accountId);
    const now = Date.now();
    const windowStart = now - limits.windowSeconds * 1000;

    try {
      await this.redis.zremrangebyscore(key, 0, windowStart);
      return await this.redis.zcard(key);
    } catch (error: any) {
      logger.error('Failed to get publish count', {
        platform,
        accountId,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Get remaining publishes allowed
   */
  async getRemaining(platform: string, accountId: string): Promise<number> {
    const limits = PLATFORM_LIMITS[platform.toLowerCase()];
    if (!limits) return Infinity;

    const count = await this.getCount(platform, accountId);
    return Math.max(0, limits.maxPosts - count);
  }

  /**
   * Get time until rate limit resets (in seconds)
   */
  async getResetTime(platform: string, accountId: string): Promise<number> {
    const limits = PLATFORM_LIMITS[platform.toLowerCase()];
    if (!limits) return 0;

    const key = this.getKey(platform, accountId);

    try {
      // Get oldest entry in window
      const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      if (oldest.length === 0) return 0;

      const oldestTimestamp = parseInt(oldest[1]);
      const resetTime = oldestTimestamp + limits.windowSeconds * 1000;
      const now = Date.now();

      return Math.max(0, Math.ceil((resetTime - now) / 1000));
    } catch (error: any) {
      logger.error('Failed to get reset time', {
        platform,
        accountId,
        error: error.message,
      });
      return limits.windowSeconds;
    }
  }

  /**
   * Get platform limits
   */
  getLimits(platform: string): PlatformLimits | null {
    return PLATFORM_LIMITS[platform.toLowerCase()] || null;
  }

  /**
   * Get Redis key
   */
  private getKey(platform: string, accountId: string): string {
    return `${this.keyPrefix}:${platform}:${accountId}`;
  }

  /**
   * Clear rate limit for account (for testing)
   */
  async clear(platform: string, accountId: string): Promise<void> {
    const key = this.getKey(platform, accountId);
    await this.redis.del(key);
  }
}
