import { logger } from '../utils/logger';

/**
 * Platform Circuit Breaker Service
 * 
 * Implements circuit breaker pattern for external platform APIs
 * Prevents cascading failures and provides graceful degradation
 */

export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Circuit is open, requests fail fast
  HALF_OPEN = 'half-open' // Testing if service is back
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures to open circuit
  successThreshold: number;    // Number of successes to close circuit
  timeout: number;            // Time to wait before half-open (ms)
  monitoringWindow: number;   // Time window for failure counting (ms)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  openedAt: Date | null;
  nextAttemptAt: Date | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export interface PlatformStats {
  platform: string;
  circuitBreaker: CircuitBreakerStats;
  errorRate: number;
  requestsInWindow: number;
  failuresInWindow: number;
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private openedAt: Date | null = null;
  private nextAttemptAt: Date | null = null;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private failureTimestamps: Date[] = [];

  constructor(
    private platform: string,
    private config: CircuitBreakerConfig
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        logger.info('Circuit breaker transitioning to half-open', {
          platform: this.platform,
        });
      } else {
        const error = new Error(`Circuit breaker is OPEN for platform: ${this.platform}`);
        (error as any).circuitBreakerOpen = true;
        throw error;
      }
    }

    this.totalRequests++;

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
   * Record a successful operation
   */
  private onSuccess(): void {
    this.successes++;
    this.totalSuccesses++;
    this.lastSuccessTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.config.successThreshold) {
        this.reset();
        logger.info('Circuit breaker closed after successful recovery', {
          platform: this.platform,
          successes: this.successes,
        });
      }
    }
  }

  /**
   * Record a failed operation
   */
  private onFailure(): void {
    this.failures++;
    this.totalFailures++;
    this.lastFailureTime = new Date();
    this.failureTimestamps.push(new Date());

    // Clean old failure timestamps outside monitoring window
    this.cleanOldFailures();

    if (this.state === CircuitState.HALF_OPEN) {
      this.open();
      logger.warn('Circuit breaker reopened after half-open failure', {
        platform: this.platform,
      });
    } else if (this.state === CircuitState.CLOSED) {
      if (this.failures >= this.config.failureThreshold) {
        this.open();
        logger.error('Circuit breaker opened due to failure threshold', {
          platform: this.platform,
          failures: this.failures,
          threshold: this.config.failureThreshold,
        });
      }
    }
  }

  /**
   * Open the circuit breaker
   */
  private open(): void {
    this.state = CircuitState.OPEN;
    this.openedAt = new Date();
    this.nextAttemptAt = new Date(Date.now() + this.config.timeout);
    this.successes = 0; // Reset success counter
  }

  /**
   * Reset the circuit breaker to closed state
   */
  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.openedAt = null;
    this.nextAttemptAt = null;
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttemptAt !== null && Date.now() >= this.nextAttemptAt.getTime();
  }

  /**
   * Clean old failure timestamps outside monitoring window
   */
  private cleanOldFailures(): void {
    const cutoff = Date.now() - this.config.monitoringWindow;
    this.failureTimestamps = this.failureTimestamps.filter(
      timestamp => timestamp.getTime() > cutoff
    );
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    this.cleanOldFailures();
    
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
      nextAttemptAt: this.nextAttemptAt,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Get error rate in current monitoring window
   */
  getErrorRate(): number {
    this.cleanOldFailures();
    
    const recentFailures = this.failureTimestamps.length;
    const recentRequests = Math.max(recentFailures, this.successes); // Approximate
    
    if (recentRequests === 0) return 0;
    return (recentFailures / recentRequests) * 100;
  }

  /**
   * Force open the circuit (for testing or manual intervention)
   */
  forceOpen(): void {
    this.open();
    logger.warn('Circuit breaker manually opened', {
      platform: this.platform,
    });
  }

  /**
   * Force close the circuit (for testing or manual intervention)
   */
  forceClose(): void {
    this.reset();
    logger.info('Circuit breaker manually closed', {
      platform: this.platform,
    });
  }
}

export class PlatformCircuitBreakerService {
  private static instance: PlatformCircuitBreakerService;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  
  // Default configuration
  private defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,      // 5 failures to open
    successThreshold: 3,      // 3 successes to close
    timeout: 30000,          // 30 seconds
    monitoringWindow: 60000, // 1 minute window
  };

  static getInstance(): PlatformCircuitBreakerService {
    if (!PlatformCircuitBreakerService.instance) {
      PlatformCircuitBreakerService.instance = new PlatformCircuitBreakerService();
    }
    return PlatformCircuitBreakerService.instance;
  }

  /**
   * Get or create circuit breaker for platform
   */
  private getCircuitBreaker(platform: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.circuitBreakers.has(platform)) {
      const finalConfig = { ...this.defaultConfig, ...config };
      this.circuitBreakers.set(platform, new CircuitBreaker(platform, finalConfig));
      
      logger.info('Created circuit breaker for platform', {
        platform,
        config: finalConfig,
      });
    }
    
    return this.circuitBreakers.get(platform)!;
  }

  /**
   * Execute platform API call with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    platform: string,
    operation: string,
    fn: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(platform, config);
    
    try {
      const result = await circuitBreaker.execute(fn);
      
      logger.debug('Platform API call succeeded', {
        platform,
        operation,
        circuitState: circuitBreaker.getStats().state,
      });
      
      return result;
    } catch (error: any) {
      const stats = circuitBreaker.getStats();
      
      if (error.circuitBreakerOpen) {
        logger.warn('Platform API call blocked by circuit breaker', {
          platform,
          operation,
          circuitState: stats.state,
          nextAttemptAt: stats.nextAttemptAt,
        });
      } else {
        logger.error('Platform API call failed', {
          platform,
          operation,
          error: error.message,
          circuitState: stats.state,
          failures: stats.failures,
        });
      }
      
      throw error;
    }
  }

  /**
   * Get statistics for all platforms
   */
  getAllPlatformStats(): PlatformStats[] {
    const stats: PlatformStats[] = [];
    
    for (const [platform, circuitBreaker] of this.circuitBreakers.entries()) {
      const cbStats = circuitBreaker.getStats();
      const errorRate = circuitBreaker.getErrorRate();
      
      stats.push({
        platform,
        circuitBreaker: cbStats,
        errorRate,
        requestsInWindow: cbStats.totalRequests,
        failuresInWindow: cbStats.failures,
      });
    }
    
    return stats.sort((a, b) => a.platform.localeCompare(b.platform));
  }

  /**
   * Get statistics for specific platform
   */
  getPlatformStats(platform: string): PlatformStats | null {
    const circuitBreaker = this.circuitBreakers.get(platform);
    if (!circuitBreaker) {
      return null;
    }
    
    const cbStats = circuitBreaker.getStats();
    const errorRate = circuitBreaker.getErrorRate();
    
    return {
      platform,
      circuitBreaker: cbStats,
      errorRate,
      requestsInWindow: cbStats.totalRequests,
      failuresInWindow: cbStats.failures,
    };
  }

  /**
   * Check if platform is available (circuit not open)
   */
  isPlatformAvailable(platform: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(platform);
    if (!circuitBreaker) {
      return true; // No circuit breaker = available
    }
    
    return circuitBreaker.getStats().state !== CircuitState.OPEN;
  }

  /**
   * Get platforms that are currently unavailable
   */
  getUnavailablePlatforms(): string[] {
    const unavailable: string[] = [];
    
    for (const [platform, circuitBreaker] of this.circuitBreakers.entries()) {
      if (circuitBreaker.getStats().state === CircuitState.OPEN) {
        unavailable.push(platform);
      }
    }
    
    return unavailable;
  }

  /**
   * Force open circuit for platform (for maintenance)
   */
  forceOpenCircuit(platform: string): void {
    const circuitBreaker = this.getCircuitBreaker(platform);
    circuitBreaker.forceOpen();
  }

  /**
   * Force close circuit for platform (for recovery)
   */
  forceCloseCircuit(platform: string): void {
    const circuitBreaker = this.circuitBreakers.get(platform);
    if (circuitBreaker) {
      circuitBreaker.forceClose();
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuits(): void {
    for (const [platform, circuitBreaker] of this.circuitBreakers.entries()) {
      circuitBreaker.forceClose();
      logger.info('Circuit breaker reset', { platform });
    }
  }

  /**
   * Get overall system health based on circuit breaker states
   */
  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    availablePlatforms: number;
    totalPlatforms: number;
    unavailablePlatforms: string[];
  } {
    const totalPlatforms = this.circuitBreakers.size;
    const unavailablePlatforms = this.getUnavailablePlatforms();
    const availablePlatforms = totalPlatforms - unavailablePlatforms.length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (unavailablePlatforms.length === totalPlatforms && totalPlatforms > 0) {
      status = 'unhealthy'; // All platforms down
    } else if (unavailablePlatforms.length > 0) {
      status = 'degraded'; // Some platforms down
    }
    
    return {
      status,
      availablePlatforms,
      totalPlatforms,
      unavailablePlatforms,
    };
  }
}

export const platformCircuitBreakerService = PlatformCircuitBreakerService.getInstance();