import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Retry Storm Protection Service
 * 
 * Prevents retry storms that can overwhelm the system by:
 * 1. Adding jitter to retry delays
 * 2. Enforcing global retry cap per time window
 * 3. Tracking retry rates per component
 * 
 * Use cases:
 * - Prevent thundering herd after mass failure
 * - Limit retry rate during platform outages
 * - Protect system from retry amplification
 */

export interface RetryConfig {
  component: string; // e.g., 'publishing', 'analytics', 'token-refresh'
  baseDelay: number; // Base delay in milliseconds
  maxDelay: number; // Maximum delay in milliseconds
  jitterFactor: number; // Jitter factor (0-1)
}

export class RetryStormProtectionService {
  private readonly GLOBAL_RETRY_CAP_KEY = 'retry:global:cap';
  private readonly COMPONENT_RETRY_KEY_PREFIX = 'retry:component:';
  private readonly WINDOW_SIZE = 60; // 60 seconds
  private readonly GLOBAL_MAX_RETRIES_PER_MINUTE = 1000; // Global cap
  private readonly COMPONENT_MAX_RETRIES_PER_MINUTE = 100; // Per-component cap

  /**
   * Calculate retry delay with exponential backoff and jitter
   * 
   * Formula: delay = min(baseDelay * 2^attempt, maxDelay) * (1 + jitter)
   * 
   * Jitter prevents synchronized retries (thundering herd)
   */
  calculateRetryDelay(config: RetryConfig, attempt: number): number {
    const { baseDelay, maxDelay, jitterFactor } = config;

    // Exponential backoff
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);

    // Add jitter (random factor between 0 and jitterFactor)
    const jitter = Math.random() * jitterFactor;
    const finalDelay = cappedDelay * (1 + jitter);

    logger.debug('Calculated retry delay with jitter', {
      component: config.component,
      attempt,
      baseDelay,
      exponentialDelay,
      cappedDelay,
      jitter: jitter.toFixed(3),
      finalDelay: Math.round(finalDelay),
    });

    return Math.round(finalDelay);
  }

  /**
   * Check if retry is allowed under global and component caps
   * 
   * Returns:
   * - allowed: true if retry is allowed
   * - reason: reason if not allowed
   * - retryAfter: suggested retry delay in seconds
   */
  async checkRetryAllowed(component: string): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    try {
      const redis = getRedisClient();

      // Check global retry cap
      const globalCount = await redis.get(this.GLOBAL_RETRY_CAP_KEY);
      const globalRetries = globalCount ? parseInt(globalCount, 10) : 0;

      if (globalRetries >= this.GLOBAL_MAX_RETRIES_PER_MINUTE) {
        logger.warn('Global retry cap exceeded', {
          component,
          globalRetries,
          cap: this.GLOBAL_MAX_RETRIES_PER_MINUTE,
        });

        return {
          allowed: false,
          reason: 'Global retry cap exceeded',
          retryAfter: this.WINDOW_SIZE,
        };
      }

      // Check component retry cap
      const componentKey = `${this.COMPONENT_RETRY_KEY_PREFIX}${component}`;
      const componentCount = await redis.get(componentKey);
      const componentRetries = componentCount ? parseInt(componentCount, 10) : 0;

      if (componentRetries >= this.COMPONENT_MAX_RETRIES_PER_MINUTE) {
        logger.warn('Component retry cap exceeded', {
          component,
          componentRetries,
          cap: this.COMPONENT_MAX_RETRIES_PER_MINUTE,
        });

        return {
          allowed: false,
          reason: 'Component retry cap exceeded',
          retryAfter: this.WINDOW_SIZE,
        };
      }

      return { allowed: true };
    } catch (error: any) {
      // If Redis is unavailable, allow retry (fail open)
      logger.error('Error checking retry cap', {
        component,
        error: error.message,
      });
      return { allowed: true };
    }
  }

  /**
   * Record a retry attempt
   * 
   * Increments both global and component retry counters
   */
  async recordRetry(component: string): Promise<void> {
    try {
      const redis = getRedisClient();

      // Increment global counter
      const globalCount = await redis.incr(this.GLOBAL_RETRY_CAP_KEY);
      if (globalCount === 1) {
        // Set TTL on first increment
        await redis.expire(this.GLOBAL_RETRY_CAP_KEY, this.WINDOW_SIZE);
      }

      // Increment component counter
      const componentKey = `${this.COMPONENT_RETRY_KEY_PREFIX}${component}`;
      const componentCount = await redis.incr(componentKey);
      if (componentCount === 1) {
        // Set TTL on first increment
        await redis.expire(componentKey, this.WINDOW_SIZE);
      }

      logger.debug('Recorded retry attempt', {
        component,
        globalCount,
        componentCount,
      });
    } catch (error: any) {
      // Non-critical - log and continue
      logger.error('Error recording retry', {
        component,
        error: error.message,
      });
    }
  }

  /**
   * Get retry statistics
   */
  async getRetryStats(): Promise<{
    global: number;
    components: Record<string, number>;
  }> {
    try {
      const redis = getRedisClient();

      // Get global count
      const globalCount = await redis.get(this.GLOBAL_RETRY_CAP_KEY);
      const global = globalCount ? parseInt(globalCount, 10) : 0;

      // Get component counts
      const componentKeys = await redis.keys(`${this.COMPONENT_RETRY_KEY_PREFIX}*`);
      const components: Record<string, number> = {};

      for (const key of componentKeys) {
        const component = key.replace(this.COMPONENT_RETRY_KEY_PREFIX, '');
        const count = await redis.get(key);
        components[component] = count ? parseInt(count, 10) : 0;
      }

      return { global, components };
    } catch (error: any) {
      logger.error('Error getting retry stats', {
        error: error.message,
      });
      return { global: 0, components: {} };
    }
  }

  /**
   * Reset retry counters (for testing)
   */
  async resetCounters(): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(this.GLOBAL_RETRY_CAP_KEY);
      const componentKeys = await redis.keys(`${this.COMPONENT_RETRY_KEY_PREFIX}*`);
      if (componentKeys.length > 0) {
        await redis.del(...componentKeys);
      }
      logger.info('Retry counters reset');
    } catch (error: any) {
      logger.error('Error resetting retry counters', {
        error: error.message,
      });
    }
  }
}

export const retryStormProtectionService = new RetryStormProtectionService();
