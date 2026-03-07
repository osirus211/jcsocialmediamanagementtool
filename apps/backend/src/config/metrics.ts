/**
 * Prometheus Metrics Configuration
 * 
 * Collects metrics for:
 * - Webhook requests
 * - OAuth callbacks
 * - Token refresh attempts
 * - Queue depth
 * - Job success/failure rates
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from '../utils/logger';

// Create registry
export const metricsRegistry = new Registry();

// Add default metrics (CPU, memory, etc.)
import { collectDefaultMetrics } from 'prom-client';
collectDefaultMetrics({ register: metricsRegistry });

/**
 * Webhook Metrics
 */
export const webhookRequestsTotal = new Counter({
  name: 'webhook_requests_total',
  help: 'Total number of webhook requests received',
  labelNames: ['provider', 'status'],
  registers: [metricsRegistry],
});

export const webhookRequestDuration = new Histogram({
  name: 'webhook_request_duration_ms',
  help: 'Webhook request duration in milliseconds',
  labelNames: ['provider', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [metricsRegistry],
});

export const webhookErrorsTotal = new Counter({
  name: 'webhook_errors_total',
  help: 'Total number of webhook errors',
  labelNames: ['provider', 'error_type'],
  registers: [metricsRegistry],
});

export const webhookReplayDetectedTotal = new Counter({
  name: 'webhook_replay_detected_total',
  help: 'Total number of replay attacks detected',
  labelNames: ['provider'],
  registers: [metricsRegistry],
});

export const webhookRateLimitExceededTotal = new Counter({
  name: 'webhook_rate_limit_exceeded_total',
  help: 'Total number of rate limit exceeded events',
  labelNames: ['provider'],
  registers: [metricsRegistry],
});

/**
 * OAuth Metrics
 */
export const oauthCallbacksTotal = new Counter({
  name: 'oauth_callbacks_total',
  help: 'Total number of OAuth callbacks',
  labelNames: ['provider', 'status'],
  registers: [metricsRegistry],
});

export const oauthCallbackDuration = new Histogram({
  name: 'oauth_callback_duration_ms',
  help: 'OAuth callback duration in milliseconds',
  labelNames: ['provider', 'status'],
  buckets: [100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [metricsRegistry],
});

export const oauthFailuresTotal = new Counter({
  name: 'oauth_failures_total',
  help: 'Total number of OAuth failures',
  labelNames: ['provider', 'error_type'],
  registers: [metricsRegistry],
});

export const oauthSuspiciousActivityTotal = new Counter({
  name: 'oauth_suspicious_activity_total',
  help: 'Total number of suspicious OAuth activity alerts',
  labelNames: ['ip'],
  registers: [metricsRegistry],
});

export const oauthRateLimitExceededTotal = new Counter({
  name: 'oauth_rate_limit_exceeded_total',
  help: 'Total number of OAuth rate limit exceeded events',
  labelNames: ['ip'],
  registers: [metricsRegistry],
});

/**
 * Token Refresh Metrics
 */
export const tokenRefreshAttemptsTotal = new Counter({
  name: 'token_refresh_attempts_total',
  help: 'Total number of token refresh attempts',
  labelNames: ['provider', 'status'],
  registers: [metricsRegistry],
});

export const tokenRefreshDuration = new Histogram({
  name: 'token_refresh_duration_ms',
  help: 'Token refresh duration in milliseconds',
  labelNames: ['provider', 'status'],
  buckets: [100, 250, 500, 1000, 2500, 5000],
  registers: [metricsRegistry],
});

export const tokenRefreshFailureRate = new Gauge({
  name: 'token_refresh_failure_rate',
  help: 'Token refresh failure rate (percentage)',
  labelNames: ['provider'],
  registers: [metricsRegistry],
});

/**
 * Queue Metrics
 */
export const queueDepth = new Gauge({
  name: 'queue_depth',
  help: 'Current queue depth (waiting jobs)',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});

export const queueActiveJobs = new Gauge({
  name: 'queue_active_jobs',
  help: 'Current number of active jobs',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});

export const queueCompletedJobsTotal = new Counter({
  name: 'queue_completed_jobs_total',
  help: 'Total number of completed jobs',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});

export const queueFailedJobsTotal = new Counter({
  name: 'queue_failed_jobs_total',
  help: 'Total number of failed jobs',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});

export const jobProcessingDuration = new Histogram({
  name: 'job_processing_duration_ms',
  help: 'Job processing duration in milliseconds',
  labelNames: ['queue_name', 'job_name'],
  buckets: [10, 50, 100, 500, 1000, 5000, 10000, 30000],
  registers: [metricsRegistry],
});

export const jobSuccessRate = new Gauge({
  name: 'job_success_rate',
  help: 'Job success rate (percentage)',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});

/**
 * Circuit Breaker Metrics
 */
export const circuitBreakerStateGauge = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['provider', 'operation'],
  registers: [metricsRegistry],
});

export const circuitBreakerOpenDuration = new Histogram({
  name: 'circuit_breaker_open_duration_seconds',
  help: 'Duration circuit breaker was open in seconds',
  labelNames: ['provider', 'operation'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

/**
 * Connection Health Metrics
 */
export const connectionHealthScore = new Gauge({
  name: 'connection_health_score',
  help: 'Connection health score (0-100)',
  labelNames: ['provider', 'account_id'],
  registers: [metricsRegistry],
});

/**
 * Helper Functions
 */

/**
 * Record webhook request
 */
export function recordWebhookRequest(
  provider: string,
  status: 'success' | 'error',
  durationMs: number
): void {
  webhookRequestsTotal.inc({ provider, status });
  webhookRequestDuration.observe({ provider, status }, durationMs);
}

/**
 * Record webhook error
 */
export function recordWebhookError(provider: string, errorType: string): void {
  webhookErrorsTotal.inc({ provider, error_type: errorType });
}

/**
 * Record OAuth callback
 */
export function recordOAuthCallback(
  provider: string,
  status: 'success' | 'error',
  durationMs: number
): void {
  oauthCallbacksTotal.inc({ provider, status });
  oauthCallbackDuration.observe({ provider, status }, durationMs);
}

/**
 * Record OAuth failure
 */
export function recordOAuthFailure(provider: string, errorType: string): void {
  oauthFailuresTotal.inc({ provider, error_type: errorType });
}

/**
 * Record token refresh attempt
 */
export function recordTokenRefresh(
  provider: string,
  status: 'success' | 'error',
  durationMs: number
): void {
  tokenRefreshAttemptsTotal.inc({ provider, status });
  tokenRefreshDuration.observe({ provider, status }, durationMs);
}

/**
 * Update queue metrics
 */
export async function updateQueueMetrics(
  queueName: string,
  waiting: number,
  active: number
): Promise<void> {
  queueDepth.set({ queue_name: queueName }, waiting);
  queueActiveJobs.set({ queue_name: queueName }, active);
}

/**
 * Record job completion
 */
export function recordJobCompletion(
  queueName: string,
  jobName: string,
  status: 'success' | 'error',
  durationMs: number
): void {
  if (status === 'success') {
    queueCompletedJobsTotal.inc({ queue_name: queueName });
  } else {
    queueFailedJobsTotal.inc({ queue_name: queueName });
  }
  
  jobProcessingDuration.observe({ queue_name: queueName, job_name: jobName }, durationMs);
}

/**
 * Update circuit breaker state
 */
export function updateCircuitBreakerState(
  provider: string,
  operation: string,
  state: 'closed' | 'open' | 'half-open'
): void {
  const stateValue = state === 'closed' ? 0 : state === 'open' ? 1 : 2;
  circuitBreakerStateGauge.set({ provider, operation }, stateValue);
}

/**
 * Update connection health score
 */
export function updateConnectionHealthScore(
  provider: string,
  accountId: string,
  score: number
): void {
  connectionHealthScore.set({ provider, account_id: accountId }, score);
}

/**
 * Initialize metrics collection
 */
export function initMetrics(): void {
  logger.info('Prometheus metrics initialized', {
    metricsCount: metricsRegistry.getMetricsAsArray().length,
  });
}
