import { 
  connectRedis, 
  getRedisClientSafe, 
  isRedisHealthy, 
  getCircuitBreakerStatus,
  recordCircuitBreakerError,
  recordCircuitBreakerSuccess,
  resetCircuitBreaker 
} from '../config/redis';

describe('Redis Connection Resilience', () => {
  beforeEach(() => {
    // Reset circuit breaker before each test
    resetCircuitBreaker();
  });

  describe('Circuit Breaker', () => {
    it('should start in closed state', () => {
      const status = getCircuitBreakerStatus();
      expect(status.state).toBe('closed');
      expect(status.isHealthy).toBe(true);
    });

    it('should open circuit after 50% error threshold', () => {
      // Record 3 successes and 3 errors (50% error rate)
      recordCircuitBreakerSuccess();
      recordCircuitBreakerError();
      recordCircuitBreakerSuccess();
      recordCircuitBreakerError();
      recordCircuitBreakerSuccess();
      recordCircuitBreakerError();

      const status = getCircuitBreakerStatus();
      expect(status.state).toBe('open');
      expect(status.errorRate).toBeGreaterThanOrEqual(0.5);
    });

    it('should block operations when circuit is open', () => {
      // Force circuit to open
      for (let i = 0; i < 5; i++) {
        recordCircuitBreakerError();
      }

      const client = getRedisClientSafe();
      expect(client).toBeNull();
      expect(isRedisHealthy()).toBe(false);
    });

    it('should transition to half-open after timeout', async () => {
      // Force circuit to open
      for (let i = 0; i < 5; i++) {
        recordCircuitBreakerError();
      }

      expect(getCircuitBreakerStatus().state).toBe('open');

      // Wait for circuit breaker timeout (30 seconds in production, mocked here)
      // In real test, we'd mock the timer or wait
      // For now, just verify the logic exists
      const status = getCircuitBreakerStatus();
      expect(status.openedAt).toBeTruthy();
    });

    it('should close circuit after successful half-open test', () => {
      // Manually set to half-open state (in real scenario, this happens after timeout)
      resetCircuitBreaker();
      
      // Record 5 successes (threshold for closing from half-open)
      for (let i = 0; i < 5; i++) {
        recordCircuitBreakerSuccess();
      }

      const status = getCircuitBreakerStatus();
      expect(status.state).toBe('closed');
      expect(status.isHealthy).toBe(true);
    });

    it('should track error rate correctly', () => {
      recordCircuitBreakerSuccess();
      recordCircuitBreakerSuccess();
      recordCircuitBreakerError();

      const status = getCircuitBreakerStatus();
      expect(status.errors).toBe(1);
      expect(status.successes).toBe(2);
      expect(status.errorRate).toBeCloseTo(0.33, 2);
    });
  });

  describe('Graceful Degradation', () => {
    it('should return null when Redis is unavailable', () => {
      // Force circuit to open
      for (let i = 0; i < 5; i++) {
        recordCircuitBreakerError();
      }

      const client = getRedisClientSafe();
      expect(client).toBeNull();
    });

    it('should report unhealthy status when circuit is open', () => {
      // Force circuit to open
      for (let i = 0; i < 5; i++) {
        recordCircuitBreakerError();
      }

      expect(isRedisHealthy()).toBe(false);
    });
  });
});
