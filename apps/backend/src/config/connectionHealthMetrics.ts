/**
 * Connection Health Metrics
 * 
 * Prometheus metrics for connection health monitoring
 */

import { Counter, Gauge, Histogram } from 'prom-client';
import { metricsRegistry } from './metrics';

/**
 * Connection Health Metrics
 */
let connectionHealthScore: Gauge<string>;
let expiredConnectionsTotal: Gauge<string>;
let reauthRequiredTotal: Gauge<string>;
let degradedConnectionsTotal: Gauge<string>;
let connectionHealthChecksTotal: Counter<string>;
let connectionStatusChangesTotal: Counter<string>;
let autoRecoveryAttemptsTotal: Counter<string>;
let webhookEventsEmittedTotal: Counter<string>;
let connectionApiFailureRate: Gauge<string>;
let connectionPublishErrorRate: Gauge<string>;
let healthCheckDuration: Histogram<string>;

try {
  connectionHealthScore = new Gauge({
    name: 'connection_health_score',
    help: 'Health score for social account connections (0-100)',
    labelNames: ['platform', 'account_id', 'workspace_id'],
    registers: [metricsRegistry],
  });

  expiredConnectionsTotal = new Gauge({
    name: 'expired_connections_total',
    help: 'Total number of expired connections',
    labelNames: ['platform'],
    registers: [metricsRegistry],
  });

  reauthRequiredTotal = new Gauge({
    name: 'reauth_required_total',
    help: 'Total number of connections requiring reauth',
    labelNames: ['platform'],
    registers: [metricsRegistry],
  });

  degradedConnectionsTotal = new Gauge({
    name: 'degraded_connections_total',
    help: 'Total number of degraded connections',
    labelNames: ['platform'],
    registers: [metricsRegistry],
  });

  connectionHealthChecksTotal = new Counter({
    name: 'connection_health_checks_total',
    help: 'Total number of connection health checks performed',
    labelNames: ['platform', 'status'],
    registers: [metricsRegistry],
  });

  connectionStatusChangesTotal = new Counter({
    name: 'connection_status_changes_total',
    help: 'Total number of connection status changes',
    labelNames: ['platform', 'from_status', 'to_status'],
    registers: [metricsRegistry],
  });

  autoRecoveryAttemptsTotal = new Counter({
    name: 'auto_recovery_attempts_total',
    help: 'Total number of auto-recovery attempts',
    labelNames: ['platform', 'status'],
    registers: [metricsRegistry],
  });

  webhookEventsEmittedTotal = new Counter({
    name: 'webhook_events_emitted_total',
    help: 'Total number of webhook events emitted',
    labelNames: ['event_type'],
    registers: [metricsRegistry],
  });

  connectionApiFailureRate = new Gauge({
    name: 'connection_api_failure_rate',
    help: 'API failure rate for connection (percentage)',
    labelNames: ['platform', 'account_id'],
    registers: [metricsRegistry],
  });

  connectionPublishErrorRate = new Gauge({
    name: 'connection_publish_error_rate',
    help: 'Publish error rate for connection (percentage)',
    labelNames: ['platform', 'account_id'],
    registers: [metricsRegistry],
  });

  healthCheckDuration = new Histogram({
    name: 'health_check_duration_ms',
    help: 'Duration of health check in milliseconds',
    labelNames: ['platform'],
    buckets: [100, 500, 1000, 2500, 5000, 10000],
    registers: [metricsRegistry],
  });
} catch (error) {
  // Metrics already registered, ignore error in test environment
  console.warn('Metrics already registered, using existing instances');
}

export { 
  connectionHealthScore,
  expiredConnectionsTotal,
  reauthRequiredTotal,
  degradedConnectionsTotal,
  connectionHealthChecksTotal,
  connectionStatusChangesTotal,
  autoRecoveryAttemptsTotal,
  webhookEventsEmittedTotal,
  connectionApiFailureRate,
  connectionPublishErrorRate,
  healthCheckDuration
};

/**
 * Helper Functions
 */

/**
 * Update connection health score
 */
export function updateConnectionHealthScore(
  platform: string,
  accountId: string,
  workspaceId: string,
  score: number
): void {
  connectionHealthScore.set({ platform, account_id: accountId, workspace_id: workspaceId }, score);
}

/**
 * Record health check
 */
export function recordHealthCheck(platform: string, status: string): void {
  connectionHealthChecksTotal.inc({ platform, status });
}

/**
 * Record status change
 */
export function recordStatusChange(platform: string, fromStatus: string, toStatus: string): void {
  connectionStatusChangesTotal.inc({ platform, from_status: fromStatus, to_status: toStatus });
}

/**
 * Record auto-recovery attempt
 */
export function recordAutoRecoveryAttempt(platform: string, status: 'success' | 'failed'): void {
  autoRecoveryAttemptsTotal.inc({ platform, status });
}

/**
 * Record webhook event
 */
export function recordWebhookEvent(eventType: string): void {
  webhookEventsEmittedTotal.inc({ event_type: eventType });
}

/**
 * Update API failure rate
 */
export function updateApiFailureRate(platform: string, accountId: string, rate: number): void {
  connectionApiFailureRate.set({ platform, account_id: accountId }, rate);
}

/**
 * Update publish error rate
 */
export function updatePublishErrorRate(platform: string, accountId: string, rate: number): void {
  connectionPublishErrorRate.set({ platform, account_id: accountId }, rate);
}

/**
 * Update expired connections count
 */
export function updateExpiredConnections(platform: string, count: number): void {
  expiredConnectionsTotal.set({ platform }, count);
}

/**
 * Update reauth required count
 */
export function updateReauthRequired(platform: string, count: number): void {
  reauthRequiredTotal.set({ platform }, count);
}

/**
 * Update degraded connections count
 */
export function updateDegradedConnections(platform: string, count: number): void {
  degradedConnectionsTotal.set({ platform }, count);
}

/**
 * Record health check duration
 */
export function recordHealthCheckDuration(platform: string, durationMs: number): void {
  healthCheckDuration.observe({ platform }, durationMs);
}
