import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Global Rate Limit Manager
 * 
 * Tracks rate limits across all platforms and accounts
 * 
 * Features:
 * - Centralized rate limit tracking
 * - Per-account rate limits
 * - Per-platform rate limits
 * - Rate limit reset scheduling
 * - Rate limit warnings
 * - Redis-backed persistence
 * - Atomic publish budget enforcement (RFC-005)
 * 
 * Rate Limit Structure:
 * - account:{accountId}:ratelimit:{operation} -> { limit, remaining, resetAt }
 * - platform:{platform}:ratelimit:{operation} -> { limit, remaining, resetAt }
 * 
 * Publish Budget Structure (RFC-005):
 * - publish:budget:global -> ZSET (sliding window)
 * - publish:budget:workspace:{workspaceId} -> ZSET (sliding window)
 * - publish:budget:platform:{platform} -> ZSET (sliding window)
 * - publish:freeze:overload -> STRING (freeze flag)
 */

export interface RateLimitInfo {
  operation: string;
  limit: number;
  remaining: number;
  resetAt: Date;
  isLimited: boolean;
}

export interface RateLimitUpdate {
  operation: string;
  limit: number;
  remaining: number;
  resetAt: Date;
}

export interface PublishBudgetCheckParams {
  workspaceId: string;
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram';
  tier: 'free' | 'pro' | 'enterprise';
  correlationId: string;
  shouldIncrement: boolean;
}

export interface PublishBudgetResult {
  allowed: boolean;
  reason:
    | 'ADMITTED'
    | 'OVERLOAD_FREEZE'
    | 'GLOBAL_BUDGET'
    | 'WORKSPACE_BUDGET'
    | 'PLATFORM_BUDGET';
  retryAfterSeconds: number;
  budgetRemaining: {
    global: number;
    workspace: number;
    platform?: number;
  };
}

export class GlobalRateLimitManager {
  private static instance: GlobalRateLimitManager;
  private redis: ReturnType<typeof getRedisClient>;
  private publishBudgetLuaSha: string | null = null;
  private publishBudgetLuaScript: string | null = null;

  private constructor() {
    this.redis = getRedisClient();
    this.loadPublishBudgetLuaScript();
    logger.info('GlobalRateLimitManager initialized');
  }

  /**
   * Load publish budget Lua script at startup
   */
  private loadPublishBudgetLuaScript(): void {
    try {
      const scriptPath = path.join(__dirname, '../redis/lua/checkAndIncrementPublishBudget.lua');
      this.publishBudgetLuaScript = fs.readFileSync(scriptPath, 'utf8');
      
      // Load script into Redis and get SHA
      this.redis.script('LOAD', this.publishBudgetLuaScript).then((sha: string) => {
        this.publishBudgetLuaSha = sha;
        logger.info('Publish budget Lua script loaded', { sha });
      }).catch((error: any) => {
        logger.error('Failed to load publish budget Lua script', {
          error: error.message,
          stack: error.stack,
        });
      });
    } catch (error: any) {
      logger.error('Failed to read publish budget Lua script file', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GlobalRateLimitManager {
    if (!GlobalRateLimitManager.instance) {
      GlobalRateLimitManager.instance = new GlobalRateLimitManager();
    }
    return GlobalRateLimitManager.instance;
  }

  /**
   * Update account rate limit
   */
  async updateAccountRateLimit(
    accountId: string,
    platform: string,
    update: RateLimitUpdate
  ): Promise<void> {
    const key = `account:${accountId}:ratelimit:${update.operation}`;
    const data = {
      platform,
      operation: update.operation,
      limit: update.limit,
      remaining: update.remaining,
      resetAt: update.resetAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store with TTL = time until reset + 1 hour buffer
    const ttl = Math.max(
      Math.ceil((update.resetAt.getTime() - Date.now()) / 1000) + 3600,
      3600
    );

    await this.redis.setex(key, ttl, JSON.stringify(data));

    logger.debug('Account rate limit updated', {
      accountId,
      platform,
      operation: update.operation,
      remaining: update.remaining,
      limit: update.limit,
      resetAt: update.resetAt,
    });

    // Check if rate limited
    if (update.remaining === 0) {
      logger.warn('Account rate limited', {
        accountId,
        platform,
        operation: update.operation,
        resetAt: update.resetAt,
      });
    }
  }

  /**
   * Get account rate limit
   */
  async getAccountRateLimit(
    accountId: string,
    operation: string
  ): Promise<RateLimitInfo | null> {
    const key = `account:${accountId}:ratelimit:${operation}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    const parsed = JSON.parse(data);
    const resetAt = new Date(parsed.resetAt);
    const now = new Date();

    // If reset time has passed, rate limit is no longer active
    if (resetAt <= now) {
      await this.redis.del(key);
      return null;
    }

    return {
      operation: parsed.operation,
      limit: parsed.limit,
      remaining: parsed.remaining,
      resetAt,
      isLimited: parsed.remaining === 0,
    };
  }

  /**
   * Check if account is rate limited
   */
  async isAccountRateLimited(accountId: string, operation: string): Promise<boolean> {
    const rateLimit = await this.getAccountRateLimit(accountId, operation);
    return rateLimit?.isLimited || false;
  }

  /**
   * Get all rate limits for account
   */
  async getAccountRateLimits(accountId: string): Promise<RateLimitInfo[]> {
    const pattern = `account:${accountId}:ratelimit:*`;
    const keys = await this.redis.keys(pattern);

    const rateLimits: RateLimitInfo[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        const resetAt = new Date(parsed.resetAt);
        const now = new Date();

        // Skip expired rate limits
        if (resetAt <= now) {
          await this.redis.del(key);
          continue;
        }

        rateLimits.push({
          operation: parsed.operation,
          limit: parsed.limit,
          remaining: parsed.remaining,
          resetAt,
          isLimited: parsed.remaining === 0,
        });
      }
    }

    return rateLimits;
  }

  /**
   * Update platform-wide rate limit
   * 
   * Used for platform-level rate limits (e.g., Twitter app-level limits)
   */
  async updatePlatformRateLimit(
    platform: string,
    update: RateLimitUpdate
  ): Promise<void> {
    const key = `platform:${platform}:ratelimit:${update.operation}`;
    const data = {
      platform,
      operation: update.operation,
      limit: update.limit,
      remaining: update.remaining,
      resetAt: update.resetAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const ttl = Math.max(
      Math.ceil((update.resetAt.getTime() - Date.now()) / 1000) + 3600,
      3600
    );

    await this.redis.setex(key, ttl, JSON.stringify(data));

    logger.debug('Platform rate limit updated', {
      platform,
      operation: update.operation,
      remaining: update.remaining,
      limit: update.limit,
      resetAt: update.resetAt,
    });

    if (update.remaining === 0) {
      logger.warn('Platform rate limited', {
        platform,
        operation: update.operation,
        resetAt: update.resetAt,
      });
    }
  }

  /**
   * Get platform rate limit
   */
  async getPlatformRateLimit(
    platform: string,
    operation: string
  ): Promise<RateLimitInfo | null> {
    const key = `platform:${platform}:ratelimit:${operation}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    const parsed = JSON.parse(data);
    const resetAt = new Date(parsed.resetAt);
    const now = new Date();

    if (resetAt <= now) {
      await this.redis.del(key);
      return null;
    }

    return {
      operation: parsed.operation,
      limit: parsed.limit,
      remaining: parsed.remaining,
      resetAt,
      isLimited: parsed.remaining === 0,
    };
  }

  /**
   * Check if platform is rate limited
   */
  async isPlatformRateLimited(platform: string, operation: string): Promise<boolean> {
    const rateLimit = await this.getPlatformRateLimit(platform, operation);
    return rateLimit?.isLimited || false;
  }

  /**
   * Clear account rate limits
   */
  async clearAccountRateLimits(accountId: string): Promise<void> {
    const pattern = `account:${accountId}:ratelimit:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
      logger.info('Account rate limits cleared', {
        accountId,
        count: keys.length,
      });
    }
  }

  /**
   * Clear platform rate limits
   */
  async clearPlatformRateLimits(platform: string): Promise<void> {
    const pattern = `platform:${platform}:ratelimit:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
      logger.info('Platform rate limits cleared', {
        platform,
        count: keys.length,
      });
    }
  }

  /**
   * Get rate limit statistics
   */
  async getStats(): Promise<any> {
    const accountPattern = 'account:*:ratelimit:*';
    const platformPattern = 'platform:*:ratelimit:*';

    const [accountKeys, platformKeys] = await Promise.all([
      this.redis.keys(accountPattern),
      this.redis.keys(platformPattern),
    ]);

    let accountsLimited = 0;
    let platformsLimited = 0;

    // Count limited accounts
    for (const key of accountKeys) {
      const data = await this.redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.remaining === 0) {
          accountsLimited++;
        }
      }
    }

    // Count limited platforms
    for (const key of platformKeys) {
      const data = await this.redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.remaining === 0) {
          platformsLimited++;
        }
      }
    }

    return {
      totalAccountRateLimits: accountKeys.length,
      accountsLimited,
      totalPlatformRateLimits: platformKeys.length,
      platformsLimited,
    };
  }

  /**
   * Check publish budget atomically (RFC-005)
   * 
   * Uses Redis Lua script for atomic sliding window budget enforcement
   * 
   * @param params - Budget check parameters
   * @returns Budget check result with admission decision
   */
  async checkPublishBudget(params: PublishBudgetCheckParams): Promise<PublishBudgetResult> {
    // Resolve tier limits
    const tierLimits = {
      free: 10,
      pro: 50,
      enterprise: 200,
    };
    
    try {
      const workspaceLimit = tierLimits[params.tier];
      
      // Resolve platform limits (disabled by default)
      const platformLimitsEnabled = false;
      const platformLimit = platformLimitsEnabled ? 300 : 0;
      const platformWindow = platformLimitsEnabled ? 60000 : 0;
      
      // Construct Redis keys
      const globalKey = 'publish:budget:global';
      const workspaceKey = `publish:budget:workspace:${params.workspaceId}`;
      const platformKey = platformLimitsEnabled ? `publish:budget:platform:${params.platform}` : '';
      const freezeKey = 'publish:freeze:overload';
      
      // Generate member ID
      const currentTs = Date.now();
      const memberId = `${currentTs}:${params.correlationId}`;
      
      // Prepare Lua script arguments
      const keys = [globalKey, workspaceKey, platformKey, freezeKey];
      const args = [
        currentTs.toString(),
        '60000', // global_window_ms
        '1000', // global_limit
        workspaceLimit.toString(),
        platformLimit.toString(),
        memberId,
        params.shouldIncrement ? '1' : '0',
        platformWindow.toString(),
      ];
      
      // Execute Lua script via EVALSHA (with fallback to EVAL)
      let result: number[];
      try {
        if (this.publishBudgetLuaSha) {
          result = await this.redis.evalsha(this.publishBudgetLuaSha, keys.length, ...keys, ...args) as number[];
        } else {
          throw new Error('Lua script SHA not loaded');
        }
      } catch (error: any) {
        // Fallback to EVAL if EVALSHA fails (NOSCRIPT case)
        if (error.message.includes('NOSCRIPT') || !this.publishBudgetLuaSha) {
          if (!this.publishBudgetLuaScript) {
            throw new Error('Lua script not available');
          }
          
          logger.warn('EVALSHA failed, falling back to EVAL', {
            error: error.message,
          });
          
          result = await this.redis.eval(this.publishBudgetLuaScript, keys.length, ...keys, ...args) as number[];
          
          // Reload SHA for next time
          this.loadPublishBudgetLuaScript();
        } else {
          throw error;
        }
      }
      
      // Parse numeric return array
      const [allowed, reasonCode, retryAfter, globalCount, workspaceCount, platformCount] = result;
      
      // Map reason code to string
      const reasonMap: Record<number, PublishBudgetResult['reason']> = {
        1: 'ADMITTED',
        2: 'OVERLOAD_FREEZE',
        3: 'GLOBAL_BUDGET',
        4: 'WORKSPACE_BUDGET',
        5: 'PLATFORM_BUDGET',
      };
      const reason = reasonMap[reasonCode] || 'ADMITTED';
      
      // Track global budget exhaustion
      if (reason === 'GLOBAL_BUDGET') {
        const exhaustionKey = `publish:budget:global:exhausted:${Math.floor(currentTs / 60000)}`;
        await this.redis.setex(exhaustionKey, 120, '1').catch((err) => {
          logger.error('Failed to track global budget exhaustion', { error: err.message });
        });
      }
      
      // Calculate remaining budget
      const globalRemaining = Math.max(0, 1000 - globalCount);
      const workspaceRemaining = Math.max(0, workspaceLimit - workspaceCount);
      const platformRemaining = platformLimitsEnabled ? Math.max(0, platformLimit - platformCount) : undefined;
      
      const budgetResult: PublishBudgetResult = {
        allowed: allowed === 1,
        reason,
        retryAfterSeconds: retryAfter,
        budgetRemaining: {
          global: globalRemaining,
          workspace: workspaceRemaining,
          platform: platformRemaining,
        },
      };
      
      logger.debug('Publish budget check complete', {
        workspaceId: params.workspaceId,
        tier: params.tier,
        platform: params.platform,
        allowed: budgetResult.allowed,
        reason: budgetResult.reason,
        retryAfter: budgetResult.retryAfterSeconds,
        budgetRemaining: budgetResult.budgetRemaining,
      });
      
      return budgetResult;
    } catch (error: any) {
      // Fail-open on Redis errors
      logger.error('Publish budget check failed, failing open', {
        error: error.message,
        stack: error.stack,
        workspaceId: params.workspaceId,
        tier: params.tier,
      });
      
      return {
        allowed: true,
        reason: 'ADMITTED',
        retryAfterSeconds: 0,
        budgetRemaining: {
          global: 1000,
          workspace: tierLimits[params.tier] || 50,
        },
      };
    }
  }

  /**
   * Increment publish counters atomically
   * 
   * This is a convenience method that calls checkPublishBudget with shouldIncrement=true
   * 
   * @param params - Budget check parameters (without shouldIncrement)
   * @returns Budget check result
   */
  async incrementPublishCounters(
    params: Omit<PublishBudgetCheckParams, 'shouldIncrement'>
  ): Promise<PublishBudgetResult> {
    return this.checkPublishBudget({
      ...params,
      shouldIncrement: true,
    });
  }
}

// Export singleton instance
export const globalRateLimitManager = GlobalRateLimitManager.getInstance();
