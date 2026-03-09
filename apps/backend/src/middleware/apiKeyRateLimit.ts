/**
 * API Key Rate Limiting Middleware
 * 
 * Extends existing rate limiting system to support per-API-key limits
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { ApiKey } from '../models/ApiKey';
import { publicApiMetricsTracker } from './publicApiMetrics';

/**
 * Sliding window rate limiter using Redis
 * Reuses the same algorithm as existing RateLimitMiddleware
 */
async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
  total: number;
}> {
  try {
    const redis = getRedisClient();
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Remove old entries outside the window
    await redis.zremrangebyscore(key, 0, windowStart);
    
    // Count requests in current window
    const count = await redis.zcard(key);
    
    // Check if limit exceeded
    if (count >= maxRequests) {
      // Get oldest entry to calculate reset time
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = oldest.length > 0 
        ? parseInt(oldest[1]) + windowMs 
        : now + windowMs;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        total: count,
      };
    }
    
    // Add current request
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiry on key (cleanup)
    await redis.expire(key, Math.ceil(windowMs / 1000));
    
    return {
      allowed: true,
      remaining: maxRequests - count - 1,
      resetTime: now + windowMs,
      total: count + 1,
    };
  } catch (error: any) {
    logger.error('Rate limit check failed', {
      key,
      error: error.message,
    });
    
    // Graceful degradation: allow request if Redis fails
    return {
      allowed: true,
      remaining: maxRequests,
      resetTime: Date.now() + windowMs,
      total: 0,
    };
  }
}

/**
 * API Key Rate Limiter Middleware
 * 
 * Enforces per-API-key rate limits using configured limits from the API key
 */
export const apiKeyRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Only apply to requests with API key authentication
    if (!req.apiKey) {
      return next();
    }
    
    const apiKeyId = req.apiKey.keyId;
    
    // Fetch API key to get rate limit configuration
    const apiKey = await ApiKey.findById(apiKeyId).select('rateLimit name workspaceId');
    
    if (!apiKey) {
      return next();
    }
    
    // Use per-key rate limit configuration
    const { maxRequests, windowMs } = apiKey.rateLimit;
    const redisKey = `ratelimit:apikey:${apiKeyId}`;
    
    // Check rate limit
    const result = await checkRateLimit(redisKey, maxRequests, windowMs);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.floor(result.resetTime / 1000));
    
    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      
      logger.warn('API key rate limit exceeded', {
        keyId: apiKeyId,
        keyName: apiKey.name,
        workspaceId: apiKey.workspaceId,
        path: req.path,
        method: req.method,
        limit: maxRequests,
        total: result.total,
      });
      
      publicApiMetricsTracker.incrementRateLimitHit();
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          limit: maxRequests,
          remaining: 0,
          resetAt: new Date(result.resetTime).toISOString(),
          retryAfter,
        },
      });
    }
    
    next();
  } catch (error: any) {
    logger.error('API key rate limit middleware error', {
      error: error.message,
      path: req.path,
    });
    
    // Graceful degradation: allow request on error
    next();
  }
};

/**
 * Workspace-level rate limiter for API keys
 * 
 * Provides secondary protection against abuse across multiple API keys
 * in the same workspace
 */
export const workspaceApiKeyRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Only apply to requests with API key authentication
    if (!req.apiKey) {
      return next();
    }
    
    const workspaceId = req.apiKey.workspaceId;
    
    // Workspace-level limit (aggregate across all keys)
    const maxRequests = config.apiKey.workspaceRateLimit;
    const windowMs = 60 * 60 * 1000; // 1 hour
    const redisKey = `ratelimit:workspace:apikeys:${workspaceId}`;
    
    // Check rate limit
    const result = await checkRateLimit(redisKey, maxRequests, windowMs);
    
    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      
      logger.warn('Workspace API key rate limit exceeded', {
        workspaceId,
        path: req.path,
        method: req.method,
        limit: maxRequests,
        total: result.total,
      });
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Workspace rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        code: 'WORKSPACE_RATE_LIMIT_EXCEEDED',
        details: {
          limit: maxRequests,
          remaining: 0,
          resetAt: new Date(result.resetTime).toISOString(),
          retryAfter,
        },
      });
    }
    
    next();
  } catch (error: any) {
    logger.error('Workspace API key rate limit middleware error', {
      error: error.message,
      path: req.path,
    });
    
    // Graceful degradation: allow request on error
    next();
  }
};

/**
 * Combined API key rate limiter
 * 
 * Applies both per-key and workspace-level limits
 */
export const combinedApiKeyRateLimit = [
  apiKeyRateLimit,
  workspaceApiKeyRateLimit,
];
