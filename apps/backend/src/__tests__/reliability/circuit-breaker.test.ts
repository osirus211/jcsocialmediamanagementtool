/**
 * Circuit Breaker Integration Tests
 * 
 * Comprehensive tests for circuit breaker pattern implementation:
 * - State transitions (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)
 * - Failure threshold behavior
 * - Timeout and recovery
 * - Integration with retry logic
 * - Service-specific configurations
 * - Concurrent access safety
 */

import {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerError,
  CircuitBreakerErrorType,
  getCircuitBreakerConfig
} from '../../../../../.kiro/execution/reliability';

describe('Circuit Breaker Pattern', () => {
  let circuitBreaker: CircuitBreaker;
  let circuitBreakerManager: CircuitBreakerManager;

  const testConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    timeoutMs: 1000, // 1 second for faster tests
    halfOpenMaxCalls: 1,
    enabled: true
  };

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker('test-service', testConfig);
    circuitBreakerManager = new CircuitBreakerManager();
  });

  afterEach(() => {
    circuitBreakerManager.shutdown();
  });

  describe('Circuit Breaker Core Functionality', () => {
    test('should start in CLOSED state', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });

    test('should allow requests in CLOSED state', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.circuitState).toBe(CircuitState.CLOSED);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    test('should record successful operations', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      await circuitBreaker.execute(mockOperation);
      
      const stats = circuitBreaker.getStats();
      expect(stats.successCount).toBe(1);
      expect(stats.totalRequests).toBe(1);
      expect(stats.failureCount).toBe(0);
    });

    test('should record failed operations', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Test failure'));
      
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Test failure');
      expect(result.circuitState).toBe(CircuitState.CLOSED);
      
      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(1);
      expect(stats.totalRequests).toBe(1);
      expect(stats.successCount).toBe(0);
    });
  });

  describe('State Transitions', () => {
    test('should transition to OPEN after failure threshold', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Test failure'));
      
      // Execute failures up to threshold
      for (let i = 0; i < testConfig.failureThreshold; i++) {
        await circuitBreaker.execute(mockOperation);
      }
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
      expect(stats.failureCount).toBe(testConfig.failureThreshold);
    });

    test('should block requests in OPEN state', async () => {
      // Force circuit to OPEN state
      circuitBreaker.forceState(CircuitState.OPEN);
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(CircuitBreakerError);
      expect((result.error as CircuitBreakerError).errorType).toBe(CircuitBreakerErrorType.CIRCUIT_OPEN);
      expect(mockOperation).not.toHaveBeenCalled();
    });

    test('should transition to HALF_OPEN after timeout', async () => {
      // Force circuit to OPEN state
      circuitBreaker.forceState(CircuitState.OPEN);
      
      // Wait for timeout period
      await new Promise(resolve => setTimeout(resolve, testConfig.timeoutMs + 100));
      
      // Next request should trigger transition to HALF_OPEN
      const mockOperation = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result.success).toBe(true);
      expect(result.circuitState).toBe(CircuitState.CLOSED); // Should close after successful call
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    test('should limit calls in HALF_OPEN state', async () => {
      // Force circuit to HALF_OPEN state
      circuitBreaker.forceState(CircuitState.HALF_OPEN);
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      // First call should be allowed
      const result1 = await circuitBreaker.execute(mockOperation);
      expect(result1.success).toBe(true);
      
      // Second call should be blocked (exceeds halfOpenMaxCalls)
      const result2 = await circuitBreaker.execute(mockOperation);
      expect(result2.success).toBe(false);
      expect(result2.error).toBeInstanceOf(CircuitBreakerError);
      expect((result2.error as CircuitBreakerError).errorType).toBe(CircuitBreakerErrorType.HALF_OPEN_LIMIT_EXCEEDED);
    });

    test('should transition to CLOSED on successful HALF_OPEN call', async () => {
      // Force circuit to HALF_OPEN state
      circuitBreaker.forceState(CircuitState.HALF_OPEN);
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result.success).toBe(true);
      expect(result.circuitState).toBe(CircuitState.CLOSED);
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0); // Should reset on close
    });

    test('should transition back to OPEN on failed HALF_OPEN call', async () => {
      // Force circuit to HALF_OPEN state
      circuitBreaker.forceState(CircuitState.HALF_OPEN);
      
      const mockOperation = jest.fn().mockRejectedValue(new Error('Test failure'));
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result.success).toBe(false);
      expect(result.circuitState).toBe(CircuitState.OPEN);
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
    });
  });

  describe('Circuit Breaker Manager', () => {
    test('should manage multiple service circuit breakers', () => {
      const stats = circuitBreakerManager.getStats();
      
      expect(stats.services).toHaveProperty('oauth');
      expect(stats.services).toHaveProperty('mediaUpload');
      expect(stats.services).toHaveProperty('aiCaption');
      expect(stats.services).toHaveProperty('email');
      expect(stats.services).toHaveProperty('socialPublishing');
      expect(stats.services).toHaveProperty('analytics');
    });

    test('should execute operations with circuit breaker protection', async () => {
      const mockOperation = jest.fn().mockResolvedValue('test-result');
      
      const result = await circuitBreakerManager.executeWithCircuitBreaker({
        serviceName: 'oauth',
        operation: mockOperation,
        context: 'test-operation'
      });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('test-result');
      expect(result.circuitState).toBe(CircuitState.CLOSED);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    test('should execute operations with combined circuit breaker and retry protection', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue('success-after-retry');
      
      const result = await circuitBreakerManager.executeWithProtection({
        serviceName: 'oauth',
        operation: mockOperation,
        context: 'test-operation-with-retry'
      });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success-after-retry');
      expect(result.retryResult?.attempts).toBeGreaterThan(1);
    });

    test('should track open circuits', async () => {
      // Force a circuit to open
      circuitBreakerManager.forceCircuitState('oauth', CircuitState.OPEN);
      
      const stats = circuitBreakerManager.getStats();
      expect(stats.openCircuits).toContain('oauth');
      expect(circuitBreakerManager.hasOpenCircuits()).toBe(true);
    });

    test('should reset circuit breakers', () => {
      // Force a circuit to open
      circuitBreakerManager.forceCircuitState('oauth', CircuitState.OPEN);
      
      // Reset the circuit
      circuitBreakerManager.resetCircuitBreaker('oauth');
      
      const stats = circuitBreakerManager.getServiceStats('oauth');
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0);
    });

    test('should reset all circuit breakers', () => {
      // Force multiple circuits to open
      circuitBreakerManager.forceCircuitState('oauth', CircuitState.OPEN);
      circuitBreakerManager.forceCircuitState('mediaUpload', CircuitState.OPEN);
      
      // Reset all circuits
      circuitBreakerManager.resetAllCircuitBreakers();
      
      const stats = circuitBreakerManager.getStats();
      expect(stats.openCircuits).toHaveLength(0);
    });
  });

  describe('Service-Specific Configurations', () => {
    test('should load correct configuration for each service', () => {
      const oauthConfig = getCircuitBreakerConfig('oauth');
      const mediaUploadConfig = getCircuitBreakerConfig('mediaUpload');
      const emailConfig = getCircuitBreakerConfig('email');
      
      expect(oauthConfig.failureThreshold).toBe(5);
      expect(oauthConfig.timeoutMs).toBe(60000);
      
      expect(mediaUploadConfig.failureThreshold).toBe(3);
      expect(mediaUploadConfig.timeoutMs).toBe(120000);
      
      expect(emailConfig.failureThreshold).toBe(8);
      expect(emailConfig.timeoutMs).toBe(180000);
    });

    test('should validate circuit breaker configurations', () => {
      expect(() => {
        new CircuitBreaker('test', {
          failureThreshold: 0,
          timeoutMs: 1000,
          halfOpenMaxCalls: 1,
          enabled: true
        });
      }).toThrow('failureThreshold must be positive');

      expect(() => {
        new CircuitBreaker('test', {
          failureThreshold: 5,
          timeoutMs: 0,
          halfOpenMaxCalls: 1,
          enabled: true
        });
      }).toThrow('timeoutMs must be positive');
    });
  });

  describe('Health Check Integration', () => {
    test('should perform health checks', async () => {
      const healthCheckFn = jest.fn().mockResolvedValue(true);
      
      const isHealthy = await circuitBreaker.healthCheck(healthCheckFn);
      
      expect(isHealthy).toBe(true);
      expect(healthCheckFn).toHaveBeenCalledTimes(1);
    });

    test('should transition to HALF_OPEN on successful health check when circuit is OPEN', async () => {
      // Force circuit to OPEN
      circuitBreaker.forceState(CircuitState.OPEN);
      
      const healthCheckFn = jest.fn().mockResolvedValue(true);
      await circuitBreaker.healthCheck(healthCheckFn);
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.HALF_OPEN);
    });

    test('should start and stop health check monitoring', () => {
      const healthCheckFn = jest.fn().mockResolvedValue(true);
      
      // Start monitoring
      circuitBreakerManager.startServiceHealthCheck('oauth', healthCheckFn, 100);
      
      // Stop monitoring
      circuitBreakerManager.stopServiceHealthCheck('oauth');
      
      // Should not throw any errors
      expect(true).toBe(true);
    });
  });

  describe('Concurrent Access Safety', () => {
    test('should handle concurrent requests safely', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      // Execute multiple concurrent requests
      const promises = Array.from({ length: 10 }, () => 
        circuitBreaker.execute(mockOperation)
      );
      
      const results = await Promise.all(promises);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.result).toBe('success');
      });
      
      const stats = circuitBreaker.getStats();
      expect(stats.successCount).toBe(10);
      expect(stats.totalRequests).toBe(10);
    });

    test('should handle concurrent failures safely', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Concurrent failure'));
      
      // Execute multiple concurrent requests that will fail
      const promises = Array.from({ length: 5 }, () => 
        circuitBreaker.execute(mockOperation)
      );
      
      const results = await Promise.all(promises);
      
      // All requests should fail
      results.forEach(result => {
        expect(result.success).toBe(false);
      });
      
      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(5);
      expect(stats.state).toBe(CircuitState.OPEN); // Should open after threshold
    });
  });

  describe('Metrics and Statistics', () => {
    test('should calculate failure rate correctly', async () => {
      const successOperation = jest.fn().mockResolvedValue('success');
      const failureOperation = jest.fn().mockRejectedValue(new Error('failure'));
      
      // Execute 3 successes and 2 failures
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(failureOperation);
      await circuitBreaker.execute(failureOperation);
      
      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(5);
      expect(stats.successCount).toBe(3);
      expect(stats.failureCount).toBe(2);
      expect(stats.failureRate).toBe(40); // 2/5 * 100 = 40%
    });

    test('should track execution time', async () => {
      const slowOperation = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      });
      
      const result = await circuitBreaker.execute(slowOperation);
      
      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(90);
      expect(result.executionTime).toBeLessThan(200);
    });

    test('should provide comprehensive manager statistics', async () => {
      // Execute some operations on different services
      await circuitBreakerManager.executeWithCircuitBreaker({
        serviceName: 'oauth',
        operation: async () => 'oauth-success'
      });
      
      await circuitBreakerManager.executeWithCircuitBreaker({
        serviceName: 'mediaUpload',
        operation: async () => { throw new Error('media-failure'); }
      });
      
      const stats = circuitBreakerManager.getStats();
      
      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(stats.totalSuccesses).toBeGreaterThan(0);
      expect(stats.totalFailures).toBeGreaterThan(0);
      expect(stats.overallFailureRate).toBeGreaterThan(0);
      expect(Object.keys(stats.services)).toHaveLength(6);
    });
  });

  describe('Error Handling', () => {
    test('should handle disabled circuit breaker', async () => {
      const disabledConfig = { ...testConfig, enabled: false };
      const disabledCircuit = new CircuitBreaker('disabled-service', disabledConfig);
      
      const mockOperation = jest.fn().mockRejectedValue(new Error('Test failure'));
      const result = await disabledCircuit.execute(mockOperation);
      
      expect(result.success).toBe(false);
      expect(result.circuitState).toBe(CircuitState.CLOSED);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    test('should handle unknown service in manager', () => {
      expect(() => {
        circuitBreakerManager.getServiceStats('unknown-service' as any);
      }).toThrow('No circuit breaker found for service: unknown-service');
    });
  });
});

describe('Circuit Breaker Integration with Enhanced Services', () => {
  let circuitBreakerManager: CircuitBreakerManager;

  beforeEach(() => {
    circuitBreakerManager = new CircuitBreakerManager();
  });

  afterEach(() => {
    circuitBreakerManager.shutdown();
  });

  test('should integrate with OAuth service operations', async () => {
    const mockOAuthOperation = jest.fn().mockResolvedValue({
      success: true,
      account: { id: 'test-account' }
    });

    const result = await circuitBreakerManager.executeWithProtection({
      serviceName: 'oauth',
      operation: mockOAuthOperation,
      context: 'oauth-callback'
    });

    expect(result.success).toBe(true);
    expect(result.result?.success).toBe(true);
    expect(result.circuitBreakerResult.circuitState).toBe(CircuitState.CLOSED);
  });

  test('should integrate with media upload operations', async () => {
    const mockMediaOperation = jest.fn().mockResolvedValue({
      media: { id: 'test-media' },
      url: 'https://example.com/media.jpg'
    });

    const result = await circuitBreakerManager.executeWithProtection({
      serviceName: 'mediaUpload',
      operation: mockMediaOperation,
      context: 'media-upload'
    });

    expect(result.success).toBe(true);
    expect(result.result?.media.id).toBe('test-media');
    expect(result.circuitBreakerResult.circuitState).toBe(CircuitState.CLOSED);
  });

  test('should integrate with analytics operations', async () => {
    const mockAnalyticsOperation = jest.fn().mockResolvedValue({
      totalImpressions: 1000,
      totalEngagement: 50,
      engagementRate: 5.0
    });

    const result = await circuitBreakerManager.executeWithProtection({
      serviceName: 'analytics',
      operation: mockAnalyticsOperation,
      context: 'analytics-overview'
    });

    expect(result.success).toBe(true);
    expect(result.result?.totalImpressions).toBe(1000);
    expect(result.circuitBreakerResult.circuitState).toBe(CircuitState.CLOSED);
  });

  test('should handle service failures with circuit breaker protection', async () => {
    const mockFailingOperation = jest.fn().mockRejectedValue(new Error('Service unavailable'));

    // Execute enough failures to open the circuit
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreakerManager.executeWithProtection({
          serviceName: 'email',
          operation: mockFailingOperation,
          context: 'email-send'
        });
      } catch (error) {
        // Expected to fail
      }
    }

    // Circuit should now be open
    const stats = circuitBreakerManager.getServiceStats('email');
    expect(stats.state).toBe(CircuitState.OPEN);

    // Next request should fail fast
    try {
      await circuitBreakerManager.executeWithCircuitBreaker({
        serviceName: 'email',
        operation: mockFailingOperation,
        context: 'email-send-blocked'
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CircuitBreakerError);
      expect((error as CircuitBreakerError).errorType).toBe(CircuitBreakerErrorType.CIRCUIT_OPEN);
    }
  });
});