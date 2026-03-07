/**
 * Alerting Service
 * 
 * Central service for sending alerts through multiple adapters
 * 
 * Features:
 * - Non-blocking alert delivery
 * - Multiple adapters support
 * - Alert deduplication (cooldown window)
 * - Never crashes on failure
 * - Horizontally safe (Redis-based deduplication)
 */

import { AlertAdapter, Alert, AlertSeverity } from './AlertAdapter';
import { logger } from '../../utils/logger';
import { getRedisClient } from '../../config/redis';

export interface AlertingConfig {
  enabled: boolean;
  cooldownMinutes: number; // Cooldown window for duplicate alerts
  adapters: AlertAdapter[];
}

export class AlertingService {
  private config: AlertingConfig;
  private readonly COOLDOWN_KEY_PREFIX = 'alert:cooldown:';

  constructor(config: AlertingConfig) {
    this.config = config;
  }

  /**
   * Send an alert through all configured adapters
   * NEVER throws - handles all errors internally
   */
  async sendAlert(alert: Alert): Promise<void> {
    try {
      // Check if alerting is enabled
      if (!this.config.enabled) {
        logger.debug('Alerting disabled, skipping alert', {
          title: alert.title,
        });
        return;
      }

      // Check if alert is in cooldown (deduplicate)
      const inCooldown = await this.isInCooldown(alert);
      if (inCooldown) {
        logger.debug('Alert in cooldown, skipping', {
          title: alert.title,
          cooldownMinutes: this.config.cooldownMinutes,
        });
        return;
      }

      // Set cooldown for this alert
      await this.setCooldown(alert);

      // Send through all adapters (non-blocking)
      const sendPromises = this.config.adapters.map(adapter =>
        this.sendThroughAdapter(adapter, alert)
      );

      // Wait for all adapters (but don't throw on failure)
      await Promise.allSettled(sendPromises);

      logger.info('Alert sent', {
        severity: alert.severity,
        title: alert.title,
        adapters: this.config.adapters.map(a => a.getName()),
      });

    } catch (error: any) {
      // NEVER throw - log and continue
      logger.error('AlertingService error', {
        error: error.message,
        alert: {
          title: alert.title,
          severity: alert.severity,
        },
      });
    }
  }

  /**
   * Send alert through a single adapter
   * Wraps adapter call with error handling
   */
  private async sendThroughAdapter(adapter: AlertAdapter, alert: Alert): Promise<void> {
    try {
      await adapter.sendAlert(alert);
    } catch (error: any) {
      // Adapter should never throw, but catch just in case
      logger.error('Alert adapter error', {
        adapter: adapter.getName(),
        error: error.message,
        alert: {
          title: alert.title,
          severity: alert.severity,
        },
      });
    }
  }

  /**
   * Check if alert is in cooldown period
   * Uses Redis for distributed deduplication
   */
  private async isInCooldown(alert: Alert): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const cooldownKey = this.getCooldownKey(alert);
      const exists = await redis.exists(cooldownKey);
      return exists === 1;
    } catch (error: any) {
      // If Redis fails, allow alert (fail open)
      logger.debug('Cooldown check failed, allowing alert', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Set cooldown for alert
   * Uses Redis with TTL for automatic expiry
   */
  private async setCooldown(alert: Alert): Promise<void> {
    try {
      const redis = getRedisClient();
      const cooldownKey = this.getCooldownKey(alert);
      const ttlSeconds = this.config.cooldownMinutes * 60;
      
      await redis.setex(cooldownKey, ttlSeconds, Date.now().toString());
    } catch (error: any) {
      // If Redis fails, continue anyway (alert will be sent)
      logger.debug('Failed to set cooldown', {
        error: error.message,
      });
    }
  }

  /**
   * Generate cooldown key for alert
   * Format: alert:cooldown:{severity}:{title_hash}
   */
  private getCooldownKey(alert: Alert): string {
    // Create a simple hash of the title for deduplication
    const titleHash = this.simpleHash(alert.title);
    return `${this.COOLDOWN_KEY_PREFIX}${alert.severity}:${titleHash}`;
  }

  /**
   * Simple hash function for alert titles
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Create a critical alert
   */
  createCriticalAlert(title: string, message: string, metadata?: any): Alert {
    return {
      severity: AlertSeverity.CRITICAL,
      title,
      message,
      timestamp: new Date(),
      metadata,
    };
  }

  /**
   * Create a warning alert
   */
  createWarningAlert(title: string, message: string, metadata?: any): Alert {
    return {
      severity: AlertSeverity.WARNING,
      title,
      message,
      timestamp: new Date(),
      metadata,
    };
  }

  /**
   * Create an info alert
   */
  createInfoAlert(title: string, message: string, metadata?: any): Alert {
    return {
      severity: AlertSeverity.INFO,
      title,
      message,
      timestamp: new Date(),
      metadata,
    };
  }

  /**
   * Get alerting configuration
   */
  getConfig(): AlertingConfig {
    return { ...this.config };
  }

  /**
   * Check if alerting is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}
