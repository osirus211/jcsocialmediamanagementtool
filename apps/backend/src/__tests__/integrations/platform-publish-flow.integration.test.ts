/**
 * Integration Tests for Platform Publish Flow with Circuit Breaker
 * 
 * Tests the full publish flow with PublishingWorkerWrapper integrated into PublishingWorker.
 * Verifies that:
 * 1. The wrapper is properly integrated into the publish flow
 * 2. Platform API failures are recorded in the circuit breaker and trigger BullMQ retry
 * 3. When circuit breaker is OPEN, publish fails fast and triggers BullMQ retry
 * 4. Successful publishes are recorded in the circuit breaker
 * 5. Multi-platform scenarios with partial failures work correctly
 * 
 * Requirements: 2.1, 2.8, 2.9, 3.1, 3.4
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import PublishingWorkerWrapper from '../../../../../.kiro/execution/reliability/PublishingWorkerWrapper';
import { CircuitState } from '../../../../../.kiro/execution/reliability/CircuitBreakerState';

describe('Platform Publish Flow Integration Tests', () => {
  let wrapper: PublishingWorkerWrapper;

  beforeEach(() => {
    wrapper = new PublishingWorkerWrapper();
  });

  afterEach(() => {
    wrapper.shutdown();
  });

  describe('Test 1: Full publish flow with wrapper integrated', () => {
    it('should successfully publish post through wrapper', async () => {
      // Arrange
      const mockPublishFn = jest.fn(async () => ({
        success: true,
        platformPostId: 'platform-123',
        publishedAt: new Date(),
        url: 'https://twitter.com/user/status/123'
      }));

      const context = {
        postId: 'post-123',
        platform: 'twitter'
      };

      // Act
      const result = await wrapper.wrapPlatformPublish(mockPublishFn, context);

      // Assert
      expect(mockPublishFn).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('platform-123');
    });

    it('should check circuit breaker state before publishing', async () => {
      // Arrange
      const mockPublishFn = jest.fn(async () => ({
        success: true,
        platformPostId: 'platform-456'
      }));

      // Act
      const circuitState = wrapper.getCircuitState('twitter');
      expect(circuitState).toBe('CLOSED');

      const result = await wrapper.wrapPlatformPublish(
        mockPublishFn,
        { postId: 'post-123', platform: 'twitter' }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockPublishFn).toHaveBeenCalled();
    });

    it('should preserve existing error handling flow', async () => {
      // Arrange
      const publishError: any = new Error('Provider publish failed');
      publishError.retryable = true;
      const mockPublishFn = jest.fn(async () => {
        throw publishError;
      });

      // Act & Assert
      await expect(
        wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'post-123', platform: 'twitter' }
        )
      ).rejects.toThrow('Provider publish failed');
    });
  });

  describe('Test 2: Platform API failure → circuit breaker records failure → BullMQ retry', () => {
    it('should record failure in circuit breaker when platform API fails', async () => {
      // Arrange
      const apiError: any = new Error('Platform API 500 error');
      apiError.retryable = true;
      apiError.statusCode = 500;

      const mockPublishFn = jest.fn(async () => {
        throw apiError;
      });

      const cbManager = wrapper['circuitBreakerManager'];
      const initialStats = cbManager.getServiceStats('socialPublishing');
      const initialFailures = initialStats.failureCount;

      // Act
      try {
        await wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'post-123', platform: 'twitter' }
        );
        fail('Should have thrown error');
      } catch (error: any) {
        // Assert - error should be thrown for BullMQ retry
        expect(error.message).toBe('Platform API 500 error');
      }

      // Verify failure was recorded
      const finalStats = cbManager.getServiceStats('socialPublishing');
      expect(finalStats.failureCount).toBeGreaterThan(initialFailures);
    });

    it('should trigger BullMQ retry on platform API failure', async () => {
      // Arrange
      const apiError: any = new Error('Network timeout');
      apiError.retryable = true;
      const mockPublishFn = jest.fn(async () => {
        throw apiError;
      });

      // Act & Assert
      await expect(
        wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'post-123', platform: 'twitter' }
        )
      ).rejects.toThrow('Network timeout');

      // Verify function was called (error propagates for BullMQ retry)
      expect(mockPublishFn).toHaveBeenCalled();
    });

    it('should handle retryable errors (5xx)', async () => {
      // Arrange
      const retryableError: any = new Error('Service unavailable');
      retryableError.retryable = true;
      retryableError.statusCode = 503;
      const mockPublishFn = jest.fn(async () => {
        throw retryableError;
      });

      // Act & Assert
      await expect(
        wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'post-123', platform: 'twitter' }
        )
      ).rejects.toThrow('Service unavailable');
    });

    it('should handle rate limit errors (429)', async () => {
      // Arrange
      const rateLimitError: any = new Error('Rate limit exceeded');
      rateLimitError.retryable = true;
      rateLimitError.statusCode = 429;
      rateLimitError.retryAfter = 60;
      const mockPublishFn = jest.fn(async () => {
        throw rateLimitError;
      });

      // Act & Assert
      await expect(
        wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'post-123', platform: 'twitter' }
        )
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Test 3: Circuit breaker OPEN → fail-fast → BullMQ retry', () => {
    it('should fail-fast when circuit breaker is OPEN', async () => {
      // Arrange
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('socialPublishing', CircuitState.OPEN);

      const mockPublishFn = jest.fn(async () => ({
        success: true,
        platformPostId: 'platform-123'
      }));

      // Act - check circuit state (should be OPEN now)
      const circuitState = cbManager.getServiceStats('socialPublishing').state;
      expect(circuitState).toBe(CircuitState.OPEN);

      // Assert - should fail-fast
      await expect(
        wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'post-123', platform: 'twitter' }
        )
      ).rejects.toThrow('Circuit breaker OPEN');

      // Verify provider was NOT called (fail-fast)
      expect(mockPublishFn).not.toHaveBeenCalled();
    });

    it('should not call provider when circuit is OPEN', async () => {
      // Arrange
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('socialPublishing', CircuitState.OPEN);

      const mockPublishFn = jest.fn(async () => ({
        success: true
      }));

      // Act
      try {
        await wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'post-123', platform: 'twitter' }
        );
        fail('Should have thrown error');
      } catch (error) {
        // Expected
      }

      // Assert - provider should NOT be called (fail-fast)
      expect(mockPublishFn).not.toHaveBeenCalled();
    });

    it('should trigger BullMQ retry when circuit is OPEN', async () => {
      // Arrange
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('socialPublishing', CircuitState.OPEN);

      const mockPublishFn = jest.fn(async () => ({
        success: true
      }));

      // Act & Assert
      await expect(
        wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'post-123', platform: 'facebook' }
        )
      ).rejects.toThrow('Circuit breaker OPEN');

      // Error thrown → BullMQ will retry
    });

    it('should allow publish when circuit transitions to HALF_OPEN', async () => {
      // Arrange
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('socialPublishing', CircuitState.HALF_OPEN);

      const mockPublishFn = jest.fn(async () => ({
        success: true,
        platformPostId: 'platform-789'
      }));

      // Act - check circuit state (should be HALF_OPEN now)
      const circuitState = cbManager.getServiceStats('socialPublishing').state;
      expect(circuitState).toBe(CircuitState.HALF_OPEN);

      const result = await wrapper.wrapPlatformPublish(
        mockPublishFn,
        { postId: 'post-123', platform: 'twitter' }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockPublishFn).toHaveBeenCalled();
    });
  });

  describe('Test 4: Successful publish → circuit breaker records success', () => {
    it('should record success in circuit breaker on successful publish', async () => {
      // Arrange
      const mockPublishFn = jest.fn(async () => ({
        success: true,
        platformPostId: 'platform-success-123',
        publishedAt: new Date()
      }));

      const cbManager = wrapper['circuitBreakerManager'];
      const initialStats = cbManager.getServiceStats('socialPublishing');
      const initialSuccesses = initialStats.successCount;

      // Act
      const result = await wrapper.wrapPlatformPublish(
        mockPublishFn,
        { postId: 'post-123', platform: 'twitter' }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('platform-success-123');

      // Verify success was recorded
      const finalStats = cbManager.getServiceStats('socialPublishing');
      expect(finalStats.successCount).toBeGreaterThan(initialSuccesses);
    });

    it('should keep circuit breaker CLOSED after successful publish', async () => {
      // Arrange
      const mockPublishFn = jest.fn(async () => ({
        success: true,
        platformPostId: 'platform-456'
      }));

      // Act
      await wrapper.wrapPlatformPublish(
        mockPublishFn,
        { postId: 'post-123', platform: 'twitter' }
      );

      const circuitState = wrapper.getCircuitState('twitter');

      // Assert
      expect(circuitState).toBe('CLOSED');
    });

    it('should transition circuit from HALF_OPEN to CLOSED on success', async () => {
      // Arrange
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('socialPublishing', CircuitState.HALF_OPEN);

      const mockPublishFn = jest.fn(async () => ({
        success: true,
        platformPostId: 'platform-recovery-123'
      }));

      // Act - check initial state
      const initialState = cbManager.getServiceStats('socialPublishing').state;
      expect(initialState).toBe(CircuitState.HALF_OPEN);

      await wrapper.wrapPlatformPublish(
        mockPublishFn,
        { postId: 'post-123', platform: 'twitter' }
      );

      // Wait a bit for state transition
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalState = cbManager.getServiceStats('socialPublishing').state;

      // Assert - should transition to CLOSED after successful request in HALF_OPEN
      expect(finalState).toBe(CircuitState.CLOSED);
    });
  });

  describe('Test 5: Multi-platform publish with partial failures', () => {
    it('should handle partial failures across multiple platforms', async () => {
      // Arrange
      const platforms = [
        { platform: 'twitter', shouldFail: false },
        { platform: 'facebook', shouldFail: true },
        { platform: 'linkedin', shouldFail: false }
      ];

      const results: Array<{ platform: string; success: boolean; error?: string }> = [];

      // Act
      for (const { platform, shouldFail } of platforms) {
        const mockPublishFn = jest.fn(async () => {
          if (shouldFail) {
            throw new Error(`${platform} API error`);
          }
          return {
            success: true,
            platformPostId: `${platform}-123`
          };
        });

        try {
          await wrapper.wrapPlatformPublish(
            mockPublishFn,
            { postId: 'post-123', platform }
          );
          results.push({ platform, success: true });
        } catch (error: any) {
          results.push({ 
            platform, 
            success: false, 
            error: error.message 
          });
        }
      }

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ platform: 'twitter', success: true });
      expect(results[1]).toEqual({ 
        platform: 'facebook', 
        success: false, 
        error: 'facebook API error' 
      });
      expect(results[2]).toEqual({ platform: 'linkedin', success: true });
    });

    it('should handle concurrent multi-platform publishes', async () => {
      // Arrange
      const platforms = ['twitter', 'facebook', 'linkedin'];
      
      const publishPromises = platforms.map(platform => {
        const mockPublishFn = jest.fn(async () => ({
          success: true,
          platformPostId: `${platform}-123`
        }));

        return wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'post-123', platform }
        );
      });

      // Act
      const results = await Promise.all(publishPromises);

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].platformPostId).toBe('twitter-123');
      expect(results[1].platformPostId).toBe('facebook-123');
      expect(results[2].platformPostId).toBe('linkedin-123');
    });

    it('should handle all platforms failing', async () => {
      // Arrange
      const platforms = ['twitter', 'facebook', 'linkedin'];
      const apiError = new Error('All platforms down');

      const publishPromises = platforms.map(platform => {
        const mockPublishFn = jest.fn(async () => {
          throw apiError;
        });

        return wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'post-123', platform }
        );
      });

      // Act
      const results = await Promise.allSettled(publishPromises);

      // Assert
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(result.reason.message).toBe('All platforms down');
        }
      });
    });

    it('should handle all platforms succeeding', async () => {
      // Arrange
      const platforms = ['twitter', 'facebook', 'linkedin'];

      const publishPromises = platforms.map(platform => {
        const mockPublishFn = jest.fn(async () => ({
          success: true,
          platformPostId: `${platform}-123`
        }));

        return wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'post-123', platform }
        );
      });

      // Act
      const results = await Promise.all(publishPromises);

      // Assert
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.platformPostId).toBeDefined();
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle timeout errors', async () => {
      // Arrange
      const timeoutError: any = new Error('Request timeout');
      timeoutError.retryable = true;
      timeoutError.code = 'ETIMEDOUT';
      const mockPublishFn = jest.fn(async () => {
        throw timeoutError;
      });

      // Act & Assert
      await expect(
        wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'post-123', platform: 'twitter' }
        )
      ).rejects.toThrow('Request timeout');
    });

    it('should handle network errors', async () => {
      // Arrange
      const networkError: any = new Error('Network unreachable');
      networkError.retryable = true;
      networkError.code = 'ENETUNREACH';
      const mockPublishFn = jest.fn(async () => {
        throw networkError;
      });

      // Act & Assert
      await expect(
        wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'post-123', platform: 'twitter' }
        )
      ).rejects.toThrow('Network unreachable');
    });

    it('should handle circuit breaker opening after threshold failures', async () => {
      // Arrange
      const apiError = new Error('API error');
      const mockPublishFn = jest.fn(async () => {
        throw apiError;
      });

      const cbManager = wrapper['circuitBreakerManager'];

      // Act - trigger multiple failures to open circuit
      const failureThreshold = 5;
      for (let i = 0; i < failureThreshold; i++) {
        try {
          await wrapper.wrapPlatformPublish(
            mockPublishFn,
            { postId: `post-${i}`, platform: 'twitter' }
          );
        } catch (error) {
          // Expected to throw
        }
      }

      // Assert - circuit should be OPEN
      const circuitState = cbManager.getServiceStats('socialPublishing').state;
      expect(circuitState).toBe(CircuitState.OPEN);
    });
  });
});
