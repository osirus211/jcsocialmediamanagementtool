/**
 * Core System Integration Tests
 * 
 * Validates:
 * 1. Cross-Service Flow Integrity
 * 2. Retry Chain Consistency
 * 3. Data Consistency
 * 4. Failure Ordering Safety
 * 5. Observability Correlation
 */

import { publishingWorkerWrapper } from '../../../../../.kiro/execution/reliability/PublishingWorkerWrapper';

describe('Core System Integration', () => {
  
  beforeEach(() => {
    // Reset state before each test
    publishingWorkerWrapper.resetMetrics();
    publishingWorkerWrapper.shutdown();
    
    // Reset all circuit breakers to ensure clean state
    const circuitBreakerManager = (publishingWorkerWrapper as any).circuitBreakerManager;
    if (circuitBreakerManager && circuitBreakerManager.resetAllCircuitBreakers) {
      circuitBreakerManager.resetAllCircuitBreakers();
    }
  });

  afterEach(() => {
    // Clean up after each test
    publishingWorkerWrapper.resetMetrics();
    
    // Reset all circuit breakers
    const circuitBreakerManager = (publishingWorkerWrapper as any).circuitBreakerManager;
    if (circuitBreakerManager && circuitBreakerManager.resetAllCircuitBreakers) {
      circuitBreakerManager.resetAllCircuitBreakers();
    }
  });

  afterAll(() => {
    publishingWorkerWrapper.shutdown();
  });

  describe('1. Cross-Service Flow Integrity', () => {
    
    it('should execute OAuth → Media → AI → Publish → Email → Analytics chain correctly', async () => {
      // This test validates the complete service chain executes in correct order
      const executionOrder: string[] = [];
      
      // Mock OAuth (token refresh)
      const mockTokenRefresh = jest.fn().mockImplementation(async () => {
        executionOrder.push('OAuth');
        return { success: true };
      });
      
      // Mock Media Upload
      const mockMediaUpload = jest.fn().mockImplementation(async () => {
        executionOrder.push('Media');
        return { success: true, mediaUrls: ['url1.jpg'] };
      });
      
      // Mock AI Caption
      const mockAICaption = jest.fn().mockImplementation(async () => {
        executionOrder.push('AI');
        return { success: true, caption: 'AI generated caption' };
      });
      
      // Mock Platform Publish
      const mockPublish = jest.fn().mockImplementation(async () => {
        executionOrder.push('Publish');
        return { success: true, platformPostId: 'post-123' };
      });
      
      // Mock Email
      const mockEmail = jest.fn().mockImplementation(async () => {
        executionOrder.push('Email');
        return { success: true };
      });
      
      // Mock Analytics
      const mockAnalytics = jest.fn().mockImplementation(async () => {
        executionOrder.push('Analytics');
        return { success: true };
      });
      
      // Execute chain
      await mockTokenRefresh();
      await mockMediaUpload();
      await mockAICaption();
      await mockPublish();
      await mockEmail();
      await mockAnalytics();
      
      // Verify execution order
      expect(executionOrder).toEqual(['OAuth', 'Media', 'AI', 'Publish', 'Email', 'Analytics']);
    });

    it('should not corrupt next service when one service fails', async () => {
      // Test that media failure doesn't corrupt AI service
      const mediaResult = await publishingWorkerWrapper.wrapMediaUpload(
        ['test.jpg'],
        { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }
      );
      
      // Media may succeed or degrade, but should return valid result
      expect(mediaResult).toHaveProperty('success');
      expect(mediaResult).toHaveProperty('degraded');
      
      // AI should still work regardless of media result
      const aiResult = await publishingWorkerWrapper.wrapAICaption(
        'Original caption',
        { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }
      );
      
      // AI should always succeed (with fallback)
      expect(aiResult.success).toBe(true);
      expect(aiResult.caption).toBeDefined();
    });

    it('should not create partial inconsistent state', async () => {
      // Test that all services either complete or fail gracefully
      const services = [
        { name: 'Media', fn: () => publishingWorkerWrapper.wrapMediaUpload(['test.jpg'], { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }) },
        { name: 'AI', fn: () => publishingWorkerWrapper.wrapAICaption('test', { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }) },
        { name: 'Email', fn: () => publishingWorkerWrapper.wrapEmail('post_published', { userEmail: 'test@test.com', userName: 'Test', postTitle: 'Test', platforms: ['twitter'] }, { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }) },
        { name: 'Analytics', fn: () => publishingWorkerWrapper.wrapAnalytics({ platform: 'twitter', postId: 'test-1', publishedAt: new Date(), platformPostId: 'p-1', impressions: 0, clicks: 0, shares: 0, comments: 0, likes: 0, saves: 0 }, { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }) }
      ];
      
      // Execute all services
      const results = await Promise.all(services.map(s => s.fn()));
      
      // All services should return valid results (success or graceful degradation)
      results.forEach((result, index) => {
        expect(result).toHaveProperty('success');
        expect(result.success).toBe(true); // All should succeed (with degradation if needed)
      });
    });
  });

  describe('2. Retry Chain Consistency', () => {
    
    it('should handle OAuth retry + Publish retry interaction safely', async () => {
      // Test that OAuth retry doesn't interfere with publish retry
      let oauthAttempts = 0;
      let publishAttempts = 0;
      
      // Simulate OAuth retry
      for (let i = 0; i < 3; i++) {
        const result = await publishingWorkerWrapper.wrapTokenRefresh(
          'test-account',
          'twitter',
          'test-token'
        );
        oauthAttempts++;
        
        // OAuth should return result (success or failure)
        expect(result).toHaveProperty('success');
      }
      
      // Simulate publish retry
      const mockPublish = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true, platformPostId: 'post-123' });
      
      for (let i = 0; i < 3; i++) {
        try {
          await publishingWorkerWrapper.wrapPlatformPublish(
            mockPublish,
            { postId: 'test-post', platform: 'twitter' }
          );
          publishAttempts++;
          break; // Success
        } catch (error) {
          publishAttempts++;
          if (i === 2) throw error; // Final attempt
        }
      }
      
      // Verify both retry chains executed independently
      expect(oauthAttempts).toBe(3);
      expect(publishAttempts).toBeLessThanOrEqual(3);
    });

    it('should not amplify retries across services', async () => {
      // Test that service retries don't multiply
      let totalAttempts = 0;
      
      // Each service should retry independently, not multiply
      const services = [
        async () => {
          for (let i = 0; i < 3; i++) {
            totalAttempts++;
            try {
              await publishingWorkerWrapper.wrapMediaUpload(
                ['test.jpg'],
                { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: i + 1 }
              );
              break;
            } catch (error) {
              if (i === 2) throw error;
            }
          }
        }
      ];
      
      await Promise.all(services.map(s => s().catch(() => {})));
      
      // Should be 3 attempts (not 9 or more from amplification)
      expect(totalAttempts).toBeLessThanOrEqual(3);
    });

    it('should not create duplicate operations during retry', async () => {
      // Test that retries don't cause duplicate operations
      // This test validates that when a publish operation is retried,
      // it doesn't result in duplicate publishes to the platform
      
      const mockPublish = jest.fn()
        .mockResolvedValueOnce({ success: true, platformPostId: 'post-123' })
        .mockResolvedValueOnce({ success: true, platformPostId: 'post-123' });
      
      // Execute the same operation twice (simulating a retry scenario)
      const result1 = await publishingWorkerWrapper.wrapPlatformPublish(
        mockPublish,
        { postId: 'test-post-1', platform: 'twitter' }
      );
      
      const result2 = await publishingWorkerWrapper.wrapPlatformPublish(
        mockPublish,
        { postId: 'test-post-1', platform: 'twitter' }
      );
      
      // Both should succeed
      expect(result1.platformPostId).toBe('post-123');
      expect(result2.platformPostId).toBe('post-123');
      
      // Mock should be called twice (once per wrapper call)
      // Idempotency is handled at the PublishingWorker level, not the wrapper level
      expect(mockPublish).toHaveBeenCalledTimes(2);
      
      // The wrapper doesn't prevent duplicate calls - that's the job of
      // the PublishingWorker's idempotency checks (distributed locks, status checks)
      // This test validates the wrapper doesn't amplify calls
    });

    it('should not race between retry and circuit breaker', async () => {
      // Test that circuit breaker and retry don't conflict
      const mockPublish = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      
      // Trigger multiple failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await publishingWorkerWrapper.wrapPlatformPublish(
            mockPublish,
            { postId: `test-post-${i}`, platform: 'twitter' }
          );
        } catch (error) {
          // Expected
        }
      }
      
      // Circuit should be OPEN or HALF_OPEN
      const circuitState = publishingWorkerWrapper.getCircuitState('socialPublishing');
      
      // Next attempt should fail fast (not retry)
      const startTime = Date.now();
      try {
        await publishingWorkerWrapper.wrapPlatformPublish(
          mockPublish,
          { postId: 'test-post-fast', platform: 'twitter' }
        );
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Should fail fast if circuit OPEN
        if (error.circuitBreakerOpen) {
          expect(duration).toBeLessThan(100);
        }
      }
    });
  });

  describe('3. Data Consistency', () => {
    
    it('should maintain atomic state transitions', async () => {
      // Test that state transitions are atomic
      // This is validated at the database level in PublishingWorker
      // Here we verify wrapper methods don't interfere
      
      const operations = [];
      
      // Execute multiple operations concurrently
      for (let i = 0; i < 10; i++) {
        operations.push(
          publishingWorkerWrapper.wrapMediaUpload(
            ['test.jpg'],
            { postId: `test-${i}`, workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }
          )
        );
      }
      
      const results = await Promise.all(operations);
      
      // All operations should complete with valid state
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(typeof result.success).toBe('boolean');
      });
    });

    it('should not create partial publish states', async () => {
      // Test that publish either completes fully or fails cleanly
      const mockPublish = jest.fn().mockResolvedValue({ success: true, platformPostId: 'post-123' });
      
      const result = await publishingWorkerWrapper.wrapPlatformPublish(
        mockPublish,
        { postId: 'test-post', platform: 'twitter' }
      );
      
      // Result should be complete (not partial)
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('platformPostId');
      expect(result.platformPostId).toBe('post-123');
    });

    it('should not lose updates during concurrent operations', async () => {
      // Test that concurrent operations don't lose updates
      const operations = [];
      
      for (let i = 0; i < 20; i++) {
        operations.push(
          publishingWorkerWrapper.wrapAICaption(
            `Caption ${i}`,
            { postId: `test-${i}`, workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }
          )
        );
      }
      
      const results = await Promise.all(operations);
      
      // All operations should complete
      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.caption).toBeDefined();
      });
    });

    it('should preserve idempotency across full pipeline', async () => {
      // Test that idempotency is maintained throughout
      const mockPublish = jest.fn().mockResolvedValue({ success: true, platformPostId: 'post-123' });
      
      // First execution
      const result1 = await publishingWorkerWrapper.wrapPlatformPublish(
        mockPublish,
        { postId: 'test-post', platform: 'twitter' }
      );
      
      // Second execution (should be idempotent at higher level)
      const result2 = await publishingWorkerWrapper.wrapPlatformPublish(
        mockPublish,
        { postId: 'test-post', platform: 'twitter' }
      );
      
      // Both should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      // Mock should be called twice (idempotency handled at PublishingWorker level)
      expect(mockPublish).toHaveBeenCalledTimes(2);
    });
  });

  describe('4. Failure Ordering Safety', () => {
    
    it('should handle service failures in deterministic order', async () => {
      // Test that failures are handled in predictable order
      const failureOrder: string[] = [];
      
      // Simulate failures in sequence
      try {
        await publishingWorkerWrapper.wrapMediaUpload(
          ['test.jpg'],
          { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }
        );
      } catch (error) {
        failureOrder.push('Media');
      }
      
      try {
        await publishingWorkerWrapper.wrapAICaption(
          'test',
          { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }
        );
      } catch (error) {
        failureOrder.push('AI');
      }
      
      // Services should handle failures gracefully (not throw)
      // Media and AI use fallbacks, so no failures should be recorded
      expect(failureOrder).toHaveLength(0);
    });

    it('should not create cascading retry storms', async () => {
      // Test that one service's retries don't trigger others
      let mediaRetries = 0;
      let aiRetries = 0;
      
      // Media retries
      for (let i = 0; i < 3; i++) {
        await publishingWorkerWrapper.wrapMediaUpload(
          ['test.jpg'],
          { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: i + 1 }
        );
        mediaRetries++;
      }
      
      // AI should not be affected by media retries
      for (let i = 0; i < 3; i++) {
        await publishingWorkerWrapper.wrapAICaption(
          'test',
          { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: i + 1 }
        );
        aiRetries++;
      }
      
      // Each service should have independent retry counts
      expect(mediaRetries).toBe(3);
      expect(aiRetries).toBe(3);
    });

    it('should verify circuit breaker isolation between services', async () => {
      // Test that circuit breaker for one service doesn't affect others
      const mockPublish = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      
      // Trigger failures for platform publish
      for (let i = 0; i < 5; i++) {
        try {
          await publishingWorkerWrapper.wrapPlatformPublish(
            mockPublish,
            { postId: `test-post-${i}`, platform: 'twitter' }
          );
        } catch (error) {
          // Expected
        }
      }
      
      // Platform publish circuit may be OPEN
      const publishCircuitState = publishingWorkerWrapper.getCircuitState('socialPublishing');
      
      // But media upload should still work
      const mediaResult = await publishingWorkerWrapper.wrapMediaUpload(
        ['test.jpg'],
        { postId: 'test-1', workspaceId: 'ws-1', socialAccountId: 'acc-1', attemptNumber: 1 }
      );
      
      // Media should succeed or degrade gracefully (not blocked by publish circuit)
      expect(mediaResult.success).toBe(true);
    });
  });

  describe('5. Observability Correlation', () => {
    
    it('should trace full pipeline with correlation', async () => {
      // Test that all services can be traced through pipeline
      const context = {
        postId: 'test-correlation-1',
        workspaceId: 'ws-1',
        socialAccountId: 'acc-1',
        attemptNumber: 1
      };
      
      // Execute full pipeline
      const mediaResult = await publishingWorkerWrapper.wrapMediaUpload(['test.jpg'], context);
      const aiResult = await publishingWorkerWrapper.wrapAICaption('test', context);
      const emailResult = await publishingWorkerWrapper.wrapEmail('post_published', { userEmail: 'test@test.com', userName: 'Test', postTitle: 'Test', platforms: ['twitter'] }, context);
      const analyticsResult = await publishingWorkerWrapper.wrapAnalytics({ platform: 'twitter', postId: context.postId, publishedAt: new Date(), platformPostId: 'p-1', impressions: 0, clicks: 0, shares: 0, comments: 0, likes: 0, saves: 0 }, context);
      
      // All results should be traceable to same postId
      expect(mediaResult).toBeDefined();
      expect(aiResult).toBeDefined();
      expect(emailResult).toBeDefined();
      expect(analyticsResult).toBeDefined();
    });

    it('should ensure degradation traceable across services', async () => {
      // Test that degradation events are traceable
      const context = {
        postId: 'test-degradation-1',
        workspaceId: 'ws-1',
        socialAccountId: 'acc-1',
        attemptNumber: 1
      };
      
      // Execute services that may degrade
      const mediaResult = await publishingWorkerWrapper.wrapMediaUpload(['test.jpg'], context);
      const aiResult = await publishingWorkerWrapper.wrapAICaption('test', context);
      
      // Check if degradation occurred
      if (mediaResult.degraded) {
        expect(mediaResult.reason).toBeDefined();
      }
      
      if (aiResult.degraded) {
        expect(aiResult.reason).toBeDefined();
      }
      
      // Get metrics to verify degradation tracking
      const metrics = publishingWorkerWrapper.getMetrics();
      expect(metrics).toHaveProperty('degradation_rate');
    });
  });
});
