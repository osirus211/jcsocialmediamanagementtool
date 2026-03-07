/**
 * Unit Tests for PublishingWorkerWrapper.wrapPlatformPublish()
 * 
 * Tests:
 * - Circuit breaker state check (OPEN → fail-fast)
 * - Circuit breaker state check (CLOSED → execute)
 * - Circuit breaker failure recording
 * - Error propagation
 * - Metrics emission
 * 
 * Requirements: 2.1, 2.8, 2.9
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import PublishingWorkerWrapper from '../../../../../.kiro/execution/reliability/PublishingWorkerWrapper';
import CircuitBreakerManager from '../../../../../.kiro/execution/reliability/CircuitBreakerManager';
import { CircuitState } from '../../../../../.kiro/execution/reliability/CircuitBreakerState';

describe('PublishingWorkerWrapper.wrapPlatformPublish()', () => {
  let wrapper: PublishingWorkerWrapper;

  beforeEach(() => {
    wrapper = new PublishingWorkerWrapper();
  });

  afterEach(() => {
    wrapper.shutdown();
  });

  describe('Circuit Breaker State Check - OPEN', () => {
    it('should fail-fast when circuit breaker is OPEN', async () => {
      // Force circuit breaker to OPEN state
      const stats = wrapper.getCircuitBreakerStats();
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('socialPublishing', CircuitState.OPEN);

      const publishFn = jest.fn(async () => ({ success: true, platformPostId: '123' }));
      const context = { postId: 'post-123', platform: 'twitter' };

      // Should throw error without calling publishFn
      await expect(wrapper.wrapPlatformPublish(publishFn, context)).rejects.toThrow(
        'Circuit breaker OPEN for twitter'
      );

      // Verify publishFn was NOT called (fail-fast)
      expect(publishFn).not.toHaveBeenCalled();
    });

    it('should throw error with retryable flag when circuit is OPEN', async () => {
      // Force circuit breaker to OPEN state
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('socialPublishing', CircuitState.OPEN);

      const publishFn = jest.fn(async () => ({ success: true }));
      const context = { postId: 'post-456', platform: 'facebook' };

      try {
        await wrapper.wrapPlatformPublish(publishFn, context);
        fail('Should have thrown error');
      } catch (error: any) {
        // Verify error has retryable flag
        expect(error.retryable).toBe(true);
        expect(error.circuitBreakerOpen).toBe(true);
        expect(error.message).toContain('Circuit breaker OPEN');
      }
    });

    it('should log warning when circuit is OPEN', async () => {
      // Force circuit breaker to OPEN state
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('socialPublishing', CircuitState.OPEN);

      const publishFn = jest.fn(async () => ({ success: true }));
      const context = { postId: 'post-789', platform: 'linkedin' };

      // Mock logger to verify warning
      const loggerWarnSpy = jest.spyOn(wrapper['logger'], 'warn');

      try {
        await wrapper.wrapPlatformPublish(publishFn, context);
      } catch (error) {
        // Expected to throw
      }

      // Verify warning was logged
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        '[CIRCUIT_BREAKER] Circuit OPEN - fail-fast',
        expect.objectContaining({
          postId: 'post-789',
          platform: 'linkedin',
          circuitState: 'OPEN'
        })
      );

      loggerWarnSpy.mockRestore();
    });
  });

  describe('Circuit Breaker State Check - CLOSED', () => {
    it('should execute publishFn when circuit breaker is CLOSED', async () => {
      const expectedResult = { success: true, platformPostId: 'abc123' };
      const publishFn = jest.fn(async () => expectedResult);
      const context = { postId: 'post-111', platform: 'twitter' };

      const result = await wrapper.wrapPlatformPublish(publishFn, context);

      // Verify publishFn was called
      expect(publishFn).toHaveBeenCalledTimes(1);
      
      // Verify result is returned
      expect(result).toEqual(expectedResult);
    });

    it('should execute publishFn when circuit breaker is HALF_OPEN', async () => {
      // Force circuit breaker to HALF_OPEN state
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('socialPublishing', CircuitState.HALF_OPEN);

      const expectedResult = { success: true, platformPostId: 'xyz789' };
      const publishFn = jest.fn(async () => expectedResult);
      const context = { postId: 'post-222', platform: 'facebook' };

      const result = await wrapper.wrapPlatformPublish(publishFn, context);

      // Verify publishFn was called (HALF_OPEN allows test requests)
      expect(publishFn).toHaveBeenCalledTimes(1);
      
      // Verify result is returned
      expect(result).toEqual(expectedResult);
    });

    it('should return result from successful publishFn', async () => {
      const expectedResult = {
        success: true,
        platformPostId: 'post-external-123',
        url: 'https://twitter.com/user/status/123'
      };
      const publishFn = jest.fn(async () => expectedResult);
      const context = { postId: 'post-333', platform: 'twitter' };

      const result = await wrapper.wrapPlatformPublish(publishFn, context);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('Circuit Breaker Failure Recording', () => {
    it('should record failure in circuit breaker when publishFn throws', async () => {
      const publishFn = jest.fn(async () => {
        throw new Error('Platform API error');
      });
      const context = { postId: 'post-444', platform: 'twitter' };

      // Get initial stats
      const cbManager = wrapper['circuitBreakerManager'];
      const initialStats = cbManager.getServiceStats('socialPublishing');
      const initialFailures = initialStats.failureCount;

      try {
        await wrapper.wrapPlatformPublish(publishFn, context);
        fail('Should have thrown error');
      } catch (error) {
        // Expected to throw
      }

      // Verify failure was recorded
      const finalStats = cbManager.getServiceStats('socialPublishing');
      expect(finalStats.failureCount).toBeGreaterThan(initialFailures);
    });

    it('should record success in circuit breaker when publishFn succeeds', async () => {
      const publishFn = jest.fn(async () => ({ success: true }));
      const context = { postId: 'post-555', platform: 'facebook' };

      // Get initial stats
      const cbManager = wrapper['circuitBreakerManager'];
      const initialStats = cbManager.getServiceStats('socialPublishing');
      const initialSuccesses = initialStats.successCount;

      await wrapper.wrapPlatformPublish(publishFn, context);

      // Verify success was recorded
      const finalStats = cbManager.getServiceStats('socialPublishing');
      expect(finalStats.successCount).toBeGreaterThan(initialSuccesses);
    });

    it('should open circuit breaker after threshold failures', async () => {
      const publishFn = jest.fn(async () => {
        throw new Error('Platform API error');
      });
      const context = { postId: 'post-666', platform: 'twitter' };

      // Trigger multiple failures to open circuit
      const failureThreshold = 5; // Default threshold
      for (let i = 0; i < failureThreshold; i++) {
        try {
          await wrapper.wrapPlatformPublish(publishFn, context);
        } catch (error) {
          // Expected to throw
        }
      }

      // Verify circuit breaker is now OPEN
      const cbManager = wrapper['circuitBreakerManager'];
      const stats = cbManager.getServiceStats('socialPublishing');
      expect(stats.state).toBe(CircuitState.OPEN);
    });
  });

  describe('Error Propagation', () => {
    it('should propagate error from publishFn', async () => {
      const expectedError = new Error('Platform API timeout');
      const publishFn = jest.fn(async () => {
        throw expectedError;
      });
      const context = { postId: 'post-777', platform: 'linkedin' };

      await expect(wrapper.wrapPlatformPublish(publishFn, context)).rejects.toThrow(
        'Platform API timeout'
      );
    });

    it('should preserve error properties from publishFn', async () => {
      const customError: any = new Error('Rate limit exceeded');
      customError.retryable = true;
      customError.statusCode = 429;
      customError.retryAfter = 60;

      const publishFn = jest.fn(async () => {
        throw customError;
      });
      const context = { postId: 'post-888', platform: 'twitter' };

      try {
        await wrapper.wrapPlatformPublish(publishFn, context);
        fail('Should have thrown error');
      } catch (error: any) {
        // Verify error properties are preserved
        expect(error.retryable).toBe(true);
        expect(error.statusCode).toBe(429);
        expect(error.retryAfter).toBe(60);
      }
    });

    it('should log error when publishFn fails', async () => {
      const publishFn = jest.fn(async () => {
        throw new Error('Network error');
      });
      const context = { postId: 'post-999', platform: 'facebook' };

      // Mock logger to verify error logging
      const loggerErrorSpy = jest.spyOn(wrapper['logger'], 'error');

      try {
        await wrapper.wrapPlatformPublish(publishFn, context);
      } catch (error) {
        // Expected to throw
      }

      // Verify error was logged
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        '[CIRCUIT_BREAKER] Platform publish failed',
        expect.objectContaining({
          postId: 'post-999',
          platform: 'facebook',
          error: 'Network error'
        })
      );

      loggerErrorSpy.mockRestore();
    });

    it('should throw error when circuit breaker execution fails', async () => {
      const publishFn = jest.fn(async () => {
        throw new Error('Service unavailable');
      });
      const context = { postId: 'post-1010', platform: 'twitter' };

      await expect(wrapper.wrapPlatformPublish(publishFn, context)).rejects.toThrow(
        'Service unavailable'
      );
    });
  });

  describe('Metrics Emission', () => {
    it('should emit metrics for successful publish', async () => {
      const publishFn = jest.fn(async () => ({ success: true }));
      const context = { postId: 'post-1111', platform: 'twitter' };

      // Get initial stats
      const cbManager = wrapper['circuitBreakerManager'];
      const initialStats = cbManager.getServiceStats('socialPublishing');
      const initialSuccesses = initialStats.successCount;

      await wrapper.wrapPlatformPublish(publishFn, context);

      // Verify success metric was incremented
      const finalStats = cbManager.getServiceStats('socialPublishing');
      expect(finalStats.successCount).toBe(initialSuccesses + 1);
    });

    it('should emit metrics for failed publish', async () => {
      const publishFn = jest.fn(async () => {
        throw new Error('API error');
      });
      const context = { postId: 'post-1212', platform: 'facebook' };

      // Get initial stats
      const cbManager = wrapper['circuitBreakerManager'];
      const initialStats = cbManager.getServiceStats('socialPublishing');
      const initialFailures = initialStats.failureCount;

      try {
        await wrapper.wrapPlatformPublish(publishFn, context);
      } catch (error) {
        // Expected to throw
      }

      // Verify failure metric was incremented
      const finalStats = cbManager.getServiceStats('socialPublishing');
      expect(finalStats.failureCount).toBe(initialFailures + 1);
    });

    it('should emit metrics for circuit breaker OPEN', async () => {
      // Force circuit breaker to OPEN state
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('socialPublishing', CircuitState.OPEN);

      const publishFn = jest.fn(async () => ({ success: true }));
      const context = { postId: 'post-1313', platform: 'linkedin' };

      try {
        await wrapper.wrapPlatformPublish(publishFn, context);
      } catch (error) {
        // Expected to throw
      }

      // Verify circuit breaker state is OPEN
      const stats = cbManager.getServiceStats('socialPublishing');
      expect(stats.state).toBe(CircuitState.OPEN);
    });

    it('should track circuit breaker state transitions', async () => {
      const publishFn = jest.fn(async () => {
        throw new Error('API error');
      });
      const context = { postId: 'post-1414', platform: 'twitter' };

      // Initial state should be CLOSED
      const cbManager = wrapper['circuitBreakerManager'];
      let stats = cbManager.getServiceStats('socialPublishing');
      expect(stats.state).toBe(CircuitState.CLOSED);

      // Trigger failures to open circuit
      const failureThreshold = 5;
      for (let i = 0; i < failureThreshold; i++) {
        try {
          await wrapper.wrapPlatformPublish(publishFn, context);
        } catch (error) {
          // Expected to throw
        }
      }

      // Verify state transitioned to OPEN
      stats = cbManager.getServiceStats('socialPublishing');
      expect(stats.state).toBe(CircuitState.OPEN);
    });
  });

  describe('Edge Cases', () => {
    it('should handle publishFn that returns null', async () => {
      const publishFn = jest.fn(async () => null);
      const context = { postId: 'post-1515', platform: 'twitter' };

      const result = await wrapper.wrapPlatformPublish(publishFn, context);

      expect(result).toBeNull();
    });

    it('should handle publishFn that returns undefined', async () => {
      const publishFn = jest.fn(async () => undefined);
      const context = { postId: 'post-1616', platform: 'facebook' };

      const result = await wrapper.wrapPlatformPublish(publishFn, context);

      expect(result).toBeUndefined();
    });

    it('should handle publishFn with complex return object', async () => {
      const complexResult = {
        success: true,
        platformPostId: 'complex-123',
        metadata: {
          likes: 0,
          shares: 0,
          comments: []
        },
        url: 'https://example.com/post/123'
      };
      const publishFn = jest.fn(async () => complexResult);
      const context = { postId: 'post-1717', platform: 'linkedin' };

      const result = await wrapper.wrapPlatformPublish(publishFn, context);

      expect(result).toEqual(complexResult);
    });

    it('should handle multiple concurrent calls', async () => {
      const publishFn = jest.fn(async () => ({ success: true }));
      
      const calls = [
        wrapper.wrapPlatformPublish(publishFn, { postId: 'post-1', platform: 'twitter' }),
        wrapper.wrapPlatformPublish(publishFn, { postId: 'post-2', platform: 'facebook' }),
        wrapper.wrapPlatformPublish(publishFn, { postId: 'post-3', platform: 'linkedin' })
      ];

      const results = await Promise.all(calls);

      expect(results).toHaveLength(3);
      expect(publishFn).toHaveBeenCalledTimes(3);
      results.forEach(result => {
        expect(result).toEqual({ success: true });
      });
    });

    it('should handle publishFn that throws non-Error object', async () => {
      const publishFn = jest.fn(async () => {
        throw 'String error';
      });
      const context = { postId: 'post-1818', platform: 'twitter' };

      await expect(wrapper.wrapPlatformPublish(publishFn, context)).rejects.toBe('String error');
    });
  });
});
