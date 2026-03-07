/**
 * System Monitor
 * 
 * Monitors system health and triggers alerts when conditions are met
 * 
 * Features:
 * - Background polling (every 60 seconds)
 * - Checks 10 alert conditions
 * - Non-blocking, never crashes
 * - Horizontally safe (no distributed state)
 * - Production-safe
 * 
 * Alert Conditions:
 * 1. Worker heartbeat missing
 * 2. Scheduler heartbeat missing (via Redis)
 * 3. Redis connection lost (production only)
 * 4. MongoDB disconnected
 * 5. Queue failure rate too high
 * 6. Dead Letter Queue growing
 * 7. Token refresh failures spike
 * 8. Publishing failures spike
 * 9. Memory usage critical
 * 10. Health endpoint degraded/unhealthy
 */

import { AlertingService } from './AlertingService';
import { AlertSeverity } from './AlertAdapter';
import { logger } from '../../utils/logger';
import { getRedisClient } from '../../config/redis';
import { QueueManager } from '../../queue/QueueManager';
import mongoose from 'mongoose';
import { config } from '../../config';

export interface SystemMonitorConfig {
  enabled: boolean;
  pollInterval: number; // milliseconds
  memoryThresholdPercent: number; // e.g., 90
  queueFailureRateThreshold: number; // e.g., 20 (20%)
  deadLetterQueueThreshold: number; // e.g., 10 jobs
}

export class SystemMonitor {
  private alertingService: AlertingService;
  private config: SystemMonitorConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  
  // Track previous values for spike detection
  private previousMetrics = {
    tokenRefreshFailures: 0,
    publishingFailures: 0,
    deadLetterQueueSize: 0,
  };

  constructor(alertingService: AlertingService, config: SystemMonitorConfig) {
    this.alertingService = alertingService;
    this.config = config;
  }

  /**
   * Start the system monitor
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('System monitor already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('System monitor disabled');
      return;
    }

    this.isRunning = true;

    // Run immediately
    this.poll();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.poll();
    }, this.config.pollInterval);

    logger.info('System monitor started', {
      pollInterval: this.config.pollInterval,
      memoryThreshold: this.config.memoryThresholdPercent,
      queueFailureRateThreshold: this.config.queueFailureRateThreshold,
    });
  }

  /**
   * Stop the system monitor
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('System monitor not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;

    logger.info('System monitor stopped');
  }

  /**
   * Poll and check all alert conditions
   */
  private async poll(): Promise<void> {
    try {
      logger.debug('System monitor polling');

      // Check all conditions in parallel (non-blocking)
      await Promise.allSettled([
        this.checkWorkerHeartbeat(),
        this.checkSchedulerHeartbeat(),
        this.checkRedisConnection(),
        this.checkMongoDBConnection(),
        this.checkQueueFailureRate(),
        this.checkDeadLetterQueue(),
        this.checkTokenRefreshFailures(),
        this.checkPublishingFailures(),
        this.checkMemoryUsage(),
        this.checkHealthStatus(),
      ]);

    } catch (error: any) {
      // NEVER throw - log and continue
      logger.error('System monitor poll error', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * 1. Check worker heartbeat
   */
  private async checkWorkerHeartbeat(): Promise<void> {
    try {
      const redis = getRedisClient();
      const heartbeat = await redis.get('worker:heartbeat');
      
      if (!heartbeat) {
        await this.alertingService.sendAlert(
          this.alertingService.createCriticalAlert(
            'Worker Heartbeat Missing',
            'Publishing worker has not sent a heartbeat. Worker may be down or stuck.',
            { component: 'worker' }
          )
        );
        return;
      }

      const lastHeartbeat = parseInt(heartbeat, 10);
      const now = Date.now();
      const timeSinceHeartbeat = now - lastHeartbeat;

      // Alert if heartbeat is stale (>120 seconds)
      if (timeSinceHeartbeat > 120000) {
        await this.alertingService.sendAlert(
          this.alertingService.createCriticalAlert(
            'Worker Heartbeat Stale',
            `Publishing worker heartbeat is ${Math.floor(timeSinceHeartbeat / 1000)}s old. Worker may be stuck.`,
            {
              component: 'worker',
              lastHeartbeat: new Date(lastHeartbeat).toISOString(),
              timeSinceHeartbeatSeconds: Math.floor(timeSinceHeartbeat / 1000),
            }
          )
        );
      }

    } catch (error: any) {
      logger.debug('Worker heartbeat check failed', {
        error: error.message,
      });
    }
  }

  /**
   * 2. Check scheduler heartbeat
   */
  private async checkSchedulerHeartbeat(): Promise<void> {
    try {
      const redis = getRedisClient();
      const heartbeat = await redis.get('scheduler:heartbeat');
      
      if (!heartbeat) {
        await this.alertingService.sendAlert(
          this.alertingService.createCriticalAlert(
            'Scheduler Heartbeat Missing',
            'Scheduler has not sent a heartbeat. Scheduler may be down.',
            { component: 'scheduler' }
          )
        );
        return;
      }

      const lastHeartbeat = parseInt(heartbeat, 10);
      const now = Date.now();
      const timeSinceHeartbeat = now - lastHeartbeat;

      // Alert if heartbeat is stale (>90 seconds, scheduler polls every 30s)
      if (timeSinceHeartbeat > 90000) {
        await this.alertingService.sendAlert(
          this.alertingService.createCriticalAlert(
            'Scheduler Heartbeat Stale',
            `Scheduler heartbeat is ${Math.floor(timeSinceHeartbeat / 1000)}s old. Scheduler may be stuck.`,
            {
              component: 'scheduler',
              lastHeartbeat: new Date(lastHeartbeat).toISOString(),
              timeSinceHeartbeatSeconds: Math.floor(timeSinceHeartbeat / 1000),
            }
          )
        );
      }

    } catch (error: any) {
      logger.debug('Scheduler heartbeat check failed', {
        error: error.message,
      });
    }
  }

  /**
   * 3. Check Redis connection (production only)
   */
  private async checkRedisConnection(): Promise<void> {
    // Only check in production
    if (config.env !== 'production') {
      return;
    }

    try {
      const redis = getRedisClient();
      await redis.ping();
    } catch (error: any) {
      await this.alertingService.sendAlert(
        this.alertingService.createCriticalAlert(
          'Redis Connection Lost',
          'Cannot connect to Redis. Queue system and distributed locks unavailable.',
          {
            component: 'redis',
            error: error.message,
          }
        )
      );
    }
  }

  /**
   * 4. Check MongoDB connection
   */
  private async checkMongoDBConnection(): Promise<void> {
    try {
      if (mongoose.connection.readyState !== 1) {
        await this.alertingService.sendAlert(
          this.alertingService.createCriticalAlert(
            'MongoDB Disconnected',
            `MongoDB connection state: ${mongoose.connection.readyState}. Database unavailable.`,
            {
              component: 'mongodb',
              readyState: mongoose.connection.readyState,
            }
          )
        );
        return;
      }

      // Ping database
      await mongoose.connection.db.admin().ping();

    } catch (error: any) {
      await this.alertingService.sendAlert(
        this.alertingService.createCriticalAlert(
          'MongoDB Connection Error',
          'Cannot ping MongoDB. Database may be down.',
          {
            component: 'mongodb',
            error: error.message,
          }
        )
      );
    }
  }

  /**
   * 5. Check queue failure rate
   */
  private async checkQueueFailureRate(): Promise<void> {
    try {
      const queueManager = QueueManager.getInstance();
      const stats = await queueManager.getQueueStats('posting-queue');
      
      const failureRate = parseFloat(stats.failureRate);

      if (failureRate > this.config.queueFailureRateThreshold) {
        await this.alertingService.sendAlert(
          this.alertingService.createWarningAlert(
            'High Queue Failure Rate',
            `Posting queue failure rate is ${failureRate.toFixed(2)}% (threshold: ${this.config.queueFailureRateThreshold}%)`,
            {
              component: 'queue',
              failureRate: failureRate.toFixed(2),
              threshold: this.config.queueFailureRateThreshold,
              failed: stats.failed,
              total: stats.total,
            }
          )
        );
      }

    } catch (error: any) {
      logger.debug('Queue failure rate check failed', {
        error: error.message,
      });
    }
  }

  /**
   * 6. Check Dead Letter Queue size
   */
  private async checkDeadLetterQueue(): Promise<void> {
    try {
      const redis = getRedisClient();
      const dlqSize = await redis.llen('dlq:posting-queue');
      
      // Alert if DLQ is growing
      if (dlqSize > this.config.deadLetterQueueThreshold) {
        const growth = dlqSize - this.previousMetrics.deadLetterQueueSize;
        
        await this.alertingService.sendAlert(
          this.alertingService.createWarningAlert(
            'Dead Letter Queue Growing',
            `Dead Letter Queue has ${dlqSize} jobs (threshold: ${this.config.deadLetterQueueThreshold})`,
            {
              component: 'dlq',
              size: dlqSize,
              threshold: this.config.deadLetterQueueThreshold,
              growth,
            }
          )
        );
      }

      this.previousMetrics.deadLetterQueueSize = dlqSize;

    } catch (error: any) {
      logger.debug('DLQ check failed', {
        error: error.message,
      });
    }
  }

  /**
   * 7. Check token refresh failures
   */
  private async checkTokenRefreshFailures(): Promise<void> {
    try {
      const redis = getRedisClient();
      const failures = await redis.get('metrics:token_refresh:failed_total');
      
      if (!failures) {
        return;
      }

      const currentFailures = parseInt(failures, 10);
      const spike = currentFailures - this.previousMetrics.tokenRefreshFailures;

      // Alert if spike of 5+ failures since last check
      if (spike >= 5) {
        await this.alertingService.sendAlert(
          this.alertingService.createWarningAlert(
            'Token Refresh Failures Spike',
            `${spike} token refresh failures detected in last ${this.config.pollInterval / 1000}s`,
            {
              component: 'token-refresh',
              spike,
              totalFailures: currentFailures,
            }
          )
        );
      }

      this.previousMetrics.tokenRefreshFailures = currentFailures;

    } catch (error: any) {
      logger.debug('Token refresh failures check failed', {
        error: error.message,
      });
    }
  }

  /**
   * 8. Check publishing failures
   */
  private async checkPublishingFailures(): Promise<void> {
    try {
      const redis = getRedisClient();
      const failures = await redis.get('metrics:publish:failed_total');
      
      if (!failures) {
        return;
      }

      const currentFailures = parseInt(failures, 10);
      const spike = currentFailures - this.previousMetrics.publishingFailures;

      // Alert if spike of 10+ failures since last check
      if (spike >= 10) {
        await this.alertingService.sendAlert(
          this.alertingService.createWarningAlert(
            'Publishing Failures Spike',
            `${spike} publishing failures detected in last ${this.config.pollInterval / 1000}s`,
            {
              component: 'publishing',
              spike,
              totalFailures: currentFailures,
            }
          )
        );
      }

      this.previousMetrics.publishingFailures = currentFailures;

    } catch (error: any) {
      logger.debug('Publishing failures check failed', {
        error: error.message,
      });
    }
  }

  /**
   * 9. Check memory usage
   */
  private async checkMemoryUsage(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const percentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      if (percentage > this.config.memoryThresholdPercent) {
        await this.alertingService.sendAlert(
          this.alertingService.createCriticalAlert(
            'Critical Memory Usage',
            `Memory usage at ${percentage.toFixed(2)}% (${heapUsedMB}MB / ${heapTotalMB}MB)`,
            {
              component: 'memory',
              percentage: percentage.toFixed(2),
              heapUsedMB,
              heapTotalMB,
              threshold: this.config.memoryThresholdPercent,
            }
          )
        );
      }

    } catch (error: any) {
      logger.debug('Memory usage check failed', {
        error: error.message,
      });
    }
  }

  /**
   * 10. Check health endpoint status
   */
  private async checkHealthStatus(): Promise<void> {
    try {
      // Import health controller dynamically to avoid circular dependency
      const { healthController } = await import('../../controllers/HealthController');
      
      // Create mock request/response to call health check
      const mockRes: any = {
        status: (code: number) => mockRes,
        json: (data: any) => {
          // Check if health is degraded
          if (data.status === 'degraded') {
            this.alertingService.sendAlert(
              this.alertingService.createWarningAlert(
                'Health Endpoint Degraded',
                'System health check returned degraded status',
                {
                  component: 'health',
                  dependencies: data.dependencies,
                  uptime: data.uptime,
                }
              )
            );
          }
        },
      };

      await healthController.getHealth(null as any, mockRes);

    } catch (error: any) {
      logger.debug('Health status check failed', {
        error: error.message,
      });
    }
  }

  /**
   * Get monitor status
   */
  getStatus(): {
    isRunning: boolean;
    pollInterval: number;
    config: SystemMonitorConfig;
  } {
    return {
      isRunning: this.isRunning,
      pollInterval: this.config.pollInterval,
      config: { ...this.config },
    };
  }

  /**
   * Force poll (for testing/manual trigger)
   */
  async forcePoll(): Promise<void> {
    logger.info('Force poll triggered for system monitor');
    await this.poll();
  }
}
