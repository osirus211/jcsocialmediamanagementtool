import Redis, { Cluster } from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';
import { RedisRecoveryService } from '../services/recovery/RedisRecoveryService';

let redisClient: Redis | null = null;
let recoveryService: RedisRecoveryService | null = null;
let circuitBreakerState: 'closed' | 'open' | 'half-open' = 'closed';
let circuitBreakerErrors = 0;
let circuitBreakerSuccesses = 0;
let circuitBreakerLastError: Date | null = null;
let circuitBreakerOpenedAt: Date | null = null;
let isRedisAvailable = true;

const CIRCUIT_BREAKER_ERROR_THRESHOLD = 0.5; // 50% error rate
const CIRCUIT_BREAKER_WINDOW_SIZE = 10; // Track last 10 operations
const CIRCUIT_BREAKER_OPEN_DURATION = 30000; // 30 seconds
const CIRCUIT_BREAKER_HALF_OPEN_REQUESTS = 5; // Test with 5 requests

export const connectRedis = async (): Promise<Redis> => {
  try {
    console.log(`🔌 Connecting to Redis at ${config.redis.host}:${config.redis.port} (type: ${typeof config.redis.port})`);
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      connectTimeout: 10000, // 10 second timeout
      maxRetriesPerRequest: null, // Required for BullMQ blocking operations
      
      // Connection pooling configuration (max 20 connections)
      lazyConnect: false,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      maxLoadingRetryTime: 10000,
      family: 4, // Force IPv4
      keepAlive: 30000, // Keep alive for 30 seconds
      
      // Retry strategy with exponential backoff
      retryStrategy: (times) => {
        if (times > 10) {
          logger.error('Redis max retry attempts reached, giving up');
          return null; // Stop retrying after 10 attempts
        }
        // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, 3200ms, max 5000ms
        const delay = Math.min(times * 100 * Math.pow(2, times - 1), 5000);
        logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      
      // Reconnect on error
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Reconnect on READONLY errors
          return true;
        }
        return false;
      },
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected successfully');
      isRedisAvailable = true;
      resetCircuitBreaker();
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis ready to accept commands');
      isRedisAvailable = true;
    });

    redisClient.on('error', (error) => {
      logger.error('Redis connection error:', error);
      recordCircuitBreakerError();
      isRedisAvailable = false;
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
      isRedisAvailable = false;
    });

    redisClient.on('reconnecting', (delay: number) => {
      logger.warn(`Redis reconnecting in ${delay}ms...`);
      isRedisAvailable = false;
    });

    redisClient.on('end', () => {
      logger.warn('Redis connection ended');
      isRedisAvailable = false;
    });

    // Test connection with timeout
    await Promise.race([
      redisClient.ping(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis ping timeout')), 5000)
      )
    ]);

    // Initialize recovery service if not already created
    if (!recoveryService) {
      recoveryService = new RedisRecoveryService({
        enabled: true,
        recoveryDelayMs: 5000, // 5 second delay after reconnect
      });
      
      // Attach recovery service to Redis client
      recoveryService.attachToRedis(redisClient);
    }

    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    isRedisAvailable = false;
    throw error;
  }
};

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

/**
 * Get Redis client with circuit breaker protection
 * Returns null if circuit is open (graceful degradation)
 */
export const getRedisClientSafe = (): Redis | null => {
  if (!redisClient) {
    logger.warn('Redis client not initialized');
    return null;
  }
  
  if (circuitBreakerState === 'open') {
    // Check if circuit breaker should transition to half-open
    if (circuitBreakerOpenedAt && Date.now() - circuitBreakerOpenedAt.getTime() >= CIRCUIT_BREAKER_OPEN_DURATION) {
      logger.info('Circuit breaker transitioning to half-open state');
      circuitBreakerState = 'half-open';
      circuitBreakerSuccesses = 0;
      circuitBreakerErrors = 0;
    } else {
      logger.warn('Circuit breaker is open, Redis operations blocked');
      return null;
    }
  }
  
  return redisClient;
};

/**
 * Check if Redis is available
 */
export const isRedisHealthy = (): boolean => {
  return isRedisAvailable && circuitBreakerState !== 'open';
};

/**
 * Get circuit breaker status
 */
export const getCircuitBreakerStatus = () => {
  return {
    state: circuitBreakerState,
    errorRate: circuitBreakerErrors / Math.max(circuitBreakerErrors + circuitBreakerSuccesses, 1),
    errors: circuitBreakerErrors,
    successes: circuitBreakerSuccesses,
    lastError: circuitBreakerLastError,
    openedAt: circuitBreakerOpenedAt,
    isHealthy: isRedisHealthy(),
  };
};

/**
 * Record successful Redis operation for circuit breaker
 */
export const recordCircuitBreakerSuccess = () => {
  circuitBreakerSuccesses++;
  
  // Keep window size limited
  if (circuitBreakerSuccesses + circuitBreakerErrors > CIRCUIT_BREAKER_WINDOW_SIZE) {
    circuitBreakerSuccesses = Math.floor(circuitBreakerSuccesses / 2);
    circuitBreakerErrors = Math.floor(circuitBreakerErrors / 2);
  }
  
  // If in half-open state and enough successes, close the circuit
  if (circuitBreakerState === 'half-open' && circuitBreakerSuccesses >= CIRCUIT_BREAKER_HALF_OPEN_REQUESTS) {
    logger.info('Circuit breaker closing after successful half-open test');
    resetCircuitBreaker();
  }
};

/**
 * Record failed Redis operation for circuit breaker
 */
export const recordCircuitBreakerError = () => {
  circuitBreakerErrors++;
  circuitBreakerLastError = new Date();
  
  // Keep window size limited
  if (circuitBreakerSuccesses + circuitBreakerErrors > CIRCUIT_BREAKER_WINDOW_SIZE) {
    circuitBreakerSuccesses = Math.floor(circuitBreakerSuccesses / 2);
    circuitBreakerErrors = Math.floor(circuitBreakerErrors / 2);
  }
  
  // Check if error threshold exceeded
  const totalOps = circuitBreakerErrors + circuitBreakerSuccesses;
  if (totalOps >= 5) { // Minimum operations before opening circuit
    const errorRate = circuitBreakerErrors / totalOps;
    if (errorRate >= CIRCUIT_BREAKER_ERROR_THRESHOLD && circuitBreakerState === 'closed') {
      logger.error(`Circuit breaker opening due to high error rate: ${(errorRate * 100).toFixed(1)}%`);
      circuitBreakerState = 'open';
      circuitBreakerOpenedAt = new Date();
    }
  }
  
  // If in half-open state and error occurs, reopen circuit
  if (circuitBreakerState === 'half-open') {
    logger.warn('Circuit breaker reopening after half-open test failure');
    circuitBreakerState = 'open';
    circuitBreakerOpenedAt = new Date();
  }
};

/**
 * Reset circuit breaker to closed state
 */
export const resetCircuitBreaker = () => {
  circuitBreakerState = 'closed';
  circuitBreakerErrors = 0;
  circuitBreakerSuccesses = 0;
  circuitBreakerLastError = null;
  circuitBreakerOpenedAt = null;
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    // Notify recovery service of shutdown
    if (recoveryService) {
      recoveryService.setShuttingDown(true);
    }
    
    await redisClient.quit();
    logger.info('Redis disconnected');
  }
};

export const getRecoveryService = (): RedisRecoveryService | null => {
  return recoveryService;
};
