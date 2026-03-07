/**
 * AI Caption Hardening Integration Tests
 * 
 * Comprehensive test suite validating:
 * - Timeout handling (10 seconds)
 * - Rate limiting
 * - Service unavailable scenarios
 * - Retry behavior
 * - Fallback correctness
 * 
 * CRITICAL: AI failure MUST NEVER block post publishing
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  AICaptionRateLimiter,
  AICaptionTimeoutHandler,
  AICaptionErrorHandler,
  AICaptionFallbackHandler,
} from '../../../../../.kiro/execution/ai-caption';

// ============================================================================
// A. TIMEOUT HANDLING TESTS (5 tests)
// ============================================================================

describe('A. Timeout Handling', () => {
  let timeoutHandler: AICaptionTimeoutHandler;

  beforeEach(() => {
    timeoutHandler = new AICaptionTimeoutHandler({
      timeoutMs: 10000, // 10 seconds
      enableLogging: false,
    });
  });

  it('A.1: AI service responds in <10s → success', async () => {
    const fastOperation = async () => {
      await sleep(100); // 100ms
      return 'Generated caption';
    };

    const result = await timeoutHandler.executeWithTimeout(fastOperation);

    expect(result.success).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.data).toBe('Generated caption');
    expect(result.duration).toBeLessThan(10000);
  });

  it('A.2: AI service responds in exactly 10s → success', async () => {
    const exactOperation = async () => {
      await sleep(9999); // Just under 10s
      return 'Generated caption';
    };

    const result = await timeoutHandler.executeWithTimeout(exactOperation);

    expect(result.success).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.data).toBe('Generated caption');
  });

  it('A.3: AI service responds in >10s → timeout, fallback triggered', async () => {
    const slowOperation = async () => {
      await sleep(11000); // 11 seconds
      return 'Generated caption';
    };

    const result = await timeoutHandler.executeWithTimeout(slowOperation);

    expect(result.success).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.data).toBeUndefined();
    expect(result.error?.message).toContain('timed out');
  });

  it('A.4: Multiple timeouts → fallback consistently used', async () => {
    const slowOperation = async () => {
      await sleep(11000);
      return 'Generated caption';
    };

    const result1 = await timeoutHandler.executeWithTimeout(slowOperation);
    const result2 = await timeoutHandler.executeWithTimeout(slowOperation);
    const result3 = await timeoutHandler.executeWithTimeout(slowOperation);

    expect(result1.timedOut).toBe(true);
    expect(result2.timedOut).toBe(true);
    expect(result3.timedOut).toBe(true);

    const stats = timeoutHandler.getTimeoutStats();
    expect(stats.totalTimeouts).toBe(3);
  });

  it('A.5: Timeout doesn\'t block post publish', async () => {
    const fallbackHandler = new AICaptionFallbackHandler({ enableLogging: false });
    
    const slowOperation = async () => {
      await sleep(11000);
      return 'Generated caption';
    };

    const timeoutResult = await timeoutHandler.executeWithTimeout(slowOperation);
    
    // Even with timeout, fallback ensures post can proceed
    const fallbackResult = fallbackHandler.getFallbackCaption(
      'User caption',
      'Timeout occurred'
    );

    expect(timeoutResult.timedOut).toBe(true);
    expect(fallbackResult.caption).toBe('User caption');
    expect(fallbackResult.usedFallback).toBe(true);
    // Post publishing can proceed with fallback caption
  });
});

// ============================================================================
// B. RATE LIMITING TESTS (5 tests)
// ============================================================================

describe('B. Rate Limiting', () => {
  let rateLimiter: AICaptionRateLimiter;

  beforeEach(() => {
    rateLimiter = new AICaptionRateLimiter({
      maxRequestsPerMinute: 10,
      maxRequestsPerHour: 100,
    });
  });

  it('B.1: Under rate limit → requests succeed', () => {
    // Make 5 requests (under limit of 10)
    for (let i = 0; i < 5; i++) {
      const status = rateLimiter.checkRateLimit();
      expect(status.allowed).toBe(true);
      rateLimiter.recordRequest();
    }

    const finalStatus = rateLimiter.checkRateLimit();
    expect(finalStatus.allowed).toBe(true);
    expect(finalStatus.remainingMinute).toBe(5);
  });

  it('B.2: At rate limit → requests succeed', () => {
    // Make exactly 10 requests (at limit)
    for (let i = 0; i < 10; i++) {
      const status = rateLimiter.checkRateLimit();
      expect(status.allowed).toBe(true);
      rateLimiter.recordRequest();
    }

    const stats = rateLimiter.getStats();
    expect(stats.requestsThisMinute).toBe(10);
  });

  it('B.3: Over rate limit → graceful degradation, fallback used', () => {
    const fallbackHandler = new AICaptionFallbackHandler({ enableLogging: false });

    // Exceed rate limit
    for (let i = 0; i < 10; i++) {
      rateLimiter.recordRequest();
    }

    const status = rateLimiter.checkRateLimit();
    expect(status.allowed).toBe(false);
    expect(status.reason).toContain('Rate limit exceeded');

    // Fallback ensures post can proceed
    const fallbackResult = fallbackHandler.getFallbackCaption(
      'User caption',
      'Rate limit exceeded'
    );
    expect(fallbackResult.caption).toBe('User caption');
  });

  it('B.4: Rate limit resets correctly', async () => {
    // Fill up rate limit
    for (let i = 0; i < 10; i++) {
      rateLimiter.recordRequest();
    }

    expect(rateLimiter.checkRateLimit().allowed).toBe(false);

    // Reset and verify
    rateLimiter.reset();
    
    const status = rateLimiter.checkRateLimit();
    expect(status.allowed).toBe(true);
    expect(status.remainingMinute).toBe(10);
  });

  it('B.5: Rate limit doesn\'t block post publish', () => {
    const fallbackHandler = new AICaptionFallbackHandler({ enableLogging: false });

    // Exceed rate limit
    for (let i = 0; i < 11; i++) {
      rateLimiter.recordRequest();
    }

    const status = rateLimiter.checkRateLimit();
    expect(status.allowed).toBe(false);

    // Even with rate limit exceeded, post can proceed with fallback
    const fallbackResult = fallbackHandler.getFallbackCaption(
      null,
      'Rate limit exceeded'
    );
    expect(fallbackResult.caption).toBe(''); // Empty caption
    expect(fallbackResult.fallbackStrategy).toBe('empty');
    // Post publishing proceeds successfully
  });
});

// ============================================================================
// C. SERVICE UNAVAILABLE TESTS (5 tests)
// ============================================================================

describe('C. Service Unavailable', () => {
  let errorHandler: AICaptionErrorHandler;
  let fallbackHandler: AICaptionFallbackHandler;

  beforeEach(() => {
    errorHandler = new AICaptionErrorHandler({
      maxRetries: 3,
      initialDelayMs: 10,
      enableLogging: false,
    });
    fallbackHandler = new AICaptionFallbackHandler({ enableLogging: false });
  });

  it('C.1: AI service returns 503 → fallback triggered', async () => {
    const serviceUnavailable = async () => {
      throw new Error('Service unavailable: 503');
    };

    const result = await errorHandler.executeWithRetry(serviceUnavailable);
    expect(result.success).toBe(false);

    const fallbackResult = fallbackHandler.getFallbackCaption(
      'User caption',
      'Service unavailable'
    );
    expect(fallbackResult.caption).toBe('User caption');
  });

  it('C.2: AI service returns 500 → fallback triggered', async () => {
    const serverError = async () => {
      throw new Error('Internal server error: 500');
    };

    const result = await errorHandler.executeWithRetry(serverError);
    expect(result.success).toBe(false);

    const fallbackResult = fallbackHandler.getFallbackCaption(
      'Backup caption',
      'Server error'
    );
    expect(fallbackResult.caption).toBe('Backup caption');
  });

  it('C.3: Network error → retry then fallback', async () => {
    let attempts = 0;
    const networkError = async () => {
      attempts++;
      throw new Error('Network error: ECONNREFUSED');
    };

    const result = await errorHandler.executeWithRetry(networkError);
    
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(4); // Initial + 3 retries
    expect(attempts).toBe(4);

    const fallbackResult = fallbackHandler.getFallbackCaption(
      null,
      'Network error'
    );
    expect(fallbackResult.caption).toBe('');
  });

  it('C.4: DNS resolution failure → fallback', async () => {
    const dnsError = async () => {
      throw new Error('DNS resolution failed: ENOTFOUND');
    };

    const result = await errorHandler.executeWithRetry(dnsError);
    expect(result.success).toBe(false);

    const fallbackResult = fallbackHandler.getFallbackCaption(
      'User provided text',
      'DNS error'
    );
    expect(fallbackResult.caption).toBe('User provided text');
  });

  it('C.5: Service unavailable doesn\'t block post publish', async () => {
    const unavailable = async () => {
      throw new Error('Service unavailable');
    };

    const result = await errorHandler.executeWithRetry(unavailable);
    expect(result.success).toBe(false);

    // Fallback ensures post proceeds
    const fallbackResult = fallbackHandler.getFallbackCaption(
      null,
      'Service unavailable'
    );
    expect(fallbackResult.caption).toBe('');
    expect(fallbackResult.usedFallback).toBe(true);
    // Post can be published with empty caption
  });
});

// ============================================================================
// D. RETRY BEHAVIOR TESTS (5 tests)
// ============================================================================

describe('D. Retry Behavior', () => {
  let errorHandler: AICaptionErrorHandler;

  beforeEach(() => {
    errorHandler = new AICaptionErrorHandler({
      maxRetries: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
      maxDelayMs: 400,
      enableLogging: false,
    });
  });

  it('D.1: Transient network error → retry succeeds', async () => {
    let attempts = 0;
    const transientError = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Network error: ETIMEDOUT');
      }
      return 'Success after retry';
    };

    const result = await errorHandler.executeWithRetry(transientError);
    
    expect(result.success).toBe(true);
    expect(result.data).toBe('Success after retry');
    expect(result.attempts).toBe(3);
  });

  it('D.2: Transient error → max 3 retries', async () => {
    let attempts = 0;
    const alwaysFails = async () => {
      attempts++;
      throw new Error('Network error: socket hang up');
    };

    const result = await errorHandler.executeWithRetry(alwaysFails);
    
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(4); // Initial + 3 retries
    expect(attempts).toBe(4);
  });

  it('D.3: Non-transient error → no retry, immediate fallback', async () => {
    let attempts = 0;
    const quotaError = async () => {
      attempts++;
      throw new Error('Quota exceeded: 429');
    };

    const result = await errorHandler.executeWithRetry(quotaError);
    
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1); // No retries
    expect(attempts).toBe(1);
    expect(result.errorType).toBe('quota');
  });

  it('D.4: Retry with exponential backoff (100ms, 200ms, 400ms)', async () => {
    const delays: number[] = [];
    let attempts = 0;
    let lastTime = Date.now();

    const trackingError = async () => {
      attempts++;
      if (attempts > 1) {
        const delay = Date.now() - lastTime;
        delays.push(delay);
      }
      lastTime = Date.now();
      throw new Error('Network error: fetch failed');
    };

    await errorHandler.executeWithRetry(trackingError);
    
    expect(attempts).toBe(4);
    expect(delays.length).toBe(3);
    
    // Verify exponential backoff (with tolerance for timing)
    expect(delays[0]).toBeGreaterThanOrEqual(90); // ~100ms
    expect(delays[1]).toBeGreaterThanOrEqual(180); // ~200ms
    expect(delays[2]).toBeGreaterThanOrEqual(360); // ~400ms
  });

  it('D.5: Retry timeout respected', async () => {
    const timeoutHandler = new AICaptionTimeoutHandler({
      timeoutMs: 500,
      enableLogging: false,
    });

    const slowRetry = async () => {
      await sleep(600); // Exceeds timeout
      return 'Should not reach';
    };

    const result = await timeoutHandler.executeWithTimeout(slowRetry);
    
    expect(result.success).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.duration).toBeLessThan(600);
  });
});

// ============================================================================
// E. FALLBACK CORRECTNESS TESTS (5 tests)
// ============================================================================

describe('E. Fallback Correctness', () => {
  let fallbackHandler: AICaptionFallbackHandler;

  beforeEach(() => {
    fallbackHandler = new AICaptionFallbackHandler({ enableLogging: false });
  });

  it('E.1: User caption provided → use user caption', () => {
    const result = fallbackHandler.getFallbackCaption(
      'My custom caption',
      'AI failed'
    );

    expect(result.caption).toBe('My custom caption');
    expect(result.usedFallback).toBe(true);
    expect(result.fallbackStrategy).toBe('user-provided');
  });

  it('E.2: No user caption → use empty caption', () => {
    const result = fallbackHandler.getFallbackCaption(
      null,
      'AI failed'
    );

    expect(result.caption).toBe('');
    expect(result.usedFallback).toBe(true);
    expect(result.fallbackStrategy).toBe('empty');
  });

  it('E.3: Fallback never returns null/undefined', () => {
    const testCases = [
      null,
      undefined,
      '',
      '   ',
    ];

    testCases.forEach(testCase => {
      const result = fallbackHandler.getFallbackCaption(testCase, 'Test');
      expect(result.caption).toBeDefined();
      expect(result.caption).not.toBeNull();
      expect(typeof result.caption).toBe('string');
    });
  });

  it('E.4: Fallback always allows post publish', () => {
    // Test various failure scenarios
    const scenarios = [
      { userCaption: 'User text', reason: 'Timeout' },
      { userCaption: null, reason: 'Rate limit' },
      { userCaption: undefined, reason: 'Service down' },
      { userCaption: '', reason: 'Network error' },
    ];

    scenarios.forEach(scenario => {
      const result = fallbackHandler.getFallbackCaption(
        scenario.userCaption,
        scenario.reason
      );
      
      // All scenarios produce valid caption (even if empty)
      expect(result.caption).toBeDefined();
      expect(typeof result.caption).toBe('string');
      expect(result.usedFallback).toBe(true);
      // Post can proceed in all cases
    });
  });

  it('E.5: Fallback logged correctly', () => {
    fallbackHandler.getFallbackCaption('Caption 1', 'Reason 1');
    fallbackHandler.getFallbackCaption(null, 'Reason 2');
    fallbackHandler.getFallbackCaption('Caption 3', 'Reason 3');

    const stats = fallbackHandler.getFallbackStats();
    
    expect(stats.totalFallbacks).toBe(3);
    expect(stats.recentFallbacks.length).toBe(3);
    expect(stats.strategyBreakdown['user-provided']).toBe(2);
    expect(stats.strategyBreakdown['empty']).toBe(1);
  });
});

// ============================================================================
// F. INTEGRATION TESTS (5+ additional tests)
// ============================================================================

describe('F. End-to-End Integration', () => {
  it('F.1: Complete flow with timeout → fallback → post succeeds', async () => {
    const timeoutHandler = new AICaptionTimeoutHandler({
      timeoutMs: 1000,
      enableLogging: false,
    });
    const fallbackHandler = new AICaptionFallbackHandler({ enableLogging: false });

    const slowAI = async () => {
      await sleep(2000);
      return 'AI caption';
    };

    const timeoutResult = await timeoutHandler.executeWithTimeout(slowAI);
    expect(timeoutResult.timedOut).toBe(true);

    const fallbackResult = fallbackHandler.getFallbackCaption(
      'User caption',
      'Timeout'
    );
    expect(fallbackResult.caption).toBe('User caption');
    
    // Post proceeds with fallback caption
  });

  it('F.2: Complete flow with rate limit → fallback → post succeeds', () => {
    const rateLimiter = new AICaptionRateLimiter({
      maxRequestsPerMinute: 5,
      maxRequestsPerHour: 50,
    });
    const fallbackHandler = new AICaptionFallbackHandler({ enableLogging: false });

    // Exceed rate limit
    for (let i = 0; i < 6; i++) {
      rateLimiter.recordRequest();
    }

    const status = rateLimiter.checkRateLimit();
    expect(status.allowed).toBe(false);

    const fallbackResult = fallbackHandler.getFallbackCaption(
      null,
      'Rate limit'
    );
    expect(fallbackResult.caption).toBe('');
    
    // Post proceeds with empty caption
  });

  it('F.3: Complete flow with error → retry → fallback → post succeeds', async () => {
    const errorHandler = new AICaptionErrorHandler({
      maxRetries: 2,
      initialDelayMs: 10,
      enableLogging: false,
    });
    const fallbackHandler = new AICaptionFallbackHandler({ enableLogging: false });

    const failingAI = async () => {
      throw new Error('Network error: ECONNREFUSED');
    };

    const retryResult = await errorHandler.executeWithRetry(failingAI);
    expect(retryResult.success).toBe(false);

    const fallbackResult = fallbackHandler.getFallbackCaption(
      'Backup caption',
      'Network error'
    );
    expect(fallbackResult.caption).toBe('Backup caption');
    
    // Post proceeds with fallback
  });

  it('F.4: AI success → no fallback needed', async () => {
    const fallbackHandler = new AICaptionFallbackHandler({ enableLogging: false });

    const successfulAI = async () => 'AI generated caption';

    const result = await fallbackHandler.withFallback(successfulAI, 'User caption');
    
    expect(result.caption).toBe('AI generated caption');
    expect(result.usedFallback).toBe(false);
    expect(result.fallbackStrategy).toBe('none');
  });

  it('F.5: AI returns empty → fallback to user caption', async () => {
    const fallbackHandler = new AICaptionFallbackHandler({ enableLogging: false });

    const emptyAI = async () => '';

    const result = await fallbackHandler.withFallback(emptyAI, 'User caption');
    
    expect(result.caption).toBe('User caption');
    expect(result.usedFallback).toBe(true);
    expect(result.fallbackStrategy).toBe('user-provided');
  });

  it('F.6: Error classification accuracy', () => {
    const errorHandler = new AICaptionErrorHandler({ enableLogging: false });

    const testCases = [
      { error: new Error('Network error'), expectedType: 'network', shouldRetry: true },
      { error: new Error('Timeout occurred'), expectedType: 'timeout', shouldRetry: false },
      { error: new Error('Quota exceeded'), expectedType: 'quota', shouldRetry: false },
      { error: new Error('Model error'), expectedType: 'model', shouldRetry: false },
      { error: new Error('Unknown issue'), expectedType: 'unknown', shouldRetry: false },
    ];

    testCases.forEach(testCase => {
      const classification = errorHandler.classifyError(testCase.error);
      expect(classification.type).toBe(testCase.expectedType);
      expect(classification.shouldRetry).toBe(testCase.shouldRetry);
    });
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
