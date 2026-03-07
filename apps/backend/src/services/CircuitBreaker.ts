/**
 * Circuit Breaker
 * 
 * Implements the circuit breaker pattern to prevent repeated calls to failing services.
 * Uses three states: closed (normal), open (blocking), and half-open (testing recovery).
 * 
 * Features:
 * - Three states: closed, open, half-open
 * - Failure threshold: 5 consecutive failures
 * - Timeout: 60 seconds before transitioning to half-open
 * - Half-open success threshold: 2 successes to close
 * - Per-account isolation (NOT per-platform)
 * 
 * State Transitions:
 * - closed -> open: After 5 consecutive failures
 * - open -> half-open: After 60 second timeout
 * - half-open -> closed: After 2 consecutive successes
 * - half-open -> open: On any failure
 */

import { logger } from '../utils/logger';

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

interface CircuitBreakerConfig {
  failureThreshold?: number;
  timeout?: number; // milliseconds
  halfOpenSuccessThreshold?: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;

  // Configuration
  private readonly FAILURE_THRESHOLD: number;
  private readonly TIMEOUT: number; // milliseconds
  private readonly HALF_OPEN_SUCCESS_THRESHOLD: number;

  // Identification
  private readonly platform: string;
  private readonly accountId: string;

  constructor(
    platform: string,
    accountId: string,
    config: CircuitBreakerConfig = {}
  ) {
    this.platform = platform;
    this.accountId = accountId;
    this.FAILURE_THRESHOLD = config.failureThreshold || 5;
    this.TIMEOUT = config.timeout || 60000; // 60 seconds
    this.HALF_OPEN_SUCCESS_THRESHOLD = config.halfOpenSuccessThreshold || 2;
  }

  /**
   * Execute a function with circuit breaker protection
   * Throws CircuitBreakerOpenError if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from open to half-open
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        const timeUntilReset = this.getTimeUntilReset();
        logger.debug('Circuit breaker is open', {
          platform: this.platform,
          accountId: this.accountId,
          timeUntilReset,
        });
        throw new CircuitBreakerOpenError(
          `Circuit breaker is open for ${this.platform}:${this.accountId}. Retry in ${Math.ceil(timeUntilReset / 1000)}s`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      logger.debug('Circuit breaker half-open success', {
        platform: this.platform,
        accountId: this.accountId,
        successCount: this.successCount,
        threshold: this.HALF_OPEN_SUCCESS_THRESHOLD,
      });

      // Close circuit after threshold successes
      if (this.successCount >= this.HALF_OPEN_SUCCESS_THRESHOLD) {
        this.transitionToClosed();
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    if (this.state === 'half-open') {
      // Any failure in half-open state reopens the circuit
      logger.warn('Circuit breaker half-open failure - reopening', {
        platform: this.platform,
        accountId: this.accountId,
      });
      this.transitionToOpen();
    } else if (this.state === 'closed') {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      logger.debug('Circuit breaker failure recorded', {
        platform: this.platform,
        accountId: this.accountId,
        failureCount: this.failureCount,
        threshold: this.FAILURE_THRESHOLD,
      });

      // Open circuit after threshold failures
      if (this.failureCount >= this.FAILURE_THRESHOLD) {
        this.transitionToOpen();
      }
    }
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return false;
    }
    return Date.now() - this.lastFailureTime >= this.TIMEOUT;
  }

  /**
   * Get time in milliseconds until circuit can attempt reset
   */
  private getTimeUntilReset(): number {
    if (!this.lastFailureTime) {
      return 0;
    }
    const elapsed = Date.now() - this.lastFailureTime;
    return Math.max(0, this.TIMEOUT - elapsed);
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(): void {
    logger.info('Circuit breaker closed', {
      platform: this.platform,
      accountId: this.accountId,
      previousState: this.state,
    });

    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(): void {
    logger.warn('Circuit breaker opened', {
      platform: this.platform,
      accountId: this.accountId,
      failureCount: this.failureCount,
      threshold: this.FAILURE_THRESHOLD,
    });

    this.state = 'open';
    this.lastFailureTime = Date.now();
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    logger.info('Circuit breaker half-open', {
      platform: this.platform,
      accountId: this.accountId,
    });

    this.state = 'half-open';
    this.successCount = 0;
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      timeUntilReset: this.state === 'open' ? this.getTimeUntilReset() : 0,
    };
  }
}
