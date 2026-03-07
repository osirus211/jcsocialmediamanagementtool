/**
 * Webhook Alert Adapter
 * 
 * Sends alerts to webhook endpoints (Slack/Discord compatible)
 * Non-blocking with timeout and error handling
 */

import { AlertAdapter, Alert, AlertSeverity } from './AlertAdapter';
import { logger } from '../../utils/logger';

export interface WebhookConfig {
  url: string;
  timeout?: number; // milliseconds
  format?: 'slack' | 'discord' | 'generic';
}

export class WebhookAlertAdapter implements AlertAdapter {
  private config: WebhookConfig;
  private readonly DEFAULT_TIMEOUT = 5000; // 5 seconds

  constructor(config: WebhookConfig) {
    this.config = {
      timeout: this.DEFAULT_TIMEOUT,
      format: 'generic',
      ...config,
    };
  }

  getName(): string {
    return `webhook(${this.config.format})`;
  }

  async sendAlert(alert: Alert): Promise<void> {
    try {
      const payload = this.formatPayload(alert);

      // Send with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn('Webhook alert failed', {
          adapter: this.getName(),
          status: response.status,
          statusText: response.statusText,
        });
      } else {
        logger.debug('Webhook alert sent successfully', {
          adapter: this.getName(),
          alertTitle: alert.title,
        });
      }

    } catch (error: any) {
      // NEVER throw - log and continue
      if (error.name === 'AbortError') {
        logger.warn('Webhook alert timeout', {
          adapter: this.getName(),
          timeout: this.config.timeout,
        });
      } else {
        logger.warn('Webhook alert error', {
          adapter: this.getName(),
          error: error.message,
        });
      }
    }
  }

  private formatPayload(alert: Alert): any {
    switch (this.config.format) {
      case 'slack':
        return this.formatSlack(alert);
      case 'discord':
        return this.formatDiscord(alert);
      default:
        return this.formatGeneric(alert);
    }
  }

  private formatSlack(alert: Alert): any {
    const color = this.getSeverityColor(alert.severity);
    
    return {
      attachments: [
        {
          color,
          title: alert.title,
          text: alert.message,
          fields: alert.metadata
            ? Object.entries(alert.metadata).map(([key, value]) => ({
                title: key,
                value: String(value),
                short: true,
              }))
            : [],
          footer: 'Social Media Scheduler',
          ts: Math.floor(alert.timestamp.getTime() / 1000),
        },
      ],
    };
  }

  private formatDiscord(alert: Alert): any {
    const color = this.getSeverityColorInt(alert.severity);
    
    return {
      embeds: [
        {
          title: alert.title,
          description: alert.message,
          color,
          fields: alert.metadata
            ? Object.entries(alert.metadata).map(([key, value]) => ({
                name: key,
                value: String(value),
                inline: true,
              }))
            : [],
          footer: {
            text: 'Social Media Scheduler',
          },
          timestamp: alert.timestamp.toISOString(),
        },
      ],
    };
  }

  private formatGeneric(alert: Alert): any {
    return {
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      timestamp: alert.timestamp.toISOString(),
      metadata: alert.metadata,
    };
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 'danger';
      case AlertSeverity.WARNING:
        return 'warning';
      case AlertSeverity.INFO:
        return 'good';
      default:
        return '#808080';
    }
  }

  private getSeverityColorInt(severity: AlertSeverity): number {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 0xff0000; // Red
      case AlertSeverity.WARNING:
        return 0xffa500; // Orange
      case AlertSeverity.INFO:
        return 0x00ff00; // Green
      default:
        return 0x808080; // Gray
    }
  }
}
