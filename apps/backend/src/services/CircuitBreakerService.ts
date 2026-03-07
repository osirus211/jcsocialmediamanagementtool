/**
 * Circuit Breaker Service
 * 
 * Redis-based circuit breaker per provider
 * Prevents refresh storms during provider outages
 * 
 * States:
 * - CLOSED: Normal operation
 * - OPEN: Provider failing, block all requests
 * - HALF_OPEN: Testing if provider recovered
 */

import { getRedisClientSafe } from '../config/redis';
import { logger } from '../utils/logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitData {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  openedAt: number | null;
  nextAttemptAt: number | null;
}

export class CircuitBreakerService {
  private static instance: CircuitBreakerService;

  // Configuration
  private readonly FAILURE_THRESHOLD = 5; // 5 consecutive failures → OPEN
  private readonly SUCCESS_THRESHOLD = 1; // 1 success in HALF_OPEN → CLOSED
  private readonly OPEN_DURATION_MS = 60000; // 60 seconds
  private readonly OPEN_DURATION_EXTENDED_MS = 120000; // 120 seconds after retry failure

  private constructor() {}

  static getInstance(): CircuitBreakerService {
    if (!CircuitBreakerService.instance) {
      CircuitBreakerService.instance = new CircuitBreakerService();
    }
    return CircuitBreakerService.instance;
  }

  /**
   * Check if circuit allows request
   * Returns 'allow' or 'block'
   */
  async checkCircuit(provider: string): Promise<'allow' | 'block'> {
    const redis = getRedisClientSafe();

    // Fail closed: If Redis unavailable, throw error
    if (!redis) {
      throw new Error('Redis unavailable - cannot check circuit breaker (fail-closed)');
    }

    const circuitKey = `oauth:circuit:${provider}`;
    const circuitData = await redis.get(circuitKey);

    if (!circuitData) {
      // No circuit state = CLOSED (allow)
      return 'allow';
    }

    const state: CircuitData = JSON.parse(circuitData);

    if (state.state === CircuitState.OPEN) {
      // Check if cooldown period passed
      if (state.nextAttemptAt && Date.now() < state.nextAttemptAt) {
        logger.warn('Circuit breaker OPEN, blocking request', {
          provider,
          nextAttemptAt: new Date(state.nextAttemptAt).toISOString(),
          openedAt: state.openedAt ? new Date(state.openedAt).toISOString() : null,
        });
        return 'block';
      }

      // Transition to HALF_OPEN
      state.state = CircuitState.HALF_OPEN;
      state.successCount = 0;
      await redis.set(circuitKey, JSON.stringify(state), 'EX', 300); // 5 min TTL

      logger.info('Circuit breaker transitioning to HALF_OPEN', { provider });
      return 'allow';
    }

    // CLOSED or HALF_OPEN = allow
    return 'allow';
  }

  /**
   * Record successful refresh
   */
  async recordSuccess(provider: string): Promise<void> {
    const redis = getRedisClientSafe();
    if (!redis) return; // Graceful degradation

    const circuitKey = `oauth:circuit:${provider}`;
    const circuitData = await redis.get(circuitKey);

    const state: CircuitData = circuitData
      ? JSON.parse(circuitData)
      : this.getDefaultState();

    state.successCount++;
    state.failureCount = 0; // Reset failure count on success
    state.lastSuccessTime = Date.now();

    // If in HALF_OPEN and success, close circuit
    if (state.state === CircuitState.HALF_OPEN && state.successCount >= this.SUCCESS_THRESHOLD) {
      state.state = CircuitState.CLOSED;
      state.successCount = 0;
      state.openedAt = null;
      state.nextAttemptAt = null;

      logger.info('Circuit breaker CLOSED (recovered)', {
        provider,
        previousState: CircuitState.HALF_OPEN,
      });
    }

    await redis.set(circuitKey, JSON.stringify(state), 'EX', 300); // 5 min TTL
  }

  /**
   * Record failed refresh
   */
  async recordFailure(provider: string): Promise<void> {
    const redis = getRedisClientSafe();
    if (!redis) return; // Graceful degradation

    const circuitKey = `oauth:circuit:${provider}`;
    const circuitData = await redis.get(circuitKey);

    const state: CircuitData = circuitData
      ? JSON.parse(circuitData)
      : this.getDefaultState();

    state.failureCount++;
    state.successCount = 0; // Reset success count on failure
    state.lastFailureTime = Date.now();

    // If in HALF_OPEN and failed, reopen with extended duration
    if (state.state === CircuitState.HALF_OPEN) {
      state.state = CircuitState.OPEN;
      state.openedAt = Date.now();
      state.nextAttemptAt = Date.now() + this.OPEN_DURATION_EXTENDED_MS;

      logger.error('Circuit breaker OPEN (retry failed, extended cooldown)', {
        provider,
        failureCount: state.failureCount,
        nextAttemptAt: new Date(state.nextAttemptAt).toISOString(),
        cooldownMs: this.OPEN_DURATION_EXTENDED_MS,
      });
    }
    // If CLOSED and reached threshold, open circuit
    else if (state.state === CircuitState.CLOSED && state.failureCount >= this.FAILURE_THRESHOLD) {
      state.state = CircuitState.OPEN;
      state.openedAt = Date.now();
      state.nextAttemptAt = Date.now() + this.OPEN_DURATION_MS;

      logger.error('Circuit breaker OPEN (threshold reached)', {
        provider,
        failureCount: state.failureCount,
        threshold: this.FAILURE_THRESHOLD,
        nextAttemptAt: new Date(state.nextAttemptAt).toISOString(),
        cooldownMs: this.OPEN_DURATION_MS,
      });
    }

    await redis.set(circuitKey, JSON.stringify(state), 'EX', 300); // 5 min TTL
  }

  /**
   * Get circuit state for monitoring
   */
  async getState(provider: string): Promise<CircuitData | null> {
    const redis = getRedisClientSafe();
    if (!redis) return null;

    const circuitKey = `oauth:circuit:${provider}`;
    const circuitData = await redis.get(circuitKey);

    return circuitData ? JSON.parse(circuitData) : null;
  }

  /**
   * Get default circuit state
   */
  private getDefaultState(): CircuitData {
    return {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      openedAt: null,
      nextAttemptAt: null,
    };
  }

  /**
   * Reset circuit (for testing/admin)
   */
  async resetCircuit(provider: string): Promise<void> {
    const redis = getRedisClientSafe();
    if (!redis) return;

    const circuitKey = `oauth:circuit:${provider}`;
    await redis.del(circuitKey);

    logger.info('Circuit breaker reset', { provider });
  }
}

export const circuitBreakerService = CircuitBreakerService.getInstance();
