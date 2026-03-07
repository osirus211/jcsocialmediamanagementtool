/**
 * Worker Manager
 * 
 * Centralized management for all background workers
 * 
 * Features:
 * - Start/stop all workers
 * - Graceful shutdown
 * - Crash detection and recovery
 * - Health status reporting
 */

import { logger } from '../utils/logger';

export interface WorkerStatus {
  name: string;
  isRunning: boolean;
  startedAt?: Date;
  restartCount: number;
  lastError?: string;
  lastErrorAt?: Date;
}

export interface WorkerConfig {
  name: string;
  enabled: boolean;
  maxRestarts: number;
  restartDelay: number; // ms
}

export class WorkerManager {
  private static instance: WorkerManager;
  
  private workers: Map<string, any> = new Map();
  private workerStatus: Map<string, WorkerStatus> = new Map();
  private workerConfigs: Map<string, WorkerConfig> = new Map();
  private isShuttingDown: boolean = false;

  private constructor() {
    this.setupGracefulShutdown();
  }

  static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }

  /**
   * Register a worker
   */
  registerWorker(
    name: string,
    worker: any,
    config: Partial<WorkerConfig> = {}
  ): void {
    this.workers.set(name, worker);
    
    this.workerConfigs.set(name, {
      name,
      enabled: config.enabled !== false,
      maxRestarts: config.maxRestarts || 3,
      restartDelay: config.restartDelay || 5000,
    });
    
    this.workerStatus.set(name, {
      name,
      isRunning: false,
      restartCount: 0,
    });

    logger.info('Worker registered', { worker: name });
  }

  /**
   * Start all workers
   */
  async startAll(): Promise<void> {
    logger.info('Starting all workers...');
    
    const workerNames = Array.from(this.workers.keys());
    
    for (const name of workerNames) {
      const config = this.workerConfigs.get(name);
      if (config && config.enabled) {
        await this.startWorker(name);
      } else {
        logger.info('Worker disabled, skipping', { worker: name });
      }
    }
    
    logger.info('All workers started', {
      total: workerNames.length,
      running: this.getRunningWorkers().length,
    });
  }

  /**
   * Start specific worker
   */
  async startWorker(name: string): Promise<void> {
    const worker = this.workers.get(name);
    const status = this.workerStatus.get(name);
    
    if (!worker) {
      logger.error('Worker not found', { worker: name });
      return;
    }
    
    if (status?.isRunning) {
      logger.warn('Worker already running', { worker: name });
      return;
    }

    try {
      logger.info('Starting worker', { worker: name });
      
      // Start the worker
      if (typeof worker.start === 'function') {
        await worker.start();
      } else {
        logger.error('Worker does not have start method', { worker: name });
        return;
      }
      
      // Update status
      if (status) {
        status.isRunning = true;
        status.startedAt = new Date();
      }
      
      // Setup error handlers
      this.setupWorkerErrorHandlers(name, worker);
      
      logger.info('Worker started successfully', { worker: name });
    } catch (error: any) {
      logger.error('Failed to start worker', {
        worker: name,
        error: error.message,
      });
      
      if (status) {
        status.lastError = error.message;
        status.lastErrorAt = new Date();
      }
      
      throw error;
    }
  }

  /**
   * Stop all workers gracefully
   */
  async stopAll(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Already shutting down');
      return;
    }
    
    this.isShuttingDown = true;
    
    logger.info('Stopping all workers gracefully...');
    
    const workerNames = Array.from(this.workers.keys());
    
    for (const name of workerNames) {
      await this.stopWorker(name);
    }
    
    logger.info('All workers stopped');
  }

  /**
   * Stop specific worker
   */
  async stopWorker(name: string): Promise<void> {
    const worker = this.workers.get(name);
    const status = this.workerStatus.get(name);
    
    if (!worker) {
      logger.error('Worker not found', { worker: name });
      return;
    }
    
    if (!status?.isRunning) {
      logger.warn('Worker not running', { worker: name });
      return;
    }

    try {
      logger.info('Stopping worker', { worker: name });
      
      // Stop the worker
      if (typeof worker.stop === 'function') {
        await worker.stop();
      }
      
      // Update status
      if (status) {
        status.isRunning = false;
      }
      
      logger.info('Worker stopped successfully', { worker: name });
    } catch (error: any) {
      logger.error('Failed to stop worker', {
        worker: name,
        error: error.message,
      });
      
      throw error;
    }
  }

  /**
   * Restart specific worker
   */
  async restartWorker(name: string): Promise<void> {
    logger.info('Restarting worker', { worker: name });
    
    await this.stopWorker(name);
    
    // Wait before restart
    const config = this.workerConfigs.get(name);
    if (config) {
      await new Promise(resolve => setTimeout(resolve, config.restartDelay));
    }
    
    await this.startWorker(name);
  }

  /**
   * Handle worker crash
   */
  private async handleWorkerCrash(name: string, error: Error): Promise<void> {
    const status = this.workerStatus.get(name);
    const config = this.workerConfigs.get(name);
    
    if (!status || !config) {
      return;
    }
    
    // Update status
    status.isRunning = false;
    status.lastError = error.message;
    status.lastErrorAt = new Date();
    status.restartCount++;
    
    logger.error('Worker crashed', {
      alert: 'worker_crashed',
      worker: name,
      error: error.message,
      restartCount: status.restartCount,
      maxRestarts: config.maxRestarts,
    });
    
    // Check if we should restart
    if (status.restartCount <= config.maxRestarts && !this.isShuttingDown) {
      logger.info('Attempting to restart worker', {
        worker: name,
        attempt: status.restartCount,
        maxAttempts: config.maxRestarts,
      });
      
      try {
        await this.restartWorker(name);
        logger.info('Worker restarted successfully', { worker: name });
      } catch (restartError: any) {
        logger.error('Failed to restart worker', {
          worker: name,
          error: restartError.message,
        });
      }
    } else {
      logger.error('Worker restart limit exceeded', {
        alert: 'worker_restart_failed',
        worker: name,
        restartCount: status.restartCount,
        maxRestarts: config.maxRestarts,
      });
    }
  }

  /**
   * Setup error handlers for worker
   */
  private setupWorkerErrorHandlers(name: string, worker: any): void {
    // Handle worker errors
    if (worker.on && typeof worker.on === 'function') {
      worker.on('error', (error: Error) => {
        logger.error('Worker error event', {
          worker: name,
          error: error.message,
        });
        this.handleWorkerCrash(name, error);
      });
      
      worker.on('failed', (job: any, error: Error) => {
        logger.error('Worker job failed', {
          worker: name,
          jobId: job?.id,
          error: error.message,
        });
      });
      
      worker.on('stalled', (jobId: string) => {
        logger.warn('Worker job stalled', {
          worker: name,
          jobId,
        });
      });
    }
  }

  /**
   * Get status of all workers
   */
  getStatus(): WorkerStatus[] {
    return Array.from(this.workerStatus.values());
  }

  /**
   * Get status of specific worker
   */
  getWorkerStatus(name: string): WorkerStatus | undefined {
    return this.workerStatus.get(name);
  }

  /**
   * Get running workers
   */
  getRunningWorkers(): string[] {
    return Array.from(this.workerStatus.entries())
      .filter(([_, status]) => status.isRunning)
      .map(([name]) => name);
  }

  /**
   * Check if all workers are healthy
   */
  isHealthy(): boolean {
    const statuses = Array.from(this.workerStatus.values());
    
    // All enabled workers should be running
    for (const status of statuses) {
      const config = this.workerConfigs.get(status.name);
      if (config?.enabled && !status.isRunning) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        return;
      }
      
      logger.info(`${signal} received - shutting down workers`);
      
      try {
        await this.stopAll();
        logger.info('Workers shutdown complete');
        process.exit(0);
      } catch (error: any) {
        logger.error('Error during worker shutdown', { error: error.message });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Print status summary
   */
  printStatus(): void {
    const statuses = this.getStatus();
    
    console.log('\n' + '='.repeat(60));
    console.log('Worker Manager Status');
    console.log('='.repeat(60));
    
    for (const status of statuses) {
      const config = this.workerConfigs.get(status.name);
      const statusIcon = status.isRunning ? '✅' : '❌';
      const enabledText = config?.enabled ? 'enabled' : 'disabled';
      
      console.log(`${statusIcon} ${status.name} (${enabledText})`);
      
      if (status.isRunning && status.startedAt) {
        const uptime = Date.now() - status.startedAt.getTime();
        console.log(`   Uptime: ${Math.floor(uptime / 1000)}s`);
      }
      
      if (status.restartCount > 0) {
        console.log(`   Restarts: ${status.restartCount}`);
      }
      
      if (status.lastError) {
        console.log(`   Last error: ${status.lastError}`);
        if (status.lastErrorAt) {
          console.log(`   Error at: ${status.lastErrorAt.toISOString()}`);
        }
      }
    }
    
    console.log('='.repeat(60) + '\n');
  }
}

export const workerManager = WorkerManager.getInstance();
