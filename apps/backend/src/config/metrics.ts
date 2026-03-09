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

export const queueLagP50 = new Gauge({
  name: 'queue_lag_p50_seconds',
  help: 'Queue lag P50 (median) in seconds',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});

export const queueLagP95 = new Gauge({
  name: 'queue_lag_p95_seconds',
  help: 'Queue lag P95 in seconds',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});

export const queueLagP99 = new Gauge({
  name: 'queue_lag_p99_seconds',
  help: 'Queue lag P99 in seconds',
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
 * Redis Connection Metrics (Phase 3)
 */
export const redisConnectionStatus = new Gauge({
  name: 'redis_connection_status',
  help: 'Redis connection status (1 = connected, 0 = disconnected)',
  registers: [metricsRegistry],
});

export const redisCircuitBreakerState = new Gauge({
  name: 'redis_circuit_breaker_state',
  help: 'Redis circuit breaker state (0 = closed, 1 = open, 2 = half-open)',
  registers: [metricsRegistry],
});

export const redisCircuitBreakerErrors = new Gauge({
  name: 'redis_circuit_breaker_errors_total',
  help: 'Total Redis circuit breaker errors',
  registers: [metricsRegistry],
});

export const redisCircuitBreakerSuccesses = new Gauge({
  name: 'redis_circuit_breaker_successes_total',
  help: 'Total Redis circuit breaker successes',
  registers: [metricsRegistry],
});

export const redisRecoveryEventsTotal = new Counter({
  name: 'redis_recovery_events_total',
  help: 'Total Redis recovery events',
  labelNames: ['event_type'],
  registers: [metricsRegistry],
});

/**
 * Worker Metrics (Phase 3)
 */
export const workerRunningTotal = new Gauge({
  name: 'worker_running_total',
  help: 'Total number of running workers',
  registers: [metricsRegistry],
});

export const workerEnabledTotal = new Gauge({
  name: 'worker_enabled_total',
  help: 'Total number of enabled workers',
  registers: [metricsRegistry],
});

export const workerRestartTotal = new Gauge({
  name: 'worker_restart_total',
  help: 'Worker restart count',
  labelNames: ['worker_name'],
  registers: [metricsRegistry],
});

export const workerStatus = new Gauge({
  name: 'worker_status',
  help: 'Worker status (1=running, 0=stopped)',
  labelNames: ['worker_name'],
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
 * Update queue lag metrics
 */
export function updateQueueLagMetrics(
  queueName: string,
  lagP50Ms: number,
  lagP95Ms: number,
  lagP99Ms: number
): void {
  queueLagP50.set({ queue_name: queueName }, lagP50Ms / 1000); // Convert to seconds
  queueLagP95.set({ queue_name: queueName }, lagP95Ms / 1000);
  queueLagP99.set({ queue_name: queueName }, lagP99Ms / 1000);
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
 * Update Redis metrics (Phase 3)
 */
export function updateRedisMetrics(): void {
  try {
    const { isRedisHealthy, getCircuitBreakerStatus, getRecoveryService } = require('./redis');
    
    // Connection status
    const isHealthy = isRedisHealthy();
    redisConnectionStatus.set(isHealthy ? 1 : 0);
    
    // Circuit breaker
    const cbStatus = getCircuitBreakerStatus();
    const stateValue = cbStatus.state === 'closed' ? 0 : cbStatus.state === 'open' ? 1 : 2;
    redisCircuitBreakerState.set(stateValue);
    redisCircuitBreakerErrors.set(cbStatus.errors);
    redisCircuitBreakerSuccesses.set(cbStatus.successes);
    
    // Recovery service events (if available)
    const recoveryService = getRecoveryService();
    if (recoveryService) {
      const status = recoveryService.getStatus();
      // Note: These are cumulative counters, so we set them directly
      // In a real implementation, we'd track deltas, but for now we'll use gauges
      if (status.metrics) {
        redisRecoveryEventsTotal.inc({ event_type: 'disconnect' }, 0); // Initialize
        redisRecoveryEventsTotal.inc({ event_type: 'reconnect' }, 0); // Initialize
      }
    }
  } catch (error: any) {
    logger.error('Error updating Redis metrics', { error: error.message });
  }
}

/**
 * Update Worker metrics (Phase 3)
 */
export function updateWorkerMetrics(): void {
  try {
    const { WorkerManager } = require('../services/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    
    const statuses = workerManager.getStatus();
    
    // Update per-worker metrics
    for (const status of statuses) {
      workerRestartTotal.set({ worker_name: status.name }, status.restartCount);
      workerStatus.set({ worker_name: status.name }, status.isRunning ? 1 : 0);
    }
    
    // Update totals
    const runningCount = statuses.filter((s: any) => s.isRunning).length;
    const enabledCount = statuses.filter((s: any) => s.isEnabled).length;
    
    workerRunningTotal.set(runningCount);
    workerEnabledTotal.set(enabledCount);
  } catch (error: any) {
    logger.error('Error updating Worker metrics', { error: error.message });
  }
}

/**
 * Initialize metrics collection
 */
export function initMetrics(): void {
  logger.info('Prometheus metrics initialized', {
    metricsCount: metricsRegistry.getMetricsAsArray().length,
  });
}


/**
 * Distributed Lock Metrics
 */
export const distributedLockAcquisitionsTotal = new Counter({
  name: 'distributed_lock_acquisitions_total',
  help: 'Total number of lock acquisition attempts',
  labelNames: ['key', 'status'], // status: success, failed, contention
  registers: [metricsRegistry],
});

export const distributedLockAcquisitionDuration = new Histogram({
  name: 'distributed_lock_acquisition_duration_ms',
  help: 'Lock acquisition duration in milliseconds',
  labelNames: ['key'],
  buckets: [10, 25, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [metricsRegistry],
});

export const distributedLockHoldDuration = new Histogram({
  name: 'distributed_lock_hold_duration_ms',
  help: 'Lock hold duration in milliseconds',
  labelNames: ['key'],
  buckets: [100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000],
  registers: [metricsRegistry],
});

export const distributedLockContentionTotal = new Counter({
  name: 'distributed_lock_contention_total',
  help: 'Total number of lock contention events',
  labelNames: ['key'],
  registers: [metricsRegistry],
});

export const distributedLockErrorsTotal = new Counter({
  name: 'distributed_lock_errors_total',
  help: 'Total number of lock errors',
  labelNames: ['key', 'error_type'],
  registers: [metricsRegistry],
});

export const distributedLockActiveGauge = new Gauge({
  name: 'distributed_lock_active',
  help: 'Number of currently active locks',
  registers: [metricsRegistry],
});

/**
 * Update distributed lock metrics
 */
export function updateDistributedLockMetrics(
  key: string,
  status: 'success' | 'failed' | 'contention',
  acquisitionDurationMs?: number,
  holdDurationMs?: number
): void {
  try {
    distributedLockAcquisitionsTotal.inc({ key, status });
    
    if (acquisitionDurationMs !== undefined) {
      distributedLockAcquisitionDuration.observe({ key }, acquisitionDurationMs);
    }
    
    if (holdDurationMs !== undefined) {
      distributedLockHoldDuration.observe({ key }, holdDurationMs);
    }
    
    if (status === 'contention') {
      distributedLockContentionTotal.inc({ key });
    }
  } catch (error: any) {
    logger.error('Error updating distributed lock metrics', {
      error: error.message,
    });
  }
}

/**
 * Record distributed lock error
 */
export function recordDistributedLockError(key: string, errorType: string): void {
  try {
    distributedLockErrorsTotal.inc({ key, error_type: errorType });
  } catch (error: any) {
    logger.error('Error recording distributed lock error', {
      error: error.message,
    });
  }
}

/**
 * Update active locks gauge
 */
export function updateActiveLocks(count: number): void {
  try {
    distributedLockActiveGauge.set(count);
  } catch (error: any) {
    logger.error('Error updating active locks gauge', {
      error: error.message,
    });
  }
}

/**
 * Idempotency Metrics
 */
export const idempotencyChecksTotal = new Counter({
  name: 'idempotency_checks_total',
  help: 'Total number of idempotency checks',
  labelNames: ['key', 'status'], // status: hit, miss, error
  registers: [metricsRegistry],
});

export const idempotencyCheckDuration = new Histogram({
  name: 'idempotency_check_duration_ms',
  help: 'Idempotency check duration in milliseconds',
  labelNames: ['key'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
  registers: [metricsRegistry],
});

export const idempotencyCacheHitRate = new Gauge({
  name: 'idempotency_cache_hit_rate',
  help: 'Idempotency cache hit rate (0-1)',
  registers: [metricsRegistry],
});

export const idempotencyDuplicatesPreventedTotal = new Counter({
  name: 'idempotency_duplicates_prevented_total',
  help: 'Total number of duplicate operations prevented',
  labelNames: ['resource_type'],
  registers: [metricsRegistry],
});

export const idempotencyFallbackUsageTotal = new Counter({
  name: 'idempotency_fallback_usage_total',
  help: 'Total number of times memory fallback was used',
  labelNames: ['reason'], // reason: redis_unavailable, redis_error
  registers: [metricsRegistry],
});

export const idempotencyCacheSizeGauge = new Gauge({
  name: 'idempotency_cache_size',
  help: 'Current size of in-memory idempotency cache',
  registers: [metricsRegistry],
});

export const idempotencyErrorsTotal = new Counter({
  name: 'idempotency_errors_total',
  help: 'Total number of idempotency errors',
  labelNames: ['key', 'error_type'],
  registers: [metricsRegistry],
});

/**
 * Update idempotency metrics
 */
export function updateIdempotencyMetrics(
  key: string,
  status: 'hit' | 'miss' | 'error',
  durationMs?: number
): void {
  try {
    idempotencyChecksTotal.inc({ key, status });
    
    if (durationMs !== undefined) {
      idempotencyCheckDuration.observe({ key }, durationMs);
    }
    
    // Update cache hit rate
    // Note: This is a simplified calculation, real implementation should track over time window
    const metrics = metricsRegistry.getSingleMetric('idempotency_checks_total') as Counter;
    if (metrics) {
      const allMetrics = (metrics as any).hashMap;
      let totalHits = 0;
      let totalChecks = 0;
      
      for (const [labels, metric] of Object.entries(allMetrics)) {
        const value = (metric as any).value || 0;
        totalChecks += value;
        if (labels.includes('status="hit"')) {
          totalHits += value;
        }
      }
      
      const hitRate = totalChecks > 0 ? totalHits / totalChecks : 0;
      idempotencyCacheHitRate.set(hitRate);
    }
  } catch (error: any) {
    logger.error('Error updating idempotency metrics', {
      error: error.message,
    });
  }
}

/**
 * Record idempotency error
 */
export function recordIdempotencyError(key: string, errorType: string): void {
  try {
    idempotencyErrorsTotal.inc({ key, error_type: errorType });
  } catch (error: any) {
    logger.error('Error recording idempotency error', {
      error: error.message,
    });
  }
}

/**
 * Update idempotency cache size
 */
export function updateIdempotencyCacheSize(size: number): void {
  try {
    idempotencyCacheSizeGauge.set(size);
  } catch (error: any) {
    logger.error('Error updating idempotency cache size', {
      error: error.message,
    });
  }
}

/**
 * Transaction Metrics
 */
export const transactionsTotal = new Counter({
  name: 'transactions_total',
  help: 'Total number of transactions',
  labelNames: ['status'], // status: success, rollback, error
  registers: [metricsRegistry],
});

export const transactionDuration = new Histogram({
  name: 'transaction_duration_ms',
  help: 'Transaction duration in milliseconds',
  labelNames: ['status'],
  buckets: [100, 250, 500, 1000, 2500, 5000, 10000, 30000],
  registers: [metricsRegistry],
});

export const transactionRollbackTotal = new Counter({
  name: 'transaction_rollback_total',
  help: 'Total number of transaction rollbacks',
  labelNames: ['reason'], // reason: timeout, transient, write_conflict, network, etc.
  registers: [metricsRegistry],
});

export const transactionRetryTotal = new Counter({
  name: 'transaction_retry_total',
  help: 'Total number of transaction retries',
  registers: [metricsRegistry],
});

export const transactionErrorsTotal = new Counter({
  name: 'transaction_errors_total',
  help: 'Total number of transaction errors',
  labelNames: ['error_type'],
  registers: [metricsRegistry],
});

/**
 * Update transaction metrics
 */
export function updateTransactionMetrics(
  status: 'success' | 'rollback' | 'error',
  durationMs: number
): void {
  try {
    transactionsTotal.inc({ status });
    transactionDuration.observe({ status }, durationMs);
    
    if (status === 'rollback') {
      transactionRetryTotal.inc();
    }
  } catch (error: any) {
    logger.error('Error updating transaction metrics', {
      error: error.message,
    });
  }
}

/**
 * Record transaction error
 */
export function recordTransactionError(errorType: string): void {
  try {
    transactionErrorsTotal.inc({ error_type: errorType });
    transactionRollbackTotal.inc({ reason: errorType });
  } catch (error: any) {
    logger.error('Error recording transaction error', {
      error: error.message,
    });
  }
}

/**
 * Queue Limiter Metrics
 */
export const queueSizeGauge = new Gauge({
  name: 'queue_size',
  help: 'Current number of jobs in queue',
  labelNames: ['queue', 'status'], // status: waiting, active, delayed
  registers: [metricsRegistry],
});

export const queuePressureGauge = new Gauge({
  name: 'queue_pressure_ratio',
  help: 'Queue pressure ratio (current/max)',
  labelNames: ['queue'],
  registers: [metricsRegistry],
});

export const queueRejectedJobsTotal = new Counter({
  name: 'queue_rejected_jobs_total',
  help: 'Total number of jobs rejected due to queue full',
  labelNames: ['queue'],
  registers: [metricsRegistry],
});

export const queueCleanupOperationsTotal = new Counter({
  name: 'queue_cleanup_operations_total',
  help: 'Total number of cleanup operations',
  labelNames: ['queue'],
  registers: [metricsRegistry],
});

export const queueCleanupJobsRemoved = new Counter({
  name: 'queue_cleanup_jobs_removed',
  help: 'Total number of jobs removed during cleanup',
  labelNames: ['queue', 'type'], // type: completed, failed
  registers: [metricsRegistry],
});

export const queueCleanupDuration = new Histogram({
  name: 'queue_cleanup_duration_ms',
  help: 'Queue cleanup duration in milliseconds',
  labelNames: ['queue'],
  buckets: [100, 500, 1000, 2500, 5000, 10000, 30000],
  registers: [metricsRegistry],
});

export const queueAlertThresholdExceeded = new Counter({
  name: 'queue_alert_threshold_exceeded_total',
  help: 'Total number of times queue exceeded alert threshold',
  labelNames: ['queue'],
  registers: [metricsRegistry],
});

/**
 * Update queue limiter metrics
 */
export function updateQueueLimiterMetrics(
  queueName: string,
  operation: 'cleanup' | 'rejection',
  jobsRemoved?: number,
  durationMs?: number
): void {
  try {
    if (operation === 'cleanup') {
      queueCleanupOperationsTotal.inc({ queue: queueName });
      
      if (jobsRemoved !== undefined) {
        queueCleanupJobsRemoved.inc({ queue: queueName, type: 'total' }, jobsRemoved);
      }
      
      if (durationMs !== undefined) {
        queueCleanupDuration.observe({ queue: queueName }, durationMs);
      }
    }
  } catch (error: any) {
    logger.error('Error updating queue limiter metrics', {
      error: error.message,
    });
  }
}

/**
 * Record queue rejection
 */
export function recordQueueRejection(queueName: string): void {
  try {
    queueRejectedJobsTotal.inc({ queue: queueName });
  } catch (error: any) {
    logger.error('Error recording queue rejection', {
      error: error.message,
    });
  }
}

/**
 * Update queue pressure
 */
export function updateQueuePressure(queueName: string, pressure: number): void {
  try {
    queuePressureGauge.set({ queue: queueName }, pressure);
    
    // Check if threshold exceeded (80%)
    if (pressure >= 0.8) {
      queueAlertThresholdExceeded.inc({ queue: queueName });
    }
  } catch (error: any) {
    logger.error('Error updating queue pressure', {
      error: error.message,
    });
  }
}

/**
 * Update queue size
 */
export function updateQueueSize(
  queueName: string,
  waiting: number,
  active: number,
  delayed: number
): void {
  try {
    queueSizeGauge.set({ queue: queueName, status: 'waiting' }, waiting);
    queueSizeGauge.set({ queue: queueName, status: 'active' }, active);
    queueSizeGauge.set({ queue: queueName, status: 'delayed' }, delayed);
  } catch (error: any) {
    logger.error('Error updating queue size', {
      error: error.message,
    });
  }
}

/**
 * DLQ Processor Metrics
 */
export const dlqJobsTotal = new Gauge({
  name: 'dlq_jobs_total',
  help: 'Total number of jobs in DLQ',
  labelNames: ['queue'],
  registers: [metricsRegistry],
});

export const dlqRetryAttemptsTotal = new Counter({
  name: 'dlq_retry_attempts_total',
  help: 'Total number of DLQ retry attempts',
  labelNames: ['queue', 'classification'], // classification: transient, rate_limit, etc.
  registers: [metricsRegistry],
});

export const dlqPermanentFailuresTotal = new Counter({
  name: 'dlq_permanent_failures_total',
  help: 'Total number of permanent failures moved to manual review',
  labelNames: ['queue', 'type'], // type: permanent, validation, etc.
  registers: [metricsRegistry],
});

export const dlqProcessingDuration = new Histogram({
  name: 'dlq_processing_duration_ms',
  help: 'DLQ processing duration in milliseconds',
  labelNames: ['queue'],
  buckets: [100, 500, 1000, 2500, 5000, 10000, 30000, 60000],
  registers: [metricsRegistry],
});

export const dlqJobsProcessed = new Counter({
  name: 'dlq_jobs_processed_total',
  help: 'Total number of DLQ jobs processed',
  labelNames: ['queue', 'action'], // action: retried, manual_review, skipped
  registers: [metricsRegistry],
});

export const dlqAlertsFired = new Counter({
  name: 'dlq_alerts_fired_total',
  help: 'Total number of DLQ size alerts fired',
  labelNames: ['queue'],
  registers: [metricsRegistry],
});

/**
 * Update DLQ metrics
 */
export function updateDLQMetrics(
  queueName: string,
  totalJobs: number,
  retried: number,
  manualReview: number
): void {
  try {
    dlqJobsTotal.set({ queue: queueName }, totalJobs);
    
    if (retried > 0) {
      dlqJobsProcessed.inc({ queue: queueName, action: 'retried' }, retried);
    }
    
    if (manualReview > 0) {
      dlqJobsProcessed.inc({ queue: queueName, action: 'manual_review' }, manualReview);
    }
  } catch (error: any) {
    logger.error('Error updating DLQ metrics', {
      error: error.message,
    });
  }
}

/**
 * Record DLQ retry
 */
export function recordDLQRetry(queueName: string, classification: string): void {
  try {
    dlqRetryAttemptsTotal.inc({ queue: queueName, classification });
  } catch (error: any) {
    logger.error('Error recording DLQ retry', {
      error: error.message,
    });
  }
}

/**
 * Record DLQ permanent failure
 */
export function recordDLQPermanentFailure(queueName: string, type: string): void {
  try {
    dlqPermanentFailuresTotal.inc({ queue: queueName, type });
  } catch (error: any) {
    logger.error('Error recording DLQ permanent failure', {
      error: error.message,
    });
  }
}

/**
 * Update DLQ size
 */
export function updateDLQSize(queueName: string, size: number): void {
  try {
    dlqJobsTotal.set({ queue: queueName }, size);
    
    // Fire alert if size exceeds threshold (100)
    if (size >= 100) {
      dlqAlertsFired.inc({ queue: queueName });
    }
  } catch (error: any) {
    logger.error('Error updating DLQ size', {
      error: error.message,
    });
  }
}




