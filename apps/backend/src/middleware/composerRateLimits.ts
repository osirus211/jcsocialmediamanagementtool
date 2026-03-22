import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}

/**
 * Sliding window rate limiter using Redis ZADD/ZREMRANGEBYSCORE
 * More accurate than fixed window as it considers exact timestamps
 */
export class SlidingWindowRateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async checkLimit(workspaceId: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const key = `${this.config.keyPrefix}:${workspaceId}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      const redisClient = getRedisClient();
      
      // Remove old entries outside the sliding window
      await redisClient.zremrangebyscore(key, 0, windowStart);

      // Count requests in current window
      const requestCount = await redisClient.zcard(key);

      if (requestCount >= this.config.maxRequests) {
        // Get oldest request timestamp to calculate reset time
        const oldestRequests = await redisClient.zrange(key, 0, 0, 'WITHSCORES');
        const oldestTimestamp = oldestRequests.length > 1 ? parseInt(oldestRequests[1]) : now;
        const resetAt = new Date(oldestTimestamp + this.config.windowMs);

        return {
          allowed: false,
          remaining: 0,
          resetAt
        };
      }

      // Add current request with timestamp as score
      const requestId = `${now}:${Math.random()}`;
      await redisClient.zadd(key, now, requestId);

      // Set expiry on the key (cleanup)
      await redisClient.expire(key, Math.ceil(this.config.windowMs / 1000));

      return {
        allowed: true,
        remaining: this.config.maxRequests - requestCount - 1,
        resetAt: new Date(now + this.config.windowMs)
      };
    } catch (error) {
      logger.error('Rate limit check failed', { error, key });
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(now + this.config.windowMs)
      };
    }
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const workspaceId = req.workspace?.workspaceId?.toString();

      if (!workspaceId) {
        return next(new AppError(401, 'Workspace ID required'));
      }

      const result = await this.checkLimit(workspaceId);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

      if (!result.allowed) {
        return next(
          new AppError(
            429,
            `Rate limit exceeded. Try again after ${result.resetAt.toISOString()}`,
            {
              limit: this.config.maxRequests,
              windowMs: this.config.windowMs,
              resetAt: result.resetAt
            }
          )
        );
      }

      next();
    };
  }
}

// AI Caption Generation: 100 requests/hour/workspace
export const aiCaptionLimit = new SlidingWindowRateLimiter({
  maxRequests: 100,
  windowMs: 60 * 60 * 1000, // 1 hour
  keyPrefix: 'ratelimit:ai:caption'
}).middleware();

// AI Image Generation: 20 requests/hour/workspace
export const aiImageLimit = new SlidingWindowRateLimiter({
  maxRequests: 20,
  windowMs: 60 * 60 * 1000, // 1 hour
  keyPrefix: 'ratelimit:ai:image'
}).middleware();

// Link Preview: 200 requests/hour/workspace
export const linkPreviewLimit = new SlidingWindowRateLimiter({
  maxRequests: 200,
  windowMs: 60 * 60 * 1000, // 1 hour
  keyPrefix: 'ratelimit:linkpreview'
}).middleware();

// URL Shortener: 500 requests/day/workspace
export const urlShortenerLimit = new SlidingWindowRateLimiter({
  maxRequests: 500,
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  keyPrefix: 'ratelimit:urlshortener'
}).middleware();

// Media Upload: 1000 requests/day/workspace
export const mediaUploadLimit = new SlidingWindowRateLimiter({
  maxRequests: 1000,
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  keyPrefix: 'ratelimit:mediaupload'
}).middleware();

// Content Moderation: 500 requests/hour/workspace
export const moderationLimit = new SlidingWindowRateLimiter({
  maxRequests: 500,
  windowMs: 60 * 60 * 1000,
  keyPrefix: 'rateLimit:moderation',
});
