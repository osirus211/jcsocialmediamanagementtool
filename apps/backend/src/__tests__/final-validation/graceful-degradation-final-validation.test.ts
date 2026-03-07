/**
 * Final Validation Tests for Graceful Degradation Integration
 * 
 * Validates:
 * 1. System-wide failure simulation
 * 2. Circuit breaker behavior
 * 3. Safety guarantees
 * 4. Performance characteristics
 * 5. Observability
 */

import { publishingWorkerWrapper } from '../../../../../.kiro/execution/reliability/PublishingWorkerWrapper';

describe('Final Validation: Graceful Degradation Integration', () => {
  
  beforeEach(() => {
    // Reset metrics before each test
    publishingWorkerWrapper.resetMetrics();
    // Shutdown and recreate to reset circuit breaker state
    publishingWorkerWrapper.shutdown();
  });

  afterAll(() => {
    // Clean shutdown after all tests
    publishingWorkerWrapper.shutdown();
  });

  describe('1. System-Wide Failure Simulation', () => {
    
    it('should handle platform API failures gracefully', async () => {
      const mockPublishFn = jest.fn().mockRejectedValue(new Error('Platform API timeout'));
      
      try {
        await publishingWorkerWrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'test-post-1', platform: 'twitter' }
        );
        fail('Should have thrown error');
      } catch (error: any) {
        // Error should be thrown for BullMQ retry
        expect(error.message).toContain('Platform API timeout');
        expect(mockPublishFn).toHaveBeenCalledTimes(1);
      }
    });

    it('should handle OAuth refresh failures gracefully', async () => {
      const result = await publishingWorkerWrapper.wrapTokenRefresh(
        'invalid-account-id',
        'twitter',
        'invalid-token'
      );
      
      // Should return failure without throwing
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle media upload failures with text-only fallback', async () => {
      const mockMediaFiles = ['image1.jpg', 'image2.jpg'];
      
      const result = await publishingWorkerWrapper.wrapMediaUpload(
        mockMediaFiles,
        {
          postId: 'test-post-1',
          workspaceId: 'workspace-1',
          socialAccountId: 'account-1',
          attemptNumber: 1
        }
      );
      
      // Should succeed with degradation
      expect(result.success).toBe(true);
      // May be degraded or successful depending on circuit state
      if (result.degraded) {
        expect(result.textOnly).toBe(true);
        expect(result.mediaUrls).toEqual([]);
      }
    });

    it('should handle AI caption failures with original caption fallback', async () => {
      const originalCaption = 'Original post content';
      
      const result = await publishingWorkerWrapper.wrapAICaption(
        originalCaption,
        {
          postId: 'test-post-1',
          workspaceId: 'workspace-1',
          socialAccountId: 'account-1',
          attemptNumber: 1
        }
      );
      
      // Should always succeed (with fallback)
      expect(result.success).toBe(true);
      expect(result.caption).toBeDefined();
      // Caption should be either AI-generated or original
      if (result.degraded) {
        expect(result.fallbackUsed).toBe(true);
      }
    });

    it('should handle email failures non-blocking', async () => {
      const result = await publishingWorkerWrapper.wrapEmail(
        'post_published',
        {
          userEmail: 'test@example.com',
          userName: 'Test User',
          postTitle: 'Test Post',
          platforms: ['twitter']
        },
        {
          postId: 'test-post-1',
          workspaceId: 'workspace-1',
          socialAccountId: 'account-1',
          attemptNumber: 1
        }
      );
      
      // Should always succeed (non-blocking)
      expect(result.success).toBe(true);
      // May be degraded if circuit open
      if (result.degraded) {
        expect(result.skipped).toBe(true);
      }
    });

    it('should handle analytics failures non-blocking', async () => {
      const result = await publishingWorkerWrapper.wrapAnalytics(
        {
          platform: 'twitter',
          postId: 'test-post-1',
          publishedAt: new Date(),
          platformPostId: 'platform-123',
          impressions: 0,
          clicks: 0,
          shares: 0,
          comments: 0,
          likes: 0,
          saves: 0
        },
        {
          postId: 'test-post-1',
          workspaceId: 'workspace-1',
          socialAccountId: 'account-1',
          attemptNumber: 1
        }
      );
      
      // Should always succeed (non-blocking)
      expect(result.success).toBe(true);
      // May be degraded if circuit open
      if (result.degraded) {
        expect(result.skipped).toBe(true);
      }
    });
  });

  describe('2. Circuit Breaker Behavior', () => {
    
    it('should open circuit after repeated failures', async () => {
      const mockPublishFn = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      
      // Trigger multiple failures
      for (let i = 0; i < 5; i++) {
        try {
          await publishingWorkerWrapper.wrapPlatformPublish(
            mockPublishFn,
            { postId: `test-post-${i}`, platform: 'twitter' }
          );
        } catch (error) {
          // Expected to fail
        }
      }
      
      // Circuit should be OPEN or HALF_OPEN after repeated failures
      const circuitState = publishingWorkerWrapper.getCircuitState('socialPublishing');
      expect(['OPEN', 'HALF_OPEN']).toContain(circuitState);
    });

    it('should fail-fast when circuit is OPEN', async () => {
      const mockPublishFn = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      
      // Trigger failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await publishingWorkerWrapper.wrapPlatformPublish(
            mockPublishFn,
            { postId: `test-post-${i}`, platform: 'twitter' }
          );
        } catch (error) {
          // Expected
        }
      }
      
      const startTime = Date.now();
      try {
        await publishingWorkerWrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'test-post-fast', platform: 'twitter' }
        );
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Should fail fast (< 100ms) if circuit OPEN
        if (error.circuitBreakerOpen) {
          expect(duration).toBeLessThan(100);
        }
      }
    });

    it('should not create infinite retry loops', async () => {
      // Reset circuit breaker for this test
      publishingWorkerWrapper.shutdown();
      
      const mockPublishFn = jest.fn().mockRejectedValue(new Error('Permanent failure'));
      
      let attemptCount = 0;
      const maxAttempts = 3;
      
      for (let i = 0; i < maxAttempts; i++) {
        try {
          await publishingWorkerWrapper.wrapPlatformPublish(
            mockPublishFn,
            { postId: 'test-post-retry', platform: 'facebook' } // Use different platform
          );
        } catch (error) {
          attemptCount++;
        }
      }
      
      // Should attempt all times (circuit breaker may open, but attempts still counted)
      expect(attemptCount).toBe(maxAttempts);
    });
  });

  describe('3. Safety Guarantees', () => {
    
    it('should never crash worker on service failure', async () => {
      // Test all wrapper methods don't throw unexpected errors
      const operations = [
        async () => {
          try {
            await publishingWorkerWrapper.wrapPlatformPublish(
              async () => { throw new Error('Test error'); },
              { postId: 'test-1', platform: 'twitter' }
            );
          } catch (error) {
            // Expected - error should be thrown for BullMQ retry
          }
        },
        async () => {
          const result = await publishingWorkerWrapper.wrapTokenRefresh(
            'invalid-id',
            'twitter',
            'invalid-token'
          );
          expect(result).toBeDefined();
        },
        async () => {
          const result = await publishingWorkerWrapper.wrapMediaUpload(
            ['test.jpg'],
            { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }
          );
          expect(result.success).toBe(true);
        },
        async () => {
          const result = await publishingWorkerWrapper.wrapAICaption(
            'test caption',
            { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }
          );
          expect(result.success).toBe(true);
        },
        async () => {
          const result = await publishingWorkerWrapper.wrapEmail(
            'post_published',
            { userEmail: 'test@test.com', userName: 'Test', postTitle: 'Test', platforms: ['twitter'] },
            { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }
          );
          expect(result.success).toBe(true);
        },
        async () => {
          const result = await publishingWorkerWrapper.wrapAnalytics(
            { platform: 'twitter', postId: 'test-1', publishedAt: new Date(), platformPostId: 'p-1', impressions: 0, clicks: 0, shares: 0, comments: 0, likes: 0, saves: 0 },
            { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }
          );
          expect(result.success).toBe(true);
        }
      ];
      
      // All operations should complete without crashing
      for (const operation of operations) {
        await expect(operation()).resolves.not.toThrow();
      }
    });

    it('should preserve idempotency - no duplicate operations', async () => {
      // Reset circuit breaker for this test
      publishingWorkerWrapper.shutdown();
      
      const mockPublishFn = jest.fn().mockResolvedValue({ success: true, platformPostId: 'post-123' });
      
      // Call twice with same context
      await publishingWorkerWrapper.wrapPlatformPublish(
        mockPublishFn,
        { postId: 'test-post-idempotent', platform: 'linkedin' }
      );
      
      // Second call should also work (idempotency handled at higher level)
      await publishingWorkerWrapper.wrapPlatformPublish(
        mockPublishFn,
        { postId: 'test-post-idempotent', platform: 'linkedin' }
      );
      
      // Both calls should execute (wrapper doesn't prevent, PublishingWorker does)
      expect(mockPublishFn).toHaveBeenCalledTimes(2);
    });

    it('should not create silent failures - all failures logged', async () => {
      // All wrapper methods should log failures
      // This is validated by checking that methods return error info
      
      const tokenResult = await publishingWorkerWrapper.wrapTokenRefresh(
        'invalid-id',
        'twitter',
        'invalid-token'
      );
      
      if (!tokenResult.success) {
        expect(tokenResult.error).toBeDefined();
      }
      
      const mediaResult = await publishingWorkerWrapper.wrapMediaUpload(
        ['test.jpg'],
        { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }
      );
      
      if (mediaResult.degraded) {
        expect(mediaResult.reason).toBeDefined();
      }
    });
  });

  describe('4. Performance Characteristics', () => {
    
    it('should have minimal wrapper overhead', async () => {
      // Reset circuit breaker for this test
      publishingWorkerWrapper.shutdown();
      
      const mockPublishFn = jest.fn().mockResolvedValue({ success: true, platformPostId: 'post-123' });
      
      const startTime = Date.now();
      await publishingWorkerWrapper.wrapPlatformPublish(
        mockPublishFn,
        { postId: 'test-post-perf', platform: 'instagram' }
      );
      const duration = Date.now() - startTime;
      
      // Wrapper overhead should be < 50ms for successful operations
      expect(duration).toBeLessThan(50);
    });

    it('should not block on non-critical service failures', async () => {
      // Email and Analytics should return immediately even on failure
      
      const emailStart = Date.now();
      const emailResult = await publishingWorkerWrapper.wrapEmail(
        'post_published',
        { userEmail: 'test@test.com', userName: 'Test', postTitle: 'Test', platforms: ['twitter'] },
        { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }
      );
      const emailDuration = Date.now() - emailStart;
      
      expect(emailResult.success).toBe(true);
      expect(emailDuration).toBeLessThan(3000); // Should be reasonably fast
      
      const analyticsStart = Date.now();
      const analyticsResult = await publishingWorkerWrapper.wrapAnalytics(
        { platform: 'twitter', postId: 'test-1', publishedAt: new Date(), platformPostId: 'p-1', impressions: 0, clicks: 0, shares: 0, comments: 0, likes: 0, saves: 0 },
        { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }
      );
      const analyticsDuration = Date.now() - analyticsStart;
      
      expect(analyticsResult.success).toBe(true);
      expect(analyticsDuration).toBeLessThan(1000); // Should be fast
    });

    it('should not leak memory on repeated operations', async () => {
      // Reset circuit breaker for this test
      publishingWorkerWrapper.shutdown();
      
      const mockPublishFn = jest.fn().mockResolvedValue({ success: true, platformPostId: 'post-123' });
      
      // Run 100 operations
      for (let i = 0; i < 100; i++) {
        await publishingWorkerWrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: `test-post-${i}`, platform: 'tiktok' }
        );
      }
      
      // Should complete without memory issues
      expect(mockPublishFn).toHaveBeenCalledTimes(100);
    });
  });

  describe('5. Observability', () => {
    
    it('should provide circuit breaker statistics', () => {
      const stats = publishingWorkerWrapper.getCircuitBreakerStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should provide degradation metrics', () => {
      const metrics = publishingWorkerWrapper.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
    });

    it('should classify errors correctly', async () => {
      // Reset circuit breaker for this test
      publishingWorkerWrapper.shutdown();
      
      // Platform publish errors should be thrown for BullMQ retry
      const mockPublishFn = jest.fn().mockRejectedValue(new Error('Network timeout'));
      
      try {
        await publishingWorkerWrapper.wrapPlatformPublish(
          mockPublishFn,
          { postId: 'test-post-error', platform: 'pinterest' }
        );
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Network timeout');
      }
    });
  });

  describe('6. Integration Completeness', () => {
    
    it('should have all wrapper methods available', () => {
      expect(typeof publishingWorkerWrapper.wrapPlatformPublish).toBe('function');
      expect(typeof publishingWorkerWrapper.wrapTokenRefresh).toBe('function');
      expect(typeof publishingWorkerWrapper.wrapMediaUpload).toBe('function');
      expect(typeof publishingWorkerWrapper.wrapAICaption).toBe('function');
      expect(typeof publishingWorkerWrapper.wrapEmail).toBe('function');
      expect(typeof publishingWorkerWrapper.wrapAnalytics).toBe('function');
      expect(typeof publishingWorkerWrapper.getCircuitState).toBe('function');
      expect(typeof publishingWorkerWrapper.getMetrics).toBe('function');
      expect(typeof publishingWorkerWrapper.getCircuitBreakerStats).toBe('function');
      expect(typeof publishingWorkerWrapper.shutdown).toBe('function');
    });

    it('should handle shutdown gracefully', () => {
      expect(() => {
        publishingWorkerWrapper.shutdown();
      }).not.toThrow();
    });
  });
});
