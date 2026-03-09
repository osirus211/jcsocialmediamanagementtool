/**
 * Idempotency Service
 * 
 * Ensures external API calls and critical operations can be safely retried
 * without causing duplicate side effects (duplicate posts, charges, webhooks).
 * 
 * Features:
 * - Redis-based idempotency key storage with 24-hour TTL
 * - In-memory fallback with LRU eviction (max 10k entries)
 * - Automatic result caching and retrieval
 * - Graceful degradation when Redis unavailable
 * - Metrics tracking for monitoring
 * 
 * Usage:
 * ```typescript
 * const idempotencyService = IdempotencyService.getInstance();
 * 
 * // Execute with idempotency
 * const result = await idempotencyService.withIdempotency(
 *   'post:123:1709812800:publish',
 *   async () => {
 *     return await publishToExternalAPI(post);
 *   },
 *   { ttl: 86400 }
 * );
 * ```
 */

import { getRedisClientSafe, recordCircuitBreakerSuccess, recordCircuitBreakerError } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  updateIdempotencyMetrics,
  recordIdempotencyError,
  updateIdempotencyCacheSize,
} from '../config/metrics';

export interface IdempotencyOptions {
  ttl?: number;          // TTL in seconds (default: 86400 = 24 hours)
  skipCache?: boolean;   // Skip cache check (force execution)
}

export interface IdempotencyResult<T> {
  value: T;
  cached: boolean;
  timestamp: Date;
}

export interface IdempotencyMetrics {
  checks: {
    total: number;
    hit: number;
    miss: number;
    error: number;
  };
  duplicatesPrevented: {
    total: number;
    byResourceType: Record<string, number>;
  };
  fallback: {
    memoryUsageCount: number;
    redisUnavailableCount: number;
  };
  timing: {
    checkDurationMs: number[];
    storeDurationMs: number[];
  };
}

interface CachedResult<T> {
  value: T;
  timestamp: Date;
}

export class IdempotencyService {
  private static instance: IdempotencyService | null = null;
  
  private readonly DEFAULT_TTL = 86400; // 24 hours in seconds
  private readonly MAX_MEMORY_ENTRIES = 10000;
  
  // In-memory fallback cache with LRU eviction
  private memoryCache: Map<string, CachedResult<any>> = new Map();
  private cacheAccessOrder: string[] = []; // Track access order for LRU
  
  private metrics: IdempotencyMetrics = {
    checks: {
      total: 0,
      hit: 0,
      miss: 0,
      error: 0,
    },
    duplicatesPrevented: {
      total: 0,
      byResourceType: {},
    },
    fallback: {
      memoryUsageCount: 0,
      redisUnavailableCount: 0,
    },
    timing: {
      checkDurationMs: [],
      storeDurationMs: [],
    },
  };
  
  private constructor() {
    logger.info('IdempotencyService initialized');
  }
  
  static getInstance(): IdempotencyService {
    if (!IdempotencyService.instance) {
      IdempotencyService.instance = new IdempotencyService();
    }
    return IdempotencyService.instance;
  }

  /**
   * Generate idempotency key
   * Format: {resourceType}:{resourceId}:{timestamp}:{operation}
   * 
   * @param resourceType - Type of resource (post, billing, webhook, etc.)
   * @param resourceId - Unique resource identifier
   * @param operation - Operation name (publish, charge, deliver, etc.)
   * @param timestamp - Optional timestamp (defaults to current time)
   * @returns Idempotency key string
   */
  generateKey(
    resourceType: string,
    resourceId: string,
    operation: string,
    timestamp?: Date
  ): string {
    const ts = timestamp ? Math.floor(timestamp.getTime() / 1000) : Math.floor(Date.now() / 1000);
    return `${resourceType}:${resourceId}:${ts}:${operation}`;
  }

  /**
   * Check if operation was already executed
   * 
   * @param key - Idempotency key
   * @returns Cached result if exists, null otherwise
   */
  async check<T>(key: string): Promise<IdempotencyResult<T> | null> {
    const startTime = Date.now();
    this.metrics.checks.total++;
    
    // Check if feature is enabled
    const enabled = config.features.idempotencyEnabled;
    if (!enabled) {
      logger.debug('Idempotency disabled, skipping check', { key });
      this.metrics.checks.miss++;
      return null;
    }
    
    try {
      // Try Redis first
      const redis = getRedisClientSafe();
      if (redis) {
        const redisKey = `idempotency:${key}`;
        const cached = await redis.get(redisKey);
        
        recordCircuitBreakerSuccess();
        
        if (cached) {
          // Cache hit
          const duration = Date.now() - startTime;
          this.metrics.checks.hit++;
          this.metrics.timing.checkDurationMs.push(duration);
          
          // Extract resource type for metrics
          const resourceType = key.split(':')[0];
          this.metrics.duplicatesPrevented.total++;
          this.metrics.duplicatesPrevented.byResourceType[resourceType] = 
            (this.metrics.duplicatesPrevented.byResourceType[resourceType] || 0) + 1;
          
          // Update Prometheus metrics
          updateIdempotencyMetrics(key, 'hit', duration);
          
          const result = JSON.parse(cached);
          
          logger.info('Idempotency cache hit - returning cached result', {
            key,
            resourceType,
            cachedAt: result.timestamp,
            durationMs: duration,
          });
          
          return {
            value: result.value,
            cached: true,
            timestamp: new Date(result.timestamp),
          };
        }
        
        // Cache miss
        const duration = Date.now() - startTime;
        this.metrics.checks.miss++;
        this.metrics.timing.checkDurationMs.push(duration);
        updateIdempotencyMetrics(key, 'miss', duration);
        
        logger.debug('Idempotency cache miss', { key, durationMs: duration });
        return null;
      }
      
      // Redis unavailable - fall back to memory cache
      this.metrics.fallback.redisUnavailableCount++;
      logger.warn('Redis unavailable, checking in-memory cache', { key });
      
      return this.checkMemoryCache<T>(key);
      
    } catch (error: any) {
      recordCircuitBreakerError();
      this.metrics.checks.error++;
      recordIdempotencyError(key, 'check_failed');
      
      logger.error('Idempotency check failed', {
        key,
        error: error.message,
      });
      
      // Fall back to memory cache on error
      const fallbackEnabled = config.features.idempotencyFallbackToMemory;
      if (fallbackEnabled) {
        this.metrics.fallback.memoryUsageCount++;
        return this.checkMemoryCache<T>(key);
      }
      
      // If fallback disabled, return null (proceed with operation)
      return null;
    }
  }

  /**
   * Store operation result for idempotency
   * 
   * @param key - Idempotency key
   * @param result - Operation result to cache
   * @param options - Storage options (TTL)
   */
  async store<T>(key: string, result: T, options?: IdempotencyOptions): Promise<void> {
    const startTime = Date.now();
    const ttl = options?.ttl ?? this.DEFAULT_TTL;
    
    // Check if feature is enabled
    const enabled = config.features.idempotencyEnabled;
    if (!enabled) {
      logger.debug('Idempotency disabled, skipping store', { key });
      return;
    }
    
    const cachedResult: CachedResult<T> = {
      value: result,
      timestamp: new Date(),
    };
    
    try {
      // Try Redis first
      const redis = getRedisClientSafe();
      if (redis) {
        const redisKey = `idempotency:${key}`;
        const serialized = JSON.stringify(cachedResult);
        
        await redis.setex(redisKey, ttl, serialized);
        
        recordCircuitBreakerSuccess();
        
        const duration = Date.now() - startTime;
        this.metrics.timing.storeDurationMs.push(duration);
        
        logger.debug('Idempotency result stored in Redis', {
          key,
          ttl,
          durationMs: duration,
        });
        
        return;
      }
      
      // Redis unavailable - fall back to memory cache
      this.metrics.fallback.redisUnavailableCount++;
      logger.warn('Redis unavailable, storing in memory cache', { key });
      
      this.storeInMemory(key, cachedResult);
      
    } catch (error: any) {
      recordCircuitBreakerError();
      recordIdempotencyError(key, 'store_failed');
      
      logger.error('Idempotency store failed', {
        key,
        error: error.message,
      });
      
      // Fall back to memory cache on error
      const fallbackEnabled = config.features.idempotencyFallbackToMemory;
      if (fallbackEnabled) {
        this.metrics.fallback.memoryUsageCount++;
        this.storeInMemory(key, cachedResult);
      }
    }
  }

  /**
   * Execute operation with idempotency guarantee
   * 
   * @param key - Idempotency key
   * @param fn - Operation to execute
   * @param options - Idempotency options
   * @returns Operation result (cached or fresh)
   */
  async withIdempotency<T>(
    key: string,
    fn: () => Promise<T>,
    options?: IdempotencyOptions
  ): Promise<IdempotencyResult<T>> {
    // Skip cache check if requested
    if (options?.skipCache) {
      const result = await fn();
      await this.store(key, result, options);
      return {
        value: result,
        cached: false,
        timestamp: new Date(),
      };
    }
    
    // Check if already executed
    const cached = await this.check<T>(key);
    if (cached) {
      return cached;
    }
    
    // Execute operation
    const result = await fn();
    
    // Store result for future idempotency checks
    await this.store(key, result, options);
    
    return {
      value: result,
      cached: false,
      timestamp: new Date(),
    };
  }

  /**
   * Check in-memory cache
   */
  private checkMemoryCache<T>(key: string): IdempotencyResult<T> | null {
    const cached = this.memoryCache.get(key);
    
    if (cached) {
      // Update access order for LRU
      this.updateAccessOrder(key);
      
      // Extract resource type for metrics
      const resourceType = key.split(':')[0];
      this.metrics.duplicatesPrevented.total++;
      this.metrics.duplicatesPrevented.byResourceType[resourceType] = 
        (this.metrics.duplicatesPrevented.byResourceType[resourceType] || 0) + 1;
      
      logger.debug('Idempotency memory cache hit', {
        key,
        resourceType,
        cachedAt: cached.timestamp,
      });
      
      return {
        value: cached.value,
        cached: true,
        timestamp: cached.timestamp,
      };
    }
    
    return null;
  }

  /**
   * Store in memory cache with LRU eviction
   */
  private storeInMemory<T>(key: string, result: CachedResult<T>): void {
    // Check if cache is full
    if (this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
      // Evict least recently used entry
      const lruKey = this.cacheAccessOrder.shift();
      if (lruKey) {
        this.memoryCache.delete(lruKey);
        logger.debug('Evicted LRU entry from memory cache', { evictedKey: lruKey });
      }
    }
    
    // Store in cache
    this.memoryCache.set(key, result);
    this.cacheAccessOrder.push(key);
    
    // Update metrics
    updateIdempotencyCacheSize(this.memoryCache.size);
    
    logger.debug('Idempotency result stored in memory', {
      key,
      cacheSize: this.memoryCache.size,
    });
  }

  /**
   * Update access order for LRU (move to end)
   */
  private updateAccessOrder(key: string): void {
    const index = this.cacheAccessOrder.indexOf(key);
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1);
      this.cacheAccessOrder.push(key);
    }
  }

  /**
   * Clear expired entries from memory cache
   * Should be called periodically (e.g., every hour)
   */
  clearExpiredMemoryEntries(maxAgeSeconds: number = 86400): number {
    const now = Date.now();
    const maxAgeMs = maxAgeSeconds * 1000;
    let cleared = 0;
    
    for (const [key, cached] of this.memoryCache.entries()) {
      const age = now - cached.timestamp.getTime();
      if (age > maxAgeMs) {
        this.memoryCache.delete(key);
        const index = this.cacheAccessOrder.indexOf(key);
        if (index > -1) {
          this.cacheAccessOrder.splice(index, 1);
        }
        cleared++;
      }
    }
    
    if (cleared > 0) {
      updateIdempotencyCacheSize(this.memoryCache.size);
      logger.info('Cleared expired memory cache entries', {
        cleared,
        remaining: this.memoryCache.size,
      });
    }
    
    return cleared;
  }

  /**
   * Get idempotency metrics
   */
  getMetrics(): IdempotencyMetrics {
    return {
      checks: { ...this.metrics.checks },
      duplicatesPrevented: {
        total: this.metrics.duplicatesPrevented.total,
        byResourceType: { ...this.metrics.duplicatesPrevented.byResourceType },
      },
      fallback: { ...this.metrics.fallback },
      timing: {
        checkDurationMs: [...this.metrics.timing.checkDurationMs],
        storeDurationMs: [...this.metrics.timing.storeDurationMs],
      },
    };
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate(): number {
    const total = this.metrics.checks.total;
    if (total === 0) return 0;
    return this.metrics.checks.hit / total;
  }

  /**
   * Get memory cache size
   */
  getMemoryCacheSize(): number {
    return this.memoryCache.size;
  }

  /**
   * Clear memory cache (for testing)
   */
  clearMemoryCache(): void {
    this.memoryCache.clear();
    this.cacheAccessOrder = [];
    updateIdempotencyCacheSize(0);
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      checks: {
        total: 0,
        hit: 0,
        miss: 0,
        error: 0,
      },
      duplicatesPrevented: {
        total: 0,
        byResourceType: {},
      },
      fallback: {
        memoryUsageCount: 0,
        redisUnavailableCount: 0,
      },
      timing: {
        checkDurationMs: [],
        storeDurationMs: [],
      },
    };
  }
}

// Export singleton instance
export const idempotencyService = IdempotencyService.getInstance();

