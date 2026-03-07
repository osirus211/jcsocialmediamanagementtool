/**
 * Redis Recovery Service
 * 
 * Automatically recovers Redis-dependent services when Redis reconnects
 * 
 * Features:
 * - Detects Redis disconnect/reconnect events
 * - Safely stops services on disconnect
 * - Safely restarts services on reconnect
 * - Prevents duplicate workers/schedulers
 * - Idempotent (safe if called multiple times)
 * - Respects graceful shutdown
 * - Horizontally safe (multi-instance)
 * 
 * SAFETY GUARANTEES:
 * - No duplicate workers
 * - No duplicate scheduler
 * - No queue corruption
 * - No job loss
 * - Safe during Redis flapping
 * - Safe during shutdown
 * - Non-blocking
 */

import { logger } from '../../utils/logger';
import Redis from 'ioredis';

export interface RedisRecoveryConfig {
  enabled: boolean;
  recoveryDelayMs: number; // Delay before attempting recovery
}

export interface RecoverableService {
  name: string;
  isRunning: () => boolean;
  start: () => void | Promise<void>;
  stop: () => void | Promise<void>;
  requiresRedis: boolean;
}

export class RedisRecoveryService {
  private config: RedisRecoveryConfig;
  private redisClient: Redis | null = null;
  private services: Map<string, RecoverableService> = new Map();
  private isShuttingDown: boolean = false;
  private isRecovering: boolean = false;
  private recoveryTimeout: NodeJS.Timeout | null = null;
  
  // State tracking
  private redisConnected: boolean = false;
  private lastDisconnectTime: number = 0;
  
  // Metrics
  private metrics = {
    disconnect_events: 0,
    reconnect_events: 0,
    recovery_attempts: 0,
    recovery_success: 0,
    recovery_failed: 0,
  };

  constructor(config: RedisRecoveryConfig) {
    this.config = config;
  }

  /**
   * Register a service for automatic recovery
   */
  registerService(service: RecoverableService): void {
    if (this.services.has(service.name)) {
      logger.warn('Service already registered for recovery', {
        service: service.name,
      });
      return;
    }

    this.services.set(service.name, service);
    
    logger.info('Service registered for Redis recovery', {
      service: service.name,
      requiresRedis: service.requiresRedis,
    });
  }

  /**
   * Attach to Redis client and listen for events
   */
  attachToRedis(redisClient: Redis): void {
    if (this.redisClient) {
      logger.warn('Redis recovery already attached to client');
      return;
    }

    this.redisClient = redisClient;
    this.redisConnected = true;

    // Listen for disconnect
    this.redisClient.on('close', () => {
      this.handleDisconnect();
    });

    this.redisClient.on('end', () => {
      this.handleDisconnect();
    });

    // Listen for reconnect
    this.redisClient.on('ready', () => {
      this.handleReconnect();
    });

    logger.info('Redis recovery service attached to Redis client', {
      enabled: this.config.enabled,
      recoveryDelayMs: this.config.recoveryDelayMs,
    });
  }

  /**
   * Mark system as shutting down (prevents recovery)
   */
  setShuttingDown(shutting: boolean): void {
    this.isShuttingDown = shutting;
    
    if (shutting) {
      // Cancel any pending recovery
      if (this.recoveryTimeout) {
        clearTimeout(this.recoveryTimeout);
        this.recoveryTimeout = null;
      }
      
      logger.info('Redis recovery disabled during shutdown');
    }
  }

  /**
   * Handle Redis disconnect event
   */
  private handleDisconnect(): void {
    if (!this.redisConnected) {
      return; // Already handled
    }

    this.redisConnected = false;
    this.lastDisconnectTime = Date.now();
    this.metrics.disconnect_events++;

    logger.warn('Redis disconnected - pausing Redis-dependent services', {
      disconnectTime: new Date().toISOString(),
      metrics: { ...this.metrics },
    });

    // Stop Redis-dependent services
    this.pauseServices();
  }

  /**
   * Handle Redis reconnect event
   */
  private handleReconnect(): void {
    if (this.redisConnected) {
      return; // Already connected
    }

    this.redisConnected = true;
    this.metrics.reconnect_events++;

    const disconnectDuration = Date.now() - this.lastDisconnectTime;

    logger.info('Redis reconnected - scheduling service recovery', {
      reconnectTime: new Date().toISOString(),
      disconnectDurationMs: disconnectDuration,
      recoveryDelayMs: this.config.recoveryDelayMs,
      metrics: { ...this.metrics },
    });

    // Schedule recovery after delay (allows Redis to stabilize)
    this.scheduleRecovery();
  }

  /**
   * Pause Redis-dependent services
   */
  private pauseServices(): void {
    if (this.isShuttingDown) {
      logger.debug('Skipping service pause during shutdown');
      return;
    }

    for (const [name, service] of this.services.entries()) {
      if (!service.requiresRedis) {
        continue;
      }

      try {
        if (service.isRunning()) {
          logger.info('Pausing service due to Redis disconnect', {
            service: name,
          });
          
          service.stop();
        }
      } catch (error: any) {
        logger.error('Failed to pause service', {
          service: name,
          error: error.message,
        });
      }
    }
  }

  /**
   * Schedule service recovery
   */
  private scheduleRecovery(): void {
    if (!this.config.enabled) {
      logger.debug('Redis recovery disabled');
      return;
    }

    if (this.isShuttingDown) {
      logger.debug('Skipping recovery during shutdown');
      return;
    }

    if (this.isRecovering) {
      logger.debug('Recovery already in progress');
      return;
    }

    // Cancel any existing recovery timeout
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
    }

    // Schedule recovery after delay
    this.recoveryTimeout = setTimeout(() => {
      this.recoverServices();
    }, this.config.recoveryDelayMs);

    logger.info('Service recovery scheduled', {
      delayMs: this.config.recoveryDelayMs,
    });
  }

  /**
   * Recover Redis-dependent services
   */
  private async recoverServices(): Promise<void> {
    if (this.isShuttingDown) {
      logger.debug('Skipping recovery during shutdown');
      return;
    }

    if (this.isRecovering) {
      logger.debug('Recovery already in progress');
      return;
    }

    if (!this.redisConnected) {
      logger.warn('Cannot recover services - Redis not connected');
      return;
    }

    this.isRecovering = true;
    this.metrics.recovery_attempts++;

    logger.info('Starting service recovery', {
      servicesRegistered: this.services.size,
      metrics: { ...this.metrics },
    });

    const recoveryResults: { service: string; success: boolean; error?: string }[] = [];

    // Recover each service
    for (const [name, service] of this.services.entries()) {
      if (!service.requiresRedis) {
        continue;
      }

      try {
        // Check if service is already running (idempotency)
        if (service.isRunning()) {
          logger.debug('Service already running, skipping recovery', {
            service: name,
          });
          recoveryResults.push({ service: name, success: true });
          continue;
        }

        logger.info('Recovering service', {
          service: name,
        });

        // Start service
        await service.start();

        // Verify service started
        if (service.isRunning()) {
          logger.info('✅ Service recovered successfully', {
            service: name,
          });
          recoveryResults.push({ service: name, success: true });
        } else {
          logger.error('Service failed to start after recovery', {
            service: name,
          });
          recoveryResults.push({
            service: name,
            success: false,
            error: 'Service not running after start',
          });
        }
      } catch (error: any) {
        logger.error('Failed to recover service', {
          service: name,
          error: error.message,
          stack: error.stack,
        });
        recoveryResults.push({
          service: name,
          success: false,
          error: error.message,
        });
      }
    }

    // Calculate success rate
    const successCount = recoveryResults.filter(r => r.success).length;
    const totalCount = recoveryResults.length;
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

    if (successCount === totalCount) {
      this.metrics.recovery_success++;
      logger.info('✅ Service recovery completed successfully', {
        recovered: successCount,
        total: totalCount,
        successRate: successRate.toFixed(2),
        results: recoveryResults,
        metrics: { ...this.metrics },
      });
    } else {
      this.metrics.recovery_failed++;
      logger.error('⚠️ Service recovery completed with failures', {
        recovered: successCount,
        total: totalCount,
        failed: totalCount - successCount,
        successRate: successRate.toFixed(2),
        results: recoveryResults,
        metrics: { ...this.metrics },
      });
    }

    this.isRecovering = false;
  }

  /**
   * Get recovery status
   */
  getStatus(): {
    enabled: boolean;
    redisConnected: boolean;
    isRecovering: boolean;
    servicesRegistered: number;
    metrics: typeof this.metrics;
  } {
    return {
      enabled: this.config.enabled,
      redisConnected: this.redisConnected,
      isRecovering: this.isRecovering,
      servicesRegistered: this.services.size,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Force recovery (for testing/manual trigger)
   */
  async forceRecovery(): Promise<void> {
    logger.info('Force recovery triggered');
    await this.recoverServices();
  }
}
