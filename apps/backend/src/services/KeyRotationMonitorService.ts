import { keyRotationService } from './KeyRotationService';
import { logger } from '../utils/logger';

/**
 * Key Rotation Monitor Service
 * 
 * Monitors key rotation health and provides alerts
 */

export class KeyRotationMonitorService {
  private static instance: KeyRotationMonitorService;
  private monitorInterval: NodeJS.Timeout | null = null;
  private readonly MONITOR_INTERVAL = 60000; // 1 minute

  static getInstance(): KeyRotationMonitorService {
    if (!KeyRotationMonitorService.instance) {
      KeyRotationMonitorService.instance = new KeyRotationMonitorService();
    }
    return KeyRotationMonitorService.instance;
  }

  /**
   * Start monitoring key rotation health
   */
  startMonitoring(): void {
    if (this.monitorInterval) {
      logger.warn('Key rotation monitoring already started');
      return;
    }

    this.monitorInterval = setInterval(async () => {
      try {
        await this.checkRotationHealth();
      } catch (error: any) {
        logger.error('Key rotation health check failed', {
          error: error.message,
        });
      }
    }, this.MONITOR_INTERVAL);

    logger.info('Key rotation monitoring started', {
      interval: this.MONITOR_INTERVAL,
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      logger.info('Key rotation monitoring stopped');
    }
  }

  /**
   * Check key rotation health
   */
  private async checkRotationHealth(): Promise<void> {
    const health = await keyRotationService.monitorRotation();

    if (!health.healthy) {
      logger.warn('Key rotation health issues detected', {
        issues: health.issues,
        metrics: health.metrics,
      });

      // In production, send alerts here
      // await alertingService.sendAlert('key_rotation_unhealthy', health);
    } else {
      logger.debug('Key rotation health check passed', {
        metrics: health.metrics,
      });
    }
  }

  /**
   * Get monitoring status
   */
  getStatus(): { isMonitoring: boolean; interval: number } {
    return {
      isMonitoring: this.monitorInterval !== null,
      interval: this.MONITOR_INTERVAL,
    };
  }
}

export const keyRotationMonitorService = KeyRotationMonitorService.getInstance();