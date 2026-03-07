import { logger, logEvent, logMetric } from './utils/logger';
import { incrementCounter, getCounter, setValue, getValue } from './utils/redisClient';
import { config } from './config';

/**
 * Refresh Storm Validation
 * 
 * Validates that token refresh operations don't cause storms:
 * - No more than X refreshes per second
 * - No concurrent refresh per account
 * - No exponential retry storm
 */

export class RefreshStormValidator {
  private refreshRates: number[] = [];
  private peakRefreshRate: number = 0;
  private concurrentRefreshViolations: number = 0;
  private retryStormEvents: number = 0;

  /**
   * Track refresh attempt
   */
  async trackRefreshAttempt(accountId: string): Promise<void> {
    const now = Date.now();
    const second = Math.floor(now / 1000);

    // Increment refresh counter for this second
    const key = `chaos:refresh:rate:${second}`;
    const count = await incrementCounter(key, 1);

    // Set TTL to clean up old counters
    await setValue(key, count.toString(), 60);

    // Track peak rate
    if (count > this.peakRefreshRate) {
      this.peakRefreshRate = count;
      logMetric('peak_refresh_rate', count);
    }

    // Check if rate exceeds threshold
    if (count > config.maxRefreshPerSecond) {
      logger.warn('Refresh rate threshold exceeded', {
        rate: count,
        threshold: config.maxRefreshPerSecond,
        second,
      });

      logEvent('refresh_rate_exceeded', {
        rate: count,
        threshold: config.maxRefreshPerSecond,
      });
    }

    // Track concurrent refresh for this account
    await this.trackConcurrentRefresh(accountId);

    // Update rate history
    this.refreshRates.push(count);
    if (this.refreshRates.length > 60) {
      this.refreshRates.shift();
    }
  }

  /**
   * Track concurrent refresh attempts for same account
   */
  private async trackConcurrentRefresh(accountId: string): Promise<void> {
    const lockKey = `chaos:refresh:lock:${accountId}`;
    const existing = await getValue(lockKey);

    if (existing) {
      // Concurrent refresh detected!
      this.concurrentRefreshViolations++;

      logger.error('Concurrent refresh violation detected', {
        accountId,
        violations: this.concurrentRefreshViolations,
      });

      logEvent('concurrent_refresh_violation', {
        accountId,
        violations: this.concurrentRefreshViolations,
      });
    } else {
      // Set lock with 60 second TTL
      await setValue(lockKey, Date.now().toString(), 60);
    }
  }

  /**
   * Track retry storm
   */
  async trackRetryStorm(accountId: string, retryCount: number): Promise<void> {
    if (retryCount > config.maxRetryStormThreshold) {
      this.retryStormEvents++;

      logger.error('Retry storm detected', {
        accountId,
        retryCount,
        threshold: config.maxRetryStormThreshold,
        events: this.retryStormEvents,
      });

      logEvent('retry_storm_detected', {
        accountId,
        retryCount,
        threshold: config.maxRetryStormThreshold,
      });
    }
  }

  /**
   * Get current refresh rate
   */
  async getCurrentRefreshRate(): Promise<number> {
    const second = Math.floor(Date.now() / 1000);
    const key = `chaos:refresh:rate:${second}`;
    return await getCounter(key);
  }

  /**
   * Get average refresh rate
   */
  getAverageRefreshRate(): number {
    if (this.refreshRates.length === 0) return 0;
    const sum = this.refreshRates.reduce((a, b) => a + b, 0);
    return sum / this.refreshRates.length;
  }

  /**
   * Get peak refresh rate
   */
  getPeakRefreshRate(): number {
    return this.peakRefreshRate;
  }

  /**
   * Get concurrent refresh violations
   */
  getConcurrentRefreshViolations(): number {
    return this.concurrentRefreshViolations;
  }

  /**
   * Get retry storm events
   */
  getRetryStormEvents(): number {
    return this.retryStormEvents;
  }

  /**
   * Check if refresh storm is occurring
   */
  async isRefreshStorm(): Promise<boolean> {
    const currentRate = await this.getCurrentRefreshRate();
    return currentRate > config.maxRefreshPerSecond;
  }

  /**
   * Get statistics
   */
  getStatistics(): any {
    return {
      peakRefreshRate: this.peakRefreshRate,
      averageRefreshRate: this.getAverageRefreshRate().toFixed(2),
      concurrentRefreshViolations: this.concurrentRefreshViolations,
      retryStormEvents: this.retryStormEvents,
      rateHistory: this.refreshRates.slice(-10), // Last 10 seconds
    };
  }

  /**
   * Reset counters
   */
  reset(): void {
    this.refreshRates = [];
    this.peakRefreshRate = 0;
    this.concurrentRefreshViolations = 0;
    this.retryStormEvents = 0;
  }
}

// Singleton instance
export const refreshStormValidator = new RefreshStormValidator();
