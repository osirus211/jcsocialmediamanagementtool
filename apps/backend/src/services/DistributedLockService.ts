/**
 * Distributed Lock Service
 * 
 * Provides distributed locking using Redis to prevent race conditions
 * when multiple workers process the same resource.
 * 
 * Features:
 * - Redlock-inspired algorithm for single Redis instance
 * - Automatic lock expiration (TTL)
 * - Retry logic with exponential backoff
 * - Graceful degradation when Redis unavailable
 * - Metrics tracking for monitoring
 * 
 * Usage:
 * ```typescript
 * const lockService = DistributedLockService.getInstance();
 * 
 * // Acquire lock
 * const lock = await lockService.acquire('lock:post:123');
 * try {
 *   await publishPost(123);
 * } finally {
 *   await lockService.release(lock);
 * }
 * 
 * // Or use withLock helper
 * await lockService.withLock('lock:post:123', async () => {
 *   await publishPost(123);
 * });
 * ```
 */

import { getRedisClientSafe, recordCircuitBreakerSuccess, recordCircuitBreakerError } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { randomBytes } from 'crypto';
import {
  updateDistributedLockMetrics,
  recordDistributedLockError,
  updateActiveLocks,
} from '../config/metrics';

export interface LockOptions {
  ttl?: number;          // Lock TTL in milliseconds (default: 5000)
  retryCount?: number;   // Retry attempts (default: 3)
  retryDelay?: number;   // Delay between retries in ms (default: 200)
  retryAttempts?: number; // Alias for retryCount
  renewInterval?: number; // Auto-renewal interval in ms
}

export interface Lock {
  key: string;
  value: string;
  acquiredAt: Date;
  ttl: number;
  expiresAt: Date;
  renewalTimer?: NodeJS.Timeout; // Auto-renewal timer
}

export interface LockMetrics {
  acquisitions: {
    total: number;
    success: number;
    failed: number;
    contention: number;
  };
  releases: {
    total: number;
    success: number;
    failed: number;
  };
  timing: {
    acquisitionDurationMs: number[];
    holdDurationMs: number[];
  };
  // Additional metrics for tests
  totalAcquired?: number;
  totalReleased?: number;
  totalRenewed?: number;
  totalTimeouts?: number;
  averageLockDuration?: number;
}

export class LockAcquisitionError extends Error {
  constructor(key: string, reason: string) {
    super(`Failed to acquire lock for ${key}: ${reason}`);
    this.name = 'LockAcquisitionError';
  }
}

export class DistributedLockService {
  private static instance: DistributedLockService | null = null;
  
  private readonly DEFAULT_TTL = 5000;        // 5 seconds
  private readonly DEFAULT_RETRY_COUNT = 3;
  private readonly DEFAULT_RETRY_DELAY = 200; // 200ms
  
  private metrics: LockMetrics = {
    acquisitions: {
      total: 0,
      success: 0,
      failed: 0,
      contention: 0,
    },
    releases: {
      total: 0,
      success: 0,
      failed: 0,
    },
    timing: {
      acquisitionDurationMs: [],
      holdDurationMs: [],
    },
  };
  
  private activeLocks: Map<string, Lock> = new Map();
  
  private constructor() {
    logger.info('DistributedLockService initialized');
  }
  
  static getInstance(): DistributedLockService {
    if (!DistributedLockService.instance) {
      DistributedLockService.instance = new DistributedLockService();
    }
    return DistributedLockService.instance;
  }

  
  /**
   * Acquire a distributed lock
   * 
   * @param key - Lock key (e.g., "lock:post:123")
   * @param options - Lock options (ttl, retryCount, retryDelay)
   * @returns Lock object
   * @throws LockAcquisitionError if lock cannot be acquired
   */
  async acquire(key: string, options?: LockOptions): Promise<Lock> {
    const ttl = options?.ttl ?? this.DEFAULT_TTL;
    const retryCount = options?.retryCount ?? this.DEFAULT_RETRY_COUNT;
    const retryDelay = options?.retryDelay ?? this.DEFAULT_RETRY_DELAY;
    
    const startTime = Date.now();
    this.metrics.acquisitions.total++;
    
    // Check if feature is enabled
    const enabled = config.distributedLock.enabled;
    if (!enabled) {
      logger.warn('Distributed locking disabled, proceeding without lock', { key });
      // Return a dummy lock for graceful degradation
      const dummyLock: Lock = {
        key,
        value: 'disabled',
        acquiredAt: new Date(),
        ttl,
        expiresAt: new Date(Date.now() + ttl),
      };
      this.metrics.acquisitions.success++;
      return dummyLock;
    }
    
    // Try to acquire lock with retries
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const lock = await this.tryAcquire(key, ttl);
        
        if (lock) {
          // Lock acquired successfully
          const duration = Date.now() - startTime;
          this.metrics.acquisitions.success++;
          this.metrics.timing.acquisitionDurationMs.push(duration);
          this.activeLocks.set(key, lock);
          
          // Update Prometheus metrics
          updateDistributedLockMetrics(key, 'success', duration);
          updateActiveLocks(this.activeLocks.size);
          
          logger.debug('Lock acquired', {
            key,
            value: lock.value,
            ttl,
            attempt: attempt + 1,
            durationMs: duration,
          });
          
          return lock;
        }
        
        // Lock contention - another process holds the lock
        this.metrics.acquisitions.contention++;
        updateDistributedLockMetrics(key, 'contention');
        
        if (attempt < retryCount) {
          // Wait before retry with exponential backoff
          const delay = retryDelay * Math.pow(2, attempt);
          logger.debug('Lock contention, retrying', {
            key,
            attempt: attempt + 1,
            retryCount,
            delayMs: delay,
          });
          await this.sleep(delay);
        }
      } catch (error: any) {
        logger.error('Error acquiring lock', {
          key,
          attempt: attempt + 1,
          error: error.message,
        });
        
        // If Redis unavailable, check fallback behavior
        const fallbackEnabled = config.distributedLock.fallbackEnabled;
        if (fallbackEnabled) {
          logger.warn('Lock acquisition failed, proceeding without lock (fallback enabled)', { key });
          const fallbackLock: Lock = {
            key,
            value: 'fallback',
            acquiredAt: new Date(),
            ttl,
            expiresAt: new Date(Date.now() + ttl),
          };
          this.metrics.acquisitions.success++;
          return fallbackLock;
        }
        
        // Don't retry on Redis errors
        break;
      }
    }
    
    // Failed to acquire lock after all retries
    this.metrics.acquisitions.failed++;
    updateDistributedLockMetrics(key, 'failed');
    recordDistributedLockError(key, 'acquisition_failed');
    throw new LockAcquisitionError(key, `Failed after ${retryCount + 1} attempts`);
  }
  
  /**
   * Try to acquire lock once (no retries)
   */
  private async tryAcquire(key: string, ttl: number): Promise<Lock | null> {
    const redis = getRedisClientSafe();
    if (!redis) {
      throw new Error('Redis client unavailable');
    }
    
    // Generate unique lock value (prevents accidental release by another process)
    const value = this.generateLockValue();
    
    try {
      // SET key value NX PX ttl
      // NX = only set if not exists
      // PX = set expiry in milliseconds
      const result = await redis.set(key, value, 'PX', ttl, 'NX');
      
      recordCircuitBreakerSuccess();
      
      if (result === 'OK') {
        return {
          key,
          value,
          acquiredAt: new Date(),
          ttl,
          expiresAt: new Date(Date.now() + ttl),
        };
      }
      
      return null; // Lock already held by another process
    } catch (error: any) {
      recordCircuitBreakerError();
      throw error;
    }
  }
  
  /**
   * Release a distributed lock
   * 
   * @param lock - Lock object returned by acquire()
   */
  async release(lock: Lock): Promise<void> {
    this.metrics.releases.total++;
    
    // Check if this is a dummy/fallback lock
    if (lock.value === 'disabled' || lock.value === 'fallback') {
      this.metrics.releases.success++;
      return;
    }
    
    const redis = getRedisClientSafe();
    if (!redis) {
      logger.warn('Redis unavailable, cannot release lock', { key: lock.key });
      this.metrics.releases.failed++;
      return;
    }
    
    try {
      // Use Lua script to ensure we only delete our own lock
      // This prevents accidentally deleting a lock acquired by another process
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await redis.eval(script, 1, lock.key, lock.value);
      
      recordCircuitBreakerSuccess();
      
      if (result === 1) {
        // Calculate hold duration
        const holdDuration = Date.now() - lock.acquiredAt.getTime();
        this.metrics.timing.holdDurationMs.push(holdDuration);
        this.activeLocks.delete(lock.key);
        
        // Update Prometheus metrics
        updateDistributedLockMetrics(lock.key, 'success', undefined, holdDuration);
        updateActiveLocks(this.activeLocks.size);
        
        logger.debug('Lock released', {
          key: lock.key,
          holdDurationMs: holdDuration,
        });
        
        this.metrics.releases.success++;
      } else {
        logger.warn('Lock already released or expired', { key: lock.key });
        this.activeLocks.delete(lock.key);
        this.metrics.releases.success++;
      }
    } catch (error: any) {
      recordCircuitBreakerError();
      logger.error('Error releasing lock', {
        key: lock.key,
        error: error.message,
      });
      this.metrics.releases.failed++;
    }
  }
  
  /**
   * Execute function with automatic lock acquisition and release
   * 
   * @param key - Lock key
   * @param fn - Function to execute while holding lock
   * @param options - Lock options
   * @returns Result of function execution
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options?: LockOptions
  ): Promise<T> {
    const lock = await this.acquire(key, options);
    
    try {
      return await fn();
    } finally {
      await this.release(lock);
    }
  }
  
  /**
   * Generate unique lock value
   */
  private generateLockValue(): string {
    return `${process.pid}-${randomBytes(16).toString('hex')}`;
  }
  
  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get lock metrics
   */
  getMetrics(): LockMetrics {
    return {
      acquisitions: { ...this.metrics.acquisitions },
      releases: { ...this.metrics.releases },
      timing: {
        acquisitionDurationMs: [...this.metrics.timing.acquisitionDurationMs],
        holdDurationMs: [...this.metrics.timing.holdDurationMs],
      },
    };
  }
  
  /**
   * Get active locks count
   */
  getActiveLockCount(): number {
    return this.activeLocks.size;
  }
  
  /**
   * Get active locks
   */
  getActiveLocks(): Lock[] {
    return Array.from(this.activeLocks.values());
  }
  
  /**
   * Check if a lock is currently held
   */
  isLockHeld(key: string): boolean {
    return this.activeLocks.has(key);
  }
  
  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      acquisitions: {
        total: 0,
        success: 0,
        failed: 0,
        contention: 0,
      },
      releases: {
        total: 0,
        success: 0,
        failed: 0,
      },
      timing: {
        acquisitionDurationMs: [],
        holdDurationMs: [],
      },
    };
  }

  /**
   * Alias for acquire method (for compatibility)
   */
  async acquireLock(key: string, options?: LockOptions): Promise<Lock> {
    return this.acquire(key, options);
  }

  /**
   * Alias for release method (for compatibility)
   */
  async releaseLock(lock: Lock): Promise<void> {
    return this.release(lock);
  }

  /**
   * Renew lock TTL (extend expiration)
   */
  async renewLock(lock: Lock, ttl?: number): Promise<boolean> {
    try {
      const redisClient = getRedisClientSafe();
      if (!redisClient) {
        logger.warn('Redis client not available for lock renewal', { key: lock.key });
        return false;
      }
      
      // Use provided TTL or original TTL from lock
      const renewalTtl = ttl || (lock.expiresAt.getTime() - lock.acquiredAt.getTime());
      
      const result = await redisClient.expire(lock.key, Math.ceil(renewalTtl / 1000));
      if (result === 1) {
        lock.expiresAt = new Date(Date.now() + renewalTtl);
        logger.debug('Lock renewed', { key: lock.key, ttl: renewalTtl });
        return true;
      }
      return false;
    } catch (error: any) {
      logger.error('Failed to renew lock', { key: lock.key, error: error.message });
      return false;
    }
  }

  /**
   * Cleanup expired locks (stub method for tests)
   */
  async cleanupExpiredLocks(): Promise<void> {
    const now = Date.now();
    for (const [key, lock] of this.activeLocks.entries()) {
      if (lock.expiresAt.getTime() < now) {
        this.activeLocks.delete(key);
      }
    }
  }

  /**
   * Shutdown the service (stub method for tests)
   */
  async shutdown(): Promise<void> {
    this.activeLocks.clear();
    logger.info('DistributedLockService shutdown');
  }
}

// Export singleton instance
export const distributedLockService = DistributedLockService.getInstance();

