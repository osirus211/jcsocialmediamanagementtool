import { logger } from '../utils/logger';
import { queueMonitoringService, QueueStats } from './QueueMonitoringService';
import { QueueBackpressureMonitor } from './monitoring/QueueBackpressureMonitor';
import { getEnabledBackpressureConfigs } from '../config/backpressure.config';
import { QueueManager } from '../queue/QueueManager';
import { AlertingService } from './alerting/AlertingService';
import { ConsoleAlertAdapter } from './alerting/ConsoleAlertAdapter';
import { WebhookAlertAdapter } from './alerting/WebhookAlertAdapter';
import { config } from '../config';

/**
 * Worker interface that all workers must implement
 */
export interface IWorker {
  start(): void;
  stop(): Promise<void>;
  getStatus(): { isRunning: boolean; metrics?: any };
}

/**
 * Worker status tracking
 */
export interface WorkerStatus {
  name: string;
  isRunning: boolean;
  isEnabled: boolean;
  startedAt: Date | null;
  stoppedAt: Date | null;
  restartCount: number;
  lastError: string | null;
  lastErrorAt: Date | null;
}

/**
 * Worker configuration
 */
export interface WorkerConfig {
  enabled: boolean;
  maxRestarts: number;
  restartDelay: number; // milliseconds
}

/**
 * Worker registration entry
 */
interface WorkerEntry {
  instance: IWorker;
  config: WorkerConfig;
  status: WorkerStatus;
}

/**
 * WorkerManager
 * 
 * Centralized lifecycle management for all background workers
 * 
 * Features:
 * - Worker registration with configuration
 * - Automatic startup of enabled workers
 * - Graceful shutdown on SIGTERM/SIGINT
 * - Crash detection and automatic restart
 * - Restart limit enforcement
 * - Status reporting and health checks
 * 
 * Usage:
 * ```typescript
 * const manager = WorkerManager.getInstance();
 * 
 * // Register workers
 * manager.registerWorker('scheduler', schedulerWorker, {
 *   enabled: true,
 *   maxRestarts: 5,
 *   restartDelay: 5000
 * });
 * 
 * // Start all enabled workers
 * await manager.startAll();
 * 
 * // Graceful shutdown
 * await manager.stopAll();
 * ```
 */
export class WorkerManager {
  private static instance: WorkerManager | null = null;
  private workers: Map<string, WorkerEntry> = new Map();
  private isShuttingDown: boolean = false;
  private backpressureMonitors: QueueBackpressureMonitor[] = [];
  private isBackpressureMonitoringStarted: boolean = false;

  private constructor() {
    logger.info('WorkerManager initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }

  /**
   * Register a worker with configuration
   * 
   * @param name - Unique worker identifier
   * @param instance - Worker instance implementing IWorker interface
   * @param config - Worker configuration (enabled, maxRestarts, restartDelay)
   */
  registerWorker(name: string, instance: IWorker, config: WorkerConfig): void {
    if (this.workers.has(name)) {
      logger.warn('Worker already registered, skipping', { worker: name });
      return;
    }

    const status: WorkerStatus = {
      name,
      isRunning: false,
      isEnabled: config.enabled,
      startedAt: null,
      stoppedAt: null,
      restartCount: 0,
      lastError: null,
      lastErrorAt: null,
    };

    this.workers.set(name, {
      instance,
      config,
      status,
    });

    logger.info('Worker registered', {
      worker: name,
      enabled: config.enabled,
      maxRestarts: config.maxRestarts,
      restartDelay: config.restartDelay,
    });
  }

  /**
   * Start all enabled workers
   */
  async startAll(): Promise<void> {
    logger.info('Starting all enabled workers', {
      totalWorkers: this.workers.size,
      enabledWorkers: Array.from(this.workers.values()).filter(w => w.config.enabled).length,
    });

    for (const [name, entry] of this.workers.entries()) {
      if (!entry.config.enabled) {
        logger.debug('Worker disabled, skipping startup', { worker: name });
        continue;
      }

      try {
        await this.startWorker(name);
      } catch (error: any) {
        logger.error('Failed to start worker', {
          worker: name,
          error: error.message,
        });
        // Continue starting other workers
      }
    }

    logger.info('Worker startup complete', {
      runningWorkers: Array.from(this.workers.values()).filter(w => w.status.isRunning).length,
    });

    // Start backpressure monitoring after all workers are started
    await this.startBackpressureMonitoring();
  }

  /**
   * Start a specific worker
   */
  private async startWorker(name: string): Promise<void> {
    const entry = this.workers.get(name);
    if (!entry) {
      throw new Error(`Worker not found: ${name}`);
    }

    if (entry.status.isRunning) {
      logger.warn('Worker already running', { worker: name });
      return;
    }

    logger.info('Starting worker', { worker: name });

    try {
      // Setup error handlers before starting
      this.setupWorkerErrorHandlers(name, entry.instance);

      // Start the worker
      entry.instance.start();

      // Update status
      entry.status.isRunning = true;
      entry.status.startedAt = new Date();
      entry.status.stoppedAt = null;

      logger.info('Worker started successfully', {
        worker: name,
        startedAt: entry.status.startedAt,
      });
    } catch (error: any) {
      logger.error('Worker startup failed', {
        worker: name,
        error: error.message,
      });

      // Update status
      entry.status.isRunning = false;
      entry.status.lastError = error.message;
      entry.status.lastErrorAt = new Date();

      throw error;
    }
  }

  /**
   * Stop all workers gracefully
   */
  async stopAll(): Promise<void> {
    this.isShuttingDown = true;

    // Stop backpressure monitoring first
    await this.stopBackpressureMonitoring();

    logger.info('Stopping all workers gracefully', {
      runningWorkers: Array.from(this.workers.values()).filter(w => w.status.isRunning).length,
    });

    const stopPromises: Promise<void>[] = [];

    for (const [name, entry] of this.workers.entries()) {
      if (!entry.status.isRunning) {
        continue;
      }

      stopPromises.push(this.stopWorker(name));
    }

    await Promise.all(stopPromises);

    logger.info('All workers stopped', {
      totalWorkers: this.workers.size,
    });
  }

  /**
   * Stop a specific worker
   */
  private async stopWorker(name: string): Promise<void> {
    const entry = this.workers.get(name);
    if (!entry) {
      throw new Error(`Worker not found: ${name}`);
    }

    if (!entry.status.isRunning) {
      logger.warn('Worker not running', { worker: name });
      return;
    }

    logger.info('Stopping worker', { worker: name });

    try {
      await entry.instance.stop();

      // Update status
      entry.status.isRunning = false;
      entry.status.stoppedAt = new Date();

      logger.info('Worker stopped successfully', {
        worker: name,
        stoppedAt: entry.status.stoppedAt,
      });
    } catch (error: any) {
      logger.error('Worker stop failed', {
        worker: name,
        error: error.message,
      });

      // Mark as stopped anyway
      entry.status.isRunning = false;
      entry.status.stoppedAt = new Date();
      entry.status.lastError = error.message;
      entry.status.lastErrorAt = new Date();
    }
  }

  /**
   * Handle worker crash and attempt restart
   */
  private async handleWorkerCrash(name: string, error: Error): Promise<void> {
    const entry = this.workers.get(name);
    if (!entry) {
      logger.error('Cannot handle crash for unknown worker', { worker: name });
      return;
    }

    // Update status
    entry.status.isRunning = false;
    entry.status.lastError = error.message;
    entry.status.lastErrorAt = new Date();
    entry.status.restartCount++;

    logger.error('Worker crashed', {
      worker: name,
      error: error.message,
      restartCount: entry.status.restartCount,
      maxRestarts: entry.config.maxRestarts,
    });

    // Check if we should restart
    if (this.isShuttingDown) {
      logger.info('System shutting down, not restarting worker', { worker: name });
      return;
    }

    if (entry.status.restartCount >= entry.config.maxRestarts) {
      logger.error('Worker restart limit exceeded', {
        worker: name,
        restartCount: entry.status.restartCount,
        maxRestarts: entry.config.maxRestarts,
      });
      return;
    }

    // Schedule restart after delay
    logger.info('Scheduling worker restart', {
      worker: name,
      delayMs: entry.config.restartDelay,
      attempt: entry.status.restartCount + 1,
    });

    setTimeout(async () => {
      await this.restartWorker(name);
    }, entry.config.restartDelay);
  }

  /**
   * Restart a crashed worker
   */
  private async restartWorker(name: string): Promise<void> {
    const entry = this.workers.get(name);
    if (!entry) {
      logger.error('Cannot restart unknown worker', { worker: name });
      return;
    }

    if (this.isShuttingDown) {
      logger.info('System shutting down, aborting restart', { worker: name });
      return;
    }

    logger.info('Restarting worker', {
      worker: name,
      attempt: entry.status.restartCount,
    });

    try {
      // Stop worker for cleanup (if still running)
      if (entry.status.isRunning) {
        await entry.instance.stop();
      }

      // Start worker
      await this.startWorker(name);

      logger.info('Worker restarted successfully', {
        worker: name,
        restartCount: entry.status.restartCount,
      });
    } catch (error: any) {
      logger.error('Worker restart failed', {
        worker: name,
        error: error.message,
      });

      // Update status
      entry.status.lastError = error.message;
      entry.status.lastErrorAt = new Date();
    }
  }

  /**
   * Setup error handlers for a worker
   * 
   * Note: This is a placeholder for event listener registration.
   * Actual implementation depends on worker event emitter pattern.
   */
  private setupWorkerErrorHandlers(name: string, worker: IWorker): void {
    // TODO: Implement event listener registration when workers support EventEmitter
    // For now, workers handle their own errors internally
    
    logger.debug('Worker error handlers setup', { worker: name });
  }

  /**
   * Get status of all workers
   */
  getStatus(): WorkerStatus[] {
    return Array.from(this.workers.values()).map(entry => ({ ...entry.status }));
  }

  /**
   * Get status of a specific worker
   */
  getWorkerStatus(name: string): WorkerStatus | null {
    const entry = this.workers.get(name);
    return entry ? { ...entry.status } : null;
  }

  /**
   * Check if all enabled workers are healthy (running)
   */
  isHealthy(): boolean {
    for (const entry of this.workers.values()) {
      if (entry.config.enabled && !entry.status.isRunning) {
        return false;
      }
    }
    return true;
  }

  /**
   * Print status for debugging
   */
  printStatus(): void {
    console.log('\n=== Worker Manager Status ===');
    console.log(`Total Workers: ${this.workers.size}`);
    console.log(`Healthy: ${this.isHealthy() ? 'YES' : 'NO'}`);
    console.log(`Shutting Down: ${this.isShuttingDown ? 'YES' : 'NO'}`);
    console.log('\nWorker Details:');

    for (const entry of this.workers.values()) {
      const status = entry.status;
      console.log(`\n  ${status.name}:`);
      console.log(`    Enabled: ${status.isEnabled}`);
      console.log(`    Running: ${status.isRunning}`);
      console.log(`    Restart Count: ${status.restartCount}/${entry.config.maxRestarts}`);
      if (status.startedAt) {
        console.log(`    Started At: ${status.startedAt.toISOString()}`);
      }
      if (status.lastError) {
        console.log(`    Last Error: ${status.lastError}`);
        console.log(`    Last Error At: ${status.lastErrorAt?.toISOString()}`);
      }
    }

    console.log('\n=============================\n');
  }

  /**
   * Register signal handlers for graceful shutdown
   */
  registerSignalHandlers(): void {
    const handleShutdown = async (signal: string) => {
      logger.info('Shutdown signal received', { signal });
      
      try {
        await this.stopAll();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error: any) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    logger.info('Signal handlers registered for graceful shutdown');
  }

  /**
   * Start backpressure monitoring for all enabled queues
   */
  private async startBackpressureMonitoring(): Promise<void> {
    if (this.isBackpressureMonitoringStarted) {
      logger.warn('Backpressure monitoring already started');
      return;
    }

    try {
      // Get enabled backpressure configs
      const configs = getEnabledBackpressureConfigs();
      
      if (configs.length === 0) {
        logger.info('No backpressure monitors configured');
        return;
      }

      // Get QueueManager instance
      let queueManager: QueueManager | null = null;
      try {
        queueManager = QueueManager.getInstance();
      } catch (error: any) {
        logger.warn('QueueManager not available, skipping backpressure monitoring', {
          error: error.message,
        });
        return;
      }

      // Create alerting service if alerting is enabled
      let alertingService: AlertingService | null = null;
      if (config.alerting.enabled) {
        const adapters: any[] = [new ConsoleAlertAdapter()];
        
        if (config.alerting.webhookUrl) {
          adapters.push(new WebhookAlertAdapter({
            url: config.alerting.webhookUrl,
            format: config.alerting.webhookFormat,
          }));
        }
        
        alertingService = new AlertingService({
          enabled: config.alerting.enabled,
          cooldownMinutes: config.alerting.cooldownMinutes,
          adapters,
        });
      }

      // Create and start a monitor for each queue
      for (const monitorConfig of configs) {
        try {
          const monitor = new QueueBackpressureMonitor(
            monitorConfig,
            queueManager,
            alertingService
          );
          
          monitor.start();
          this.backpressureMonitors.push(monitor);
          
          logger.debug('Backpressure monitor started', {
            queue: monitorConfig.queueName,
          });
        } catch (error: any) {
          logger.error('Failed to start backpressure monitor', {
            queue: monitorConfig.queueName,
            error: error.message,
          });
          // Continue with other monitors
        }
      }

      this.isBackpressureMonitoringStarted = true;

      logger.info('Backpressure monitoring started', {
        monitorCount: this.backpressureMonitors.length,
        queues: configs.map(c => c.queueName),
      });

    } catch (error: any) {
      logger.error('Failed to start backpressure monitoring', {
        error: error.message,
      });
      // Don't throw - continue without backpressure monitoring
    }
  }

  /**
   * Stop backpressure monitoring for all queues
   */
  private async stopBackpressureMonitoring(): Promise<void> {
    if (!this.isBackpressureMonitoringStarted) {
      return;
    }

    logger.info('Stopping backpressure monitoring', {
      monitorCount: this.backpressureMonitors.length,
    });

    for (const monitor of this.backpressureMonitors) {
      try {
        monitor.stop();
      } catch (error: any) {
        logger.error('Failed to stop backpressure monitor', {
          error: error.message,
        });
        // Continue stopping other monitors
      }
    }

    this.backpressureMonitors = [];
    this.isBackpressureMonitoringStarted = false;

    logger.info('Backpressure monitoring stopped');
  }

  /**
   * Get queue health for all monitored queues
   */
  async getQueueHealth(): Promise<QueueStats[]> {
    return await queueMonitoringService.getAllQueueStats();
  }

  /**
   * Check if all queues are healthy
   */
  async areQueuesHealthy(): Promise<boolean> {
    const stats = await this.getQueueHealth();
    return stats.every(s => s.health !== 'unhealthy');
  }

  /**
   * Check if WorkerManager is running
   * (Required by RedisRecoveryService)
   * 
   * Returns true if any enabled worker is running
   */
  isRunning(): boolean {
    for (const entry of this.workers.values()) {
      if (entry.config.enabled && entry.status.isRunning) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get Redis health status
   * 
   * Returns combined health information from:
   * - Redis connection status
   * - Circuit breaker state
   * - Recovery service status
   */
  getRedisHealth(): {
    isHealthy: boolean;
    circuitBreaker: any;
    recoveryService: any;
  } {
    try {
      const { isRedisHealthy, getCircuitBreakerStatus, getRecoveryService } = require('../config/redis');
      
      return {
        isHealthy: isRedisHealthy(),
        circuitBreaker: getCircuitBreakerStatus(),
        recoveryService: getRecoveryService()?.getStatus() || null,
      };
    } catch (error: any) {
      logger.error('Error getting Redis health', { error: error.message });
      return {
        isHealthy: false,
        circuitBreaker: null,
        recoveryService: null,
      };
    }
  }

  /**
   * Get running workers count
   */
  getRunningWorkers(): string[] {
    return Array.from(this.workers.values())
      .filter(entry => entry.status.isRunning)
      .map(entry => entry.status.name);
  }
}


// Export singleton instance for convenience
export const workerManager = WorkerManager.getInstance();
