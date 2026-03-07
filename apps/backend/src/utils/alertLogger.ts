import { logger } from './logger';

/**
 * Alert Logger
 * 
 * Simple alert system that logs critical issues
 * Can be extended to send to external monitoring services
 */

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

interface AlertContext {
  [key: string]: any;
}

class AlertLogger {
  /**
   * Log an alert
   */
  alert(severity: AlertSeverity, message: string, context?: AlertContext): void {
    const alertLog = {
      alert: true,
      severity,
      message,
      timestamp: new Date().toISOString(),
      ...context,
    };

    // Log with appropriate level
    switch (severity) {
      case AlertSeverity.CRITICAL:
      case AlertSeverity.HIGH:
        logger.error(`[ALERT][${severity}] ${message}`, alertLog);
        break;
      case AlertSeverity.MEDIUM:
        logger.warn(`[ALERT][${severity}] ${message}`, alertLog);
        break;
      case AlertSeverity.LOW:
        logger.info(`[ALERT][${severity}] ${message}`, alertLog);
        break;
    }

    // TODO: Send to external monitoring service (PagerDuty, Slack, etc.)
    // this.sendToMonitoring(alertLog);
  }

  /**
   * Worker stopped heartbeat alert
   */
  workerHeartbeatStopped(timeSinceLastHeartbeat: number): void {
    this.alert(
      AlertSeverity.CRITICAL,
      'Worker heartbeat stopped',
      {
        timeSinceLastHeartbeat,
        threshold: 120,
        unit: 'seconds',
      }
    );
  }

  /**
   * Queue failed jobs threshold alert
   */
  queueFailedThreshold(failedCount: number, threshold: number): void {
    this.alert(
      AlertSeverity.HIGH,
      'Queue failed jobs exceeded threshold',
      {
        failedCount,
        threshold,
      }
    );
  }

  /**
   * Queue waiting jobs growing alert
   */
  queueWaitingGrowing(waitingCount: number, previousCount: number): void {
    const growthRate = ((waitingCount - previousCount) / previousCount) * 100;

    this.alert(
      AlertSeverity.MEDIUM,
      'Queue waiting jobs growing rapidly',
      {
        waitingCount,
        previousCount,
        growthRate: `${growthRate.toFixed(1)}%`,
      }
    );
  }

  /**
   * Billing webhook error alert
   */
  billingWebhookError(eventType: string, error: string): void {
    this.alert(
      AlertSeverity.HIGH,
      'Billing webhook processing failed',
      {
        eventType,
        error,
      }
    );
  }

  /**
   * Token refresh failure alert
   */
  tokenRefreshFailed(accountId: string, platform: string, error: string): void {
    this.alert(
      AlertSeverity.MEDIUM,
      'Token refresh failed',
      {
        accountId,
        platform,
        error,
      }
    );
  }

  /**
   * Database connection lost alert
   */
  databaseConnectionLost(error: string): void {
    this.alert(
      AlertSeverity.CRITICAL,
      'Database connection lost',
      {
        error,
      }
    );
  }

  /**
   * Redis connection lost alert
   */
  redisConnectionLost(error: string): void {
    this.alert(
      AlertSeverity.CRITICAL,
      'Redis connection lost',
      {
        error,
      }
    );
  }

  /**
   * High memory usage alert
   */
  highMemoryUsage(usedMB: number, totalMB: number, percentage: number): void {
    this.alert(
      AlertSeverity.HIGH,
      'High memory usage detected',
      {
        usedMB,
        totalMB,
        percentage: `${percentage.toFixed(1)}%`,
      }
    );
  }

  /**
   * Stalled jobs detected alert
   */
  stalledJobsDetected(count: number): void {
    this.alert(
      AlertSeverity.MEDIUM,
      'Stalled jobs detected',
      {
        count,
      }
    );
  }

  /**
   * Post publishing failed alert
   */
  postPublishingFailed(postId: string, platform: string, error: string): void {
    this.alert(
      AlertSeverity.LOW,
      'Post publishing failed',
      {
        postId,
        platform,
        error,
      }
    );
  }

  /**
   * Scheduler stopped alert
   */
  schedulerStopped(error: string): void {
    this.alert(
      AlertSeverity.CRITICAL,
      'Scheduler stopped unexpectedly',
      {
        error,
      }
    );
  }

  /**
   * Rate limit exceeded alert
   */
  rateLimitExceeded(platform: string, endpoint: string): void {
    this.alert(
      AlertSeverity.MEDIUM,
      'Platform rate limit exceeded',
      {
        platform,
        endpoint,
      }
    );
  }
}

export const alertLogger = new AlertLogger();
