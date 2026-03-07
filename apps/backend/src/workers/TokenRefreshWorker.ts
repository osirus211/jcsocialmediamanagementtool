/**
 * Token Refresh Worker
 *
 * Automatically refreshes expiring OAuth tokens for social accounts
 * Phase 4: Real platform adapter integration with distributed locking
 * 
 * Features:
 * - Real platform API calls via adapters
 * - Distributed Redis locking to prevent concurrent refreshes
 * - Optimistic concurrency control for database updates
 * - Exponential backoff retry logic
 * - Platform-specific error classification
 * - Platform health check integration
 * - Comprehensive logging with token sanitization
 */

import { SocialAccount, ISocialAccount, AccountStatus } from '../models/SocialAccount';
import { logger } from '../utils/logger';
import { getRedisClient } from '../config/redis';
import { encrypt } from '../utils/encryption';
import { captureException, addBreadcrumb } from '../monitoring/sentry';
import { AdapterFactory } from '../adapters/platforms/AdapterFactory';
import { PlatformAdapter, SocialPlatform } from '../adapters/platforms/PlatformAdapter';
import { FacebookErrorHandler } from '../adapters/platforms/FacebookErrorHandler';
import { TwitterErrorHandler } from '../adapters/platforms/TwitterErrorHandler';
import { LinkedInErrorHandler } from '../adapters/platforms/LinkedInErrorHandler';
import { TikTokErrorHandler } from '../adapters/platforms/TikTokErrorHandler';
import { ErrorClassification } from '../adapters/platforms/FacebookErrorHandler';
import { PlatformHealthService } from '../services/PlatformHealthService';
import { circuitBreakerManager } from '../services/CircuitBreakerManager';
import { CircuitBreakerOpenError } from '../services/CircuitBreaker';
import crypto from 'crypto';

interface RefreshResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
  shouldRetry?: boolean;
  retryAfter?: number;
}

export class TokenRefreshWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  // Configuration constants
  private readonly POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly REFRESH_WINDOW = 15 * 60 * 1000; // 15 minutes (increased from 10 for safety)
  private readonly LOCK_TTL = 60; // 60 seconds (reduced from 120)
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly BACKOFF_DELAYS = [5000, 15000, 45000]; // 5s, 15s, 45s
  
  // Error handlers for each platform
  private readonly errorHandlers = {
    facebook: new FacebookErrorHandler(),
    instagram: new FacebookErrorHandler(), // Instagram uses Facebook errors
    twitter: new TwitterErrorHandler(),
    linkedin: new LinkedInErrorHandler(),
    tiktok: new TikTokErrorHandler(),
  };

  // Platform health service
  private readonly healthService = new PlatformHealthService();

  private metrics = {
    refresh_success_total: 0,
    refresh_failed_total: 0,
    refresh_retry_total: 0,
    refresh_skipped_total: 0,
  };

  start(): void {
    if (this.isRunning) {
      logger.warn('Token refresh worker already running');
      return;
    }

    getRedisClient(); // Ensure Redis available

    this.isRunning = true;

    // Setup global error handlers for worker
    this.setupErrorHandlers();

    // Run immediately
    this.poll();

    // Interval polling
    this.intervalId = setInterval(() => {
      this.poll();
    }, this.POLL_INTERVAL);

    console.log('🔄 Token Refresh Worker STARTED');
    logger.info('Token refresh worker started');
  }

  /**
   * Setup global error handlers for worker
   */
  private setupErrorHandlers(): void {
    // Capture unhandled errors in worker context
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled rejection in token refresh worker', { reason });
      
      captureException(reason instanceof Error ? reason : new Error(String(reason)), {
        level: 'error',
        tags: {
          worker: 'token-refresh',
          errorType: 'unhandledRejection',
        },
        extra: {
          workerStatus: this.getStatus(),
        },
      });
    });
  }

  stop(): void {
    if (!this.isRunning) return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Token refresh worker stopped');
  }

  /**
   * HEARTBEAT ADDED HERE
   */
  private async poll(): Promise<void> {
    try {
      console.log('🔄 TOKEN WORKER HEARTBEAT', new Date().toISOString());

      const accounts = await this.getAccountsNeedingRefresh();

      if (!accounts.length) return;

      for (const account of accounts) {
        await this.refreshAccountToken(account);
      }

    } catch (error: any) {
      logger.error('Token refresh poll error', error);
      
      // Capture poll-level errors to Sentry
      captureException(error, {
        level: 'error',
        tags: {
          worker: 'token-refresh',
          operation: 'poll',
        },
        extra: {
          workerStatus: this.getStatus(),
        },
      });
    }
  }

  private async getAccountsNeedingRefresh(): Promise<ISocialAccount[]> {
    const refreshThreshold = new Date(Date.now() + this.REFRESH_WINDOW);

    // Query accounts with status=ACTIVE and tokenExpiresAt < 15 minutes
    return SocialAccount.find({
      status: AccountStatus.ACTIVE,
      tokenExpiresAt: { $lt: refreshThreshold, $ne: null },
    })
      .select('+accessToken +refreshToken')
      .sort({ tokenExpiresAt: 1 })
      .limit(100);
  }

  private async refreshAccountToken(account: ISocialAccount): Promise<void> {
    const accountId = account._id.toString();
    
    logger.info('Starting token refresh', {
      accountId,
      provider: account.provider,
      expiresAt: account.tokenExpiresAt,
    });

    // Check platform health before attempting refresh
    const platformStatus = await this.healthService.getPlatformStatus(account.provider);
    
    if (platformStatus === 'degraded') {
      logger.info('Skipping refresh for degraded platform', { 
        accountId,
        provider: account.provider 
      });
      // Platform is degraded, skip refresh and retry later
      // The platform health service will automatically resume when recovered
      this.metrics.refresh_skipped_total++;
      return;
    }

    // Acquire distributed lock to prevent concurrent refreshes
    const lockKey = `refresh_lock:${accountId}`;
    const lockValue = crypto.randomBytes(16).toString('hex');
    
    const lockAcquired = await this.acquireLock(lockKey, lockValue);
    if (!lockAcquired) {
      logger.info('Token refresh already in progress by another worker', { 
        accountId,
        provider: account.provider 
      });
      this.metrics.refresh_skipped_total++;
      return;
    }

    logger.debug('Distributed lock acquired', { accountId, lockKey });

    try {
      const success = await this.attemptRefreshWithRetry(account);
      if (!success) {
        await this.markAccountExpired(accountId, 'Refresh failed after max retries');
      } else {
        logger.info('Token refreshed successfully', {
          accountId,
          provider: account.provider,
        });
      }
    } finally {
      // Always release lock using Lua script for safety
      await this.releaseLock(lockKey, lockValue);
      logger.debug('Distributed lock released', { accountId, lockKey });
    }
  }

  private async attemptRefreshWithRetry(account: ISocialAccount): Promise<boolean> {
    const accountId = account._id.toString();

    for (let attempt = 0; attempt < this.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        logger.debug('Token refresh attempt', {
          accountId,
          provider: account.provider,
          attempt: attempt + 1,
          maxAttempts: this.MAX_RETRY_ATTEMPTS,
        });

        const result = await this.performTokenRefresh(account);
        
        if (result.success) {
          // Update tokens with optimistic locking
          const updateSuccess = await this.updateTokensOptimistically(
            accountId,
            result.accessToken!,
            result.refreshToken,
            result.expiresAt!,
            account.__v // Mongoose version key for optimistic locking
          );

          if (!updateSuccess) {
            logger.warn('Token update conflict - another worker updated first', {
              accountId,
              provider: account.provider,
            });
            // Another worker already updated, consider this a success
            return true;
          }

          this.metrics.refresh_success_total++;
          return true;
        }

        // Handle non-retryable errors
        if (result.shouldRetry === false) {
          logger.info('Non-retryable error encountered', {
            accountId,
            provider: account.provider,
            error: result.error,
          });
          return false;
        }

        // Retry with exponential backoff
        if (attempt < this.MAX_RETRY_ATTEMPTS - 1) {
          const delay = this.BACKOFF_DELAYS[attempt];
          logger.info('Retrying token refresh after backoff', {
            accountId,
            provider: account.provider,
            attempt: attempt + 1,
            delayMs: delay,
          });
          this.metrics.refresh_retry_total++;
          await this.sleep(delay);
        }

      } catch (err: any) {
        logger.error('Token refresh attempt failed', {
          accountId,
          provider: account.provider,
          attempt: attempt + 1,
          error: err.message,
        });

        // Capture final failure to Sentry
        if (attempt === this.MAX_RETRY_ATTEMPTS - 1) {
          addBreadcrumb(
            'Token refresh failed after all retries',
            'worker',
            {
              accountId,
              provider: account.provider,
              attemptsMade: attempt + 1,
              maxRetries: this.MAX_RETRY_ATTEMPTS,
            }
          );

          captureException(err, {
            level: 'error',
            tags: {
              worker: 'token-refresh',
              operation: 'refresh',
              accountId,
              provider: account.provider,
              finalFailure: 'true',
            },
            extra: {
              attemptsMade: attempt + 1,
              maxRetries: this.MAX_RETRY_ATTEMPTS,
              accountStatus: account.status,
            },
          });
        }

        // Retry with exponential backoff
        if (attempt < this.MAX_RETRY_ATTEMPTS - 1) {
          const delay = this.BACKOFF_DELAYS[attempt];
          this.metrics.refresh_retry_total++;
          await this.sleep(delay);
        }
      }
    }

    this.metrics.refresh_failed_total++;
    return false;
  }

  private async performTokenRefresh(account: ISocialAccount): Promise<RefreshResult> {
    const refreshToken = account.getDecryptedRefreshToken();
    
    if (!refreshToken) {
      logger.warn('No refresh token available', {
        accountId: account._id.toString(),
        provider: account.provider,
      });
      return { 
        success: false, 
        error: 'No refresh token available',
        shouldRetry: false,
      };
    }

    // Get circuit breaker for this account
    const breaker = circuitBreakerManager.getBreaker(
      account.provider,
      account._id.toString()
    );

    try {
      // Execute with circuit breaker protection
      const newToken = await breaker.execute(async () => {
        // Get platform adapter
        const adapter = AdapterFactory.getAdapter(account.provider as SocialPlatform);
        
        logger.debug('Calling platform adapter for token refresh', {
          accountId: account._id.toString(),
          provider: account.provider,
        });

        // Call real platform API
        const token = await adapter.refreshAccessToken(refreshToken);
        
        // Record successful API call for platform health monitoring
        await this.healthService.recordApiCall(account.provider, true);
        
        return token;
      });
      
      logger.info('Platform token refresh successful', {
        accountId: account._id.toString(),
        provider: account.provider,
        expiresAt: newToken.expiresAt,
      });

      return {
        success: true,
        accessToken: newToken.accessToken,
        refreshToken: newToken.refreshToken || refreshToken, // Use new refresh token if provided
        expiresAt: newToken.expiresAt || new Date(Date.now() + 3600 * 1000), // Default 1 hour if not provided
      };

    } catch (error: any) {
      // Handle circuit breaker open error
      if (error instanceof CircuitBreakerOpenError) {
        logger.warn('Circuit breaker is open for account', {
          accountId: account._id.toString(),
          provider: account.provider,
          error: error.message,
        });
        
        return {
          success: false,
          error: 'Circuit breaker open',
          shouldRetry: false, // Don't retry immediately, wait for circuit to close
        };
      }

      // Record failed API call for platform health monitoring
      await this.healthService.recordApiCall(account.provider, false);

      logger.error('Platform token refresh failed', {
        accountId: account._id.toString(),
        provider: account.provider,
        error: error.message,
        statusCode: error.response?.status,
      });

      // Classify error using platform-specific error handler
      const classification = this.classifyError(error, account.provider as SocialPlatform);
      
      logger.debug('Error classified', {
        accountId: account._id.toString(),
        provider: account.provider,
        errorType: classification.type,
        action: classification.action,
      });

      // Handle permanent errors (invalid_grant, token_revoked)
      if (classification.type === 'permanent') {
        await this.markAccountReauthRequired(account._id.toString(), classification.message);
        return {
          success: false,
          error: classification.message,
          shouldRetry: false,
        };
      }

      // Handle rate limit errors
      if (classification.type === 'rate_limit') {
        logger.warn('Rate limit encountered during token refresh', {
          accountId: account._id.toString(),
          provider: account.provider,
          retryAfter: classification.retryAfter,
        });
        
        // TODO: Schedule retry after reset time (implement in Phase 5)
        // await this.scheduleRetry(account, classification.retryAfter * 1000);
        
        return {
          success: false,
          error: 'Rate limit exceeded',
          shouldRetry: false, // Don't retry immediately, wait for scheduled retry
          retryAfter: classification.retryAfter,
        };
      }

      // Transient errors - allow retry with exponential backoff
      return {
        success: false,
        error: classification.message,
        shouldRetry: true,
      };
    }
  }

  /**
   * Update account tokens with optimistic locking
   * Uses Mongoose __v field to prevent concurrent update conflicts
   * 
   * @returns true if update succeeded, false if version conflict (another worker updated first)
   */
  private async updateTokensOptimistically(
    accountId: string,
    accessToken: string,
    refreshToken: string | undefined,
    expiresAt: Date,
    expectedVersion: number
  ): Promise<boolean> {
    const encryptedAccessToken = encrypt(accessToken);
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : undefined;

    const update: any = {
      $set: {
        accessToken: encryptedAccessToken,
        tokenExpiresAt: expiresAt,
        lastRefreshedAt: new Date(),
        status: AccountStatus.ACTIVE,
        lastError: null, // Clear any previous errors
        lastErrorAt: null,
      },
      $inc: { __v: 1 }, // Increment version for optimistic locking
    };

    if (encryptedRefreshToken) {
      update.$set.refreshToken = encryptedRefreshToken;
    }

    // Query with version check - only update if version matches
    const result = await SocialAccount.findOneAndUpdate(
      {
        _id: accountId,
        __v: expectedVersion, // Optimistic locking check
      },
      update,
      { new: true }
    );

    if (!result) {
      // Version mismatch - another worker updated first
      logger.warn('Optimistic lock failed - version mismatch', {
        accountId,
        expectedVersion,
      });
      return false;
    }

    logger.debug('Token update successful with optimistic locking', {
      accountId,
      newVersion: result.__v,
      expiresAt,
    });

    return true;
  }

  /**
   * Mark account as requiring re-authentication
   */
  private async markAccountReauthRequired(accountId: string, reason: string): Promise<void> {
    await SocialAccount.findByIdAndUpdate(accountId, {
      status: AccountStatus.REAUTH_REQUIRED,
      lastError: reason,
      lastErrorAt: new Date(),
    });

    logger.warn('Account marked as reauth_required', {
      accountId,
      reason,
    });
  }

  private async markAccountExpired(accountId: string, reason: string) {
    await SocialAccount.findByIdAndUpdate(accountId, {
      status: AccountStatus.REFRESH_FAILED,
      lastError: reason,
      lastErrorAt: new Date(),
    });

    logger.warn('Account marked as refresh_failed', {
      accountId,
      reason,
    });
  }

  /**
   * Acquire distributed lock using Redis SET with NX and EX options
   * @param lockKey - Redis key for the lock
   * @param lockValue - Unique value to identify lock owner
   * @returns true if lock acquired, false if already held
   */
  private async acquireLock(lockKey: string, lockValue: string): Promise<boolean> {
    const redis = getRedisClient();
    const result = await redis.set(
      lockKey,
      lockValue,
      'EX',
      this.LOCK_TTL,
      'NX'
    );
    return result === 'OK';
  }

  /**
   * Release distributed lock using Lua script to verify ownership
   * Only deletes the lock if the value matches (prevents deleting another worker's lock)
   * @param lockKey - Redis key for the lock
   * @param lockValue - Unique value to verify lock ownership
   */
  private async releaseLock(lockKey: string, lockValue: string): Promise<void> {
    const redis = getRedisClient();
    
    // Lua script to atomically check value and delete if it matches
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    try {
      await redis.eval(luaScript, 1, lockKey, lockValue);
    } catch (error: any) {
      logger.error('Failed to release lock', {
        lockKey,
        error: error.message,
      });
    }
  }

  /**
   * Classify error using platform-specific error handler
   * @param error - Error object from platform API call
   * @param platform - Social platform name
   * @returns Error classification with type and recommended action
   */
  private classifyError(error: any, platform: SocialPlatform): ErrorClassification {
    const handler = this.errorHandlers[platform];
    
    if (!handler) {
      logger.warn('No error handler for platform, treating as transient', { platform });
      return {
        type: 'transient',
        action: 'retry',
        message: error.message || 'Unknown error',
      };
    }

    return handler.classify(error);
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      metrics: { ...this.metrics },
    };
  }

  async forcePoll(): Promise<void> {
    await this.poll();
  }
}