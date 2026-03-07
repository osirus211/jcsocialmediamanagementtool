/**
 * AI Provider Factory
 * Creates appropriate provider based on configuration
 */

import { IAIProvider, AIProvider, AIProviderConfig } from '../types';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { MockAIProvider } from './mock.provider';
import { config } from '../../config';

export class AIProviderFactory {
  static createProvider(providerConfig?: AIProviderConfig): IAIProvider {
    const provider = providerConfig?.provider || config.ai.defaultProvider;

    switch (provider) {
      case AIProvider.OPENAI:
        return new OpenAIProvider({
          provider: AIProvider.OPENAI,
          apiKey: providerConfig?.apiKey || config.ai.openaiApiKey,
          model: providerConfig?.model || config.ai.openaiModel,
          maxTokens: providerConfig?.maxTokens || config.ai.maxTokens,
          temperature: providerConfig?.temperature || config.ai.temperature,
          timeout: providerConfig?.timeout || config.ai.timeout,
        });

      case AIProvider.ANTHROPIC:
        return new AnthropicProvider({
          provider: AIProvider.ANTHROPIC,
          apiKey: providerConfig?.apiKey || config.ai.anthropicApiKey,
          model: providerConfig?.model,
          maxTokens: providerConfig?.maxTokens || config.ai.maxTokens,
          temperature: providerConfig?.temperature || config.ai.temperature,
          timeout: providerConfig?.timeout || config.ai.timeout,
        });

      case AIProvider.MOCK:
        return new MockAIProvider();

      default:
        // Fallback to mock provider
        return new MockAIProvider();
    }
  }
}

export * from './base.provider';
export * from './openai.provider';
export * from './anthropic.provider';
export * from './mock.provider';
