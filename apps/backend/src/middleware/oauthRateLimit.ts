/**
 * OAuth Rate Limiting Middleware
 * 
 * Provides rate limiting for OAuth endpoints:
 * - /oauth/twitter/authorize: 10 requests/min per user
 * - /oauth/twitter/callback: 20 requests/min per IP
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClientSafe } from '../config/redis';
import { getClientIp, hashIpAddress } from '../utils/ipHash';
import { logger } from '../utils/logger';
import { TooManyRequestsError } from '../utils/errors';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string; // Redis key prefix
  keyExtractor: (req: Request) => string; // Function to extract rate limit key
}

/**
 * Create rate limit middleware
 */
export function createOAuthRateLimit(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedisClientSafe();
      
      // If Redis not available, allow request (fail open)
      if (!redis) {
        logger.warn('[OAuth Rate Limit] Redis unavailable - allowing request', {
          path: req.path,
        });
        return next();
      }

      // Extract rate limit key
      const rateLimitKey = config.keyExtractor(req);
      const redisKey = `${config.keyPrefix}:${rateLimitKey}`;

      // Get current count
      const current = await redis.get(redisKey);
      const count = current ? parseInt(current, 10) : 0;

      // Check if limit exceeded
      if (count >= config.maxRequests) {
        const ttl = await redis.ttl(redisKey);
        const retryAfter = ttl > 0 ? ttl : Math.ceil(config.windowMs / 1000);

        logger.warn('[OAuth Rate Limit] Limit exceeded', {
          path: req.path,
          key: rateLimitKey.substring(0, 10) + '...',
          count,
          limit: config.maxRequests,
          retryAfter,
        });

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', (Date.now() + retryAfter * 1000).toString());
        res.setHeader('Retry-After', retryAfter.toString());

        throw new TooManyRequestsError(
          `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          { retryAfter }
        );
      }

      // Increment counter
      const newCount = await redis.incr(redisKey);

      // Set expiry on first request
      if (newCount === 1) {
        await redis.pexpire(redisKey, config.windowMs);
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - newCount).toString());
      
      const ttl = await redis.pttl(redisKey);
      if (ttl > 0) {
        res.setHeader('X-RateLimit-Reset', (Date.now() + ttl).toString());
      }

      logger.debug('[OAuth Rate Limit] Request allowed', {
        path: req.path,
        key: rateLimitKey.substring(0, 10) + '...',
        count: newCount,
        limit: config.maxRequests,
        remaining: config.maxRequests - newCount,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Rate limit for /oauth/twitter/authorize
 * 10 requests per minute per user
 */
export const authorizeRateLimit = createOAuthRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  keyPrefix: 'oauth:ratelimit:authorize',
  keyExtractor: (req: Request) => {
    // Rate limit by userId
    const userId = req.user?.userId?.toString() || 'anonymous';
    return userId;
  },
});

/**
 * Rate limit for /oauth/twitter/callback
 * 20 requests per minute per IP
 */
export const callbackRateLimit = createOAuthRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,
  keyPrefix: 'oauth:ratelimit:callback',
  keyExtractor: (req: Request) => {
    // Rate limit by hashed IP
    const ip = getClientIp(req);
    return hashIpAddress(ip);
  },
});
