import { getRedisClientSafe, recordCircuitBreakerSuccess, recordCircuitBreakerError } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Distributed Lock Service
 * 
 * Provides efficient distributed locking using Redis SET NX EX
 * More efficient than Redlock for simple use cases
 * 
 * Features:
 * - Atomic lock acquisition with TTL
 * - Lock ownership verification
 * - Automatic expiry handling
 * - Circuit breaker integration
 * - Lock renewal for long operations
 */

export interface LockOptions {
  ttl?: number; // Lock TTL in milliseconds (default: 30000)
  retryAttempts?: number; // Number of retry attempts (default: 3)
  retryDelay?: number; // Delay between retries in ms (default: 100)
  renewInterval?: number; // Auto-renewal interval in ms (default: ttl/2)
}

export interface Lock {
  key: string;
  value: string;
  ttl: number;
  acquiredAt: Date;
  renewalTimer?: NodeJS.Timeout;
}

export interface LockMetrics {
  totalAcquired: number;
  totalReleased: number;
  totalRenewed: number;
  totalExpired: number;
  totalTimeouts: number;
  activeLocks: number;
  averageLockDuration: number;
}

export class DistributedLockService {
  private static instance: DistributedLockService;
  private activeLocks: Map<string, Lock> = new Map();
  
  // Metrics tracking
  private metrics = {
    totalAcquired: 0,
    totalReleased: 0,
    totalRenewed: 0,
    totalExpired: 0,
    totalTimeouts: 0,
    lockDurations: [] as number[],
  };
  
  // Timeout tracking for alerting
  private recentTimeouts: Array<{ resource: string; timestamp: Date }> = [];
  private readonly TIMEOUT_ALERT_THRESHOLD = 5; // Alert if 5+ timeouts in window
  private readonly TIMEOUT_ALERT_WINDOW_MS = 60000; // 1 minute window

  static getInstance(): DistributedLockService {
    if (!DistributedLockService.instance) {
      DistributedLockService.instance = new DistributedLockService();
    }
    return DistributedLockService.instance;
  }

  /**
   * Acquire a distributed lock using Redis SET NX EX
   */
  async acquireLock(
    resource: string,
    options: LockOptions = {}
  ): Promise<Lock | null> {
    const {
      ttl = 30000, // 30 seconds default
      retryAttempts = 3,
      retryDelay = 100,
    } = options;

    const redis = getRedisClientSafe();
    if (!redis) {
      logger.warn('Redis unavailable - cannot acquire distributed lock', { resource });
      return null;
    }

    const lockKey = `lock:${resource}`;
    const lockValue = `${process.pid}:${Date.now()}:${Math.random().toString(36).substring(7)}`;
    const ttlSeconds = Math.ceil(ttl / 1000);

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        // Atomic lock acquisition with TTL
        const result = await redis.set(lockKey, lockValue, 'PX', ttl, 'NX');
        
        if (result === 'OK') {
          recordCircuitBreakerSuccess();
          
          const lock: Lock = {
            key: lockKey,
            value: lockValue,
            ttl,
            acquiredAt: new Date(),
          };

          // Setup auto-renewal if requested
          if (options.renewInterval && options.renewInterval > 0) {
            this.setupAutoRenewal(lock, options.renewInterval);
          }

          this.activeLocks.set(lockKey, lock);
          
          // Track metrics
          this.metrics.totalAcquired++;

          logger.debug('Distributed lock acquired', {
            resource,
            lockKey,
            ttl,
            attempt,
            lockValue: lockValue.substring(0, 20) + '...',
          });

          return lock;
        }

        // Lock acquisition failed, retry if not last attempt
        if (attempt < retryAttempts) {
          await this.sleep(retryDelay * attempt); // Exponential backoff
        }

      } catch (error: any) {
        recordCircuitBreakerError();
        
        logger.error('Error acquiring distributed lock', {
          resource,
          lockKey,
          attempt,
          error: error.message,
        });

        // If this is the last attempt, throw the error
        if (attempt === retryAttempts) {
          throw new Error(`Failed to acquire lock after ${retryAttempts} attempts: ${error.message}`);
        }

        // Wait before retry
        await this.sleep(retryDelay * attempt);
      }
    }

    logger.warn('Failed to acquire distributed lock after all attempts', {
      resource,
      lockKey,
      retryAttempts,
    });

    return null;
  }

  /**
   * Release a distributed lock with ownership verification
   */
  async releaseLock(lock: Lock): Promise<boolean> {
    const redis = getRedisClientSafe();
    if (!redis) {
      logger.warn('Redis unavailable - cannot release distributed lock', { 
        lockKey: lock.key 
      });
      return false;
    }

    try {
      // Stop auto-renewal if active
      if (lock.renewalTimer) {
        clearInterval(lock.renewalTimer);
        lock.renewalTimer = undefined;
      }

      // Lua script for atomic ownership verification and deletion
      const luaScript = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;

      const result = await redis.eval(luaScript, 1, lock.key, lock.value) as number;
      
      recordCircuitBreakerSuccess();
      
      // Remove from active locks
      this.activeLocks.delete(lock.key);
      
      // Track metrics
      if (result === 1) {
        this.metrics.totalReleased++;
        const lockDuration = Date.now() - lock.acquiredAt.getTime();
        this.metrics.lockDurations.push(lockDuration);
        
        // Keep only last 100 durations for average calculation
        if (this.metrics.lockDurations.length > 100) {
          this.metrics.lockDurations.shift();
        }
      }

      if (result === 1) {
        logger.debug('Distributed lock released', {
          lockKey: lock.key,
          lockValue: lock.value.substring(0, 20) + '...',
          heldFor: Date.now() - lock.acquiredAt.getTime(),
        });
        return true;
      } else {
        logger.warn('Lock ownership verification failed during release', {
          lockKey: lock.key,
          lockValue: lock.value.substring(0, 20) + '...',
        });
        return false;
      }

    } catch (error: any) {
      recordCircuitBreakerError();
      
      logger.error('Error releasing distributed lock', {
        lockKey: lock.key,
        error: error.message,
      });

      // Remove from active locks even on error to prevent memory leaks
      this.activeLocks.delete(lock.key);
      
      return false;
    }
  }

  /**
   * Renew a lock's TTL
   */
  async renewLock(lock: Lock, newTtl?: number): Promise<boolean> {
    const redis = getRedisClientSafe();
    if (!redis) {
      logger.warn('Redis unavailable - cannot renew distributed lock', { 
        lockKey: lock.key 
      });
      return false;
    }

    const ttl = newTtl || lock.ttl;

    try {
      // Lua script for atomic ownership verification and TTL renewal
      const luaScript = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("PEXPIRE", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await redis.eval(luaScript, 1, lock.key, lock.value, ttl) as number;
      
      recordCircuitBreakerSuccess();

      if (result === 1) {
        lock.ttl = ttl;
        
        // Track metrics
        this.metrics.totalRenewed++;
        
        logger.debug('Distributed lock renewed', {
          lockKey: lock.key,
          newTtl: ttl,
          lockValue: lock.value.substring(0, 20) + '...',
        });
        return true;
      } else {
        logger.warn('Lock ownership verification failed during renewal', {
          lockKey: lock.key,
          lockValue: lock.value.substring(0, 20) + '...',
        });
        return false;
      }

    } catch (error: any) {
      recordCircuitBreakerError();
      
      logger.error('Error renewing distributed lock', {
        lockKey: lock.key,
        error: error.message,
      });
      
      return false;
    }
  }

  /**
   * Check if a lock is still held
   */
  async isLockHeld(lock: Lock): Promise<boolean> {
    const redis = getRedisClientSafe();
    if (!redis) {
      return false;
    }

    try {
      const currentValue = await redis.get(lock.key);
      recordCircuitBreakerSuccess();
      return currentValue === lock.value;
    } catch (error: any) {
      recordCircuitBreakerError();
      logger.error('Error checking lock status', {
        lockKey: lock.key,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Setup automatic lock renewal
   */
  private setupAutoRenewal(lock: Lock, renewInterval: number): void {
    lock.renewalTimer = setInterval(async () => {
      try {
        const renewed = await this.renewLock(lock);
        if (!renewed) {
          logger.warn('Failed to renew lock - stopping auto-renewal', {
            lockKey: lock.key,
          });
          
          if (lock.renewalTimer) {
            clearInterval(lock.renewalTimer);
            lock.renewalTimer = undefined;
          }
          
          // Remove from active locks since renewal failed
          this.activeLocks.delete(lock.key);
          
          // Track timeout
          this.trackLockTimeout(lock.key);
        }
      } catch (error: any) {
        logger.error('Error during auto-renewal', {
          lockKey: lock.key,
          error: error.message,
        });
      }
    }, renewInterval);

    logger.debug('Auto-renewal setup for lock', {
      lockKey: lock.key,
      renewInterval,
    });
  }

  /**
   * Get all active locks (for monitoring)
   */
  getActiveLocks(): Lock[] {
    return Array.from(this.activeLocks.values());
  }
  
  /**
   * Get lock metrics
   */
  getMetrics(): LockMetrics {
    const avgDuration = this.metrics.lockDurations.length > 0
      ? this.metrics.lockDurations.reduce((a, b) => a + b, 0) / this.metrics.lockDurations.length
      : 0;
    
    return {
      totalAcquired: this.metrics.totalAcquired,
      totalReleased: this.metrics.totalReleased,
      totalRenewed: this.metrics.totalRenewed,
      totalExpired: this.metrics.totalExpired,
      totalTimeouts: this.metrics.totalTimeouts,
      activeLocks: this.activeLocks.size,
      averageLockDuration: Math.round(avgDuration),
    };
  }
  
  /**
   * Track lock timeout and check for alert threshold
   */
  private trackLockTimeout(lockKey: string): void {
    const now = new Date();
    
    // Add to recent timeouts
    this.recentTimeouts.push({
      resource: lockKey,
      timestamp: now,
    });
    
    // Track metrics
    this.metrics.totalTimeouts++;
    
    // Clean up old timeouts outside the window
    const windowStart = now.getTime() - this.TIMEOUT_ALERT_WINDOW_MS;
    this.recentTimeouts = this.recentTimeouts.filter(
      t => t.timestamp.getTime() > windowStart
    );
    
    // Check if we should alert
    if (this.recentTimeouts.length >= this.TIMEOUT_ALERT_THRESHOLD) {
      this.alertFrequentTimeouts();
    }
  }
  
  /**
   * Alert on frequent lock timeouts
   */
  private alertFrequentTimeouts(): void {
    const timeoutsByResource = new Map<string, number>();
    
    for (const timeout of this.recentTimeouts) {
      const count = timeoutsByResource.get(timeout.resource) || 0;
      timeoutsByResource.set(timeout.resource, count + 1);
    }
    
    const topResources = Array.from(timeoutsByResource.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([resource, count]) => ({ resource, count }));
    
    logger.error('ALERT: Frequent lock timeouts detected', {
      totalTimeouts: this.recentTimeouts.length,
      windowMinutes: this.TIMEOUT_ALERT_WINDOW_MS / 60000,
      threshold: this.TIMEOUT_ALERT_THRESHOLD,
      topResources,
      metrics: this.getMetrics(),
    });
    
    // Clear recent timeouts after alerting to avoid spam
    this.recentTimeouts = [];
  }

  /**
   * Clean up expired locks from memory
   */
  cleanupExpiredLocks(): void {
    const now = Date.now();
    
    for (const [key, lock] of this.activeLocks.entries()) {
      const lockAge = now - lock.acquiredAt.getTime();
      
      // If lock is older than TTL + grace period, remove from memory
      if (lockAge > lock.ttl + 5000) { // 5 second grace period
        if (lock.renewalTimer) {
          clearInterval(lock.renewalTimer);
        }
        
        this.activeLocks.delete(key);
        
        // Track expired lock
        this.metrics.totalExpired++;
        
        logger.debug('Cleaned up expired lock from memory', {
          lockKey: key,
          lockAge,
          ttl: lock.ttl,
        });
      }
    }
  }

  /**
   * Shutdown - release all active locks
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down DistributedLockService', {
      activeLocks: this.activeLocks.size,
    });

    const releasePromises = Array.from(this.activeLocks.values()).map(lock => 
      this.releaseLock(lock).catch(error => {
        logger.error('Error releasing lock during shutdown', {
          lockKey: lock.key,
          error: error.message,
        });
      })
    );

    await Promise.all(releasePromises);
    
    logger.info('DistributedLockService shutdown complete');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const distributedLockService = DistributedLockService.getInstance();