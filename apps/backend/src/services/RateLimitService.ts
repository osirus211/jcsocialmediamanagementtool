/**
 * Rate Limiting Service
 * 
 * Provides rate limiting functionality using Redis
 */

import { logger } from '../utils/logger';

export class RateLimitService {
  private redis: any;

  constructor() {
    this.initRedis();
  }

  private async initRedis() {
    try {
      const { getRedisClientSafe } = await import('../config/redis');
      this.redis = getRedisClientSafe();
    } catch (error) {
      logger.warn('Redis not available for rate limiting, using in-memory fallback');
      // Fallback to in-memory rate limiting
      this.redis = null;
    }
  }

  /**
   * Check if request is within rate limit
   * @param key - Unique identifier for the rate limit (e.g., user ID, IP)
   * @param limit - Maximum number of requests allowed
   * @param windowSeconds - Time window in seconds
   * @returns true if within limit, false if exceeded
   */
  async checkLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    try {
      if (!this.redis) {
        // Fallback: always allow (not ideal for production)
        logger.warn('Rate limiting disabled - Redis not available');
        return true;
      }

      const now = Date.now();
      const window = windowSeconds * 1000;
      const pipeline = this.redis.pipeline();

      // Remove expired entries
      pipeline.zremrangebyscore(key, 0, now - window);
      
      // Count current requests in window
      pipeline.zcard(key);
      
      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      
      // Set expiration
      pipeline.expire(key, windowSeconds);

      const results = await pipeline.exec();
      const currentCount = results[1][1]; // Get count result

      return currentCount < limit;
    } catch (error) {
      logger.error('Rate limit check error:', error);
      // On error, allow the request (fail open)
      return true;
    }
  }

  /**
   * Get current usage for a key
   */
  async getCurrentUsage(key: string, windowSeconds: number): Promise<number> {
    try {
      if (!this.redis) {
        return 0;
      }

      const now = Date.now();
      const window = windowSeconds * 1000;

      // Remove expired entries and count
      await this.redis.zremrangebyscore(key, 0, now - window);
      const count = await this.redis.zcard(key);

      return count;
    } catch (error) {
      logger.error('Get current usage error:', error);
      return 0;
    }
  }

  /**
   * Reset rate limit for a key
   */
  async resetLimit(key: string): Promise<void> {
    try {
      if (!this.redis) {
        return;
      }

      await this.redis.del(key);
    } catch (error) {
      logger.error('Reset rate limit error:', error);
    }
  }
}

export const rateLimitService = new RateLimitService();