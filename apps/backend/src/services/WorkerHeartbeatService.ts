import { getRedisClientSafe, recordCircuitBreakerSuccess, recordCircuitBreakerError } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Worker Heartbeat Service
 * 
 * Manages worker heartbeats and crash detection
 * Stores heartbeats in Redis with TTL for automatic cleanup
 */

export interface WorkerInfo {
  workerId: string;
  workerType: string;
  pid: number;
  hostname: string;
  startedAt: Date;
  lastHeartbeat: Date;
  status: 'active' | 'stale' | 'crashed';
  metadata?: Record<string, any>;
}

export interface HeartbeatData {
  workerId: string;
  workerType: string;
  pid: number;
  hostname: string;
  timestamp: Date;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  activeJobs: number;
  processedJobs: number;
  failedJobs: number;
  metadata?: Record<string, any>;
}

export class WorkerHeartbeatService {
  private static instance: WorkerHeartbeatService;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private workerId: string;
  private workerType: string;
  private startedAt: Date;
  private processedJobs: number = 0;
  private failedJobs: number = 0;
  private activeJobs: number = 0;
  private crashCallbacks: Array<(workerId: string) => void> = [];

  // Configuration
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly HEARTBEAT_TTL = 120000; // 2 minutes TTL
  private readonly STALE_THRESHOLD = 90000; // 90 seconds (3 missed heartbeats)
  private readonly MONITORING_INTERVAL = 60000; // 1 minute

  constructor(workerType: string, workerId?: string) {
    this.workerType = workerType;
    this.workerId = workerId || `${workerType}-${process.pid}-${Date.now()}`;
    this.startedAt = new Date();
  }

  static getInstance(workerType: string, workerId?: string): WorkerHeartbeatService {
    if (!WorkerHeartbeatService.instance) {
      WorkerHeartbeatService.instance = new WorkerHeartbeatService(workerType, workerId);
    }
    return WorkerHeartbeatService.instance;
  }

  /**
   * Start sending heartbeats
   */
  startHeartbeat(): void {
    if (this.heartbeatInterval) {
      logger.warn('Worker heartbeat already started', { workerId: this.workerId });
      return;
    }

    // Send initial heartbeat
    this.sendHeartbeat();

    // Setup periodic heartbeats
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL);

    logger.info('Worker heartbeat started', {
      workerId: this.workerId,
      workerType: this.workerType,
      interval: this.HEARTBEAT_INTERVAL,
    });
  }

  /**
   * Stop sending heartbeats
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;

      // Send final heartbeat with stopped status
      this.sendHeartbeat(true);

      logger.info('Worker heartbeat stopped', {
        workerId: this.workerId,
        workerType: this.workerType,
      });
    }
  }

  /**
   * Start monitoring other workers for crashes
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      logger.warn('Worker monitoring already started');
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkForCrashedWorkers();
      } catch (error: any) {
        logger.error('Error during worker monitoring', {
          error: error.message,
        });
      }
    }, this.MONITORING_INTERVAL);

    logger.info('Worker crash monitoring started', {
      monitoringInterval: this.MONITORING_INTERVAL,
      staleThreshold: this.STALE_THRESHOLD,
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Worker crash monitoring stopped');
    }
  }

  /**
   * Send heartbeat to Redis
   */
  private async sendHeartbeat(stopping: boolean = false): Promise<void> {
    const redis = getRedisClientSafe();
    if (!redis) {
      logger.debug('Redis unavailable - skipping heartbeat', { workerId: this.workerId });
      return;
    }

    try {
      const heartbeatData: HeartbeatData = {
        workerId: this.workerId,
        workerType: this.workerType,
        pid: process.pid,
        hostname: require('os').hostname(),
        timestamp: new Date(),
        uptime: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage(),
        activeJobs: this.activeJobs,
        processedJobs: this.processedJobs,
        failedJobs: this.failedJobs,
        metadata: {
          stopping,
          startedAt: this.startedAt,
        },
      };

      const key = `worker:heartbeat:${this.workerId}`;
      const ttlMs = stopping ? 10000 : this.HEARTBEAT_TTL; // Short TTL when stopping

      await redis.setex(key, Math.ceil(ttlMs / 1000), JSON.stringify(heartbeatData));
      recordCircuitBreakerSuccess();

      logger.debug('Heartbeat sent', {
        workerId: this.workerId,
        workerType: this.workerType,
        activeJobs: this.activeJobs,
        processedJobs: this.processedJobs,
        stopping,
      });

    } catch (error: any) {
      recordCircuitBreakerError();
      logger.error('Error sending heartbeat', {
        workerId: this.workerId,
        error: error.message,
      });
    }
  }

  /**
   * Check for crashed workers
   */
  private async checkForCrashedWorkers(): Promise<void> {
    const redis = getRedisClientSafe();
    if (!redis) {
      return;
    }

    try {
      // Get all worker heartbeat keys
      const keys = await redis.keys('worker:heartbeat:*');
      recordCircuitBreakerSuccess();

      const now = Date.now();
      const staleWorkers: string[] = [];

      for (const key of keys) {
        try {
          const data = await redis.get(key);
          if (!data) continue;

          const heartbeat: HeartbeatData = JSON.parse(data);
          const lastHeartbeat = new Date(heartbeat.timestamp).getTime();
          const timeSinceHeartbeat = now - lastHeartbeat;

          // Check if worker is stale (missed heartbeats)
          if (timeSinceHeartbeat > this.STALE_THRESHOLD) {
            staleWorkers.push(heartbeat.workerId);

            logger.warn('Stale worker detected', {
              workerId: heartbeat.workerId,
              workerType: heartbeat.workerType,
              pid: heartbeat.pid,
              hostname: heartbeat.hostname,
              timeSinceHeartbeat,
              threshold: this.STALE_THRESHOLD,
              lastHeartbeat: heartbeat.timestamp,
            });

            // Trigger crash callbacks
            this.triggerCrashCallbacks(heartbeat.workerId);

            // Remove stale heartbeat
            await redis.del(key);
          }

        } catch (parseError: any) {
          logger.error('Error parsing heartbeat data', {
            key,
            error: parseError.message,
          });
        }
      }

      if (staleWorkers.length > 0) {
        logger.warn('Detected stale workers', {
          count: staleWorkers.length,
          workers: staleWorkers,
        });
      }

    } catch (error: any) {
      recordCircuitBreakerError();
      logger.error('Error checking for crashed workers', {
        error: error.message,
      });
    }
  }

  /**
   * Get all active workers
   */
  async getActiveWorkers(): Promise<WorkerInfo[]> {
    const redis = getRedisClientSafe();
    if (!redis) {
      return [];
    }

    try {
      const keys = await redis.keys('worker:heartbeat:*');
      recordCircuitBreakerSuccess();

      const workers: WorkerInfo[] = [];
      const now = Date.now();

      for (const key of keys) {
        try {
          const data = await redis.get(key);
          if (!data) continue;

          const heartbeat: HeartbeatData = JSON.parse(data);
          const lastHeartbeat = new Date(heartbeat.timestamp).getTime();
          const timeSinceHeartbeat = now - lastHeartbeat;

          let status: 'active' | 'stale' | 'crashed' = 'active';
          if (timeSinceHeartbeat > this.STALE_THRESHOLD) {
            status = 'stale';
          }

          const workerInfo: WorkerInfo = {
            workerId: heartbeat.workerId,
            workerType: heartbeat.workerType,
            pid: heartbeat.pid,
            hostname: heartbeat.hostname,
            startedAt: new Date(heartbeat.metadata?.startedAt || heartbeat.timestamp),
            lastHeartbeat: new Date(heartbeat.timestamp),
            status,
            metadata: {
              uptime: heartbeat.uptime,
              memoryUsage: heartbeat.memoryUsage,
              activeJobs: heartbeat.activeJobs,
              processedJobs: heartbeat.processedJobs,
              failedJobs: heartbeat.failedJobs,
              timeSinceHeartbeat,
            },
          };

          workers.push(workerInfo);

        } catch (parseError: any) {
          logger.error('Error parsing worker heartbeat', {
            key,
            error: parseError.message,
          });
        }
      }

      return workers.sort((a, b) => a.workerId.localeCompare(b.workerId));

    } catch (error: any) {
      recordCircuitBreakerError();
      logger.error('Error getting active workers', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Update job counters
   */
  updateJobCounters(activeJobs: number, processedJobs?: number, failedJobs?: number): void {
    this.activeJobs = activeJobs;
    if (processedJobs !== undefined) {
      this.processedJobs = processedJobs;
    }
    if (failedJobs !== undefined) {
      this.failedJobs = failedJobs;
    }
  }

  /**
   * Increment processed jobs counter
   */
  incrementProcessedJobs(): void {
    this.processedJobs++;
  }

  /**
   * Increment failed jobs counter
   */
  incrementFailedJobs(): void {
    this.failedJobs++;
  }

  /**
   * Register crash callback
   */
  onWorkerCrash(callback: (workerId: string) => void): void {
    this.crashCallbacks.push(callback);
  }

  /**
   * Trigger crash callbacks
   */
  private triggerCrashCallbacks(workerId: string): void {
    for (const callback of this.crashCallbacks) {
      try {
        callback(workerId);
      } catch (error: any) {
        logger.error('Error in worker crash callback', {
          workerId,
          error: error.message,
        });
      }
    }
  }

  /**
   * Get worker health status for health checks
   */
  async getWorkerHealthStatus(): Promise<Record<string, any>> {
    const workers = await this.getActiveWorkers();
    
    const healthStatus = {
      totalWorkers: workers.length,
      activeWorkers: workers.filter(w => w.status === 'active').length,
      staleWorkers: workers.filter(w => w.status === 'stale').length,
      crashedWorkers: workers.filter(w => w.status === 'crashed').length,
      workers: workers.map(w => ({
        workerId: w.workerId,
        workerType: w.workerType,
        status: w.status,
        uptime: w.metadata?.uptime,
        activeJobs: w.metadata?.activeJobs,
        processedJobs: w.metadata?.processedJobs,
        lastHeartbeat: w.lastHeartbeat,
      })),
    };

    return healthStatus;
  }

  /**
   * Shutdown - stop heartbeat and monitoring
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down WorkerHeartbeatService', {
      workerId: this.workerId,
    });

    this.stopHeartbeat();
    this.stopMonitoring();

    // Clear any remaining heartbeat data
    const redis = getRedisClientSafe();
    if (redis) {
      try {
        await redis.del(`worker:heartbeat:${this.workerId}`);
        recordCircuitBreakerSuccess();
      } catch (error: any) {
        recordCircuitBreakerError();
        logger.error('Error cleaning up heartbeat on shutdown', {
          workerId: this.workerId,
          error: error.message,
        });
      }
    }

    logger.info('WorkerHeartbeatService shutdown complete');
  }
}

export const createWorkerHeartbeatService = (workerType: string, workerId?: string) => {
  return new WorkerHeartbeatService(workerType, workerId);
};