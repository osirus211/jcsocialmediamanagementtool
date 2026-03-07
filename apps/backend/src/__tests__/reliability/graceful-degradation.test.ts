/**
 * Graceful Degradation Integration Tests
 * 
 * Tests graceful degradation behavior for all services:
 * - Media upload fallback (text-only)
 * - AI caption fallback (original caption)
 * - Email failure (non-blocking)
 * - Analytics failure (silent)
 * - Circuit breaker integration
 * - Metrics tracking
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import CircuitBreakerManager from '../../../../../.kiro/execution/reliability/CircuitBreakerManager';
import GracefulDegradationManager from '../../../../../.kiro/execution/reliability/GracefulDegradationManager';
import PublishingWorkerWrapper from '../../../../../.kiro/execution/reliability/PublishingWorkerWrapper';
import { CircuitState } from '../../../../../.kiro/execution/reliability/CircuitBreakerState';

describe('Graceful Degradation - Media Upload', () => {
  let circuitBreakerManager: CircuitBreakerManager;
  let degradationManager: GracefulDegradationManager;

  beforeEach(() => {
    circuitBreakerManager = new CircuitBreakerManager();
    degradationManager = new GracefulDegradationManager(circuitBreakerManager);
  });

  afterEach(() => {
    circuitBreakerManager.shutdown();
  });

  it('should fallback to text-only when media upload fails', async () => {
    const result = await degradationManager.executeMediaUpload(
      async () => {
        throw new Error('Media upload service unavailable');
      },
      'test-media-upload'
    );

    expect(result.success).toBe(false);
    expect(result.degraded).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe('Media upload failed');
    
    const metrics = degradationManager.getMetrics();
    expect(metrics.media_fallback_count).toBe(1);
    expect(metrics.total_degraded_operations).toBe(1);
  });

  it('should fallback to text-only when circuit breaker is OPEN', async () => {
    // Force circuit breaker to OPEN state
    circuitBreakerManager.forceCircuitState('mediaUpload', CircuitState.OPEN);

    const result = await degradationManager.executeMediaUpload(
      async () => {
        return ['https://example.com/image.jpg'];
      },
      'test-media-upload-circuit-open'
    );

    expect(result.success).toBe(false);
    expect(result.degraded).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe('Circuit breaker OPEN');
    
    const metrics = degradationManager.getMetrics();
    expect(metrics.media_fallback_count).toBe(1);
    expect(metrics.circuit_open_fallback_count).toBe(1);
  });

  it('should succeed normally when media upload works', async () => {
    const result = await degradationManager.executeMediaUpload(
      async () => {
        return ['https://example.com/image.jpg'];
      },
      'test-media-upload-success'
    );

    expect(result.success).toBe(true);
    expect(result.degraded).toBe(false);
    expect(result.fallbackUsed).toBe(false);
    expect(result.result).toEqual(['https://example.com/image.jpg']);
  });
});

describe('Graceful Degradation - AI Caption', () => {
  let circuitBreakerManager: CircuitBreakerManager;
  let degradationManager: GracefulDegradationManager;

  beforeEach(() => {
    circuitBreakerManager = new CircuitBreakerManager();
    degradationManager = new GracefulDegradationManager(circuitBreakerManager);
  });

  afterEach(() => {
    circuitBreakerManager.shutdown();
  });

  it('should use original caption when AI caption fails', async () => {
    const originalCaption = 'Check out this amazing view!';
    
    const result = await degradationManager.executeAICaption(
      async () => {
        throw new Error('AI service unavailable');
      },
      originalCaption,
      'test-ai-caption'
    );

    expect(result.success).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.result).toBe(originalCaption);
    expect(result.fallbackReason).toBe('AI caption generation failed');
    
    const metrics = degradationManager.getMetrics();
    expect(metrics.ai_fallback_count).toBe(1);
    expect(metrics.total_degraded_operations).toBe(1);
  });

  it('should use original caption when circuit breaker is OPEN', async () => {
    const originalCaption = 'Beautiful sunset today!';
    
    // Force circuit breaker to OPEN state
    circuitBreakerManager.forceCircuitState('aiCaption', CircuitState.OPEN);

    const result = await degradationManager.executeAICaption(
      async () => {
        return 'AI-enhanced caption with hashtags #sunset #beautiful';
      },
      originalCaption,
      'test-ai-caption-circuit-open'
    );

    expect(result.success).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.result).toBe(originalCaption);
    expect(result.fallbackReason).toBe('Circuit breaker OPEN');
    
    const metrics = degradationManager.getMetrics();
    expect(metrics.ai_fallback_count).toBe(1);
    expect(metrics.circuit_open_fallback_count).toBe(1);
  });

  it('should use AI caption when service works', async () => {
    const originalCaption = 'Nice photo';
    const aiCaption = 'Stunning landscape photography capturing the golden hour #photography #nature';
    
    const result = await degradationManager.executeAICaption(
      async () => {
        return aiCaption;
      },
      originalCaption,
      'test-ai-caption-success'
    );

    expect(result.success).toBe(true);
    expect(result.degraded).toBe(false);
    expect(result.fallbackUsed).toBe(false);
    expect(result.result).toBe(aiCaption);
  });
});

describe('Graceful Degradation - Email Service', () => {
  let circuitBreakerManager: CircuitBreakerManager;
  let degradationManager: GracefulDegradationManager;

  beforeEach(() => {
    circuitBreakerManager = new CircuitBreakerManager();
    degradationManager = new GracefulDegradationManager(circuitBreakerManager);
  });

  afterEach(() => {
    circuitBreakerManager.shutdown();
  });

  it('should not block publish when email fails', async () => {
    const result = await degradationManager.executeEmail(
      async () => {
        throw new Error('Email service unavailable');
      },
      'test-email'
    );

    // Email failure should not block - returns success with degraded flag
    expect(result.success).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe('Email failed - non-blocking');
    
    const metrics = degradationManager.getMetrics();
    expect(metrics.email_failure_count).toBe(1);
    expect(metrics.total_degraded_operations).toBe(1);
  });

  it('should skip email when circuit breaker is OPEN', async () => {
    // Force circuit breaker to OPEN state
    circuitBreakerManager.forceCircuitState('email', CircuitState.OPEN);

    const result = await degradationManager.executeEmail(
      async () => {
        return { messageId: 'test-123', accepted: ['user@example.com'] };
      },
      'test-email-circuit-open'
    );

    expect(result.success).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe('Circuit breaker OPEN - email skipped');
    
    const metrics = degradationManager.getMetrics();
    expect(metrics.email_failure_count).toBe(1);
    expect(metrics.circuit_open_fallback_count).toBe(1);
  });

  it('should send email normally when service works', async () => {
    const emailResult = { messageId: 'test-123', accepted: ['user@example.com'] };
    
    const result = await degradationManager.executeEmail(
      async () => {
        return emailResult;
      },
      'test-email-success'
    );

    expect(result.success).toBe(true);
    expect(result.degraded).toBe(false);
    expect(result.fallbackUsed).toBe(false);
    expect(result.result).toEqual(emailResult);
  });
});

describe('Graceful Degradation - Analytics Service', () => {
  let circuitBreakerManager: CircuitBreakerManager;
  let degradationManager: GracefulDegradationManager;

  beforeEach(() => {
    circuitBreakerManager = new CircuitBreakerManager();
    degradationManager = new GracefulDegradationManager(circuitBreakerManager);
  });

  afterEach(() => {
    circuitBreakerManager.shutdown();
  });

  it('should silently fail when analytics fails', async () => {
    const result = await degradationManager.executeAnalytics(
      async () => {
        throw new Error('Analytics service unavailable');
      },
      'test-analytics'
    );

    // Analytics failure should be silent - returns success with degraded flag
    expect(result.success).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe('Analytics failed - silent');
    
    const metrics = degradationManager.getMetrics();
    expect(metrics.analytics_failure_count).toBe(1);
    expect(metrics.total_degraded_operations).toBe(1);
  });

  it('should skip analytics when circuit breaker is OPEN', async () => {
    // Force circuit breaker to OPEN state
    circuitBreakerManager.forceCircuitState('analytics', CircuitState.OPEN);

    const result = await degradationManager.executeAnalytics(
      async () => {
        return { recorded: true };
      },
      'test-analytics-circuit-open'
    );

    expect(result.success).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe('Circuit breaker OPEN - analytics skipped');
    
    const metrics = degradationManager.getMetrics();
    expect(metrics.analytics_failure_count).toBe(1);
    expect(metrics.circuit_open_fallback_count).toBe(1);
  });

  it('should record analytics normally when service works', async () => {
    const analyticsResult = { recorded: true, snapshotId: 'snapshot-123' };
    
    const result = await degradationManager.executeAnalytics(
      async () => {
        return analyticsResult;
      },
      'test-analytics-success'
    );

    expect(result.success).toBe(true);
    expect(result.degraded).toBe(false);
    expect(result.fallbackUsed).toBe(false);
    expect(result.result).toEqual(analyticsResult);
  });
});

describe('Graceful Degradation - Metrics Tracking', () => {
  let circuitBreakerManager: CircuitBreakerManager;
  let degradationManager: GracefulDegradationManager;

  beforeEach(() => {
    circuitBreakerManager = new CircuitBreakerManager();
    degradationManager = new GracefulDegradationManager(circuitBreakerManager);
  });

  afterEach(() => {
    circuitBreakerManager.shutdown();
  });

  it('should track degradation metrics correctly', async () => {
    // Simulate multiple failures
    await degradationManager.executeMediaUpload(
      async () => { throw new Error('Media failed'); },
      'test-1'
    );
    
    await degradationManager.executeAICaption(
      async () => { throw new Error('AI failed'); },
      'fallback caption',
      'test-2'
    );
    
    await degradationManager.executeEmail(
      async () => { throw new Error('Email failed'); },
      'test-3'
    );
    
    await degradationManager.executeAnalytics(
      async () => { throw new Error('Analytics failed'); },
      'test-4'
    );

    const metrics = degradationManager.getMetrics();
    
    expect(metrics.total_operations).toBe(4);
    expect(metrics.total_degraded_operations).toBe(4);
    expect(metrics.media_fallback_count).toBe(1);
    expect(metrics.ai_fallback_count).toBe(1);
    expect(metrics.email_failure_count).toBe(1);
    expect(metrics.analytics_failure_count).toBe(1);
    expect(metrics.degradation_rate).toBe(100); // 4/4 = 100%
  });

  it('should calculate degradation rate correctly', async () => {
    // 2 successes, 2 failures
    await degradationManager.executeMediaUpload(
      async () => ['url1'],
      'test-1'
    );
    
    await degradationManager.executeMediaUpload(
      async () => { throw new Error('Failed'); },
      'test-2'
    );
    
    await degradationManager.executeAICaption(
      async () => 'AI caption',
      'fallback',
      'test-3'
    );
    
    await degradationManager.executeAICaption(
      async () => { throw new Error('Failed'); },
      'fallback',
      'test-4'
    );

    const metrics = degradationManager.getMetrics();
    
    expect(metrics.total_operations).toBe(4);
    expect(metrics.total_degraded_operations).toBe(2);
    expect(metrics.degradation_rate).toBe(50); // 2/4 = 50%
  });

  it('should reset metrics correctly', async () => {
    // Generate some metrics
    await degradationManager.executeMediaUpload(
      async () => { throw new Error('Failed'); },
      'test-1'
    );
    
    let metrics = degradationManager.getMetrics();
    expect(metrics.total_operations).toBe(1);
    expect(metrics.media_fallback_count).toBe(1);
    
    // Reset metrics
    degradationManager.resetMetrics();
    
    metrics = degradationManager.getMetrics();
    expect(metrics.total_operations).toBe(0);
    expect(metrics.media_fallback_count).toBe(0);
    expect(metrics.total_degraded_operations).toBe(0);
    expect(metrics.degradation_rate).toBe(0);
  });
});

describe('Graceful Degradation - PublishingWorkerWrapper', () => {
  let wrapper: PublishingWorkerWrapper;

  beforeEach(() => {
    wrapper = new PublishingWorkerWrapper();
  });

  afterEach(() => {
    wrapper.shutdown();
  });

  it('should wrap media upload with graceful degradation', async () => {
    const context = {
      postId: 'post-123',
      workspaceId: 'workspace-123',
      socialAccountId: 'account-123',
      attemptNumber: 1
    };

    // Test with empty media files
    const result = await wrapper.wrapMediaUpload([], context);
    
    expect(result.success).toBe(true);
    expect(result.mediaUrls).toEqual([]);
    expect(result.degraded).toBe(false);
    expect(result.textOnly).toBe(false);
  });

  it('should wrap AI caption with graceful degradation', async () => {
    const context = {
      postId: 'post-123',
      workspaceId: 'workspace-123',
      socialAccountId: 'account-123',
      attemptNumber: 1
    };

    const originalCaption = 'Test caption';
    const result = await wrapper.wrapAICaption(originalCaption, context);
    
    expect(result.success).toBe(true);
    expect(result.caption).toBeDefined();
    expect(typeof result.caption).toBe('string');
  });

  it('should wrap email with graceful degradation', async () => {
    const context = {
      postId: 'post-123',
      workspaceId: 'workspace-123',
      socialAccountId: 'account-123',
      attemptNumber: 1
    };

    const emailData = {
      userEmail: 'user@example.com',
      userName: 'Test User',
      postTitle: 'Test Post',
      platforms: ['twitter', 'linkedin']
    };

    const result = await wrapper.wrapEmail('post_published', emailData, context);
    
    expect(result.success).toBe(true);
  });

  it('should wrap analytics with graceful degradation', async () => {
    const context = {
      postId: 'post-123',
      workspaceId: 'workspace-123',
      socialAccountId: 'account-123',
      attemptNumber: 1
    };

    const analyticsData = {
      platform: 'twitter',
      impressions: 100,
      engagement: 10
    };

    const result = await wrapper.wrapAnalytics(analyticsData, context);
    
    expect(result.success).toBe(true);
  });

  it('should provide metrics access', () => {
    const metrics = wrapper.getMetrics();
    
    expect(metrics).toBeDefined();
    expect(typeof metrics.degradation_rate).toBe('number');
    expect(typeof metrics.total_operations).toBe('number');
  });

  it('should provide circuit breaker stats access', () => {
    const stats = wrapper.getCircuitBreakerStats();
    
    expect(stats).toBeDefined();
    expect(stats.services).toBeDefined();
    expect(typeof stats.totalRequests).toBe('number');
  });
});

describe('Graceful Degradation - Safety Invariants', () => {
  let circuitBreakerManager: CircuitBreakerManager;
  let degradationManager: GracefulDegradationManager;

  beforeEach(() => {
    circuitBreakerManager = new CircuitBreakerManager();
    degradationManager = new GracefulDegradationManager(circuitBreakerManager);
  });

  afterEach(() => {
    circuitBreakerManager.shutdown();
  });

  it('should never throw on email failure (non-blocking)', async () => {
    const result = await degradationManager.executeEmail(
      async () => {
        throw new Error('Email service down');
      },
      'test-email-safety'
    );

    // Should not throw - returns success with degraded flag
    expect(result.success).toBe(true);
    expect(result.degraded).toBe(true);
  });

  it('should never throw on analytics failure (silent)', async () => {
    const result = await degradationManager.executeAnalytics(
      async () => {
        throw new Error('Analytics service down');
      },
      'test-analytics-safety'
    );

    // Should not throw - returns success with degraded flag
    expect(result.success).toBe(true);
    expect(result.degraded).toBe(true);
  });

  it('should always return deterministic fallback for AI caption', async () => {
    const originalCaption = 'Deterministic fallback caption';
    
    const result1 = await degradationManager.executeAICaption(
      async () => { throw new Error('AI failed'); },
      originalCaption,
      'test-1'
    );
    
    const result2 = await degradationManager.executeAICaption(
      async () => { throw new Error('AI failed'); },
      originalCaption,
      'test-2'
    );

    // Both should return the same deterministic fallback
    expect(result1.result).toBe(originalCaption);
    expect(result2.result).toBe(originalCaption);
    expect(result1.result).toBe(result2.result);
  });

  it('should preserve operation order and atomicity', async () => {
    const operations: string[] = [];
    
    // Execute multiple operations
    await degradationManager.executeMediaUpload(
      async () => {
        operations.push('media-1');
        return ['url1'];
      },
      'test-1'
    );
    
    await degradationManager.executeAICaption(
      async () => {
        operations.push('ai-1');
        return 'caption';
      },
      'fallback',
      'test-2'
    );
    
    await degradationManager.executeEmail(
      async () => {
        operations.push('email-1');
        return { messageId: 'msg-1' };
      },
      'test-3'
    );

    // Operations should execute in order
    expect(operations).toEqual(['media-1', 'ai-1', 'email-1']);
  });
});
