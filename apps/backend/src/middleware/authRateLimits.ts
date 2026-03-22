import { Request, Response } from 'express';
import { getRedisClient } from '../config/redis';
import { TooManyRequestsError } from '../utils/errors';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}

export class SlidingWindowRateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async checkLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    try {
      const redis = getRedisClient();
      if (!redis) {
        return { allowed: true, remaining: this.config.maxRequests, resetAt: new Date(Date.now() + this.config.windowMs) };
      }

      const key = `${this.config.keyPrefix}:${identifier}`;
      const now = Date.now();
      const windowStart = now - this.config.windowMs;

      await redis.zremrangebyscore(key, 0, windowStart);
      const count = await redis.zcard(key);

      if (count >= this.config.maxRequests) {
        const oldestTimestamp = await redis.zrange(key, 0, 0, 'WITHSCORES');
        const resetAt = oldestTimestamp.length > 1 
          ? new Date(parseInt(oldestTimestamp[1] as string) + this.config.windowMs)
          : new Date(now + this.config.windowMs);
        
        return { allowed: false, remaining: 0, resetAt };
      }

      await redis.zadd(key, now, `${now}-${Math.random()}`);
      await redis.expire(key, Math.ceil(this.config.windowMs / 1000));

      return {
        allowed: true,
        remaining: this.config.maxRequests - count - 1,
        resetAt: new Date(now + this.config.windowMs)
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return { allowed: true, remaining: this.config.maxRequests, resetAt: new Date(Date.now() + this.config.windowMs) };
    }
  }
}

export const loginRateLimit = new SlidingWindowRateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'rateLimit:login',
});

export const registerRateLimit = new SlidingWindowRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 60 * 1000,
  keyPrefix: 'rateLimit:register',
});

export const passwordResetRateLimit = new SlidingWindowRateLimiter({
  maxRequests: 3,
  windowMs: 60 * 60 * 1000,
  keyPrefix: 'rateLimit:passwordReset',
});

export const magicLinkRateLimit = new SlidingWindowRateLimiter({
  maxRequests: 5,
  windowMs: 60 * 60 * 1000,
  keyPrefix: 'rateLimit:magicLink',
});

export const twoFARateLimit = new SlidingWindowRateLimiter({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'rateLimit:twoFA',
});
