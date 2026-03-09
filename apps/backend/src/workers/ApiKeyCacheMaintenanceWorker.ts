/**
 * API Key Cache Maintenance Worker
 * 
 * Runs periodically to maintain Redis cache consistency
 * 
 * Features:
 * - Removes orphaned Redis cache entries (keys deleted from DB)
 * - Verifies cache consistency
 * - Cleans up stale cache entries
 * - Runs every 6 hours
 * 
 * Security:
 * - Never logs raw API keys
 * - Only logs cache keys and metadata
 */

import { logger } from '../utils/logger';
import { ApiKey } from '../models/ApiKey';
import { getRedisClient } from '../config/redis';
import { captureException } from '../monitoring/sentry';

export interface IWorker {
  start(): void;
  stop(): Promise<void>;
  getStatus(): { isRunning: boolean; metrics?: any };
}

export class ApiKeyCacheMaintenanceWorker implements IWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

  // Metrics
  private metrics = {
    maintenance_runs_total: 0,
    orphaned_entries_removed: 0,
    stale_entries_removed: 0,
    cache_entries_verified: 0,
    maintenance_errors_total: 0,
    last_run_timestamp: 0,
    last_run_duration_ms: 0,
  };

  constructor() {
    logger.info('ApiKeyCacheMaintenanceWorker initialized');
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('API key cache maintenance worker already running');
      return;
    }

    this.isRunning = true;

    // Run immediately on start
    this.runMaintenance().catch(error => {
      logger.error('Initial API key cache maintenance failed', {
        error: error.message,
      });
    });

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runMaintenance().catch(error => {
        logger.error('Scheduled API key cache maintenance failed', {
          error: error.message,
        });
      });
    }, this.INTERVAL_MS);

    logger.info('API key cache maintenance worker started', {
      intervalMs: this.INTERVAL_MS,
      intervalHours: this.INTERVAL_MS / (60 * 60 * 1000),
    });
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('API key cache maintenance worker not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;

    logger.info('API key cache maintenance worker stopped');
  }

  /**
   * Run maintenance process
   */
  private async runMaintenance(): Promise<void> {
    const startTime = Date.now();
    this.metrics.maintenance_runs_total++;
    this.metrics.last_run_timestamp = startTime;

    logger.info('Starting API key cache maintenance');

    try {
      // 1. Remove orphaned cache entries
      await this.removeOrphanedEntries();

      // 2. Remove stale cache entries (older than TTL)
      await this.removeStaleEntries();

      // 3. Verify cache consistency
      await this.verifyCacheConsistency();

      const duration = Date.now() - startTime;
      this.metrics.last_run_duration_ms = duration;

      logger.info('API key cache maintenance completed', {
        duration,
        orphanedRemoved: this.metrics.orphaned_entries_removed,
        staleRemoved: this.metrics.stale_entries_removed,
        entriesVerified: this.metrics.cache_entries_verified,
      });
    } catch (error: any) {
      this.metrics.maintenance_errors_total++;

      logger.error('API key cache maintenance failed', {
        error: error.message,
        stack: error.stack,
      });

      captureException(error, {
        level: 'error',
        tags: {
          worker: 'api-key-cache-maintenance',
        },
      });
    }
  }

  /**
   * Remove orphaned cache entries
   * (cache entries for API keys that no longer exist in database)
   */
  private async removeOrphanedEntries(): Promise<void> {
    try {
      const redis = getRedisClient();

      // Get all API key cache keys
      const cacheKeys = await redis.keys('apikey:cache:*');

      if (cacheKeys.length === 0) {
        logger.debug('No API key cache entries found');
        return;
      }

      logger.debug('Found API key cache entries', {
        count: cacheKeys.length,
      });

      // Extract key hashes from cache keys
      const keyHashes = cacheKeys.map(key => key.replace('apikey:cache:', ''));

      // Check which keys exist in database
      const existingKeys = await ApiKey.find({
        keyHash: { $in: keyHashes },
      }).select('keyHash');

      const existingKeyHashes = new Set(existingKeys.map(k => k.keyHash));

      // Remove orphaned entries
      for (const keyHash of keyHashes) {
        if (!existingKeyHashes.has(keyHash)) {
          const cacheKey = `apikey:cache:${keyHash}`;
          await redis.del(cacheKey);

          this.metrics.orphaned_entries_removed++;

          logger.debug('Removed orphaned cache entry', {
            cacheKey,
          });
        }
      }

      if (this.metrics.orphaned_entries_removed > 0) {
        logger.info('Removed orphaned cache entries', {
          count: this.metrics.orphaned_entries_removed,
        });
      }
    } catch (error: any) {
      logger.error('Failed to remove orphaned cache entries', {
        error: error.message,
      });
    }
  }

  /**
   * Remove stale cache entries
   * (entries older than 10 minutes - should have been refreshed by now)
   */
  private async removeStaleEntries(): Promise<void> {
    try {
      const redis = getRedisClient();

      // Get all API key cache keys
      const cacheKeys = await redis.keys('apikey:cache:*');

      if (cacheKeys.length === 0) {
        return;
      }

      const staleThreshold = 10 * 60; // 10 minutes in seconds

      // Check TTL for each key
      for (const cacheKey of cacheKeys) {
        const ttl = await redis.ttl(cacheKey);

        // If TTL is -1 (no expiry) or very old, remove it
        if (ttl === -1 || ttl > 5 * 60) {
          // TTL > 5 minutes means it was set with wrong TTL
          await redis.del(cacheKey);

          this.metrics.stale_entries_removed++;

          logger.debug('Removed stale cache entry', {
            cacheKey,
            ttl,
          });
        }
      }

      if (this.metrics.stale_entries_removed > 0) {
        logger.info('Removed stale cache entries', {
          count: this.metrics.stale_entries_removed,
        });
      }
    } catch (error: any) {
      logger.error('Failed to remove stale cache entries', {
        error: error.message,
      });
    }
  }

  /**
   * Verify cache consistency
   * (ensure cached data matches database)
   */
  private async verifyCacheConsistency(): Promise<void> {
    try {
      const redis = getRedisClient();

      // Get all API key cache keys
      const cacheKeys = await redis.keys('apikey:cache:*');

      if (cacheKeys.length === 0) {
        return;
      }

      // Sample 10% of cache entries for verification
      const sampleSize = Math.max(1, Math.floor(cacheKeys.length * 0.1));
      const sampleKeys = cacheKeys
        .sort(() => Math.random() - 0.5)
        .slice(0, sampleSize);

      for (const cacheKey of sampleKeys) {
        const keyHash = cacheKey.replace('apikey:cache:', '');

        // Get cached data
        const cachedData = await redis.get(cacheKey);

        if (!cachedData) {
          continue;
        }

        // Get database data
        const dbKey = await ApiKey.findOne({ keyHash }).select('status');

        if (!dbKey) {
          // Key deleted from DB but still in cache - remove it
          await redis.del(cacheKey);
          this.metrics.orphaned_entries_removed++;
          continue;
        }

        // Parse cached data
        let cached: any;
        try {
          cached = JSON.parse(cachedData);
        } catch {
          // Invalid cache data - remove it
          await redis.del(cacheKey);
          this.metrics.stale_entries_removed++;
          continue;
        }

        // Verify status matches
        if (cached.status !== dbKey.status) {
          // Status mismatch - invalidate cache
          await redis.del(cacheKey);

          logger.warn('Cache inconsistency detected', {
            cacheKey,
            cachedStatus: cached.status,
            dbStatus: dbKey.status,
          });
        }

        this.metrics.cache_entries_verified++;
      }

      logger.debug('Cache consistency verified', {
        sampleSize,
        totalEntries: cacheKeys.length,
      });
    } catch (error: any) {
      logger.error('Failed to verify cache consistency', {
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
export const apiKeyCacheMaintenanceWorker = new ApiKeyCacheMaintenanceWorker();
