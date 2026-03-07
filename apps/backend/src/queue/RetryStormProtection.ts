/**
 * Retry Storm Protection
 * 
 * Prevents infinite retry storms that can overwhelm the system
 * Automatically pauses queue when failure rate is too high
 */

import { Queue } from 'bullmq';
import { logger } from '../utils/logger';
import { QueueManager } from './QueueManager';

export interface RetryStormConfig {
  windowMs: number; // Time window to track failures
  maxFailures: number; // Max failures in window before pausing
  pauseDurationMs: number; // How long to pause queue
  checkIntervalMs: number; // How often to check for storms
}

export class RetryStormProtection {
  private config: RetryStormConfig;
  private failureTimestamps: number[] = [];
  private isPaused: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private resumeTimeout: NodeJS.Timeout | null = null;
  private queueName: string;

  constructor(
    queueName: string,
    config?: Partial<RetryStormConfig>
  ) {
    this.queueName = queueName;
    this.config = {
      windowMs: 60000, // 1 minute
      maxFailures: 50, // 50 failures
      pauseDurationMs: 60000, // Pause for 60 seconds
      checkIntervalMs: 5000, // Check every 5 seconds
      ...config,
    };

    logger.info('Retry storm protection initialized', {
      queueName,
      config: this.config,
    });
  }

  /**
   * Start monitoring for retry storms
   */
  start(): void {
    if (this.checkInterval) {
      logger.warn('Retry storm protection already running');
      return;
    }

    this.checkInterval = setInterval(() => {
      this.checkForStorm();
    }, this.config.checkIntervalMs);

    logger.info('Retry storm protection started', {
      queueName: this.queueName,
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.resumeTimeout) {
      clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }

    logger.info('Retry storm protection stopped', {
      queueName: this.queueName,
    });
  }

  /**
   * Record a job failure
   */
  recordFailure(): void {
    const now = Date.now();
    this.failureTimestamps.push(now);

    // Clean old timestamps outside window
    this.cleanOldTimestamps();

    // Check if we should pause
    if (!this.isPaused && this.failureTimestamps.length >= this.config.maxFailures) {
      this.pauseQueue();
    }
  }

  /**
   * Clean timestamps outside the window
   */
  private cleanOldTimestamps(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;
    
    this.failureTimestamps = this.failureTimestamps.filter(
      (timestamp) => timestamp > cutoff
    );
  }

  /**
   * Check for retry storm
   */
  private checkForStorm(): void {
    this.cleanOldTimestamps();

    const failureCount = this.failureTimestamps.length;
    const failureRate = (failureCount / (this.config.windowMs / 1000)).toFixed(2);

    logger.debug('Retry storm check', {
      queueName: this.queueName,
      failureCount,
      failureRate: `${failureRate}/sec`,
      threshold: this.config.maxFailures,
      isPaused: this.isPaused,
    });

    if (!this.isPaused && failureCount >= this.config.maxFailures) {
      this.pauseQueue();
    }
  }

  /**
   * Pause queue due to retry storm
   */
  private async pauseQueue(): Promise<void> {
    if (this.isPaused) {
      return;
    }

    this.isPaused = true;

    try {
      const queueManager = QueueManager.getInstance();
      await queueManager.pauseQueue(this.queueName);

      const failureCount = this.failureTimestamps.length;
      const pauseDurationSec = this.config.pauseDurationMs / 1000;

      logger.error('ALERT: Retry storm detected - Queue paused', {
        queueName: this.queueName,
        failureCount,
        windowMs: this.config.windowMs,
        pauseDurationSec,
        severity: 'HIGH',
        action: 'queue_paused',
        resumeAt: new Date(Date.now() + this.config.pauseDurationMs).toISOString(),
      });

      // Schedule automatic resume
      this.resumeTimeout = setTimeout(() => {
        this.resumeQueue();
      }, this.config.pauseDurationMs);
    } catch (error: any) {
      logger.error('Failed to pause queue during retry storm', {
        queueName: this.queueName,
        error: error.message,
      });
      this.isPaused = false;
    }
  }

  /**
   * Resume queue after pause
   */
  private async resumeQueue(): Promise<void> {
    if (!this.isPaused) {
      return;
    }

    try {
      const queueManager = QueueManager.getInstance();
      await queueManager.resumeQueue(this.queueName);

      // Clear failure history
      this.failureTimestamps = [];
      this.isPaused = false;

      logger.info('Queue resumed after retry storm pause', {
        queueName: this.queueName,
        action: 'queue_resumed',
      });
    } catch (error: any) {
      logger.error('Failed to resume queue after retry storm', {
        queueName: this.queueName,
        error: error.message,
      });
    }
  }

  /**
   * Get current status
   */
  getStatus(): {
    isPaused: boolean;
    failureCount: number;
    failureRate: string;
  } {
    this.cleanOldTimestamps();
    const failureCount = this.failureTimestamps.length;
    const failureRate = (failureCount / (this.config.windowMs / 1000)).toFixed(2);

    return {
      isPaused: this.isPaused,
      failureCount,
      failureRate: `${failureRate}/sec`,
    };
  }

  /**
   * Manual pause (for testing or maintenance)
   */
  async manualPause(): Promise<void> {
    await this.pauseQueue();
  }

  /**
   * Manual resume (for testing or maintenance)
   */
  async manualResume(): Promise<void> {
    await this.resumeQueue();
  }
}
