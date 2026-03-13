import { getRedisClientSafe, recordCircuitBreakerSuccess, recordCircuitBreakerError } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Redis Memory Monitor
 * 
 * Monitors Redis memory usage and provides alerts
 * Helps prevent Redis OOM conditions
 */

export interface RedisMemoryInfo {
  usedMemory: number; // bytes
  usedMemoryHuman: string;
  usedMemoryRss: number; // bytes
  usedMemoryPeak: number; // bytes
  usedMemoryPeakHuman: string;
  totalSystemMemory: number; // bytes
  maxMemory: number; // bytes (0 = no limit)
  maxMemoryHuman: string;
  memoryFragmentationRatio: number;
  usedMemoryOverhead: number; // bytes
  usedMemoryDataset: number; // bytes
  allocatorFragmentation: number;
  allocatorResident: number;
  timestamp: Date;
}

export interface MemoryAlert {
  level: 'warning' | 'critical';
  message: string;
  memoryInfo: RedisMemoryInfo;
  threshold: number;
  actual: number;
}

export class RedisMemoryMonitor {
  private static instance: RedisMemoryMonitor;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertCallbacks: Array<(alert: MemoryAlert) => void> = [];
  
  // Thresholds (percentages)
  private readonly WARNING_THRESHOLD = 80; // 80%
  private readonly CRITICAL_THRESHOLD = 90; // 90%
  
  static getInstance(): RedisMemoryMonitor {
    if (!RedisMemoryMonitor.instance) {
      RedisMemoryMonitor.instance = new RedisMemoryMonitor();
    }
    return RedisMemoryMonitor.instance;
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      logger.warn('Redis memory monitoring already started');
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkMemoryUsage();
      } catch (error: any) {
        logger.error('Error during Redis memory monitoring', {
          error: error.message,
        });
      }
    }, intervalMs);

    logger.info('Redis memory monitoring started', {
      intervalMs,
      warningThreshold: this.WARNING_THRESHOLD,
      criticalThreshold: this.CRITICAL_THRESHOLD,
    });
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Redis memory monitoring stopped');
    }
  }

  /**
   * Get current Redis memory information
   */
  async getMemoryInfo(): Promise<RedisMemoryInfo | null> {
    const redis = getRedisClientSafe();
    if (!redis) {
      logger.warn('Redis unavailable - cannot get memory info');
      return null;
    }

    try {
      const info = await redis.info('memory');
      recordCircuitBreakerSuccess();

      // Parse memory info
      const lines = info.split('\r\n');
      const memoryData: Record<string, string> = {};

      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          memoryData[key] = value;
        }
      }

      const memoryInfo: RedisMemoryInfo = {
        usedMemory: parseInt(memoryData.used_memory || '0'),
        usedMemoryHuman: memoryData.used_memory_human || '0B',
        usedMemoryRss: parseInt(memoryData.used_memory_rss || '0'),
        usedMemoryPeak: parseInt(memoryData.used_memory_peak || '0'),
        usedMemoryPeakHuman: memoryData.used_memory_peak_human || '0B',
        totalSystemMemory: parseInt(memoryData.total_system_memory || '0'),
        maxMemory: parseInt(memoryData.maxmemory || '0'),
        maxMemoryHuman: memoryData.maxmemory_human || '0B',
        memoryFragmentationRatio: parseFloat(memoryData.mem_fragmentation_ratio || '1.0'),
        usedMemoryOverhead: parseInt(memoryData.used_memory_overhead || '0'),
        usedMemoryDataset: parseInt(memoryData.used_memory_dataset || '0'),
        allocatorFragmentation: parseFloat(memoryData.allocator_frag_ratio || '1.0'),
        allocatorResident: parseInt(memoryData.allocator_resident || '0'),
        timestamp: new Date(),
      };

      return memoryInfo;

    } catch (error: any) {
      recordCircuitBreakerError();
      logger.error('Error getting Redis memory info', {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Check memory usage and trigger alerts if needed
   */
  private async checkMemoryUsage(): Promise<void> {
    const memoryInfo = await this.getMemoryInfo();
    if (!memoryInfo) {
      return;
    }

    // Calculate memory usage percentage
    let usagePercentage = 0;
    let maxMemory = memoryInfo.maxMemory;

    if (maxMemory === 0) {
      // No memory limit set, use system memory
      maxMemory = memoryInfo.totalSystemMemory;
    }

    if (maxMemory > 0) {
      usagePercentage = (memoryInfo.usedMemory / maxMemory) * 100;
    }

    // Log memory status
    logger.debug('Redis memory status', {
      usedMemory: memoryInfo.usedMemoryHuman,
      maxMemory: memoryInfo.maxMemoryHuman,
      usagePercentage: usagePercentage.toFixed(1),
      fragmentationRatio: memoryInfo.memoryFragmentationRatio,
    });

    // Check thresholds and trigger alerts
    if (usagePercentage >= this.CRITICAL_THRESHOLD) {
      const alert: MemoryAlert = {
        level: 'critical',
        message: `Redis memory usage critical: ${usagePercentage.toFixed(1)}% (${memoryInfo.usedMemoryHuman})`,
        memoryInfo,
        threshold: this.CRITICAL_THRESHOLD,
        actual: usagePercentage,
      };

      logger.error('Redis memory usage critical', {
        usagePercentage: usagePercentage.toFixed(1),
        usedMemory: memoryInfo.usedMemoryHuman,
        maxMemory: memoryInfo.maxMemoryHuman,
        threshold: this.CRITICAL_THRESHOLD,
      });

      this.triggerAlert(alert);

    } else if (usagePercentage >= this.WARNING_THRESHOLD) {
      const alert: MemoryAlert = {
        level: 'warning',
        message: `Redis memory usage high: ${usagePercentage.toFixed(1)}% (${memoryInfo.usedMemoryHuman})`,
        memoryInfo,
        threshold: this.WARNING_THRESHOLD,
        actual: usagePercentage,
      };

      logger.warn('Redis memory usage high', {
        usagePercentage: usagePercentage.toFixed(1),
        usedMemory: memoryInfo.usedMemoryHuman,
        maxMemory: memoryInfo.maxMemoryHuman,
        threshold: this.WARNING_THRESHOLD,
      });

      this.triggerAlert(alert);
    }
  }

  /**
   * Trigger memory alert to all registered callbacks
   */
  private triggerAlert(alert: MemoryAlert): void {
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error: any) {
        logger.error('Error in memory alert callback', {
          error: error.message,
        });
      }
    }
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (alert: MemoryAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get memory usage percentage
   */
  async getMemoryUsagePercentage(): Promise<number | null> {
    const memoryInfo = await this.getMemoryInfo();
    if (!memoryInfo) {
      return null;
    }

    let maxMemory = memoryInfo.maxMemory;
    if (maxMemory === 0) {
      maxMemory = memoryInfo.totalSystemMemory;
    }

    if (maxMemory > 0) {
      return (memoryInfo.usedMemory / maxMemory) * 100;
    }

    return null;
  }

  /**
   * Force cleanup of Redis memory (if possible)
   */
  async forceCleanup(): Promise<boolean> {
    const redis = getRedisClientSafe();
    if (!redis) {
      logger.warn('Redis unavailable - cannot force cleanup');
      return false;
    }

    try {
      // Trigger Redis memory cleanup
      await (redis as any).memory('PURGE');
      recordCircuitBreakerSuccess();
      
      logger.info('Redis memory cleanup triggered');
      return true;

    } catch (error: any) {
      recordCircuitBreakerError();
      logger.error('Error triggering Redis memory cleanup', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get Redis memory statistics for monitoring
   */
  async getMemoryStats(): Promise<Record<string, any> | null> {
    const memoryInfo = await this.getMemoryInfo();
    if (!memoryInfo) {
      return null;
    }

    const usagePercentage = await this.getMemoryUsagePercentage();

    return {
      usedMemoryMB: Math.round(memoryInfo.usedMemory / 1024 / 1024),
      usedMemoryHuman: memoryInfo.usedMemoryHuman,
      maxMemoryMB: Math.round(memoryInfo.maxMemory / 1024 / 1024),
      maxMemoryHuman: memoryInfo.maxMemoryHuman,
      usagePercentage: usagePercentage ? usagePercentage.toFixed(1) : null,
      fragmentationRatio: memoryInfo.memoryFragmentationRatio,
      peakMemoryMB: Math.round(memoryInfo.usedMemoryPeak / 1024 / 1024),
      peakMemoryHuman: memoryInfo.usedMemoryPeakHuman,
      datasetMB: Math.round(memoryInfo.usedMemoryDataset / 1024 / 1024),
      overheadMB: Math.round(memoryInfo.usedMemoryOverhead / 1024 / 1024),
      timestamp: memoryInfo.timestamp,
    };
  }
}

export const redisMemoryMonitor = RedisMemoryMonitor.getInstance();