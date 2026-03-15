/**
 * Platform Health Service
 * 
 * Monitors API failure rates and detects platform outages with queue backpressure.
 * Uses sliding window failure tracking to mark platforms as degraded when failure
 * rate exceeds threshold, and automatically recovers when stable.
 * 
 * Features:
 * - Sliding window failure tracking (5 minutes)
 * - Minimum sample size (10 calls) before marking degraded
 * - Automatic recovery detection (30% failure rate for 2 minutes)
 * - Event emission for degraded/recovered states
 * - Publishing pause/resume integration (TODO: implement with publishing worker)
 * - Platform status monitoring
 */

import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { Redis } from 'ioredis';

export interface PlatformStatus {
  status: 'operational' | 'degraded';
  failureRate: number;
  lastChecked: Date;
  publishingPaused: boolean;
}

interface DegradedStatusData {
  status: 'degraded';
  failureRate: number;
  detectedAt: string;
  consecutiveMinutes: number;
}

export class PlatformHealthService {
  private redis: Redis | null = null;
  private eventEmitter = new EventEmitter();

  // Configuration constants
  private readonly WINDOW_SIZE = 5 * 60; // 5 minutes in seconds
  private readonly DEGRADED_THRESHOLD = 0.7; // 70% failure rate
  private readonly RECOVERY_THRESHOLD = 0.3; // 30% failure rate
  private readonly MIN_SAMPLE_SIZE = 10; // Minimum API calls before marking degraded

  /**
   * Get Redis client safely
   */
  private getRedis(): Redis {
    if (!this.redis) {
      this.redis = getRedisClient();
    }
    return this.redis;
  }

  /**
   * Record an API call result (success or failure)
   * Adds timestamp to Redis sorted set and checks platform health
   */
  async recordApiCall(platform: string, success: boolean): Promise<void> {
    const redis = this.getRedis();
    const timestamp = Date.now();
    const key = success
      ? `platform:${platform}:success`
      : `platform:${platform}:failure`;

    // Add to sorted set with timestamp as score
    // Use timestamp + random to ensure uniqueness
    const member = `${timestamp}:${Math.random()}`;
    await redis.zadd(key, timestamp, member);

    // Remove entries older than window
    const cutoff = timestamp - this.WINDOW_SIZE * 1000;
    await redis.zremrangebyscore(key, '-inf', cutoff);

    logger.debug('API call recorded', {
      platform,
      success,
      timestamp: new Date(timestamp),
    });

    // Check if platform should be marked degraded or recovered
    await this.checkPlatformHealth(platform);
  }

  /**
   * Check platform health based on failure rate
   * Marks platform as degraded if failure rate >= 70% with min 10 samples
   * Marks platform as recovered if failure rate <= 30% for 2 minutes
   */
  private async checkPlatformHealth(platform: string): Promise<void> {
    const redis = this.getRedis();
    const successCount = await redis.zcard(`platform:${platform}:success`);
    const failureCount = await redis.zcard(`platform:${platform}:failure`);
    const total = successCount + failureCount;

    // Require minimum sample size to avoid false positives
    if (total < this.MIN_SAMPLE_SIZE) {
      logger.debug('Insufficient sample size for health check', {
        platform,
        total,
        required: this.MIN_SAMPLE_SIZE,
      });
      return;
    }

    const failureRate = failureCount / total;
    const currentStatus = await this.getPlatformStatus(platform);

    logger.debug('Platform health check', {
      platform,
      successCount,
      failureCount,
      total,
      failureRate: (failureRate * 100).toFixed(2) + '%',
      currentStatus,
    });

    // Check if platform should be marked degraded
    if (failureRate >= this.DEGRADED_THRESHOLD && currentStatus !== 'degraded') {
      await this.markPlatformDegraded(platform, failureRate);
    }
    // Check if platform should be recovered
    else if (failureRate <= this.RECOVERY_THRESHOLD && currentStatus === 'degraded') {
      // Check if failure rate has been low for 2 consecutive minutes
      const isStableRecovery = await this.checkStableRecovery(platform);
      if (isStableRecovery) {
        await this.markPlatformRecovered(platform);
      } else {
        logger.debug('Platform recovery not stable yet', {
          platform,
          failureRate: (failureRate * 100).toFixed(2) + '%',
        });
      }
    }
  }

  /**
   * Check if platform has stable recovery (low failure rate for 2 minutes)
   */
  private async checkStableRecovery(platform: string): Promise<boolean> {
    const redis = this.getRedis();
    // Check failure rate for last 2 minutes
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

    const recentSuccesses = await redis.zcount(
      `platform:${platform}:success`,
      twoMinutesAgo,
      '+inf'
    );

    const recentFailures = await redis.zcount(
      `platform:${platform}:failure`,
      twoMinutesAgo,
      '+inf'
    );

    const recentTotal = recentSuccesses + recentFailures;

    // Need at least 5 samples in last 2 minutes
    if (recentTotal < 5) {
      logger.debug('Not enough recent samples for stable recovery check', {
        platform,
        recentTotal,
      });
      return false;
    }

    const recentFailureRate = recentFailures / recentTotal;

    logger.debug('Stable recovery check', {
      platform,
      recentSuccesses,
      recentFailures,
      recentTotal,
      recentFailureRate: (recentFailureRate * 100).toFixed(2) + '%',
      threshold: (this.RECOVERY_THRESHOLD * 100).toFixed(2) + '%',
    });

    return recentFailureRate <= this.RECOVERY_THRESHOLD;
  }

  /**
   * Mark platform as degraded
   * Stores degraded status in Redis, emits event, pauses publishing
   */
  private async markPlatformDegraded(platform: string, failureRate: number): Promise<void> {
    const redis = this.getRedis();
    const statusKey = `platform_status:${platform}`;
    const statusData: DegradedStatusData = {
      status: 'degraded',
      failureRate,
      detectedAt: new Date().toISOString(),
      consecutiveMinutes: 1,
    };

    await redis.setex(statusKey, this.WINDOW_SIZE, JSON.stringify(statusData));

    logger.warn('Platform marked as degraded', {
      platform,
      failureRate: (failureRate * 100).toFixed(2) + '%',
      threshold: (this.DEGRADED_THRESHOLD * 100).toFixed(2) + '%',
    });

    // Emit event for publishing router to pause jobs
    this.eventEmitter.emit('platform.degraded', {
      platform,
      failureRate,
      timestamp: new Date(),
    });

    // Pause publishing jobs for this platform
    await this.pausePlatformPublishing(platform);

    // TODO: Send alert to workspace admins (implement notification service)
    logger.info('TODO: Send degraded alert to workspace admins', { platform });
  }

  /**
   * Mark platform as recovered
   * Deletes degraded status, emits event, resumes publishing
   */
  private async markPlatformRecovered(platform: string): Promise<void> {
    const redis = this.getRedis();
    const statusKey = `platform_status:${platform}`;
    await redis.del(statusKey);

    logger.info('Platform recovered', { platform });

    // Emit event for publishing router to resume jobs
    this.eventEmitter.emit('platform.recovered', {
      platform,
      timestamp: new Date(),
    });

    // Resume publishing jobs for this platform
    await this.resumePlatformPublishing(platform);

    // TODO: Send recovery notification (implement notification service)
    logger.info('TODO: Send recovery notification to workspace admins', { platform });
  }

  /**
   * Pause platform publishing
   * Sets pause flag in Redis
   * TODO: Integrate with publishing worker to delay queued jobs
   */
  private async pausePlatformPublishing(platform: string): Promise<void> {
    const redis = this.getRedis();
    // Set pause flag in Redis
    const pauseKey = `platform_publishing_paused:${platform}`;
    await redis.set(pauseKey, '1', 'EX', this.WINDOW_SIZE);

    logger.info('Publishing paused for platform', { platform });

    // TODO: Integrate with publishing worker queue
    // Get all queued jobs for this platform and delay them by 15 minutes
    // This will be implemented when publishing worker is integrated
    logger.info('TODO: Delay queued publishing jobs for platform', { platform });
  }

  /**
   * Resume platform publishing
   * Deletes pause flag from Redis
   * TODO: Integrate with publishing worker to promote delayed jobs
   */
  private async resumePlatformPublishing(platform: string): Promise<void> {
    const redis = this.getRedis();
    // Remove pause flag
    const pauseKey = `platform_publishing_paused:${platform}`;
    await redis.del(pauseKey);

    logger.info('Publishing resumed for platform', { platform });

    // TODO: Integrate with publishing worker queue
    // Promote delayed jobs back to waiting
    // This will be implemented when publishing worker is integrated
    logger.info('TODO: Promote delayed publishing jobs for platform', { platform });
  }

  /**
   * Check if platform publishing is paused
   */
  async isPlatformPublishingPaused(platform: string): Promise<boolean> {
    const redis = this.getRedis();
    const pauseKey = `platform_publishing_paused:${platform}`;
    const exists = await redis.exists(pauseKey);
    return exists === 1;
  }

  /**
   * Get platform status (operational or degraded)
   */
  async getPlatformStatus(platform: string): Promise<'operational' | 'degraded'> {
    const redis = this.getRedis();
    const statusKey = `platform_status:${platform}`;
    const data = await redis.get(statusKey);

    if (!data) {
      return 'operational';
    }

    try {
      const status: DegradedStatusData = JSON.parse(data);
      return status.status;
    } catch (e) {
      logger.error('Failed to parse platform status', { platform, data });
      return 'operational';
    }
  }

  /**
   * Get all platform statuses
   */
  async getAllPlatformStatuses(): Promise<Record<string, PlatformStatus>> {
    const platforms = ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'];
    const statuses: Record<string, PlatformStatus> = {};

    for (const platform of platforms) {
      const status = await this.getPlatformStatus(platform);
      const failureRate = await this.calculateFailureRate(platform);
      const isPaused = await this.isPlatformPublishingPaused(platform);

      statuses[platform] = {
        status,
        failureRate,
        lastChecked: new Date(),
        publishingPaused: isPaused,
      };
    }

    return statuses;
  }

  /**
   * Calculate current failure rate for platform
   */
  private async calculateFailureRate(platform: string): Promise<number> {
    const redis = this.getRedis();
    const successKey = `platform:${platform}:success`;
    const failureKey = `platform:${platform}:failure`;

    const successCount = await redis.zcard(successKey);
    const failureCount = await redis.zcard(failureKey);

    const total = successCount + failureCount;
    if (total === 0) {
      return 0;
    }

    return failureCount / total;
  }

  /**
   * Subscribe to platform health events
   */
  on(event: 'platform.degraded' | 'platform.recovered', listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }
}
