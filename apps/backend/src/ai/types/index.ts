/**
 * AI Module Types
 * Provider-agnostic type definitions
 */

export enum AIProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  MOCK = 'mock',
}

export enum ContentTone {
  PROFESSIONAL = 'professional',
  CASUAL = 'casual',
  FRIENDLY = 'friendly',
  VIRAL = 'viral',
  MARKETING = 'marketing',
  HUMOROUS = 'humorous',
  INSPIRATIONAL = 'inspirational',
}

export enum ContentLength {
  SHORT = 'short',
  MEDIUM = 'medium',
  LONG = 'long',
}

export enum SocialPlatform {
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  YOUTUBE = 'youtube',
  THREADS = 'threads',
  BLUESKY = 'bluesky',
  GOOGLE_BUSINESS = 'google-business',
  TIKTOK = 'tiktok',
  PINTEREST = 'pinterest',
}

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface CaptionGenerationInput {
  topic: string;
  tone: ContentTone;
  platform: SocialPlatform;
  length: ContentLength;
  keywords?: string[];
  context?: string;
}

export interface CaptionGenerationOutput {
  caption: string;
  tokensUsed: number;
  provider: AIProvider;
  model: string;
}

export interface HashtagGenerationInput {
  caption: string;
  platform: SocialPlatform;
  niche?: string;
  count?: number;
}

export interface HashtagGenerationOutput {
  hashtags: string[];
  tokensUsed: number;
  provider: AIProvider;
  model: string;
}

export interface RewriteInput {
  content: string;
  instruction: string;
  tone?: ContentTone;
  platform?: SocialPlatform;
}

export interface RewriteOutput {
  rewrittenContent: string;
  tokensUsed: number;
  provider: AIProvider;
  model: string;
}

export interface SuggestionInput {
  caption?: string;
  platform?: SocialPlatform;
  type: 'cta' | 'hook' | 'timing' | 'style';
}

export interface SuggestionOutput {
  suggestions: string[];
  tokensUsed: number;
  provider: AIProvider;
  model: string;
}

export interface AIUsageLog {
  workspaceId: string;
  userId: string;
  provider: AIProvider;
  operation: string;
  tokensUsed: number;
  cost: number;
  timestamp: Date;
}

export interface ImageCaptionInput {
  imageUrl: string;
  platform: SocialPlatform;
  tone: ContentTone;
  length: ContentLength;
  context?: string;
  keywords?: string[];
}

export interface ImageCaptionOutput {
  caption: string;
  tokensUsed: number;
  provider: AIProvider;
  model: string;
}

export interface BrandVoiceInput {
  workspaceId: string;
  sampleContent: string[];
  industry?: string;
  targetAudience?: string;
  brandPersonality?: string[];
}

export interface BrandVoiceOutput {
  voiceProfile: {
    tone: string;
    style: string;
    vocabulary: string[];
    phrases: string[];
  };
  tokensUsed: number;
  provider: AIProvider;
  model: string;
}

export interface TemplateGenerationInput {
  industry: string;
  platform: SocialPlatform;
  contentType: 'product' | 'service' | 'announcement' | 'educational' | 'promotional';
  tone: ContentTone;
}

export interface TemplateGenerationOutput {
  templates: {
    name: string;
    template: string;
    placeholders: string[];
    description: string;
  }[];
  tokensUsed: number;
  provider: AIProvider;
  model: string;
}

export interface IAIProvider {
  generateCompletion(prompt: string, options?: any): Promise<string>;
  generateVisionCompletion?(prompt: string, imageUrl: string, options?: any): Promise<string>;
  getTokenCount(text: string): number;
  getProviderName(): AIProvider;
  getModelName(): string;
}
