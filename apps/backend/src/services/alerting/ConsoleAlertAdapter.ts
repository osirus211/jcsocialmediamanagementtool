/**
 * Console Alert Adapter
 * 
 * Logs alerts to console using existing logger
 * Default adapter - always available
 */

import { AlertAdapter, Alert, AlertSeverity } from './AlertAdapter';
import { logger } from '../../utils/logger';

export class ConsoleAlertAdapter implements AlertAdapter {
  getName(): string {
    return 'console';
  }

  async sendAlert(alert: Alert): Promise<void> {
    try {
      // Map severity to log level
      const logLevel = this.mapSeverityToLogLevel(alert.severity);

      // Log with structured data
      logger[logLevel](`🚨 ALERT: ${alert.title}`, {
        alert: {
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          timestamp: alert.timestamp.toISOString(),
          metadata: alert.metadata,
        },
      });

    } catch (error: any) {
      // Fallback to console.error if logger fails
      console.error('ConsoleAlertAdapter failed:', error.message);
      console.error('Alert:', alert);
    }
  }

  private mapSeverityToLogLevel(severity: AlertSeverity): 'error' | 'warn' | 'info' {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 'error';
      case AlertSeverity.WARNING:
        return 'warn';
      case AlertSeverity.INFO:
        return 'info';
      default:
        return 'info';
    }
  }
}
