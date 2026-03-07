/**
 * Alert Adapter Interface
 * 
 * Defines the contract for alert delivery mechanisms
 * All adapters must be non-blocking and never throw
 */

export enum AlertSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

export interface Alert {
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
  metadata?: {
    [key: string]: any;
  };
}

export interface AlertAdapter {
  /**
   * Send an alert
   * MUST NOT throw - handle all errors internally
   * MUST be non-blocking
   */
  sendAlert(alert: Alert): Promise<void>;

  /**
   * Get adapter name for logging
   */
  getName(): string;
}
