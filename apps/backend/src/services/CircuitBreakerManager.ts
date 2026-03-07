/**
 * Circuit Breaker Manager
 * 
 * Manages circuit breakers for all platform accounts.
 * Maintains a map of circuit breakers by {platform}:{accountId} key.
 * 
 * Features:
 * - Per-account circuit breaker isolation
 * - Lazy initialization of circuit breakers
 * - Retrieval of all circuit breakers
 * - Retrieval of only open circuit breakers
 * - Singleton pattern for global access
 */

import { CircuitBreaker, CircuitState } from './CircuitBreaker';
import { logger } from '../utils/logger';

export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get circuit breaker for a specific platform account
   * Creates new breaker if it doesn't exist (lazy initialization)
   */
  getBreaker(platform: string, accountId: string): CircuitBreaker {
    const key = `${platform}:${accountId}`;
    
    let breaker = this.breakers.get(key);
    
    if (!breaker) {
      logger.debug('Creating new circuit breaker', { platform, accountId });
      breaker = new CircuitBreaker(platform, accountId);
      this.breakers.set(key, breaker);
    }
    
    return breaker;
  }

  /**
   * Get all circuit breakers
   * Returns array of breakers with their metrics
   */
  getAllBreakers(): Array<{ key: string; breaker: CircuitBreaker; metrics: any }> {
    const result: Array<{ key: string; breaker: CircuitBreaker; metrics: any }> = [];
    
    for (const [key, breaker] of this.breakers.entries()) {
      result.push({
        key,
        breaker,
        metrics: breaker.getMetrics(),
      });
    }
    
    return result;
  }

  /**
   * Get only open circuit breakers
   * Returns array of breakers that are currently open
   */
  getOpenBreakers(): Array<{ key: string; breaker: CircuitBreaker; metrics: any }> {
    const result: Array<{ key: string; breaker: CircuitBreaker; metrics: any }> = [];
    
    for (const [key, breaker] of this.breakers.entries()) {
      const state = breaker.getState();
      if (state === 'open') {
        result.push({
          key,
          breaker,
          metrics: breaker.getMetrics(),
        });
      }
    }
    
    logger.debug('Retrieved open circuit breakers', { count: result.length });
    
    return result;
  }

  /**
   * Get count of circuit breakers by state
   */
  getStateCounts(): Record<CircuitState, number> {
    const counts: Record<CircuitState, number> = {
      closed: 0,
      open: 0,
      'half-open': 0,
    };
    
    for (const breaker of this.breakers.values()) {
      const state = breaker.getState();
      counts[state]++;
    }
    
    return counts;
  }

  /**
   * Clear all circuit breakers (useful for testing)
   */
  clear(): void {
    logger.info('Clearing all circuit breakers', { count: this.breakers.size });
    this.breakers.clear();
  }
}

// Export singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();
