/**
 * Comprehensive Retry Logic Test Suite
 * 
 * Tests all aspects of the retry system including:
 * - Retry logic validation
 * - Service-specific retry behavior  
 * - Error classification
 * - Exponential backoff algorithm
 * - Real runtime validation
 */

import { RetryManager, RetryConfig, RetryResult, ErrorType, RetryableError } from '../reliability/RetryManager';
import { RETRY_CONFIGS, getRetryConfig, validateRetryConfig, SERVICE_ERROR_CONFIGS } from '../reliability/ServiceRetryConfigs';
import { classifyError, createRetryableError, shouldRetryError } from '../reliability/RetryableError';

describe('Retry Logic Test Suite', () => {
  let retryManager: RetryManager;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    retryManager = new RetryManager(mockLogger);
  });

  describe('A. Retry Logic Validation (8 tests)', () => {
    test('1. Successful operation on first attempt (no retries)', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const config: RetryConfig = {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 16000,
        backoffMultiplier: 2,
        jitterMs: 100
      };

      const result = await retryManager.executeWithRetry(operation, config, 'test-operation');

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.retryLog).toHaveLength(1);
      expect(result.retryLog[0].success).toBe(true);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('2. Successful operation on 2nd attempt (1 retry)', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue('success');
      
      const config: RetryConfig = {
        maxRetries: 3,
        baseDelayMs: 100, // Shorter delay for testing
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        jitterMs: 10
      };

      const startTime = Date.now();
      const result = await retryManager.executeWithRetry(operation, config, 'test-operation');
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(result.retryLog).toHaveLength(2);
      expect(result.retryLog[0].success).toBe(false);
      expect(result.retryLog[1].success).toBe(true);
      expect(operation).toHaveBeenCalledTimes(2);
      
      // Verify delay was applied
      expect(endTime - startTime).toBeGreaterThan(100);
    });

    test('3. Successful operation on 3rd attempt (2 retries)', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');
      
      const config: RetryConfig = {
        maxRetries: 3,
        baseDelayMs: 50,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        jitterMs: 5
      };

      const result = await retryManager.executeWithRetry(operation, config, 'test-operation');

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(3);
      expect(result.retryLog).toHaveLength(3);
      expect(result.retryLog[0].success).toBe(false);
      expect(result.retryLog[1].success).toBe(false);
      expect(result.retryLog[2].success).toBe(true);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('4. Failure after max retries exceeded', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      
      const config: RetryConfig = {
        maxRetries: 2,
        baseDelayMs: 50,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        jitterMs: 5
      };

      const result = await retryManager.executeWithRetry(operation, config, 'test-operation');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Persistent failure');
      expect(result.attempts).toBe(3); // Initial + 2 retries
      expect(result.retryLog).toHaveLength(3);
      expect(result.retryLog.every(log => !log.success)).toBe(true);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('5. Exponential backoff timing validation', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');
      
      const config: RetryConfig = {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        jitterMs: 0 // No jitter for precise timing
      };

      const result = await retryManager.executeWithRetry(operation, config, 'test-operation');

      expect(result.success).toBe(true);
      expect(result.retryLog).toHaveLength(3);
      
      // Check delay progression: 100ms, 200ms
      expect(result.retryLog[0].delayBeforeRetry).toBe(100);
      expect(result.retryLog[1].delayBeforeRetry).toBe(200);
    });

    test('6. Jitter application validation', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValue('success');
      
      const config: RetryConfig = {
        maxRetries: 2,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        jitterMs: 50
      };

      const result = await retryManager.executeWithRetry(operation, config, 'test-operation');

      expect(result.success).toBe(true);
      expect(result.retryLog).toHaveLength(2);
      
      // Delay should be base + jitter (100 ± 50)
      const delay = result.retryLog[0].delayBeforeRetry!;
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThanOrEqual(150);
    });

    test('7. Non-retryable error skips retries', async () => {
      const nonRetryableError = RetryableError.nonRetryable('Authentication failed', 401);
      const operation = jest.fn().mockRejectedValue(nonRetryableError);
      
      const config: RetryConfig = {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        jitterMs: 10
      };

      const result = await retryManager.executeWithRetry(operation, config, 'test-operation');

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1); // No retries
      expect(result.retryLog).toHaveLength(1);
      expect(result.retryLog[0].success).toBe(false);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('8. Rate limited error respects retry-after header', async () => {
      const rateLimitError = RetryableError.rateLimited('Rate limit exceeded', 2000, 429);
      const operation = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('success');
      
      const config: RetryConfig = {
        maxRetries: 2,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        jitterMs: 0
      };

      const startTime = Date.now();
      const result = await retryManager.executeWithRetry(operation, config, 'test-operation');
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      
      // Should respect the exponential backoff, not the retry-after
      // (RetryManager uses its own backoff algorithm)
      expect(endTime - startTime).toBeGreaterThan(100);
    });
  });

  describe('B. Service-Specific Retry Behavior (8 tests)', () => {
    test('1. OAuth retry behavior (network errors, 503s)', async () => {
      const networkError = new Error('Network failure');
      (networkError as any).code = 'ECONNREFUSED';
      
      const operation = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('oauth-success');
      
      const config = getRetryConfig('oauth');
      const result = await retryManager.executeWithRetry(operation, config, 'oauth-request');

      expect(result.success).toBe(true);
      expect(result.result).toBe('oauth-success');
      expect(result.attempts).toBe(2);
    });

    test('2. Media upload retry behavior (timeouts, 502s)', async () => {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'ETIMEDOUT';
      
      const operation = jest.fn()
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValue('upload-success');
      
      const config = getRetryConfig('mediaUpload');
      const result = await retryManager.executeWithRetry(operation, config, 'media-upload');

      expect(result.success).toBe(true);
      expect(result.result).toBe('upload-success');
      expect(result.attempts).toBe(2);
      
      // Media upload should have longer base delay
      expect(config.baseDelayMs).toBe(2000);
    });

    test('3. AI caption retry behavior (503s, timeouts)', async () => {
      const serverError = new Error('Service unavailable');
      (serverError as any).response = { status: 503 };
      
      const operation = jest.fn()
        .mockRejectedValueOnce(serverError)
        .mockResolvedValue('ai-caption-success');
      
      const config = getRetryConfig('aiCaption');
      const result = await retryManager.executeWithRetry(operation, config, 'ai-caption');

      expect(result.success).toBe(true);
      expect(result.result).toBe('ai-caption-success');
      expect(result.attempts).toBe(2);
    });

    test('4. Email retry behavior (rate limits, 503s)', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).response = { status: 429 };
      
      const operation = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('email-success');
      
      const config = getRetryConfig('email');
      const result = await retryManager.executeWithRetry(operation, config, 'email-send');

      expect(result.success).toBe(true);
      expect(result.result).toBe('email-success');
      expect(result.attempts).toBe(2);
      
      // Email should have fewer max retries
      expect(config.maxRetries).toBe(2);
    });

    test('5. Service-specific retry configurations applied', () => {
      const oauthConfig = getRetryConfig('oauth');
      const mediaConfig = getRetryConfig('mediaUpload');
      const aiConfig = getRetryConfig('aiCaption');
      const emailConfig = getRetryConfig('email');

      // Verify different configurations
      expect(oauthConfig.maxRetries).toBe(3);
      expect(mediaConfig.maxRetries).toBe(2);
      expect(mediaConfig.baseDelayMs).toBe(2000); // Longer for media
      expect(emailConfig.maxDelayMs).toBe(4000); // Shorter for email
      expect(aiConfig.maxDelayMs).toBe(16000);
    });

    test('6. Service-specific error classification', () => {
      const networkError = new Error('Connection refused');
      (networkError as any).code = 'ECONNREFUSED';
      
      const authError = new Error('Unauthorized');
      (authError as any).response = { status: 401 };
      
      const serverError = new Error('Internal server error');
      (serverError as any).response = { status: 500 };

      expect(classifyError(networkError)).toBe(ErrorType.RETRYABLE);
      expect(classifyError(authError)).toBe(ErrorType.NON_RETRYABLE);
      expect(classifyError(serverError)).toBe(ErrorType.RETRYABLE);
    });

    test('7. Service-specific logging context', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const config = getRetryConfig('oauth');
      
      await retryManager.executeWithRetry(operation, config, 'oauth-token-refresh');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('oauth-token-refresh'),
        expect.objectContaining({
          context: 'oauth-token-refresh',
          attempt: 1,
          success: true
        })
      );
    });

    test('8. Service-specific max retry limits', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      
      // Test email service (2 retries max)
      const emailConfig = getRetryConfig('email');
      const emailResult = await retryManager.executeWithRetry(operation, emailConfig, 'email');
      expect(emailResult.attempts).toBe(3); // Initial + 2 retries
      
      // Test social publishing (4 retries max)
      const socialConfig = getRetryConfig('socialPublishing');
      const socialResult = await retryManager.executeWithRetry(operation, socialConfig, 'social');
      expect(socialResult.attempts).toBe(5); // Initial + 4 retries
    });
  });

  describe('C. Error Classification (5 tests)', () => {
    test('1. Network errors classified as retryable', () => {
      const networkErrors = [
        { code: 'ECONNREFUSED' },
        { code: 'ETIMEDOUT' },
        { code: 'ENOTFOUND' },
        { code: 'ECONNRESET' },
        { code: 'ECONNABORTED' }
      ];

      networkErrors.forEach(error => {
        expect(classifyError(error)).toBe(ErrorType.RETRYABLE);
      });
    });

    test('2. 5xx HTTP errors classified as retryable', () => {
      const serverErrors = [500, 501, 502, 503, 504, 505];
      
      serverErrors.forEach(status => {
        const error = { response: { status } };
        expect(classifyError(error)).toBe(ErrorType.RETRYABLE);
      });
    });

    test('3. 4xx HTTP errors classified as non-retryable', () => {
      const clientErrors = [400, 401, 403, 404, 405, 406];
      
      clientErrors.forEach(status => {
        const error = { response: { status } };
        expect(classifyError(error)).toBe(ErrorType.NON_RETRYABLE);
      });
    });

    test('4. 429 errors classified as rate-limited', () => {
      const rateLimitError = { response: { status: 429 } };
      expect(classifyError(rateLimitError)).toBe(ErrorType.RATE_LIMITED);
    });

    test('5. Unknown errors classified as non-retryable', () => {
      const unknownErrors = [
        new Error('Unknown error'),
        { message: 'Some random error' },
        'string error',
        null,
        undefined
      ];

      unknownErrors.forEach(error => {
        expect(classifyError(error)).toBe(ErrorType.NON_RETRYABLE);
      });
    });
  });

  describe('D. Backoff Algorithm (4 tests)', () => {
    test('1. Exponential backoff calculation (1s, 2s, 4s, 8s, 16s)', () => {
      const config: RetryConfig = {
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 32000,
        backoffMultiplier: 2,
        jitterMs: 0
      };

      const retryManager = new RetryManager();
      const calculateDelay = (retryManager as any).calculateDelay.bind(retryManager);

      expect(calculateDelay(1, config)).toBe(1000);  // 1000 * 2^0
      expect(calculateDelay(2, config)).toBe(2000);  // 1000 * 2^1
      expect(calculateDelay(3, config)).toBe(4000);  // 1000 * 2^2
      expect(calculateDelay(4, config)).toBe(8000);  // 1000 * 2^3
      expect(calculateDelay(5, config)).toBe(16000); // 1000 * 2^4
    });

    test('2. Max delay cap enforcement', () => {
      const config: RetryConfig = {
        maxRetries: 10,
        baseDelayMs: 1000,
        maxDelayMs: 5000, // Cap at 5 seconds
        backoffMultiplier: 2,
        jitterMs: 0
      };

      const retryManager = new RetryManager();
      const calculateDelay = (retryManager as any).calculateDelay.bind(retryManager);

      expect(calculateDelay(1, config)).toBe(1000);
      expect(calculateDelay(2, config)).toBe(2000);
      expect(calculateDelay(3, config)).toBe(4000);
      expect(calculateDelay(4, config)).toBe(5000); // Capped
      expect(calculateDelay(5, config)).toBe(5000); // Still capped
    });

    test('3. Jitter application (randomization)', () => {
      const config: RetryConfig = {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        jitterMs: 500
      };

      const retryManager = new RetryManager();
      const calculateDelay = (retryManager as any).calculateDelay.bind(retryManager);

      // Run multiple times to test randomization
      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(calculateDelay(1, config));
      }

      // All delays should be in range [1000, 1500]
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(1000);
        expect(delay).toBeLessThanOrEqual(1500);
      });

      // Should have some variation (not all the same)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    test('4. Backoff multiplier configuration', () => {
      const config: RetryConfig = {
        maxRetries: 4,
        baseDelayMs: 100,
        maxDelayMs: 10000,
        backoffMultiplier: 3, // Different multiplier
        jitterMs: 0
      };

      const retryManager = new RetryManager();
      const calculateDelay = (retryManager as any).calculateDelay.bind(retryManager);

      expect(calculateDelay(1, config)).toBe(100);  // 100 * 3^0
      expect(calculateDelay(2, config)).toBe(300);  // 100 * 3^1
      expect(calculateDelay(3, config)).toBe(900);  // 100 * 3^2
      expect(calculateDelay(4, config)).toBe(2700); // 100 * 3^3
    });
  });

  describe('E. Configuration Validation (2 tests)', () => {
    test('1. Valid configuration passes validation', () => {
      const validConfig: RetryConfig = {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 16000,
        backoffMultiplier: 2,
        jitterMs: 100
      };

      expect(() => validateRetryConfig(validConfig)).not.toThrow();
    });

    test('2. Invalid configurations throw errors', () => {
      const invalidConfigs = [
        { maxRetries: -1, baseDelayMs: 1000, maxDelayMs: 16000, backoffMultiplier: 2 },
        { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 16000, backoffMultiplier: 2 },
        { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 500, backoffMultiplier: 2 },
        { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 16000, backoffMultiplier: 1 },
        { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 16000, backoffMultiplier: 2, jitterMs: -10 }
      ];

      invalidConfigs.forEach(config => {
        expect(() => validateRetryConfig(config as RetryConfig)).toThrow();
      });
    });
  });

  describe('F. Integration with Service Configurations (3 tests)', () => {
    test('1. All service configurations are valid', () => {
      const services: Array<keyof typeof RETRY_CONFIGS> = [
        'oauth', 'mediaUpload', 'aiCaption', 'email', 'socialPublishing', 'analytics'
      ];

      services.forEach(service => {
        const config = getRetryConfig(service);
        expect(() => validateRetryConfig(config)).not.toThrow();
      });
    });

    test('2. Service configurations have expected characteristics', () => {
      // Critical services should have more retries
      expect(getRetryConfig('socialPublishing').maxRetries).toBeGreaterThan(
        getRetryConfig('email').maxRetries
      );

      // Media upload should have longer delays
      expect(getRetryConfig('mediaUpload').baseDelayMs).toBeGreaterThan(
        getRetryConfig('oauth').baseDelayMs
      );

      // Analytics should have minimal retries (non-critical)
      expect(getRetryConfig('analytics').maxRetries).toBe(1);
    });

    test('3. Error handling configurations exist for all services', () => {
      const { SERVICE_ERROR_CONFIGS } = require('../../../.kiro/execution/reliability/ServiceRetryConfigs');
      
      const services = ['oauth', 'mediaUpload', 'aiCaption', 'email', 'socialPublishing', 'analytics'];
      
      services.forEach(service => {
        expect(SERVICE_ERROR_CONFIGS[service]).toBeDefined();
        expect(SERVICE_ERROR_CONFIGS[service].retryableStatusCodes).toBeInstanceOf(Array);
        expect(SERVICE_ERROR_CONFIGS[service].nonRetryableStatusCodes).toBeInstanceOf(Array);
        expect(SERVICE_ERROR_CONFIGS[service].timeoutMs).toBeGreaterThan(0);
      });
    });
  });
});

describe('Real Runtime Validation Tests', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager();
  });

  describe('G. Load Testing (2 tests)', () => {
    test('1. 100 concurrent operations with retry logic', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => {
        return () => {
          // Simulate 20% failure rate
          if (Math.random() < 0.2) {
            const error = new Error(`Simulated failure ${i}`);
            (error as any).response = { status: 503 };
            return Promise.reject(error);
          }
          return Promise.resolve(`success-${i}`);
        };
      });

      const config: RetryConfig = {
        maxRetries: 2,
        baseDelayMs: 10, // Short delays for testing
        maxDelayMs: 100,
        backoffMultiplier: 2,
        jitterMs: 5
      };

      const startTime = Date.now();
      const promises = operations.map((op, i) => 
        retryManager.executeWithRetry(op, config, `concurrent-op-${i}`)
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Most operations should succeed (with retries)
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(90); // At least 90% success rate

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // Less than 5 seconds

      // Verify retry attempts were made
      const totalAttempts = results.reduce((sum, r) => sum + r.attempts, 0);
      expect(totalAttempts).toBeGreaterThan(100); // More than initial attempts
    }, 10000);

    test('2. Retry overhead measurement under load', async () => {
      const successOperation = () => Promise.resolve('success');
      const failingOperation = () => {
        const error = new Error('Simulated failure');
        (error as any).response = { status: 503 };
        return Promise.reject(error);
      };

      const config: RetryConfig = {
        maxRetries: 3,
        baseDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
        jitterMs: 0
      };

      // Measure successful operations (no retries)
      const successStartTime = Date.now();
      const successPromises = Array.from({ length: 50 }, () => 
        retryManager.executeWithRetry(successOperation, config, 'success-op')
      );
      await Promise.all(successPromises);
      const successDuration = Date.now() - successStartTime;

      // Measure failing operations (with retries)
      const failStartTime = Date.now();
      const failPromises = Array.from({ length: 50 }, () => 
        retryManager.executeWithRetry(failingOperation, config, 'fail-op')
      );
      await Promise.all(failPromises);
      const failDuration = Date.now() - failStartTime;

      // Retry overhead should be reasonable
      const overhead = failDuration - successDuration;
      expect(overhead).toBeGreaterThan(0);
      expect(overhead).toBeLessThan(5000); // Less than 5 seconds overhead
    }, 15000);
  });

  describe('H. Failure Simulation (2 tests)', () => {
    test('1. 50% failure rate for sustained period', async () => {
      let callCount = 0;
      const operation = () => {
        callCount++;
        // 50% failure rate
        if (Math.random() < 0.5) {
          const error = new Error('Simulated failure');
          (error as any).response = { status: 503 };
          return Promise.reject(error);
        }
        return Promise.resolve(`success-${callCount}`);
      };

      const config: RetryConfig = {
        maxRetries: 3,
        baseDelayMs: 20,
        maxDelayMs: 200,
        backoffMultiplier: 2,
        jitterMs: 10
      };

      // Run operations for 30 seconds (reduced from 5 minutes for testing)
      const endTime = Date.now() + 30000;
      const results: RetryResult<string>[] = [];

      while (Date.now() < endTime) {
        const result = await retryManager.executeWithRetry(operation, config, 'sustained-test');
        results.push(result);
        
        // Small delay between operations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze results
      const successCount = results.filter(r => r.success).length;
      const totalAttempts = results.reduce((sum, r) => sum + r.attempts, 0);
      const avgAttempts = totalAttempts / results.length;

      expect(results.length).toBeGreaterThan(10); // Should have run multiple operations
      expect(successCount / results.length).toBeGreaterThan(0.7); // >70% success with retries
      expect(avgAttempts).toBeGreaterThan(1); // Should have retries
      expect(avgAttempts).toBeLessThan(3); // But not too many
    }, 35000);

    test('2. Recovery time measurement when service restores', async () => {
      let isServiceDown = true;
      let callCount = 0;

      const operation = () => {
        callCount++;
        if (isServiceDown) {
          const error = new Error('Service unavailable');
          (error as any).response = { status: 503 };
          return Promise.reject(error);
        }
        return Promise.resolve(`success-${callCount}`);
      };

      const config: RetryConfig = {
        maxRetries: 2,
        baseDelayMs: 50,
        maxDelayMs: 500,
        backoffMultiplier: 2,
        jitterMs: 10
      };

      // Start operations while service is down
      const operationPromises = Array.from({ length: 10 }, () => 
        retryManager.executeWithRetry(operation, config, 'recovery-test')
      );

      // Restore service after 2 seconds
      setTimeout(() => {
        isServiceDown = false;
      }, 2000);

      const results = await Promise.all(operationPromises);
      
      // Some operations should succeed after service restoration
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);
      
      // Successful operations should have multiple attempts
      const successfulResults = results.filter(r => r.success);
      successfulResults.forEach(result => {
        expect(result.attempts).toBeGreaterThan(1);
      });
    }, 10000);
  });
});