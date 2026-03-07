/**
 * AI Module
 * Central module for all AI operations
 */

import { AIProviderFactory } from './providers';
import { CaptionService } from './services/caption.service';
import { HashtagService } from './services/hashtag.service';
import { RewriteService } from './services/rewrite.service';
import { SuggestionService } from './services/suggestion.service';
import { IAIProvider, AIProviderConfig } from './types';

export class AIModule {
  private provider: IAIProvider;
  public caption: CaptionService;
  public hashtag: HashtagService;
  public rewrite: RewriteService;
  public suggestion: SuggestionService;

  constructor(providerConfig?: AIProviderConfig) {
    this.provider = AIProviderFactory.createProvider(providerConfig);
    this.caption = new CaptionService(this.provider);
    this.hashtag = new HashtagService(this.provider);
    this.rewrite = new RewriteService(this.provider);
    this.suggestion = new SuggestionService(this.provider);
  }

  getProvider(): IAIProvider {
    return this.provider;
  }

  getProviderName(): string {
    return this.provider.getProviderName();
  }

  getModelName(): string {
    return this.provider.getModelName();
  }
}

// Export singleton instance
let aiModuleInstance: AIModule | null = null;

export function getAIModule(providerConfig?: AIProviderConfig): AIModule {
  if (!aiModuleInstance) {
    aiModuleInstance = new AIModule(providerConfig);
  }
  return aiModuleInstance;
}

export function resetAIModule(): void {
  aiModuleInstance = null;
}

// Export all types and services
export * from './types';
export * from './providers';
export * from './services/caption.service';
export * from './services/hashtag.service';
export * from './services/rewrite.service';
export * from './services/suggestion.service';
