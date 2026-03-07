/**
 * Advanced Rate Limiting Middleware
 * 
 * Implements per-user, per-workspace rate limiting using Redis sliding window
 * Protects against API abuse, brute force, and spam
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { Billing, BillingPlan } from '../models/Billing';
import { logger } from '../utils/logger';

/**
 * Rate limit error class
 */
export class RateLimitError extends Error {
  statusCode: number;
  code: string;
  retryAfter: number;

  constructor(message: string, retryAfter: number = 60) {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = 429;
    this.code = 'RATE_LIMIT_EXCEEDED';
    this.retryAfter = retryAfter;
  }
}

/**
 * Sliding window rate limiter using Redis
 * 
 * @param key - Redis key for rate limit tracking
 * @param limit - Maximum requests allowed
 * @param windowSeconds - Time window in seconds
 * @returns true if allowed, false if rate limited
 */
async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; current: number; resetAt: number }> {
  try {
    const redis = getRedisClient();
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // Remove old entries outside the window
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count requests in current window
    const current = await redis.zcard(key);

    if (current >= limit) {
      // Get oldest entry to calculate reset time
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetAt = oldest.length > 0 
        ? parseInt(oldest[1]) + windowSeconds * 1000 
        : now + windowSeconds * 1000;

      return { allowed: false, current, resetAt };
    }

    // Add current request
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    await redis.expire(key, windowSeconds);

    return { allowed: true, current: current + 1, resetAt: now + windowSeconds * 1000 };
  } catch (error) {
    logger.error('Rate limit check failed:', error);
    // Fail open - allow request if Redis is down
    return { allowed: true, current: 0, resetAt: Date.now() + windowSeconds * 1000 };
  }
}

/**
 * Global API rate limiter per user and workspace
 * 
 * Limits:
 * - Free plan: 100 req/min
 * - Paid plans: 300 req/min
 */
export const globalApiRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip for health checks
    if (req.path.startsWith('/health')) {
      return next();
    }

    // Require authentication
    if (!req.user || !req.user.userId) {
      return next();
    }

    const userId = req.user.userId;
    const workspaceId = req.headers['x-workspace-id'] as string;

    if (!workspaceId) {
      return next();
    }

    // Get workspace billing plan
    const billing = await Billing.findOne({ workspaceId });
    const plan = billing?.plan || BillingPlan.FREE;

    // Determine rate limit based on plan
    const limit = plan === BillingPlan.FREE ? 100 : 300;
    const windowSeconds = 60; // 1 minute

    // Check rate limit
    const key = `ratelimit:${workspaceId}:${userId}`;
    const result = await checkRateLimit(key, limit, windowSeconds);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - result.current));
    res.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt / 1000));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      logger.warn('Rate limit exceeded', {
        userId,
        workspaceId,
        plan,
        limit,
        current: result.current,
      });

      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter,
        limit,
        plan,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Global rate limiter error:', error);
    // Fail open - allow request on error
    next();
  }
};

/**
 * Auth route rate limiter
 * 
 * Stricter limits to prevent brute force:
 * - /auth/login: 5 req/min per IP
 * - /auth/register: 3 req/min per IP
 */
export const authRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ip = req.ip || 'unknown';
    const path = req.path;

    // Determine limit based on endpoint
    let limit: number;
    let windowSeconds: number;

    if (path.includes('/login')) {
      limit = 5;
      windowSeconds = 60; // 1 minute
    } else if (path.includes('/register')) {
      limit = 3;
      windowSeconds = 60; // 1 minute
    } else {
      // Other auth routes
      limit = 10;
      windowSeconds = 60;
    }

    // Check rate limit
    const key = `auth:ratelimit:${ip}:${path}`;
    const result = await checkRateLimit(key, limit, windowSeconds);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - result.current));
    res.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt / 1000));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      logger.warn('Auth rate limit exceeded', {
        ip,
        path,
        limit,
        current: result.current,
      });

      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Auth rate limiter error:', error);
    // Fail open - allow request on error
    next();
  }
};

/**
 * Post creation spam protection
 * 
 * Prevents mass post creation:
 * - Max 20 posts per minute per workspace
 * - Throws RateLimitError (no queue entry created)
 */
export const postSpamProtection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;

    if (!workspaceId) {
      return next();
    }

    const limit = 20;
    const windowSeconds = 60; // 1 minute

    // Check rate limit
    const key = `post:spam:${workspaceId}`;
    const result = await checkRateLimit(key, limit, windowSeconds);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

      logger.warn('Post spam protection triggered', {
        workspaceId,
        limit,
        current: result.current,
      });

      throw new RateLimitError(
        'Too many posts created. Please slow down.',
        retryAfter
      );
    }

    next();
  } catch (error) {
    if (error instanceof RateLimitError) {
      res.status(error.statusCode).json({
        error: error.code,
        message: error.message,
        retryAfter: error.retryAfter,
      });
      return;
    }

    logger.error('Post spam protection error:', error);
    // Fail open - allow request on error
    next();
  }
};

/**
 * AI request rate limiter
 * 
 * Prevents AI API abuse:
 * - Max 30 requests per minute per workspace
 */
export const aiRequestLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;

    if (!workspaceId) {
      return next();
    }

    const limit = 30;
    const windowSeconds = 60; // 1 minute

    // Check rate limit
    const key = `ai:ratelimit:${workspaceId}`;
    const result = await checkRateLimit(key, limit, windowSeconds);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - result.current));
    res.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt / 1000));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      logger.warn('AI rate limit exceeded', {
        workspaceId,
        limit,
        current: result.current,
      });

      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many AI requests. Please try again later.',
        retryAfter,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('AI rate limiter error:', error);
    // Fail open - allow request on error
    next();
  }
};
