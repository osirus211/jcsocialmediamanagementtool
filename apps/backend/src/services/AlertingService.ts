/**
 * Alerting Service
 * 
 * Monitors metrics and triggers alerts based on thresholds:
 * - Token refresh failure rate > 10%
 * - Webhook error rate > 5%
 * - Queue backlog > 1000 jobs
 * - Circuit breaker open > 60 seconds
 */

import { logger } from '../utils/logger';
import { Redis } from 'ioredis';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertType =
  | 'token_refresh_failure_rate'
  | 'webhook_error_rate'
  | 'queue_backlog'
  | 'circuit_breaker_open';

interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

interface AlertThreshold {
  type: AlertType;
  threshold: number;
  severity: AlertSeverity;
  description: string;
}

// Alert thresholds
const ALERT_THRESHOLDS: AlertThreshold[] = [
  {
    type: 'token_refresh_failure_rate',
    threshold: 10, // 10%
    severity: 'CRITICAL',
    description: 'Token refresh failure rate exceeds 10%',
  },
  {
    type: 'webhook_error_rate',
    threshold: 5, // 5%
    severity: 'WARNING',
    description: 'Webhook error rate exceeds 5%',
  },
  {
    type: 'queue_backlog',
    threshold: 1000, // jobs
    severity: 'WARNING',
    description: 'Queue backlog exceeds 1000 jobs',
  },
  {
    type: 'circuit_breaker_open',
    threshold: 60, // seconds
    severity: 'CRITICAL',
    description: 'Circuit breaker open for more than 60 seconds',
  },
];

export class AlertingService {
  private readonly keyPrefix = 'alert:fired';
  private readonly alertCooldown = 300; // 5 minutes cooldown between same alerts

  constructor(private redis: Redis) {}

  /**
   * Check if alert should be fired
   * 
   * Implements cooldown to prevent alert spam
   */
  private async shouldFireAlert(type: AlertType, metadata: Record<string, any>): Promise<boolean> {
    const key = this.getAlertKey(type, metadata);
    const exists = await this.redis.exists(key);

    if (exists) {
      logger.debug('Alert in cooldown period', { type, metadata });
      return false;
    }

    // Set cooldown
    await this.redis.setex(key, this.alertCooldown, Date.now().toString());
    return true;
  }

  /**
   * Get alert key for cooldown tracking
   */
  private getAlertKey(type: AlertType, metadata: Record<string, any>): string {
    const metadataKey = Object.entries(metadata)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(':');
    return `${this.keyPrefix}:${type}:${metadataKey}`;
  }

  /**
   * Fire alert
   */
  private async fireAlert(alert: Alert): Promise<void> {
    // Log alert
    logger.error('ALERT FIRED', {
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      metadata: alert.metadata,
      timestamp: alert.timestamp,
      alert: alert.type.toUpperCase(),
    });

    // TODO: Send to external monitoring system (PagerDuty, Slack, etc.)
    // await this.sendToMonitoringSystem(alert);
  }

  /**
   * Check token refresh failure rate
   * 
   * @param provider - Provider name
   * @param successCount - Number of successful refreshes
   * @param failureCount - Number of failed refreshes
   */
  async checkTokenRefreshFailureRate(
    provider: string,
    successCount: number,
    failureCount: number
  ): Promise<void> {
    const totalAttempts = successCount + failureCount;
    if (totalAttempts === 0) return;

    const failureRate = (failureCount / totalAttempts) * 100;
    const threshold = ALERT_THRESHOLDS.find((t) => t.type === 'token_refresh_failure_rate');

    if (!threshold) return;

    if (failureRate > threshold.threshold) {
      const metadata = {
        provider,
        failureRate: failureRate.toFixed(2),
        successCount,
        failureCount,
        totalAttempts,
      };

      const shouldFire = await this.shouldFireAlert('token_refresh_failure_rate', metadata);

      if (shouldFire) {
        await this.fireAlert({
          type: 'token_refresh_failure_rate',
          severity: threshold.severity,
          message: `Token refresh failure rate for ${provider} is ${failureRate.toFixed(2)}% (threshold: ${threshold.threshold}%)`,
          metadata,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Check webhook error rate
   * 
   * @param provider - Provider name
   * @param successCount - Number of successful webhooks
   * @param errorCount - Number of failed webhooks
   */
  async checkWebhookErrorRate(
    provider: string,
    successCount: number,
    errorCount: number
  ): Promise<void> {
    const totalRequests = successCount + errorCount;
    if (totalRequests === 0) return;

    const errorRate = (errorCount / totalRequests) * 100;
    const threshold = ALERT_THRESHOLDS.find((t) => t.type === 'webhook_error_rate');

    if (!threshold) return;

    if (errorRate > threshold.threshold) {
      const metadata = {
        provider,
        errorRate: errorRate.toFixed(2),
        successCount,
        errorCount,
        totalRequests,
      };

      const shouldFire = await this.shouldFireAlert('webhook_error_rate', metadata);

      if (shouldFire) {
        await this.fireAlert({
          type: 'webhook_error_rate',
          severity: threshold.severity,
          message: `Webhook error rate for ${provider} is ${errorRate.toFixed(2)}% (threshold: ${threshold.threshold}%)`,
          metadata,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Check queue backlog
   * 
   * @param queueName - Queue name
   * @param backlogSize - Number of waiting jobs
   */
  async checkQueueBacklog(queueName: string, backlogSize: number): Promise<void> {
    const threshold = ALERT_THRESHOLDS.find((t) => t.type === 'queue_backlog');

    if (!threshold) return;

    if (backlogSize > threshold.threshold) {
      const metadata = {
        queueName,
        backlogSize,
        threshold: threshold.threshold,
      };

      const shouldFire = await this.shouldFireAlert('queue_backlog', metadata);

      if (shouldFire) {
        await this.fireAlert({
          type: 'queue_backlog',
          severity: threshold.severity,
          message: `Queue ${queueName} backlog is ${backlogSize} jobs (threshold: ${threshold.threshold})`,
          metadata,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Check circuit breaker open duration
   * 
   * @param provider - Provider name
   * @param operation - Operation name
   * @param openDurationSeconds - Duration circuit breaker has been open
   */
  async checkCircuitBreakerOpen(
    provider: string,
    operation: string,
    openDurationSeconds: number
  ): Promise<void> {
    const threshold = ALERT_THRESHOLDS.find((t) => t.type === 'circuit_breaker_open');

    if (!threshold) return;

    if (openDurationSeconds > threshold.threshold) {
      const metadata = {
        provider,
        operation,
        openDurationSeconds,
        threshold: threshold.threshold,
      };

      const shouldFire = await this.shouldFireAlert('circuit_breaker_open', metadata);

      if (shouldFire) {
        await this.fireAlert({
          type: 'circuit_breaker_open',
          severity: threshold.severity,
          message: `Circuit breaker for ${provider}:${operation} has been open for ${openDurationSeconds}s (threshold: ${threshold.threshold}s)`,
          metadata,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Get alert thresholds
   */
  getAlertThresholds(): AlertThreshold[] {
    return ALERT_THRESHOLDS;
  }

  /**
   * Clear alert cooldown (for testing)
   */
  async clearAlertCooldown(type: AlertType, metadata: Record<string, any>): Promise<void> {
    const key = this.getAlertKey(type, metadata);
    await this.redis.del(key);
  }
}
