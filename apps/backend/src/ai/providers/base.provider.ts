/**
 * Base AI Provider
 * Abstract class for all AI providers
 */

import { IAIProvider, AIProvider, AIProviderConfig } from '../types';

export abstract class BaseAIProvider implements IAIProvider {
  protected config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  abstract generateCompletion(prompt: string, options?: any): Promise<string>;
  abstract getTokenCount(text: string): number;
  abstract getProviderName(): AIProvider;
  abstract getModelName(): string;

  protected getTimeout(): number {
    return this.config.timeout || 30000; // 30s default
  }

  protected getMaxTokens(): number {
    return this.config.maxTokens || 500;
  }

  protected getTemperature(): number {
    return this.config.temperature || 0.7;
  }
}
