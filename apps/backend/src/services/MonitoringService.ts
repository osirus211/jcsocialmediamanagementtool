import { QueueManager } from '../queue/QueueManager';
import { getRedisClient } from '../config/redis';
import { alertLogger } from '../utils/alertLogger';
import { logger } from '../utils/logger';

/**
 * Monitoring Service
 * 
 * Monitors system health and triggers alerts
 */

class MonitoringService {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private previousQueueStats: any = null;

  /**
   * Start monitoring
   */
  start(): void {
    if (this.monitoringInterval) {
      logger.warn('Monitoring already started');
      return;
    }

    logger.info('Starting monitoring service...');

    // Run monitoring every 60 seconds
    this.monitoringInterval = setInterval(() => {
      this.runMonitoring();
    }, 60000);

    // Run initial monitoring
    this.runMonitoring();

    logger.info('Monitoring service started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Monitoring service stopped');
    }
  }

  /**
   * Run monitoring checks
   */
  private async runMonitoring(): Promise<void> {
    try {
      await Promise.all([
        this.checkWorkerHeartbeat(),
        this.checkQueueHealth(),
        this.checkMemoryUsage(),
      ]);
    } catch (error: any) {
      logger.error('Monitoring check failed', {
        error: error.message,
      });
    }
  }

  /**
   * Check worker heartbeat
   */
  private async checkWorkerHeartbeat(): Promise<void> {
    try {
      const redisClient = getRedisClient();
      const heartbeat = await redisClient.get('worker:heartbeat');

      if (!heartbeat) {
        alertLogger.workerHeartbeatStopped(0);
        return;
      }

      const lastHeartbeat = parseInt(heartbeat, 10);
      const now = Date.now();
      const timeSinceHeartbeat = now - lastHeartbeat;

      // Alert if heartbeat > 120 seconds
      if (timeSinceHeartbeat > 120000) {
        alertLogger.workerHeartbeatStopped(Math.floor(timeSinceHeartbeat / 1000));
      }
    } catch (error: any) {
      logger.error('Failed to check worker heartbeat', {
        error: error.message,
      });
    }
  }

  /**
   * Check queue health
   */
  private async checkQueueHealth(): Promise<void> {
    try {
      const queueManager = QueueManager.getInstance();
      const stats = await queueManager.getQueueStats('posting-queue');

      // Check failed jobs threshold
      const failedThreshold = 100;
      if (stats.failed > failedThreshold) {
        alertLogger.queueFailedThreshold(stats.failed, failedThreshold);
      }

      // Check if waiting jobs are growing
      if (this.previousQueueStats) {
        const previousWaiting = this.previousQueueStats.waiting;
        const currentWaiting = stats.waiting;

        // Alert if waiting jobs increased by > 50%
        if (previousWaiting > 0 && currentWaiting > previousWaiting * 1.5) {
          alertLogger.queueWaitingGrowing(currentWaiting, previousWaiting);
        }
      }

      // Store current stats for next check
      this.previousQueueStats = stats;
    } catch (error: any) {
      logger.error('Failed to check queue health', {
        error: error.message,
      });
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemoryUsage(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const totalMem = memUsage.heapTotal;
      const usedMem = memUsage.heapUsed;
      const percentage = (usedMem / totalMem) * 100;

      const usedMB = Math.round(usedMem / 1024 / 1024);
      const totalMB = Math.round(totalMem / 1024 / 1024);

      // Alert if memory usage > 85%
      if (percentage > 85) {
        alertLogger.highMemoryUsage(usedMB, totalMB, percentage);
      }
    } catch (error: any) {
      logger.error('Failed to check memory usage', {
        error: error.message,
      });
    }
  }

  /**
   * Get monitoring stats
   */
  async getStats(): Promise<{
    workerHeartbeat: {
      lastHeartbeat: number | null;
      timeSinceHeartbeat: number | null;
      healthy: boolean;
    };
    queue: any;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  }> {
    try {
      // Get worker heartbeat
      let lastHeartbeat: number | null = null;
      let timeSinceHeartbeat: number | null = null;
      let workerHealthy = false;

      try {
        const redisClient = getRedisClient();
        const heartbeat = await redisClient.get('worker:heartbeat');
        if (heartbeat) {
          lastHeartbeat = parseInt(heartbeat, 10);
          const now = Date.now();
          timeSinceHeartbeat = now - lastHeartbeat;
          workerHealthy = timeSinceHeartbeat < 120000;
        }
      } catch (error) {
        // Redis not available
      }

      // Get queue stats
      let queueStats = null;
      try {
        const queueManager = QueueManager.getInstance();
        queueStats = await queueManager.getQueueStats('posting-queue');
      } catch (error) {
        // Queue not available
      }

      // Get memory usage
      const memUsage = process.memoryUsage();
      const totalMem = memUsage.heapTotal;
      const usedMem = memUsage.heapUsed;
      const percentage = (usedMem / totalMem) * 100;

      return {
        workerHeartbeat: {
          lastHeartbeat,
          timeSinceHeartbeat,
          healthy: workerHealthy,
        },
        queue: queueStats,
        memory: {
          used: Math.round(usedMem / 1024 / 1024),
          total: Math.round(totalMem / 1024 / 1024),
          percentage: Math.round(percentage * 100) / 100,
        },
      };
    } catch (error: any) {
      logger.error('Failed to get monitoring stats', {
        error: error.message,
      });
      throw error;
    }
  }
}

export const monitoringService = new MonitoringService();
