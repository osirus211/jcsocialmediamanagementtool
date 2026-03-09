/**
 * API Key Cleanup Worker
 * 
 * Runs periodically to clean up expired API keys
 * 
 * Features:
 * - Finds API keys with expiresAt < now and status = ACTIVE
 * - Marks them as EXPIRED
 * - Invalidates Redis cache for expired keys
 * - Logs cleanup activity
 * - Runs every hour
 * 
 * Security:
 * - Never logs raw API keys
 * - Only logs keyId and metadata
 */

import { logger } from '../utils/logger';
import { ApiKey, ApiKeyStatus } from '../models/ApiKey';
import { getRedisClient } from '../config/redis';
import { captureException } from '../monitoring/sentry';

export interface IWorker {
  start(): void;
  stop(): Promise<void>;
  getStatus(): { isRunning: boolean; metrics?: any };
}

export class ApiKeyCleanupWorker implements IWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  // Metrics
  private metrics = {
    cleanup_runs_total: 0,
    keys_expired_total: 0,
    keys_rotation_grace_ended_total: 0,
    cache_invalidations_total: 0,
    cleanup_errors_total: 0,
    last_run_timestamp: 0,
    last_run_duration_ms: 0,
  };

  constructor() {
    logger.info('ApiKeyCleanupWorker initialized');
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('API key cleanup worker already running');
      return;
    }

    this.isRunning = true;

    // Run immediately on start
    this.runCleanup().catch(error => {
      logger.error('Initial API key cleanup failed', {
        error: error.message,
      });
    });

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runCleanup().catch(error => {
        logger.error('Scheduled API key cleanup failed', {
          error: error.message,
        });
      });
    }, this.INTERVAL_MS);

    logger.info('API key cleanup worker started', {
      intervalMs: this.INTERVAL_MS,
      intervalHours: this.INTERVAL_MS / (60 * 60 * 1000),
    });
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('API key cleanup worker not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;

    logger.info('API key cleanup worker stopped');
  }

  /**
   * Run cleanup process
   */
  private async runCleanup(): Promise<void> {
    const startTime = Date.now();
    this.metrics.cleanup_runs_total++;
    this.metrics.last_run_timestamp = startTime;

    logger.info('Starting API key cleanup');

    try {
      // 1. Clean up expired API keys
      await this.cleanupExpiredKeys();

      // 2. Clean up keys with ended rotation grace period
      await this.cleanupRotationGracePeriod();

      const duration = Date.now() - startTime;
      this.metrics.last_run_duration_ms = duration;

      logger.info('API key cleanup completed', {
        duration,
        keysExpired: this.metrics.keys_expired_total,
        keysRotationEnded: this.metrics.keys_rotation_grace_ended_total,
        cacheInvalidations: this.metrics.cache_invalidations_total,
      });
    } catch (error: any) {
      this.metrics.cleanup_errors_total++;

      logger.error('API key cleanup failed', {
        error: error.message,
        stack: error.stack,
      });

      captureException(error, {
        level: 'error',
        tags: {
          worker: 'api-key-cleanup',
        },
      });
    }
  }

  /**
   * Clean up expired API keys
   */
  private async cleanupExpiredKeys(): Promise<void> {
    const now = new Date();

    // Find API keys that have expired
    const expiredKeys = await ApiKey.find({
      status: ApiKeyStatus.ACTIVE,
      expiresAt: { $lt: now },
    }).select('_id name workspaceId expiresAt keyHash');

    if (expiredKeys.length === 0) {
      logger.debug('No expired API keys found');
      return;
    }

    logger.info('Found expired API keys', {
      count: expiredKeys.length,
    });

    // Mark each key as expired
    for (const key of expiredKeys) {
      try {
        // Update status to EXPIRED
        await ApiKey.updateOne(
          { _id: key._id },
          {
            status: ApiKeyStatus.EXPIRED,
            revokedAt: now,
          }
        );

        // Invalidate Redis cache
        await this.invalidateCache(key.keyHash);

        this.metrics.keys_expired_total++;

        logger.info('API key marked as expired', {
          keyId: key._id.toString(),
          keyName: key.name,
          workspaceId: key.workspaceId.toString(),
          expiresAt: key.expiresAt,
        });
      } catch (error: any) {
        logger.error('Failed to expire API key', {
          keyId: key._id.toString(),
          error: error.message,
        });
      }
    }
  }

  /**
   * Clean up keys with ended rotation grace period
   */
  private async cleanupRotationGracePeriod(): Promise<void> {
    const now = new Date();

    // Find API keys with ended rotation grace period
    const gracePeriodEndedKeys = await ApiKey.find({
      status: ApiKeyStatus.ACTIVE,
      rotationGracePeriodEnds: { $lt: now },
      rotatedTo: { $exists: true },
    }).select('_id name workspaceId rotationGracePeriodEnds rotatedTo keyHash');

    if (gracePeriodEndedKeys.length === 0) {
      logger.debug('No keys with ended rotation grace period found');
      return;
    }

    logger.info('Found keys with ended rotation grace period', {
      count: gracePeriodEndedKeys.length,
    });

    // Revoke each key
    for (const key of gracePeriodEndedKeys) {
      try {
        // Update status to REVOKED
        await ApiKey.updateOne(
          { _id: key._id },
          {
            status: ApiKeyStatus.REVOKED,
            revokedAt: now,
          }
        );

        // Invalidate Redis cache
        await this.invalidateCache(key.keyHash);

        this.metrics.keys_rotation_grace_ended_total++;

        logger.info('API key revoked after rotation grace period', {
          keyId: key._id.toString(),
          keyName: key.name,
          workspaceId: key.workspaceId.toString(),
          rotatedTo: key.rotatedTo?.toString(),
          gracePeriodEnded: key.rotationGracePeriodEnds,
        });
      } catch (error: any) {
        logger.error('Failed to revoke API key after grace period', {
          keyId: key._id.toString(),
          error: error.message,
        });
      }
    }
  }

  /**
   * Invalidate Redis cache for API key
   */
  private async invalidateCache(keyHash: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const cacheKey = `apikey:cache:${keyHash}`;
      
      await redis.del(cacheKey);
      
      this.metrics.cache_invalidations_total++;

      logger.debug('API key cache invalidated', {
        cacheKey,
      });
    } catch (error: any) {
      logger.error('Failed to invalidate API key cache', {
        error: error.message,
      });
    }
  }

  /**
   * Get worker status
   */
  getStatus(): { isRunning: boolean; metrics: any } {
    return {
      isRunning: this.isRunning,
      metrics: { ...this.metrics },
    };
  }
}

// Singleton instance
export const apiKeyCleanupWorker = new ApiKeyCleanupWorker();
