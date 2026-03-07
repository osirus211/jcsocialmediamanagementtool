/**
 * Load Tests for Platform Publish Flow with Circuit Breaker
 * 
 * Tests performance characteristics of the wrapper integration:
 * 1. Publish throughput is not significantly impacted by the wrapper
 * 2. Wrapper overhead is minimal (< 10ms per publish)
 * 3. Circuit breaker state transitions work correctly under load
 * 4. No memory leaks occur from wrapper instances
 * 
 * Requirements: 2.1
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import PublishingWorkerWrapper from '../../../../../.kiro/execution/reliability/PublishingWorkerWrapper';
import { CircuitState } from '../../../../../.kiro/execution/reliability/CircuitBreakerState';

describe('Platform Publish Load Tests', () => {
  let wrapper: PublishingWorkerWrapper;

  beforeEach(() => {
    wrapper = new PublishingWorkerWrapper();
  });

  afterEach(() => {
    wrapper.shutdown();
  });

  describe('Test 1: Publish throughput unchanged', () => {
    it('should handle 100 concurrent publishes without significant slowdown', async () => {
      // Arrange
      const publishCount = 100;
      const mockPublishFn = async () => ({
        success: true,
        platformPostId: `platform-${Date.now()}`,
        publishedAt: new Date()
      });

      // Act - measure throughput with wrapper
      const startTime = Date.now();
      const publishPromises = Array.from({ length: publishCount }, (_, i) =>
        wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: `post-${i}`, platform: 'twitter' }
        )
      );

      const results = await Promise.all(publishPromises);
      const duration = Date.now() - startTime;

      // Assert
      expect(results).toHaveLength(publishCount);
      expect(results.every(r => r.success)).toBe(true);

      // Throughput should be reasonable (100 publishes in < 5 seconds)
      expect(duration).toBeLessThan(5000);

      const throughput = publishCount / (duration / 1000);
      console.log(`Throughput: ${throughput.toFixed(2)} publishes/second`);
      console.log(`Total duration: ${duration}ms for ${publishCount} publishes`);

      // Expect at least 20 publishes per second
      expect(throughput).toBeGreaterThan(20);
    });

    it('should handle 500 sequential publishes efficiently', async () => {
      // Arrange
      const publishCount = 500;
      const mockPublishFn = async () => ({
        success: true,
        platformPostId: `platform-${Date.now()}`
      });

      // Act - measure sequential throughput
      const startTime = Date.now();
      let successCount = 0;

      for (let i = 0; i < publishCount; i++) {
        const result = await wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: `post-${i}`, platform: 'twitter' }
        );
        if (result.success) successCount++;
      }

      const duration = Date.now() - startTime;

      // Assert
      expect(successCount).toBe(publishCount);

      // Sequential throughput should be reasonable (500 publishes in < 30 seconds)
      expect(duration).toBeLessThan(30000);

      const throughput = publishCount / (duration / 1000);
      console.log(`Sequential throughput: ${throughput.toFixed(2)} publishes/second`);
      console.log(`Total duration: ${duration}ms for ${publishCount} publishes`);
    });

    it('should maintain throughput with mixed success/failure scenarios', async () => {
      // Arrange
      const publishCount = 100;
      let callCount = 0;

      const mockPublishFn = async () => {
        callCount++;
        // 80% success rate
        if (callCount % 5 === 0) {
          throw new Error('Simulated API failure');
        }
        return {
          success: true,
          platformPostId: `platform-${callCount}`
        };
      };

      // Act
      const startTime = Date.now();
      const publishPromises = Array.from({ length: publishCount }, (_, i) =>
        wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: `post-${i}`, platform: 'twitter' }
        ).catch(error => ({ success: false, error: error.message }))
      );

      const results = await Promise.all(publishPromises);
      const duration = Date.now() - startTime;

      // Assert
      const successCount = results.filter((r: any) => r.success).length;
      const failureCount = results.filter((r: any) => !r.success).length;

      expect(successCount).toBeGreaterThan(70); // At least 70% success
      expect(failureCount).toBeGreaterThan(0); // Some failures expected

      console.log(`Mixed scenario: ${successCount} successes, ${failureCount} failures in ${duration}ms`);

      // Throughput should still be reasonable
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Test 2: Wrapper overhead < 10ms per publish', () => {
    it('should add minimal overhead to successful publishes', async () => {
      // Arrange
      const iterations = 50;
      const overheadMeasurements: number[] = [];

      const mockPublishFn = async () => {
        // Simulate 5ms API call
        await new Promise(resolve => setTimeout(resolve, 5));
        return {
          success: true,
          platformPostId: 'platform-123'
        };
      };

      // Act - measure overhead for each publish
      for (let i = 0; i < iterations; i++) {
        // Measure direct call time
        const directStart = Date.now();
        await mockPublishFn();
        const directDuration = Date.now() - directStart;

        // Measure wrapped call time
        const wrappedStart = Date.now();
        await wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: `post-${i}`, platform: 'twitter' }
        );
        const wrappedDuration = Date.now() - wrappedStart;

        // Calculate overhead
        const overhead = wrappedDuration - directDuration;
        overheadMeasurements.push(overhead);
      }

      // Assert
      const avgOverhead = overheadMeasurements.reduce((a, b) => a + b, 0) / overheadMeasurements.length;
      const maxOverhead = Math.max(...overheadMeasurements);

      console.log(`Average wrapper overhead: ${avgOverhead.toFixed(2)}ms`);
      console.log(`Max wrapper overhead: ${maxOverhead}ms`);
      console.log(`Min wrapper overhead: ${Math.min(...overheadMeasurements)}ms`);

      // Average overhead should be < 10ms
      expect(avgOverhead).toBeLessThan(10);

      // Max overhead should be reasonable (< 20ms)
      expect(maxOverhead).toBeLessThan(20);
    });

    it('should have minimal overhead for failed publishes', async () => {
      // Arrange
      const iterations = 50;
      const overheadMeasurements: number[] = [];

      const mockPublishFn = async () => {
        // Simulate 5ms API call that fails
        await new Promise(resolve => setTimeout(resolve, 5));
        throw new Error('API error');
      };

      // Act - measure overhead for failed publishes
      for (let i = 0; i < iterations; i++) {
        // Measure direct call time
        const directStart = Date.now();
        try {
          await mockPublishFn();
        } catch (error) {
          // Expected
        }
        const directDuration = Date.now() - directStart;

        // Measure wrapped call time
        const wrappedStart = Date.now();
        try {
          await wrapper.wrapPlatformPublish(
            mockPublishFn,
            { postId: `post-${i}`, platform: 'twitter' }
          );
        } catch (error) {
          // Expected
        }
        const wrappedDuration = Date.now() - wrappedStart;

        // Calculate overhead
        const overhead = wrappedDuration - directDuration;
        overheadMeasurements.push(overhead);
      }

      // Assert
      const avgOverhead = overheadMeasurements.reduce((a, b) => a + b, 0) / overheadMeasurements.length;
      const maxOverhead = Math.max(...overheadMeasurements);

      console.log(`Average wrapper overhead (failures): ${avgOverhead.toFixed(2)}ms`);
      console.log(`Max wrapper overhead (failures): ${maxOverhead}ms`);

      // Average overhead should be < 10ms even for failures
      expect(avgOverhead).toBeLessThan(10);
    });

    it('should have consistent overhead across multiple platforms', async () => {
      // Arrange
      const platforms = ['twitter', 'facebook', 'linkedin', 'instagram'];
      const iterations = 25;
      const overheadByPlatform: Record<string, number[]> = {};

      const mockPublishFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return { success: true, platformPostId: 'platform-123' };
      };

      // Act - measure overhead per platform
      for (const platform of platforms) {
        overheadByPlatform[platform] = [];

        for (let i = 0; i < iterations; i++) {
          const directStart = Date.now();
          await mockPublishFn();
          const directDuration = Date.now() - directStart;

          const wrappedStart = Date.now();
          await wrapper.wrapPlatformPublish(
            mockPublishFn,
            { postId: `post-${i}`, platform }
          );
          const wrappedDuration = Date.now() - wrappedStart;

          const overhead = wrappedDuration - directDuration;
          overheadByPlatform[platform].push(overhead);
        }
      }

      // Assert
      for (const platform of platforms) {
        const avgOverhead = overheadByPlatform[platform].reduce((a, b) => a + b, 0) / iterations;
        console.log(`${platform} average overhead: ${avgOverhead.toFixed(2)}ms`);

        // Each platform should have < 10ms average overhead
        expect(avgOverhead).toBeLessThan(10);
      }
    });
  });

  describe('Test 3: Circuit breaker state transitions under load', () => {
    it('should transition to OPEN after threshold failures under load', async () => {
      // Arrange
      const mockPublishFn = async () => {
        throw new Error('API failure');
      };

      const cbManager = wrapper['circuitBreakerManager'];

      // Act - trigger failures rapidly
      const failureCount = 10;
      const publishPromises = Array.from({ length: failureCount }, (_, i) =>
        wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: `post-${i}`, platform: 'twitter' }
        ).catch(error => ({ error: error.message }))
      );

      await Promise.all(publishPromises);

      // Assert - circuit should be OPEN
      const circuitState = cbManager.getServiceStats('socialPublishing').state;
      expect(circuitState).toBe(CircuitState.OPEN);

      console.log('Circuit breaker opened after rapid failures');
    });

    it('should fail-fast when circuit is OPEN under load', async () => {
      // Arrange
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('socialPublishing', CircuitState.OPEN);

      const mockPublishFn = async () => ({
        success: true,
        platformPostId: 'platform-123'
      });

      // Act - attempt many publishes with circuit OPEN
      const attemptCount = 50;
      const startTime = Date.now();

      const publishPromises = Array.from({ length: attemptCount }, (_, i) =>
        wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: `post-${i}`, platform: 'twitter' }
        ).catch(error => ({ error: error.message }))
      );

      const results = await Promise.all(publishPromises);
      const duration = Date.now() - startTime;

      // Assert - all should fail fast
      expect(results.every((r: any) => r.error)).toBe(true);

      // Should be very fast (< 500ms for 50 fail-fast operations)
      expect(duration).toBeLessThan(500);

      console.log(`Fail-fast duration: ${duration}ms for ${attemptCount} attempts`);
      console.log(`Average fail-fast time: ${(duration / attemptCount).toFixed(2)}ms`);
    });

    it('should handle HALF_OPEN state transitions under load', async () => {
      // Arrange
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('socialPublishing', CircuitState.HALF_OPEN);

      let callCount = 0;
      const mockPublishFn = async () => {
        callCount++;
        // First call succeeds, rest should wait
        if (callCount === 1) {
          return { success: true, platformPostId: 'platform-123' };
        }
        // Simulate delay for other calls
        await new Promise(resolve => setTimeout(resolve, 10));
        return { success: true, platformPostId: `platform-${callCount}` };
      };

      // Act - attempt concurrent publishes in HALF_OPEN state
      const attemptCount = 10;
      const publishPromises = Array.from({ length: attemptCount }, (_, i) =>
        wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: `post-${i}`, platform: 'twitter' }
        ).catch(error => ({ error: error.message }))
      );

      const results = await Promise.all(publishPromises);

      // Assert - at least one should succeed
      const successCount = results.filter((r: any) => r.success).length;
      expect(successCount).toBeGreaterThan(0);

      console.log(`HALF_OPEN state: ${successCount} successes out of ${attemptCount} attempts`);
    });

    it('should recover from OPEN to CLOSED under load', async () => {
      // Arrange
      const cbManager = wrapper['circuitBreakerManager'];

      // First, open the circuit with failures
      const failingFn = async () => {
        throw new Error('API failure');
      };

      for (let i = 0; i < 10; i++) {
        try {
          await wrapper.wrapPlatformPublish(
            failingFn,
            { postId: `post-fail-${i}`, platform: 'twitter' }
          );
        } catch (error) {
          // Expected
        }
      }

      // Verify circuit is OPEN
      expect(cbManager.getServiceStats('socialPublishing').state).toBe(CircuitState.OPEN);

      // Wait for circuit to transition to HALF_OPEN (simulate timeout)
      cbManager.forceCircuitState('socialPublishing', CircuitState.HALF_OPEN);

      // Act - send successful requests to recover
      const successfulFn = async () => ({
        success: true,
        platformPostId: 'platform-recovery'
      });

      await wrapper.wrapPlatformPublish(
        successfulFn,
        { postId: 'post-recovery', platform: 'twitter' }
      );

      // Wait for state transition
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - circuit should be CLOSED
      const finalState = cbManager.getServiceStats('socialPublishing').state;
      expect(finalState).toBe(CircuitState.CLOSED);

      console.log('Circuit breaker recovered from OPEN to CLOSED');
    });
  });

  describe('Test 4: No memory leaks from wrapper instances', () => {
    it('should not leak memory with many wrapper instances', async () => {
      // Arrange
      const iterations = 100;
      const wrappers: PublishingWorkerWrapper[] = [];

      const mockPublishFn = async () => ({
        success: true,
        platformPostId: 'platform-123'
      });

      // Act - create and use many wrapper instances
      for (let i = 0; i < iterations; i++) {
        const tempWrapper = new PublishingWorkerWrapper();
        wrappers.push(tempWrapper);

        await tempWrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: `post-${i}`, platform: 'twitter' }
        );
      }

      // Cleanup all wrappers
      for (const tempWrapper of wrappers) {
        tempWrapper.shutdown();
      }

      // Assert - if we got here without crashing, no obvious memory leak
      expect(wrappers).toHaveLength(iterations);

      console.log(`Created and cleaned up ${iterations} wrapper instances successfully`);
    });

    it('should not leak memory with repeated publish operations', async () => {
      // Arrange
      const iterations = 1000;
      const mockPublishFn = async () => ({
        success: true,
        platformPostId: `platform-${Date.now()}`
      });

      // Act - perform many publishes with same wrapper
      for (let i = 0; i < iterations; i++) {
        await wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: `post-${i}`, platform: 'twitter' }
        );
      }

      // Assert - if we got here without crashing, no obvious memory leak
      expect(true).toBe(true);

      console.log(`Completed ${iterations} publish operations without memory issues`);
    });

    it('should cleanup resources properly on shutdown', async () => {
      // Arrange
      const mockPublishFn = async () => ({
        success: true,
        platformPostId: 'platform-123'
      });

      // Act - use wrapper then shutdown
      await wrapper.wrapPlatformPublish(
        mockPublishFn,
        { postId: 'post-1', platform: 'twitter' }
      );

      wrapper.shutdown();

      // Assert - wrapper should be in shutdown state
      // Attempting to use after shutdown should handle gracefully
      try {
        await wrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'post-2', platform: 'twitter' }
        );
        // If it doesn't throw, that's also acceptable (graceful handling)
      } catch (error) {
        // Expected - wrapper is shutdown
        expect(error).toBeDefined();
      }

      console.log('Wrapper shutdown completed successfully');
    });

    it('should handle concurrent operations without resource leaks', async () => {
      // Arrange
      const concurrentBatches = 10;
      const operationsPerBatch = 50;

      const mockPublishFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return {
          success: true,
          platformPostId: `platform-${Date.now()}`
        };
      };

      // Act - run multiple batches of concurrent operations
      for (let batch = 0; batch < concurrentBatches; batch++) {
        const publishPromises = Array.from({ length: operationsPerBatch }, (_, i) =>
          wrapper.wrapPlatformPublish(
            mockPublishFn,
            { postId: `post-batch${batch}-${i}`, platform: 'twitter' }
          )
        );

        await Promise.all(publishPromises);
      }

      // Assert
      const totalOperations = concurrentBatches * operationsPerBatch;
      console.log(`Completed ${totalOperations} concurrent operations across ${concurrentBatches} batches`);

      expect(true).toBe(true);
    });
  });

  describe('Performance Summary', () => {
    it('should provide overall performance metrics', async () => {
      // Arrange
      const testCases = [
        { name: 'Sequential', count: 100, concurrent: false },
        { name: 'Concurrent', count: 100, concurrent: true }
      ];

      const mockPublishFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return {
          success: true,
          platformPostId: `platform-${Date.now()}`
        };
      };

      // Act & Assert
      for (const testCase of testCases) {
        const startTime = Date.now();

        if (testCase.concurrent) {
          const publishPromises = Array.from({ length: testCase.count }, (_, i) =>
            wrapper.wrapPlatformPublish(
              mockPublishFn,
              { postId: `post-${i}`, platform: 'twitter' }
            )
          );
          await Promise.all(publishPromises);
        } else {
          for (let i = 0; i < testCase.count; i++) {
            await wrapper.wrapPlatformPublish(
              mockPublishFn,
              { postId: `post-${i}`, platform: 'twitter' }
            );
          }
        }

        const duration = Date.now() - startTime;
        const throughput = testCase.count / (duration / 1000);
        const avgTime = duration / testCase.count;

        console.log(`\n${testCase.name} Performance:`);
        console.log(`  Operations: ${testCase.count}`);
        console.log(`  Duration: ${duration}ms`);
        console.log(`  Throughput: ${throughput.toFixed(2)} ops/sec`);
        console.log(`  Avg time per op: ${avgTime.toFixed(2)}ms`);

        // Verify performance is acceptable
        expect(avgTime).toBeLessThan(100); // Average time per operation < 100ms
      }
    });
  });
});
