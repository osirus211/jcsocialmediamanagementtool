/**
 * AI Types for Frontend
 */

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
  provider: string;
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
  provider: string;
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
  provider: string;
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
  provider: string;
  model: string;
}

// API Response types
export interface AIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
