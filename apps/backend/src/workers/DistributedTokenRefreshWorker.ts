/**
 * Distributed Token Refresh Worker
 * 
 * BullMQ worker for processing token refresh jobs
 * Phase 1: Minimal production-safe implementation
 * 
 * Features:
 * - Step 1: Basic worker with concurrency
 * - Step 2: Distributed lock (Redis SETNX)
 * - Step 3: Retry + DLQ (configured in queue)
 */

import { Worker, Job } from 'bullmq';
import { SocialAccount, ISocialAccount, AccountStatus, SocialPlatform } from '../models/SocialAccount';
import { TOKEN_REFRESH_QUEUE_NAME, TokenRefreshJobData } from '../queue/TokenRefreshQueue';
import { QueueManager } from '../queue/QueueManager';
import { getRedisClientSafe } from '../config/redis';
import { logger } from '../utils/logger';
import { encrypt } from '../utils/encryption';
import { circuitBreakerService } from '../services/CircuitBreakerService';
import { RateLimiterService } from '../services/RateLimiterService';
import { facebookTokenRefreshWorker } from './FacebookTokenRefreshWorker';
import { instagramTokenRefreshService } from '../services/oauth/InstagramTokenRefreshService';
import { TwitterOAuthService } from '../services/oauth/TwitterOAuthService';
import { TikTokOAuthService } from '../services/oauth/TikTokOAuthService';
import { LinkedInOAuthService } from '../services/oauth/LinkedInOAuthService';
import { config } from '../config';

export class DistributedTokenRefreshWorker {
  private worker: Worker | null = null;
  private isRunning: boolean = false;
  private rateLimiterService: RateLimiterService;

  private readonly CONCURRENCY = 5;
  private readonly LOCK_TTL = 120; // 120 seconds

  // Platform-specific services
  private twitterService: TwitterOAuthService;
  private tiktokService: TikTokOAuthService;
  private linkedinService: LinkedInOAuthService;

  // Metrics
  private metrics = {
    refresh_success_total: 0,
    refresh_failure_total: 0,
    circuit_open_total: 0,
    circuit_blocked_total: 0,
    rate_limit_blocked_total: 0,
    refresh_attempt_total: 0,
    refresh_skipped_total: 0,
    refresh_retry_total: 0,
  };

  constructor() {
    this.rateLimiterService = new RateLimiterService({} as any);
    
    // Initialize platform-specific services
    this.twitterService = new TwitterOAuthService(
      config.oauth?.twitter?.clientId || '',
      config.oauth?.twitter?.clientSecret || '',
      (config.oauth?.twitter as any)?.callbackUrl || `${config.apiUrl}/api/v1/oauth/twitter/callback`
    );

    this.tiktokService = new TikTokOAuthService(
      config.oauth?.tiktok?.clientKey || '',
      config.oauth?.tiktok?.clientSecret || '',
      (config.oauth?.tiktok as any)?.callbackUrl || `${config.apiUrl}/api/v1/oauth/tiktok/callback`
    );

    this.linkedinService = new LinkedInOAuthService(
      config.oauth?.linkedin?.clientId || '',
      config.oauth?.linkedin?.clientSecret || '',
      (config.oauth?.linkedin as any)?.callbackUrl || `${config.apiUrl}/api/v1/oauth/linkedin/callback`
    );
  }

  /**
   * Start worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Distributed token refresh worker already running');
      return;
    }

    const queueManager = QueueManager.getInstance();

    this.worker = queueManager.createWorker(
      TOKEN_REFRESH_QUEUE_NAME,
      this.processJob.bind(this),
      {
        concurrency: this.CONCURRENCY,
      }
    );

    // STEP 3: Handle failed jobs (max retries exceeded)
    this.worker.on('failed', async (job, error) => {
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        logger.error('Token refresh job exhausted all retries', {
          connectionId: job.data.connectionId,
          provider: job.data.provider,
          correlationId: job.data.correlationId,
          attempts: job.attemptsMade,
          error: error.message,
        });

        // Move to DLQ
        const { tokenRefreshDLQ } = await import('../queue/TokenRefreshDLQ');
        await tokenRefreshDLQ.moveToDeadLetter(job, error);
      }
    });

    this.isRunning = true;

    logger.info('Distributed token refresh worker started', {
      concurrency: this.CONCURRENCY,
      lockTTL: this.LOCK_TTL,
    });
  }

  /**
   * Stop worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.worker) return;

    await this.worker.close();
    this.worker = null;
    this.isRunning = false;

    logger.info('Distributed token refresh worker stopped');
  }

  /**
   * Process refresh job
   */
  private async processJob(job: Job<TokenRefreshJobData>): Promise<void> {
    const { connectionId, provider, correlationId } = job.data;
    const startTime = Date.now();

    this.metrics.refresh_attempt_total++;

    logger.info('Processing token refresh job', {
      connectionId,
      provider,
      correlationId,
      jobId: job.id,
    });

    try {
      // PHASE 1B: Check circuit breaker
      const circuitCheck = await circuitBreakerService.checkCircuit(provider);
      
      if (circuitCheck === 'block') {
        this.metrics.circuit_blocked_total++;
        this.metrics.refresh_skipped_total++;
        
        logger.warn('Refresh skipped - circuit breaker OPEN', {
          connectionId,
          provider,
          correlationId,
        });
        
        // Re-enqueue with delay (60 seconds)
        await job.moveToDelayed(Date.now() + 60000, job.token);
        return;
      }

      // PHASE 1B: Check rate limit
      const rateLimitCheck = await (this.rateLimiterService as any).checkRateLimit(provider);
      
      if (!rateLimitCheck.allowed) {
        this.metrics.rate_limit_blocked_total++;
        this.metrics.refresh_skipped_total++;
        
        logger.warn('Refresh delayed - rate limit exceeded', {
          connectionId,
          provider,
          correlationId,
          retryAfter: rateLimitCheck.retryAfter,
        });
        
        // Re-enqueue with delay
        const delayMs = (rateLimitCheck.retryAfter || 60) * 1000;
        await job.moveToDelayed(Date.now() + delayMs, job.token);
        return;
      }

      // STEP 2: Acquire distributed lock
      const lockAcquired = await this.acquireLock(connectionId);

      if (!lockAcquired) {
        logger.info('Lock held by another worker, skipping job', {
          connectionId,
          provider,
          correlationId,
        });
        return; // Skip job safely
      }

      try {
        // STEP 1: Fetch connection
        const account = await this.fetchConnection(connectionId);

        if (!account) {
          logger.error('Connection not found', {
            connectionId,
            provider,
            correlationId,
          });
          return;
        }

        // STEP 1: Call provider refresh
        const refreshResult = await this.refreshToken(account);

        if (!refreshResult.success) {
          // PHASE 1B: Record circuit breaker failure
          await circuitBreakerService.recordFailure(provider);
          
          throw new Error(refreshResult.error || 'Token refresh failed');
        }

        // PHASE 1B: Record circuit breaker success
        await circuitBreakerService.recordSuccess(provider);

        // STEP 1: Update token
        await this.updateToken(
          connectionId,
          refreshResult.accessToken!,
          refreshResult.refreshToken,
          refreshResult.expiresAt!
        );

        // STEP 1: Log result
        const duration = Date.now() - startTime;
        this.metrics.refresh_success_total++;

        logger.info('Token refresh successful', {
          connectionId,
          provider,
          correlationId,
          duration,
        });
      } finally {
        // STEP 2: Release lock
        await this.releaseLock(connectionId);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.metrics.refresh_failure_total++;

      logger.error('Token refresh failed', {
        connectionId,
        provider,
        correlationId,
        error: error.message,
        duration,
      });

      // Re-throw for BullMQ retry handling (Step 3)
      throw error;
    }
  }

  /**
   * STEP 2: Acquire distributed lock
   */
  private async acquireLock(connectionId: string): Promise<boolean> {
    const redis = getRedisClientSafe();

    // Fail-closed: If Redis unavailable, throw error
    if (!redis) {
      throw new Error('Redis unavailable - cannot acquire lock (fail-closed)');
    }

    const lockKey = `oauth:refresh:lock:${connectionId}`;
    const lockValue = `${process.pid}:${Date.now()}`;

    try {
      const result = await redis.set(lockKey, lockValue, 'EX', this.LOCK_TTL, 'NX');
      return result === 'OK';
    } catch (error: any) {
      logger.error('Failed to acquire lock', {
        connectionId,
        error: error.message,
      });
      throw new Error('Lock acquisition failed');
    }
  }

  /**
   * STEP 2: Release distributed lock
   */
  private async releaseLock(connectionId: string): Promise<void> {
    const redis = getRedisClientSafe();
    if (!redis) return;

    const lockKey = `oauth:refresh:lock:${connectionId}`;

    try {
      await redis.del(lockKey);
    } catch (error: any) {
      logger.error('Failed to release lock', {
        connectionId,
        error: error.message,
      });
    }
  }

  /**
   * STEP 1: Fetch connection from database
   */
  private async fetchConnection(connectionId: string): Promise<ISocialAccount | null> {
    try {
      const account = await SocialAccount.findById(connectionId)
        .select('+accessToken +refreshToken');

      return account;
    } catch (error: any) {
      logger.error('Failed to fetch connection', {
        connectionId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * STEP 1: Refresh token via provider
   * 
   * Routes to platform-specific refresh logic
   */
  private async refreshToken(account: ISocialAccount): Promise<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
    error?: string;
  }> {
    try {
      const refreshToken = account.getDecryptedRefreshToken();

      if (!refreshToken) {
        return {
          success: false,
          error: 'No refresh token available',
        };
      }

      logger.info('Routing token refresh to platform service', {
        connectionId: account._id.toString(),
        provider: account.provider,
      });

      // Route to platform-specific service
      switch (account.provider) {
        case SocialPlatform.FACEBOOK:
          return await this.refreshFacebookToken(account);
          
        case SocialPlatform.INSTAGRAM:
          return await this.refreshInstagramToken(account);
          
        case SocialPlatform.TWITTER:
          return await this.refreshTwitterToken(account);
          
        case SocialPlatform.TIKTOK:
          return await this.refreshTikTokToken(account);
          
        case SocialPlatform.LINKEDIN:
          return await this.refreshLinkedInToken(account);
          
        default:
          return {
            success: false,
            error: `Unsupported platform: ${account.provider}`,
          };
      }
    } catch (error: any) {
      logger.error('Token refresh routing failed', {
        connectionId: account._id.toString(),
        provider: account.provider,
        error: error.message,
      });
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Refresh Facebook token
   */
  private async refreshFacebookToken(account: ISocialAccount): Promise<any> {
    try {
      logger.info('Refreshing Facebook token', {
        connectionId: account._id.toString(),
      });

      // Facebook uses its own worker with distributed lock
      await facebookTokenRefreshWorker['refreshAccount'](account);
      
      // Fetch updated account
      const updated = await SocialAccount.findById(account._id)
        .select('+accessToken +refreshToken');
      
      if (!updated) {
        return { success: false, error: 'Account not found after refresh' };
      }
      
      return {
        success: true,
        accessToken: updated.getDecryptedAccessToken(),
        refreshToken: updated.getDecryptedRefreshToken(),
        expiresAt: updated.tokenExpiresAt,
      };
    } catch (error: any) {
      logger.error('Facebook token refresh failed', {
        connectionId: account._id.toString(),
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh Instagram token
   */
  private async refreshInstagramToken(account: ISocialAccount): Promise<any> {
    try {
      logger.info('Refreshing Instagram token', {
        connectionId: account._id.toString(),
      });

      await (instagramTokenRefreshService as any).refreshToken(account._id.toString());
      
      const updated = await SocialAccount.findById(account._id)
        .select('+accessToken +refreshToken');
      
      if (!updated) {
        return { success: false, error: 'Account not found after refresh' };
      }
      
      return {
        success: true,
        accessToken: updated.getDecryptedAccessToken(),
        refreshToken: updated.getDecryptedRefreshToken(),
        expiresAt: updated.tokenExpiresAt,
      };
    } catch (error: any) {
      logger.error('Instagram token refresh failed', {
        connectionId: account._id.toString(),
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh Twitter token
   */
  private async refreshTwitterToken(account: ISocialAccount): Promise<any> {
    try {
      logger.info('Refreshing Twitter token', {
        connectionId: account._id.toString(),
      });

      await this.twitterService.refreshToken(account._id.toString());
      
      const updated = await SocialAccount.findById(account._id)
        .select('+accessToken +refreshToken');
      
      if (!updated) {
        return { success: false, error: 'Account not found after refresh' };
      }
      
      return {
        success: true,
        accessToken: updated.getDecryptedAccessToken(),
        refreshToken: updated.getDecryptedRefreshToken(),
        expiresAt: updated.tokenExpiresAt,
      };
    } catch (error: any) {
      logger.error('Twitter token refresh failed', {
        connectionId: account._id.toString(),
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh TikTok token
   */
  private async refreshTikTokToken(account: ISocialAccount): Promise<any> {
    try {
      logger.info('Refreshing TikTok token', {
        connectionId: account._id.toString(),
      });

      await this.tiktokService.refreshToken(account._id.toString());
      
      const updated = await SocialAccount.findById(account._id)
        .select('+accessToken +refreshToken');
      
      if (!updated) {
        return { success: false, error: 'Account not found after refresh' };
      }
      
      return {
        success: true,
        accessToken: updated.getDecryptedAccessToken(),
        refreshToken: updated.getDecryptedRefreshToken(),
        expiresAt: updated.tokenExpiresAt,
      };
    } catch (error: any) {
      logger.error('TikTok token refresh failed', {
        connectionId: account._id.toString(),
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh LinkedIn token
   */
  private async refreshLinkedInToken(account: ISocialAccount): Promise<any> {
    try {
      logger.info('Refreshing LinkedIn token', {
        connectionId: account._id.toString(),
      });

      await this.linkedinService.refreshToken(account._id.toString());
      
      const updated = await SocialAccount.findById(account._id)
        .select('+accessToken +refreshToken');
      
      if (!updated) {
        return { success: false, error: 'Account not found after refresh' };
      }
      
      return {
        success: true,
        accessToken: updated.getDecryptedAccessToken(),
        refreshToken: updated.getDecryptedRefreshToken(),
        expiresAt: updated.tokenExpiresAt,
      };
    } catch (error: any) {
      logger.error('LinkedIn token refresh failed', {
        connectionId: account._id.toString(),
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * STEP 1: Update token in database
   */
  private async updateToken(
    connectionId: string,
    accessToken: string,
    refreshToken: string | undefined,
    expiresAt: Date
  ): Promise<void> {
    try {
      const encryptedAccessToken = encrypt(accessToken);
      const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : undefined;

      const update: any = {
        accessToken: encryptedAccessToken,
        tokenExpiresAt: expiresAt,
        lastRefreshedAt: new Date(),
        status: AccountStatus.ACTIVE,
      };

      if (encryptedRefreshToken) {
        update.refreshToken = encryptedRefreshToken;
      }

      await SocialAccount.findByIdAndUpdate(connectionId, update);

      logger.debug('Token updated in database', {
        connectionId,
        expiresAt,
      });
    } catch (error: any) {
      logger.error('Failed to update token', {
        connectionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      concurrency: this.CONCURRENCY,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }
}

export const distributedTokenRefreshWorker = new DistributedTokenRefreshWorker();
