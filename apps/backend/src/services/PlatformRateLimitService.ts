/**
 * Platform Rate Limit Service
 * 
 * Handles platform-specific rate limits with intelligent retry scheduling
 * and app-level quota tracking to prevent exhausting platform limits.
 * 
 * Features:
 * - App-level quota tracking per platform
 * - Platform-specific rate limit header parsing
 * - Per-account rate limit event storage
 * - Quota warning at 80% threshold
 * - Rate limit info retrieval
 */

import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { AxiosError } from 'axios';
import { EventEmitter } from 'events';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  total?: number;
  resetAt?: Date;
  message?: string;
}

export interface RateLimitInfo {
  resetAt: Date;
  retryAfter: number; // seconds
  quotaUsed?: number;
  quotaLimit?: number;
}

interface QuotaInfo {
  used: number;
  limit: number;
}

export class PlatformRateLimitService {
  private redis = getRedisClient();
  private eventEmitter = new EventEmitter();

  // App-level rate limits (per platform app, not per account)
  private readonly APP_LEVEL_LIMITS = {
    twitter: { requests: 500, window: 15 * 60 }, // 500 requests per 15 minutes
    facebook: { requests: 200, window: 60 * 60 }, // 200 requests per hour
    instagram: { requests: 200, window: 60 * 60 }, // 200 requests per hour (same as Facebook)
    linkedin: { requests: 100, window: 24 * 60 * 60 }, // 100 requests per day
    tiktok: { requests: 1000, window: 24 * 60 * 60 }, // 1000 requests per day
  };

  /**
   * Check if app-level quota allows the request
   * Increments counter if allowed
   * Emits warning at 80% threshold
   */
  async checkAppLevelQuota(platform: string): Promise<QuotaCheckResult> {
    const limit = this.APP_LEVEL_LIMITS[platform as keyof typeof this.APP_LEVEL_LIMITS];
    
    if (!limit) {
      logger.warn('No app-level limit defined for platform', { platform });
      return { allowed: true, remaining: Infinity };
    }

    const key = `app_quota:${platform}`;
    const currentStr = await this.redis.get(key);
    const currentCount = currentStr ? parseInt(currentStr) : 0;

    // Check if limit reached
    if (currentCount >= limit.requests) {
      const ttl = await this.redis.ttl(key);
      const resetAt = new Date(Date.now() + ttl * 1000);

      logger.warn('App-level rate limit reached', {
        platform,
        current: currentCount,
        limit: limit.requests,
        resetIn: ttl,
      });

      return {
        allowed: false,
        remaining: 0,
        total: limit.requests,
        resetAt,
        message: `App-level rate limit reached for ${platform}. Resets in ${ttl} seconds.`,
      };
    }

    // Increment counter
    const newCount = await this.redis.incr(key);

    // Set expiry on first increment
    if (newCount === 1) {
      await this.redis.expire(key, limit.window);
    }

    const remaining = limit.requests - newCount;

    // Emit warning at 80% threshold
    const percentageUsed = newCount / limit.requests;
    if (percentageUsed >= 0.8) {
      this.emitQuotaWarning(platform, newCount, limit.requests);
    }

    logger.debug('App-level quota check passed', {
      platform,
      used: newCount,
      remaining,
      total: limit.requests,
    });

    return {
      allowed: true,
      remaining,
      total: limit.requests,
    };
  }

  /**
   * Handle rate limit error from platform API
   * Extracts reset time and quota info from headers
   * Stores rate limit event in Redis
   */
  async handleRateLimit(
    platform: string,
    accountId: string,
    error: AxiosError
  ): Promise<RateLimitInfo> {
    const resetTime = this.extractResetTime(platform, error);
    const quotaInfo = this.extractQuotaInfo(platform, error);

    // Store account-level rate limit event
    const key = `rate_limit:${platform}:${accountId}`;
    const ttl = Math.ceil((resetTime.getTime() - Date.now()) / 1000);

    await this.redis.setex(
      key,
      Math.max(ttl, 1), // Ensure TTL is at least 1 second
      JSON.stringify({
        timestamp: new Date().toISOString(),
        resetAt: resetTime.toISOString(),
        quotaUsed: quotaInfo.used,
        quotaLimit: quotaInfo.limit,
      })
    );

    logger.warn('Rate limit event stored', {
      platform,
      accountId,
      resetAt: resetTime,
      ttl,
      quotaUsed: quotaInfo.used,
      quotaLimit: quotaInfo.limit,
    });

    // Emit warning if quota > 80%
    if (quotaInfo.limit > 0 && quotaInfo.used / quotaInfo.limit > 0.8) {
      this.emitRateLimitWarning(platform, accountId, quotaInfo);
    }

    return {
      resetAt: resetTime,
      retryAfter: Math.max(ttl, 1),
      quotaUsed: quotaInfo.used,
      quotaLimit: quotaInfo.limit,
    };
  }

  /**
   * Extract reset time from platform-specific headers
   * Returns future timestamp when rate limit resets
   */
  private extractResetTime(platform: string, error: AxiosError): Date {
    const headers = error.response?.headers;

    if (!headers) {
      logger.debug('No headers in error response, using default reset time', { platform });
      return new Date(Date.now() + 15 * 60 * 1000); // Default: 15 minutes
    }

    switch (platform) {
      case 'facebook':
      case 'instagram':
        // Facebook uses X-Business-Use-Case-Usage header
        // Format: [{"type":"pages","call_count":10,"total_cputime":5,"total_time":10,"estimated_time_to_regain_access":0}]
        const usage = headers['x-business-use-case-usage'];
        if (usage) {
          try {
            const parsed = JSON.parse(usage);
            const estimatedTime = parsed[0]?.estimated_time_to_regain_access || 0;
            if (estimatedTime > 0) {
              return new Date(Date.now() + estimatedTime * 60 * 1000); // Convert minutes to ms
            }
          } catch (e) {
            logger.warn('Failed to parse Facebook rate limit header', { usage });
          }
        }
        // Default: 1 hour for Facebook/Instagram
        return new Date(Date.now() + 60 * 60 * 1000);

      case 'twitter':
        // Twitter uses x-rate-limit-reset header (Unix timestamp)
        const twitterReset = headers['x-rate-limit-reset'];
        if (twitterReset) {
          const timestamp = parseInt(twitterReset);
          if (!isNaN(timestamp)) {
            return new Date(timestamp * 1000);
          }
        }
        break;

      case 'linkedin':
        // LinkedIn uses x-ratelimit-reset header (Unix timestamp)
        const linkedinReset = headers['x-ratelimit-reset'];
        if (linkedinReset) {
          const timestamp = parseInt(linkedinReset);
          if (!isNaN(timestamp)) {
            return new Date(timestamp * 1000);
          }
        }
        break;

      case 'tiktok':
        // TikTok uses x-ratelimit-reset header (Unix timestamp)
        const tiktokReset = headers['x-ratelimit-reset'];
        if (tiktokReset) {
          const timestamp = parseInt(tiktokReset);
          if (!isNaN(timestamp)) {
            return new Date(timestamp * 1000);
          }
        }
        break;
    }

    // Default: retry in 15 minutes
    logger.debug('Could not extract reset time from headers, using default', { platform });
    return new Date(Date.now() + 15 * 60 * 1000);
  }

  /**
   * Extract quota information from platform-specific headers
   */
  private extractQuotaInfo(platform: string, error: AxiosError): QuotaInfo {
    const headers = error.response?.headers;

    if (!headers) {
      return { used: 0, limit: 0 };
    }

    switch (platform) {
      case 'facebook':
      case 'instagram':
        const usage = headers['x-business-use-case-usage'];
        if (usage) {
          try {
            const parsed = JSON.parse(usage);
            return {
              used: parsed[0]?.call_count || 0,
              limit: parsed[0]?.total_time || 100, // Facebook uses percentage
            };
          } catch (e) {
            logger.warn('Failed to parse Facebook quota info', { usage });
          }
        }
        break;

      case 'twitter':
        const twitterLimit = headers['x-rate-limit-limit'];
        const twitterRemaining = headers['x-rate-limit-remaining'];
        if (twitterLimit && twitterRemaining) {
          const limit = parseInt(twitterLimit);
          const remaining = parseInt(twitterRemaining);
          return {
            used: limit - remaining,
            limit,
          };
        }
        break;

      case 'linkedin':
        const linkedinLimit = headers['x-ratelimit-limit'];
        const linkedinRemaining = headers['x-ratelimit-remaining'];
        if (linkedinLimit && linkedinRemaining) {
          const limit = parseInt(linkedinLimit);
          const remaining = parseInt(linkedinRemaining);
          return {
            used: limit - remaining,
            limit,
          };
        }
        break;

      case 'tiktok':
        const tiktokLimit = headers['x-ratelimit-limit'];
        const tiktokRemaining = headers['x-ratelimit-remaining'];
        if (tiktokLimit && tiktokRemaining) {
          const limit = parseInt(tiktokLimit);
          const remaining = parseInt(tiktokRemaining);
          return {
            used: limit - remaining,
            limit,
          };
        }
        break;
    }

    return { used: 0, limit: 0 };
  }

  /**
   * Check if account is currently rate limited
   */
  async isRateLimited(platform: string, accountId: string): Promise<boolean> {
    const key = `rate_limit:${platform}:${accountId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Get rate limit info for account
   */
  async getRateLimitInfo(platform: string, accountId: string): Promise<RateLimitInfo | null> {
    const key = `rate_limit:${platform}:${accountId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    try {
      const parsed = JSON.parse(data);
      return {
        resetAt: new Date(parsed.resetAt),
        retryAfter: Math.ceil((new Date(parsed.resetAt).getTime() - Date.now()) / 1000),
        quotaUsed: parsed.quotaUsed,
        quotaLimit: parsed.quotaLimit,
      };
    } catch (e) {
      logger.error('Failed to parse rate limit info', { key, data });
      return null;
    }
  }

  /**
   * Emit quota warning event
   */
  private emitQuotaWarning(platform: string, used: number, limit: number): void {
    const percentageUsed = (used / limit) * 100;

    logger.warn('App-level quota warning', {
      platform,
      quotaUsed: used,
      quotaLimit: limit,
      percentageUsed: percentageUsed.toFixed(2),
    });

    this.eventEmitter.emit('app_quota_warning', {
      platform,
      quotaUsed: used,
      quotaLimit: limit,
      percentageUsed,
      timestamp: new Date(),
    });
  }

  /**
   * Emit rate limit warning event
   */
  private emitRateLimitWarning(platform: string, accountId: string, quotaInfo: QuotaInfo): void {
    const percentageUsed = (quotaInfo.used / quotaInfo.limit) * 100;

    logger.warn('Rate limit quota warning', {
      platform,
      accountId,
      quotaUsed: quotaInfo.used,
      quotaLimit: quotaInfo.limit,
      percentageUsed: percentageUsed.toFixed(2),
    });

    this.eventEmitter.emit('rate_limit_warning', {
      platform,
      accountId,
      quotaUsed: quotaInfo.used,
      quotaLimit: quotaInfo.limit,
      percentageUsed,
      timestamp: new Date(),
    });
  }

  /**
   * Subscribe to quota warning events
   */
  on(event: 'app_quota_warning' | 'rate_limit_warning', listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }
}
