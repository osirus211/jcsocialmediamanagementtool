/**
 * AI Module
 * Central module for all AI operations
 */

import { AIProviderFactory } from './providers';
import { CaptionService } from './services/caption.service';
import { HashtagService } from './services/hashtag.service';
import { RewriteService } from './services/rewrite.service';
import { SuggestionService } from './services/suggestion.service';
import { ContentRepurposingService } from './services/repurposing.service';
import { LongFormContentService } from './services/longform.service';
import { ReplySuggestionService } from './services/reply-suggestion.service';
import { SentimentAnalysisService } from './services/sentiment-analysis.service';
import { ModerationSuggestionService } from './services/moderation-suggestion.service';
import { IAIProvider, AIProviderConfig } from './types';

export class AIModule {
  private provider: IAIProvider;
  public caption: CaptionService;
  public hashtag: HashtagService;
  public rewrite: RewriteService;
  public suggestion: SuggestionService;
  public repurposing: ContentRepurposingService;
  public longform: LongFormContentService;
  public reply: ReplySuggestionService;
  public sentiment: SentimentAnalysisService;
  public moderation: ModerationSuggestionService;

  constructor(providerConfig?: AIProviderConfig) {
    this.provider = AIProviderFactory.createProvider(providerConfig);
    this.caption = new CaptionService(this.provider);
    this.hashtag = new HashtagService(this.provider);
    this.rewrite = new RewriteService(this.provider);
    this.suggestion = new SuggestionService(this.provider);
    this.repurposing = new ContentRepurposingService(this.provider);
    this.longform = new LongFormContentService(this.provider);
    this.reply = new ReplySuggestionService(this.provider);
    this.sentiment = new SentimentAnalysisService(this.provider);
    this.moderation = new ModerationSuggestionService(this.provider);
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
export * from './services/repurposing.service';
export * from './services/longform.service';
export * from './services/reply-suggestion.service';
export * from './services/sentiment-analysis.service';
export * from './services/moderation-suggestion.service';
export * from './services/engagement-prediction.service';
export * from './services/caption-scoring.service';
export * from './services/posting-time-prediction.service';
