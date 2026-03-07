import { logger } from '../utils/logger';

/**
 * Provider Metrics Service
 * 
 * Tracks metrics for provider operations
 * 
 * Metrics:
 * - Publish success rate (per platform, per account)
 * - Refresh failure rate (per platform, per account)
 * - Rate limit incidents (per platform, per account)
 * - Operation duration (publish, refresh, revoke)
 * - Error classification distribution
 * 
 * Usage:
 * ```typescript
 * providerMetrics.recordPublishSuccess('twitter', 'account123', 1500);
 * providerMetrics.recordPublishFailure('twitter', 'account123', 'rate_limited', 800);
 * providerMetrics.recordRefreshFailure('twitter', 'account123', 'token_revoked');
 * providerMetrics.recordRateLimitHit('twitter', 'account123', 'publish');
 * ```
 */

export interface PublishMetrics {
  platform: string;
  accountId: string;
  successCount: number;
  failureCount: number;
  totalCount: number;
  successRate: number;
  avgDuration: number;
  lastPublishAt?: Date;
}

export interface RefreshMetrics {
  platform: string;
  accountId: string;
  successCount: number;
  failureCount: number;
  totalCount: number;
  failureRate: number;
  lastRefreshAt?: Date;
}

export interface RateLimitMetrics {
  platform: string;
  accountId: string;
  hitCount: number;
  operations: Record<string, number>;
  lastHitAt?: Date;
}

export class ProviderMetricsService {
  private static instance: ProviderMetricsService;

  // In-memory metrics storage
  private publishMetrics: Map<string, PublishMetrics> = new Map();
  private refreshMetrics: Map<string, RefreshMetrics> = new Map();
  private rateLimitMetrics: Map<string, RateLimitMetrics> = new Map();

  // Duration tracking
  private publishDurations: Map<string, number[]> = new Map();

  // Error classification tracking
  private errorClassifications: Map<string, Record<string, number>> = new Map();

  private constructor() {
    logger.info('ProviderMetricsService initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ProviderMetricsService {
    if (!ProviderMetricsService.instance) {
      ProviderMetricsService.instance = new ProviderMetricsService();
    }
    return ProviderMetricsService.instance;
  }

  /**
   * Record publish success
   */
  recordPublishSuccess(platform: string, accountId: string, duration: number): void {
    const key = `${platform}:${accountId}`;

    // Update publish metrics
    const metrics = this.publishMetrics.get(key) || {
      platform,
      accountId,
      successCount: 0,
      failureCount: 0,
      totalCount: 0,
      successRate: 0,
      avgDuration: 0,
    };

    metrics.successCount++;
    metrics.totalCount++;
    metrics.successRate = (metrics.successCount / metrics.totalCount) * 100;
    metrics.lastPublishAt = new Date();

    this.publishMetrics.set(key, metrics);

    // Track duration
    const durations = this.publishDurations.get(key) || [];
    durations.push(duration);

    // Keep last 100 durations
    if (durations.length > 100) {
      durations.shift();
    }

    this.publishDurations.set(key, durations);

    // Calculate average duration
    metrics.avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;

    logger.debug('Publish success recorded', {
      platform,
      accountId,
      duration,
      successRate: metrics.successRate.toFixed(2),
    });
  }

  /**
   * Record publish failure
   */
  recordPublishFailure(
    platform: string,
    accountId: string,
    errorCategory: string,
    duration: number
  ): void {
    const key = `${platform}:${accountId}`;

    // Update publish metrics
    const metrics = this.publishMetrics.get(key) || {
      platform,
      accountId,
      successCount: 0,
      failureCount: 0,
      totalCount: 0,
      successRate: 0,
      avgDuration: 0,
    };

    metrics.failureCount++;
    metrics.totalCount++;
    metrics.successRate = (metrics.successCount / metrics.totalCount) * 100;
    metrics.lastPublishAt = new Date();

    this.publishMetrics.set(key, metrics);

    // Track duration
    const durations = this.publishDurations.get(key) || [];
    durations.push(duration);

    if (durations.length > 100) {
      durations.shift();
    }

    this.publishDurations.set(key, durations);
    metrics.avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;

    // Track error classification
    const classifications = this.errorClassifications.get(key) || {};
    classifications[errorCategory] = (classifications[errorCategory] || 0) + 1;
    this.errorClassifications.set(key, classifications);

    logger.debug('Publish failure recorded', {
      platform,
      accountId,
      errorCategory,
      duration,
      successRate: metrics.successRate.toFixed(2),
    });
  }

  /**
   * Record refresh success
   */
  recordRefreshSuccess(platform: string, accountId: string): void {
    const key = `${platform}:${accountId}`;

    const metrics = this.refreshMetrics.get(key) || {
      platform,
      accountId,
      successCount: 0,
      failureCount: 0,
      totalCount: 0,
      failureRate: 0,
    };

    metrics.successCount++;
    metrics.totalCount++;
    metrics.failureRate = (metrics.failureCount / metrics.totalCount) * 100;
    metrics.lastRefreshAt = new Date();

    this.refreshMetrics.set(key, metrics);

    logger.debug('Refresh success recorded', {
      platform,
      accountId,
      failureRate: metrics.failureRate.toFixed(2),
    });
  }

  /**
   * Record refresh failure
   */
  recordRefreshFailure(platform: string, accountId: string, reason: string): void {
    const key = `${platform}:${accountId}`;

    const metrics = this.refreshMetrics.get(key) || {
      platform,
      accountId,
      successCount: 0,
      failureCount: 0,
      totalCount: 0,
      failureRate: 0,
    };

    metrics.failureCount++;
    metrics.totalCount++;
    metrics.failureRate = (metrics.failureCount / metrics.totalCount) * 100;
    metrics.lastRefreshAt = new Date();

    this.refreshMetrics.set(key, metrics);

    logger.warn('Refresh failure recorded', {
      platform,
      accountId,
      reason,
      failureRate: metrics.failureRate.toFixed(2),
    });
  }

  /**
   * Record rate limit hit
   */
  recordRateLimitHit(platform: string, accountId: string, operation: string): void {
    const key = `${platform}:${accountId}`;

    const metrics = this.rateLimitMetrics.get(key) || {
      platform,
      accountId,
      hitCount: 0,
      operations: {},
    };

    metrics.hitCount++;
    metrics.operations[operation] = (metrics.operations[operation] || 0) + 1;
    metrics.lastHitAt = new Date();

    this.rateLimitMetrics.set(key, metrics);

    logger.warn('Rate limit hit recorded', {
      platform,
      accountId,
      operation,
      totalHits: metrics.hitCount,
    });
  }

  /**
   * Get publish metrics for account
   */
  getPublishMetrics(platform: string, accountId: string): PublishMetrics | null {
    const key = `${platform}:${accountId}`;
    return this.publishMetrics.get(key) || null;
  }

  /**
   * Get refresh metrics for account
   */
  getRefreshMetrics(platform: string, accountId: string): RefreshMetrics | null {
    const key = `${platform}:${accountId}`;
    return this.refreshMetrics.get(key) || null;
  }

  /**
   * Get rate limit metrics for account
   */
  getRateLimitMetrics(platform: string, accountId: string): RateLimitMetrics | null {
    const key = `${platform}:${accountId}`;
    return this.rateLimitMetrics.get(key) || null;
  }

  /**
   * Get error classifications for account
   */
  getErrorClassifications(platform: string, accountId: string): Record<string, number> {
    const key = `${platform}:${accountId}`;
    return this.errorClassifications.get(key) || {};
  }

  /**
   * Get all publish metrics for platform
   */
  getPlatformPublishMetrics(platform: string): PublishMetrics[] {
    const metrics: PublishMetrics[] = [];

    for (const [key, value] of this.publishMetrics.entries()) {
      if (key.startsWith(`${platform}:`)) {
        metrics.push(value);
      }
    }

    return metrics;
  }

  /**
   * Get all refresh metrics for platform
   */
  getPlatformRefreshMetrics(platform: string): RefreshMetrics[] {
    const metrics: RefreshMetrics[] = [];

    for (const [key, value] of this.refreshMetrics.entries()) {
      if (key.startsWith(`${platform}:`)) {
        metrics.push(value);
      }
    }

    return metrics;
  }

  /**
   * Get aggregated platform metrics
   */
  getAggregatedPlatformMetrics(platform: string): any {
    const publishMetrics = this.getPlatformPublishMetrics(platform);
    const refreshMetrics = this.getPlatformRefreshMetrics(platform);

    const totalPublishes = publishMetrics.reduce((sum, m) => sum + m.totalCount, 0);
    const totalPublishSuccesses = publishMetrics.reduce((sum, m) => sum + m.successCount, 0);
    const totalRefreshes = refreshMetrics.reduce((sum, m) => sum + m.totalCount, 0);
    const totalRefreshFailures = refreshMetrics.reduce((sum, m) => sum + m.failureCount, 0);

    return {
      platform,
      publish: {
        total: totalPublishes,
        successes: totalPublishSuccesses,
        failures: totalPublishes - totalPublishSuccesses,
        successRate: totalPublishes > 0 ? (totalPublishSuccesses / totalPublishes) * 100 : 0,
      },
      refresh: {
        total: totalRefreshes,
        successes: totalRefreshes - totalRefreshFailures,
        failures: totalRefreshFailures,
        failureRate: totalRefreshes > 0 ? (totalRefreshFailures / totalRefreshes) * 100 : 0,
      },
      accounts: publishMetrics.length,
    };
  }

  /**
   * Get global metrics summary
   */
  getGlobalMetrics(): any {
    const platforms = new Set<string>();

    for (const metrics of this.publishMetrics.values()) {
      platforms.add(metrics.platform);
    }

    const summary: any = {
      platforms: {},
      totals: {
        publishes: 0,
        publishSuccesses: 0,
        refreshes: 0,
        refreshFailures: 0,
        rateLimitHits: 0,
      },
    };

    for (const platform of platforms) {
      const platformMetrics = this.getAggregatedPlatformMetrics(platform);
      summary.platforms[platform] = platformMetrics;

      summary.totals.publishes += platformMetrics.publish.total;
      summary.totals.publishSuccesses += platformMetrics.publish.successes;
      summary.totals.refreshes += platformMetrics.refresh.total;
      summary.totals.refreshFailures += platformMetrics.refresh.failures;
    }

    // Count rate limit hits
    for (const metrics of this.rateLimitMetrics.values()) {
      summary.totals.rateLimitHits += metrics.hitCount;
    }

    return summary;
  }

  /**
   * Clear metrics for account
   */
  clearAccountMetrics(platform: string, accountId: string): void {
    const key = `${platform}:${accountId}`;
    this.publishMetrics.delete(key);
    this.refreshMetrics.delete(key);
    this.rateLimitMetrics.delete(key);
    this.publishDurations.delete(key);
    this.errorClassifications.delete(key);

    logger.info('Account metrics cleared', { platform, accountId });
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.publishMetrics.clear();
    this.refreshMetrics.clear();
    this.rateLimitMetrics.clear();
    this.publishDurations.clear();
    this.errorClassifications.clear();

    logger.info('All metrics cleared');
  }
}

// Export singleton instance
export const providerMetrics = ProviderMetricsService.getInstance();
