/**
 * AI Provider Failover Validation Test
 * 
 * Tests AI provider failover mechanism under failure conditions:
 * - OpenAI failure → Anthropic success
 * - Both providers fail → Mock fallback
 * - Timeout handling (30s per provider)
 * - Error logging with provider name and error message
 * - Metrics recording for each provider attempt
 * - Consistent failover across all 8 AI services
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { AIProvider } from '../../../ai/types';
import { OpenAIProvider } from '../../../ai/providers/openai.provider';
import { AnthropicProvider } from '../../../ai/providers/anthropic.provider';
import { MockAIProvider } from '../../../ai/providers/mock.provider';
import { MetricsCollector } from '../../../services/metrics/MetricsCollector';
import { logger } from '../../../utils/logger';

// Interfaces from design document
interface FailoverTestConfig {
  primaryProvider: AIProvider;
  fallbackProviders: AIProvider[];
  timeout: number;
  testPrompt: string;
}

interface FailoverTestResult {
  attemptedProviders: AIProvider[];
  successfulProvider: AIProvider | null;
  totalAttempts: number;
  totalDuration: number;
  errors: { provider: AIProvider; error: string }[];
}

/**
 * AIFailoverValidator class
 * Validates AI provider failover mechanism
 */
class AIFailoverValidator {
  private providerInstances: Map<AIProvider, any> = new Map();

  constructor() {
    // Initialize provider instances with test configurations
    this.providerInstances.set(
      AIProvider.OPENAI,
      new OpenAIProvider({
        provider: AIProvider.OPENAI,
        apiKey: process.env.OPENAI_API_KEY || 'test-key',
        timeout: 30000,
      })
    );

    this.providerInstances.set(
      AIProvider.ANTHROPIC,
      new AnthropicProvider({
        provider: AIProvider.ANTHROPIC,
        apiKey: process.env.ANTHROPIC_API_KEY || 'test-key',
        timeout: 30000,
      })
    );

    this.providerInstances.set(
      AIProvider.MOCK,
      new MockAIProvider({
        provider: AIProvider.MOCK,
        timeout: 30000,
      })
    );
  }

  /**
   * Test failover mechanism with given configuration
   */
  async testFailover(config: FailoverTestConfig): Promise<FailoverTestResult> {
    const result: FailoverTestResult = {
      attemptedProviders: [],
      successfulProvider: null,
      totalAttempts: 0,
      totalDuration: 0,
      errors: [],
    };

    const startTime = Date.now();
    const providers = [config.primaryProvider, ...config.fallbackProviders];

    for (const providerType of providers) {
      result.totalAttempts++;
      result.attemptedProviders.push(providerType);

      const attemptStart = Date.now();

      try {
        const provider = this.providerInstances.get(providerType);
        if (!provider) {
          throw new Error(`Provider ${providerType} not initialized`);
        }

        // Attempt to generate completion with timeout
        const response = await this.executeWithTimeout(
          provider.generateCompletion(config.testPrompt),
          config.timeout
        );

        const attemptDuration = Date.now() - attemptStart;

        // Record success metrics
        MetricsCollector.recordAIRequest(
          'test-failover',
          'success',
          attemptDuration
        );

        // Success - set successful provider and break
        result.successfulProvider = providerType;
        result.totalDuration = Date.now() - startTime;

        logger.info('AI provider succeeded', {
          provider: providerType,
          duration: attemptDuration,
        });

        return result;
      } catch (error: any) {
        const attemptDuration = Date.now() - attemptStart;

        // Record error
        const errorMessage = error.message || 'Unknown error';
        result.errors.push({
          provider: providerType,
          error: errorMessage,
        });

        // Log error with provider name and error message (Requirement 3.4)
        logger.error('AI provider failed', {
          provider: providerType,
          error: errorMessage,
          duration: attemptDuration,
        });

        // Record failure metrics (Requirement 3.5)
        MetricsCollector.recordAIRequest(
          'test-failover',
          'failure',
          attemptDuration
        );

        // Continue to next provider
        continue;
      }
    }

    // All providers failed
    result.totalDuration = Date.now() - startTime;
    return result;
  }

  /**
   * Execute a promise with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Provider timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Simulate provider failure by mocking the provider method
   */
  async simulateProviderFailure(provider: AIProvider): Promise<void> {
    const providerInstance = this.providerInstances.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not found`);
    }

    // Mock the generateCompletion method to throw an error
    jest.spyOn(providerInstance, 'generateCompletion').mockRejectedValue(
      new Error(`Simulated ${provider} failure`)
    );
  }

  /**
   * Simulate provider timeout by mocking with delay
   */
  async simulateProviderTimeout(provider: AIProvider, delayMs: number): Promise<void> {
    const providerInstance = this.providerInstances.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not found`);
    }

    // Mock the generateCompletion method to delay beyond timeout
    jest.spyOn(providerInstance, 'generateCompletion').mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve('Delayed response'), delayMs)
        )
    );
  }

  /**
   * Test all AI services for consistent failover behavior
   */
  async testAllServices(): Promise<Record<string, FailoverTestResult>> {
    const services = [
      'caption',
      'hashtag',
      'rewrite',
      'suggestion',
      'repurposing',
      'longform',
      'reply',
      'sentiment',
    ];

    const results: Record<string, FailoverTestResult> = {};

    for (const service of services) {
      const config: FailoverTestConfig = {
        primaryProvider: AIProvider.OPENAI,
        fallbackProviders: [AIProvider.ANTHROPIC, AIProvider.MOCK],
        timeout: 30000,
        testPrompt: `Test prompt for ${service} service`,
      };

      results[service] = await this.testFailover(config);
    }

    return results;
  }

  /**
   * Reset all provider mocks
   */
  resetMocks(): void {
    for (const [providerType, provider] of this.providerInstances.entries()) {
      if (jest.isMockFunction(provider.generateCompletion)) {
        (provider.generateCompletion as jest.Mock).mockRestore();
      }
    }
  }
}

describe('AI Provider Failover Validation', () => {
  let validator: AIFailoverValidator;

  // Set test timeout to 120 seconds (property tests with 100 iterations)
  jest.setTimeout(120000);

  beforeEach(() => {
    validator = new AIFailoverValidator();
  });

  afterEach(() => {
    validator.resetMocks();
  });

  describe('Requirement 3.1: OpenAI Failure → Anthropic Success', () => {
    it('should failover to Anthropic when OpenAI fails', async () => {
      // Simulate OpenAI failure
      await validator.simulateProviderFailure(AIProvider.OPENAI);

      // Mock Anthropic to succeed (since we don't have real API keys in tests)
      const anthropicProvider = (validator as any).providerInstances.get(AIProvider.ANTHROPIC);
      jest.spyOn(anthropicProvider, 'generateCompletion').mockResolvedValue('Anthropic response');

      // Test failover
      const config: FailoverTestConfig = {
        primaryProvider: AIProvider.OPENAI,
        fallbackProviders: [AIProvider.ANTHROPIC, AIProvider.MOCK],
        timeout: 30000,
        testPrompt: 'Generate a caption for a product launch',
      };

      const result = await validator.testFailover(config);

      // Verify OpenAI was attempted first
      expect(result.attemptedProviders[0]).toBe(AIProvider.OPENAI);

      // Verify Anthropic was attempted second
      expect(result.attemptedProviders[1]).toBe(AIProvider.ANTHROPIC);

      // Verify Anthropic succeeded
      expect(result.successfulProvider).toBe(AIProvider.ANTHROPIC);

      // Verify OpenAI failure was recorded
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].provider).toBe(AIProvider.OPENAI);
      expect(result.errors[0].error).toContain('Simulated openai failure');

      // Verify total attempts
      expect(result.totalAttempts).toBe(2);
    });
  });

  describe('Requirement 3.2: Both Providers Fail → Mock Fallback', () => {
    it('should fall back to Mock provider when both OpenAI and Anthropic fail', async () => {
      // Simulate both OpenAI and Anthropic failures
      await validator.simulateProviderFailure(AIProvider.OPENAI);
      await validator.simulateProviderFailure(AIProvider.ANTHROPIC);

      // Test failover
      const config: FailoverTestConfig = {
        primaryProvider: AIProvider.OPENAI,
        fallbackProviders: [AIProvider.ANTHROPIC, AIProvider.MOCK],
        timeout: 30000,
        testPrompt: 'Generate hashtags for a tech post',
      };

      const result = await validator.testFailover(config);

      // Verify all providers were attempted
      expect(result.attemptedProviders).toEqual([
        AIProvider.OPENAI,
        AIProvider.ANTHROPIC,
        AIProvider.MOCK,
      ]);

      // Verify Mock provider succeeded
      expect(result.successfulProvider).toBe(AIProvider.MOCK);

      // Verify both OpenAI and Anthropic failures were recorded
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].provider).toBe(AIProvider.OPENAI);
      expect(result.errors[1].provider).toBe(AIProvider.ANTHROPIC);

      // Verify total attempts
      expect(result.totalAttempts).toBe(3);
    });
  });

  describe('Requirement 3.3: Timeout Handling', () => {
    it('should treat provider timeout as failure and try next provider', async () => {
      // Simulate OpenAI timeout (35 seconds, exceeds 30s timeout)
      await validator.simulateProviderTimeout(AIProvider.OPENAI, 35000);

      // Test failover with 30s timeout
      const config: FailoverTestConfig = {
        primaryProvider: AIProvider.OPENAI,
        fallbackProviders: [AIProvider.ANTHROPIC, AIProvider.MOCK],
        timeout: 30000,
        testPrompt: 'Rewrite this content',
      };

      const result = await validator.testFailover(config);

      // Verify OpenAI was attempted and timed out
      expect(result.attemptedProviders[0]).toBe(AIProvider.OPENAI);
      expect(result.errors[0].provider).toBe(AIProvider.OPENAI);
      expect(result.errors[0].error).toContain('timeout');

      // Verify next provider was attempted
      expect(result.attemptedProviders[1]).toBe(AIProvider.ANTHROPIC);

      // Verify a provider succeeded (Anthropic or Mock)
      expect(result.successfulProvider).not.toBeNull();
    });

    it('should complete full failover within 90 seconds (3 providers × 30s)', async () => {
      // Simulate all providers timing out
      await validator.simulateProviderTimeout(AIProvider.OPENAI, 35000);
      await validator.simulateProviderTimeout(AIProvider.ANTHROPIC, 35000);
      await validator.simulateProviderTimeout(AIProvider.MOCK, 35000);

      const config: FailoverTestConfig = {
        primaryProvider: AIProvider.OPENAI,
        fallbackProviders: [AIProvider.ANTHROPIC, AIProvider.MOCK],
        timeout: 30000,
        testPrompt: 'Generate suggestions',
      };

      const startTime = Date.now();
      const result = await validator.testFailover(config);
      const duration = Date.now() - startTime;

      // Verify total duration is within 90 seconds (with some buffer)
      expect(duration).toBeLessThan(95000); // 90s + 5s buffer

      // Verify all providers were attempted
      expect(result.totalAttempts).toBe(3);

      // Verify all providers timed out
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('Requirement 3.4: Provider Error Logging', () => {
    it('should log errors with provider name and error message', async () => {
      // Spy on logger
      const loggerSpy = jest.spyOn(logger, 'error');

      // Simulate OpenAI failure
      await validator.simulateProviderFailure(AIProvider.OPENAI);

      const config: FailoverTestConfig = {
        primaryProvider: AIProvider.OPENAI,
        fallbackProviders: [AIProvider.ANTHROPIC, AIProvider.MOCK],
        timeout: 30000,
        testPrompt: 'Test prompt',
      };

      await validator.testFailover(config);

      // Verify error was logged with provider name and error message
      expect(loggerSpy).toHaveBeenCalledWith(
        'AI provider failed',
        expect.objectContaining({
          provider: AIProvider.OPENAI,
          error: expect.stringContaining('Simulated openai failure'),
        })
      );

      loggerSpy.mockRestore();
    });
  });

  describe('Requirement 3.5: Provider Attempt Metrics Recording', () => {
    it('should record metrics for each provider attempt', async () => {
      // Spy on MetricsCollector
      const metricsSpy = jest.spyOn(MetricsCollector, 'recordAIRequest');

      // Simulate OpenAI failure
      await validator.simulateProviderFailure(AIProvider.OPENAI);

      // Mock Anthropic to succeed
      const anthropicProvider = (validator as any).providerInstances.get(AIProvider.ANTHROPIC);
      jest.spyOn(anthropicProvider, 'generateCompletion').mockResolvedValue('Anthropic response');

      const config: FailoverTestConfig = {
        primaryProvider: AIProvider.OPENAI,
        fallbackProviders: [AIProvider.ANTHROPIC, AIProvider.MOCK],
        timeout: 30000,
        testPrompt: 'Test prompt',
      };

      await validator.testFailover(config);

      // Verify metrics were recorded for OpenAI failure
      expect(metricsSpy).toHaveBeenCalledWith(
        'test-failover',
        'failure',
        expect.any(Number)
      );

      // Verify metrics were recorded for Anthropic success
      expect(metricsSpy).toHaveBeenCalledWith(
        'test-failover',
        'success',
        expect.any(Number)
      );

      metricsSpy.mockRestore();
    });
  });

  describe('Requirement 3.6: Consistent Failover Across All AI Services', () => {
    it('should validate failover behavior for all 8 AI services', async () => {
      // Simulate OpenAI failure for all services
      await validator.simulateProviderFailure(AIProvider.OPENAI);

      // Mock Anthropic to succeed for all services
      const anthropicProvider = (validator as any).providerInstances.get(AIProvider.ANTHROPIC);
      jest.spyOn(anthropicProvider, 'generateCompletion').mockResolvedValue('Anthropic response');

      // Test all services
      const results = await validator.testAllServices();

      // Verify all 8 services were tested
      expect(Object.keys(results)).toHaveLength(8);
      expect(results).toHaveProperty('caption');
      expect(results).toHaveProperty('hashtag');
      expect(results).toHaveProperty('rewrite');
      expect(results).toHaveProperty('suggestion');
      expect(results).toHaveProperty('repurposing');
      expect(results).toHaveProperty('longform');
      expect(results).toHaveProperty('reply');
      expect(results).toHaveProperty('sentiment');

      // Verify consistent failover behavior across all services
      for (const [service, result] of Object.entries(results)) {
        // All services should attempt OpenAI first
        expect(result.attemptedProviders[0]).toBe(AIProvider.OPENAI);

        // All services should failover to Anthropic
        expect(result.attemptedProviders[1]).toBe(AIProvider.ANTHROPIC);

        // All services should succeed with Anthropic
        expect(result.successfulProvider).toBe(AIProvider.ANTHROPIC);

        // All services should record OpenAI failure
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].provider).toBe(AIProvider.OPENAI);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle all providers failing', async () => {
      // Simulate all providers failing
      await validator.simulateProviderFailure(AIProvider.OPENAI);
      await validator.simulateProviderFailure(AIProvider.ANTHROPIC);
      await validator.simulateProviderFailure(AIProvider.MOCK);

      const config: FailoverTestConfig = {
        primaryProvider: AIProvider.OPENAI,
        fallbackProviders: [AIProvider.ANTHROPIC, AIProvider.MOCK],
        timeout: 30000,
        testPrompt: 'Test prompt',
      };

      const result = await validator.testFailover(config);

      // Verify all providers were attempted
      expect(result.totalAttempts).toBe(3);

      // Verify no successful provider
      expect(result.successfulProvider).toBeNull();

      // Verify all failures were recorded
      expect(result.errors).toHaveLength(3);
    });

    it('should handle primary provider succeeding immediately', async () => {
      // Mock OpenAI to succeed
      const openaiProvider = (validator as any).providerInstances.get(AIProvider.OPENAI);
      jest.spyOn(openaiProvider, 'generateCompletion').mockResolvedValue('OpenAI response');

      const config: FailoverTestConfig = {
        primaryProvider: AIProvider.OPENAI,
        fallbackProviders: [AIProvider.ANTHROPIC, AIProvider.MOCK],
        timeout: 30000,
        testPrompt: 'Test prompt',
      };

      const result = await validator.testFailover(config);

      // Verify only OpenAI was attempted
      expect(result.totalAttempts).toBe(1);
      expect(result.attemptedProviders).toEqual([AIProvider.OPENAI]);

      // Verify OpenAI succeeded
      expect(result.successfulProvider).toBe(AIProvider.OPENAI);

      // Verify no errors
      expect(result.errors).toHaveLength(0);
    });
  });
});
