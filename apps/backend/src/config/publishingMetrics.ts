/**
 * Publishing Metrics
 * 
 * Prometheus metrics for post publishing pipeline
 */

import { Counter, Histogram } from 'prom-client';
import { metricsRegistry } from './metrics';

/**
 * Publishing Metrics
 */
export const postsPublishedTotal = new Counter({
  name: 'posts_published_total',
  help: 'Total number of posts published',
  labelNames: ['platform', 'status'],
  registers: [metricsRegistry],
});

export const postsFailedTotal = new Counter({
  name: 'posts_failed_total',
  help: 'Total number of failed post publishes',
  labelNames: ['platform', 'error_type'],
  registers: [metricsRegistry],
});

export const publishDuration = new Histogram({
  name: 'publish_duration_ms',
  help: 'Post publishing duration in milliseconds',
  labelNames: ['platform', 'status'],
  buckets: [100, 500, 1000, 2500, 5000, 10000, 30000],
  registers: [metricsRegistry],
});

export const publishRetryTotal = new Counter({
  name: 'publish_retry_total',
  help: 'Total number of publish retries',
  labelNames: ['platform'],
  registers: [metricsRegistry],
});

export const postsScheduledTotal = new Counter({
  name: 'posts_scheduled_total',
  help: 'Total number of posts scheduled',
  labelNames: ['platform'],
  registers: [metricsRegistry],
});

export const postsQueuedTotal = new Counter({
  name: 'posts_queued_total',
  help: 'Total number of posts queued for publishing',
  labelNames: ['platform'],
  registers: [metricsRegistry],
});

export const publishRateLimitExceededTotal = new Counter({
  name: 'publish_rate_limit_exceeded_total',
  help: 'Total number of publish rate limit exceeded events',
  labelNames: ['platform', 'account_id'],
  registers: [metricsRegistry],
});

export const publishDelayMs = new Histogram({
  name: 'publish_delay_ms',
  help: 'Difference between scheduled time and actual execution time in milliseconds',
  labelNames: ['platform'],
  buckets: [0, 1000, 5000, 10000, 30000, 60000, 300000, 600000, 1800000, 3600000], // 0s to 1h
  registers: [metricsRegistry],
});

export const publishAttemptTotal = new Counter({
  name: 'publish_attempt_total',
  help: 'Total number of publish attempts',
  labelNames: ['platform', 'status'],
  registers: [metricsRegistry],
});

export const publishAttemptFailureTotal = new Counter({
  name: 'publish_attempt_failure_total',
  help: 'Total number of failed publish attempts',
  labelNames: ['platform', 'error_code'],
  registers: [metricsRegistry],
});

/**
 * Helper Functions
 */

/**
 * Record post published
 */
export function recordPostPublished(platform: string, status: 'success' | 'error', durationMs: number): void {
  postsPublishedTotal.inc({ platform, status });
  publishDuration.observe({ platform, status }, durationMs);
}

/**
 * Record post failed
 */
export function recordPostFailed(platform: string, errorType: string): void {
  postsFailedTotal.inc({ platform, error_type: errorType });
}

/**
 * Record post retry
 */
export function recordPostRetry(platform: string): void {
  publishRetryTotal.inc({ platform });
}

/**
 * Record post scheduled
 */
export function recordPostScheduled(platform: string): void {
  postsScheduledTotal.inc({ platform });
}

/**
 * Record post queued
 */
export function recordPostQueued(platform: string): void {
  postsQueuedTotal.inc({ platform });
}

/**
 * Record publish rate limit exceeded
 */
export function recordPublishRateLimitExceeded(platform: string, accountId: string): void {
  publishRateLimitExceededTotal.inc({ platform, account_id: accountId });
}

/**
 * Record publish delay
 * 
 * Measures the difference between scheduled time and actual execution time
 */
export function recordPublishDelay(platform: string, scheduledAt: Date, executedAt: Date): void {
  const delayMs = executedAt.getTime() - scheduledAt.getTime();
  publishDelayMs.observe({ platform }, Math.max(0, delayMs));
}

/**
 * Record publish attempt
 */
export function recordPublishAttempt(platform: string, status: 'success' | 'failed'): void {
  publishAttemptTotal.inc({ platform, status });
}

/**
 * Record publish attempt failure
 */
export function recordPublishAttemptFailure(platform: string, errorCode: string): void {
  publishAttemptFailureTotal.inc({ platform, error_code: errorCode });
}
