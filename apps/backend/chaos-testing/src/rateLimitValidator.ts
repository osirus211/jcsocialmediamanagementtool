import { logger, logEvent, logMetric } from './utils/logger';
import { incrementCounter, getCounter } from './utils/redisClient';

/**
 * Rate Limit Meltdown Validation
 * 
 * Validates system behavior under rate limit conditions:
 * - Circuit breaker opens
 * - Backoff works correctly
 * - System recovers after reset
 * - No job explosion
 */

export class RateLimitValidator {
  private rateLimitHits: number = 0;
  private circuitBreakerOpens: number = 0;
  private recoveryEvents: number = 0;
  private jobExplosionDetected: boolean = false;
  private queueSizeHistory: number[] = [];

  /**
   * Track rate limit hit
   */
  async trackRateLimitHit(platform: string, accountId: string): Promise<void> {
    this.rateLimitHits++;

    await incrementCounter('chaos:ratelimit:hits:total');
    await incrementCounter(`chaos:ratelimit:hits:${platform}`);
    await incrementCounter(`chaos:ratelimit:hits:account:${accountId}`);

    logMetric('rate_limit_hit', 1, { platform, accountId });

    logger.warn('Rate limit hit tracked', {
      platform,
      accountId,
      totalHits: this.rateLimitHits,
    });

    logEvent('rate_limit_hit', {
      platform,
      accountId,
      totalHits: this.rateLimitHits,
    });
  }

  /**
   * Track circuit breaker open
   */
  async trackCircuitBreakerOpen(platform: string): Promise<void> {
    this.circuitBreakerOpens++;

    await incrementCounter('chaos:circuit:opens:total');
    await incrementCounter(`chaos:circuit:opens:${platform}`);

    logMetric('circuit_breaker_open', 1, { platform });

    logger.info('Circuit breaker opened', {
      platform,
      totalOpens: this.circuitBreakerOpens,
    });

    logEvent('circuit_breaker_open', {
      platform,
      totalOpens: this.circuitBreakerOpens,
    });
  }

  /**
   * Track recovery after rate limit
   */
  async trackRecovery(platform: string): Promise<void> {
    this.recoveryEvents++;

    await incrementCounter('chaos:recovery:total');
    await incrementCounter(`chaos:recovery:${platform}`);

    logMetric('rate_limit_recovery', 1, { platform });

    logger.info('Rate limit recovery detected', {
      platform,
      totalRecoveries: this.recoveryEvents,
    });

    logEvent('rate_limit_recovery', {
      platform,
      totalRecoveries: this.recoveryEvents,
    });
  }

  /**
   * Track queue size for job explosion detection
   */
  async trackQueueSize(queueSize: number): Promise<void> {
    this.queueSizeHistory.push(queueSize);

    // Keep last 60 measurements
    if (this.queueSizeHistory.length > 60) {
      this.queueSizeHistory.shift();
    }

    // Check for job explosion (queue size growing exponentially)
    if (this.queueSizeHistory.length >= 10) {
      const recent = this.queueSizeHistory.slice(-10);
      const growth = recent[recent.length - 1] / recent[0];

      if (growth > 5) {
        // Queue grew 5x in last 10 measurements
        if (!this.jobExplosionDetected) {
          this.jobExplosionDetected = true;

          logger.error('Job explosion detected', {
            queueSize,
            growth: growth.toFixed(2),
            history: recent,
          });

          logEvent('job_explosion_detected', {
            queueSize,
            growth: growth.toFixed(2),
          });
        }
      }
    }

    logMetric('queue_size', queueSize);
  }

  /**
   * Simulate rate limit period
   */
  async simulateRateLimitPeriod(durationSeconds: number): Promise<void> {
    logger.info('Starting rate limit simulation', { durationSeconds });

    const startTime = Date.now();
    const endTime = startTime + (durationSeconds * 1000);

    while (Date.now() < endTime) {
      await this.trackRateLimitHit('twitter', 'test-account');
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Rate limit simulation completed');
  }

  /**
   * Get rate limit hits
   */
  getRateLimitHits(): number {
    return this.rateLimitHits;
  }

  /**
   * Get circuit breaker opens
   */
  getCircuitBreakerOpens(): number {
    return this.circuitBreakerOpens;
  }

  /**
   * Get recovery events
   */
  getRecoveryEvents(): number {
    return this.recoveryEvents;
  }

  /**
   * Check if job explosion detected
   */
  isJobExplosionDetected(): boolean {
    return this.jobExplosionDetected;
  }

  /**
   * Get queue size history
   */
  getQueueSizeHistory(): number[] {
    return [...this.queueSizeHistory];
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<any> {
    const totalHits = await getCounter('chaos:ratelimit:hits:total');
    const totalOpens = await getCounter('chaos:circuit:opens:total');
    const totalRecoveries = await getCounter('chaos:recovery:total');

    return {
      rateLimitHits: this.rateLimitHits,
      circuitBreakerOpens: this.circuitBreakerOpens,
      recoveryEvents: this.recoveryEvents,
      jobExplosionDetected: this.jobExplosionDetected,
      queueSizeHistory: this.queueSizeHistory.slice(-10),
      redis: {
        totalHits,
        totalOpens,
        totalRecoveries,
      },
    };
  }

  /**
   * Reset counters
   */
  reset(): void {
    this.rateLimitHits = 0;
    this.circuitBreakerOpens = 0;
    this.recoveryEvents = 0;
    this.jobExplosionDetected = false;
    this.queueSizeHistory = [];
  }
}

// Singleton instance
export const rateLimitValidator = new RateLimitValidator();
