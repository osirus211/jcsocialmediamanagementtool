/**
 * AI Service
 * Frontend service for AI-powered content generation
 */

import { apiClient } from '@/lib/api-client';
import { SocialPlatform } from '@/types/composer.types';

// Repurposing Types based on backend interfaces
export interface RepurposingInput {
  originalContent: string;
  originalPlatform?: string;
  targetPlatforms: string[];
  preserveHashtags?: boolean;
  preserveMentions?: boolean;
}

export interface PlatformVersion {
  platform: string;
  content: string;
  hashtags?: string[];
  characterCount: number;
}

export interface RepurposingOutput {
  platformVersions: PlatformVersion[];
  tokensUsed: number;
  provider: string;
  model: string;
}

export interface LongformToSocialInput {
  longFormContent: string;
  targetPlatform: string;
  focusPoints?: string;
  preserveLinks?: boolean;
  includeHashtags?: boolean;
}

export interface LongformToSocialOutput {
  content: string;
  tokensUsed: number;
  provider: string;
  model: string;
}

// AI Types based on backend interfaces
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
  topic: string;
  platform: SocialPlatform;
  count?: number;
}

export interface SuggestionOutput {
  suggestions: string[];
  tokensUsed: number;
  provider: string;
  model: string;
}

export interface CaptionScoreInput {
  caption: string;
  platform: SocialPlatform;
}

export interface CaptionScoreOutput {
  score: number;
  breakdown: {
    clarity: number;
    engagement: number;
    relevance: number;
  };
  suggestions: string[];
}

export interface EngagementPredictionInput {
  platform: SocialPlatform;
  caption: string;
  scheduledTime?: string;
  hasMedia?: boolean;
  mediaType?: 'image' | 'video';
}

export interface EngagementPredictionOutput {
  score: number; // 0-100
  breakdown: {
    timing: number;
    content: number;
    hashtags: number;
  };
  tips: string[];
}

export interface GenerateCalendarInput {
  startDate: string;
  endDate: string;
  platforms: string[];
  postsPerDay?: number;
  topics?: string[];
  tone?: 'professional' | 'casual' | 'humorous' | 'inspirational';
}

export interface GeneratedPost {
  platform: string;
  content: string;
  hashtags: string[];
  scheduledAt: string;
  suggestedTime: string;
}

export interface GenerateCalendarOutput {
  posts: GeneratedPost[];
  totalGenerated: number;
}

export interface ImageCaptionInput {
  imageUrl: string;
  platform: SocialPlatform;
  tone?: ContentTone;
  length?: ContentLength;
  context?: string;
  keywords?: string[];
}

export interface ImageCaptionOutput {
  caption: string;
  tokensUsed: number;
  provider: string;
  model: string;
}

export interface BrandVoiceAnalysisInput {
  sampleContent: string[];
  industry?: string;
  targetAudience?: string;
  brandPersonality?: string[];
}

export interface BrandVoiceAnalysisOutput {
  voiceProfile: {
    tone: string;
    style: string;
    vocabulary: string[];
    phrases: string[];
  };
  tokensUsed: number;
  provider: string;
  model: string;
}

export interface TemplateGenerationInput {
  industry: string;
  platform: SocialPlatform;
  contentType: 'product' | 'service' | 'announcement' | 'educational' | 'promotional';
  tone?: ContentTone;
}

export interface TemplateGenerationOutput {
  templates: {
    name: string;
    template: string;
    placeholders: string[];
    description: string;
  }[];
  tokensUsed: number;
  provider: string;
  model: string;
}

export interface CTAGenerationInput {
  platform: SocialPlatform;
  tone?: ContentTone;
  objective: 'engagement' | 'conversion' | 'traffic' | 'awareness' | 'sales';
  context?: string;
}

export interface CTAGenerationOutput {
  ctas: string[];
  tokensUsed: number;
  provider: string;
  model: string;
}

export interface EmojiSuggestionInput {
  content: string;
  platform: SocialPlatform;
  tone?: ContentTone;
  maxEmojis?: number;
}

export interface EmojiSuggestionOutput {
  emojis: {
    emoji: string;
    description: string;
    relevance: number;
  }[];
  tokensUsed: number;
  provider: string;
  model: string;
}

class AIService {
  /**
   * Generate caption variations for a given topic
   */
  async generateCaption(input: {
    topic: string;
    platform: SocialPlatform;
    tone?: ContentTone;
    keywords?: string[];
    contentType?: string;
  }): Promise<CaptionGenerationOutput> {
    const requestData: CaptionGenerationInput = {
      topic: input.topic,
      platform: input.platform,
      tone: input.tone || ContentTone.CASUAL,
      length: ContentLength.MEDIUM,
      keywords: input.keywords,
      context: input.contentType,
    };

    const response = await apiClient.post('/ai/caption', requestData);
    return response.data;
  }

  /**
   * Generate hashtags for content
   */
  async generateHashtags(input: {
    content: string;
    platform: SocialPlatform;
  }): Promise<HashtagGenerationOutput> {
    const requestData: HashtagGenerationInput = {
      caption: input.content,
      platform: input.platform,
      count: 10,
    };

    const response = await apiClient.post('/ai/hashtags', requestData);
    return response.data;
  }

  /**
   * Rewrite content with specific instructions
   */
  async rewriteContent(input: {
    content: string;
    platform: SocialPlatform;
    instruction?: string;
  }): Promise<RewriteOutput> {
    const requestData: RewriteInput = {
      content: input.content,
      instruction: input.instruction || 'Improve the writing style and engagement',
      platform: input.platform,
    };

    const response = await apiClient.post('/ai/rewrite', requestData);
    return response.data;
  }

  /**
   * Improve content quality
   */
  async improveContent(input: {
    content: string;
    platform: SocialPlatform;
  }): Promise<RewriteOutput> {
    const requestData = {
      content: input.content,
      instruction: 'Improve clarity, engagement, and overall quality while maintaining the original message',
    };

    const response = await apiClient.post('/ai/improve', requestData);
    return response.data;
  }

  /**
   * Generate content suggestions
   */
  async generateSuggestions(input: {
    topic: string;
    platform: SocialPlatform;
    count?: number;
  }): Promise<SuggestionOutput> {
    const requestData: SuggestionInput = {
      topic: input.topic,
      platform: input.platform,
      count: input.count || 3,
    };

    const response = await apiClient.post('/ai/suggestions', requestData);
    return response.data;
  }

  /**
   * Score caption quality
   */
  async scoreCaption(input: {
    caption: string;
    platform: SocialPlatform;
  }): Promise<CaptionScoreOutput> {
    const requestData: CaptionScoreInput = {
      caption: input.caption,
      platform: input.platform,
    };

    const response = await apiClient.post('/ai/score-caption', requestData);
    return response.data;
  }

  /**
   * Predict engagement for content
   */
  async predictEngagement(input: {
    platform: SocialPlatform;
    caption: string;
    scheduledTime?: Date;
    hasMedia?: boolean;
    mediaType?: 'image' | 'video';
  }): Promise<EngagementPredictionOutput> {
    const requestData: EngagementPredictionInput = {
      platform: input.platform,
      caption: input.caption,
      scheduledTime: input.scheduledTime?.toISOString(),
      hasMedia: input.hasMedia,
      mediaType: input.mediaType,
    };

    const response = await apiClient.post('/ai/predict-engagement', requestData);
    return response.data;
  }

  /**
   * Repurpose content for multiple platforms
   */
  async repurposeContent(input: {
    originalContent: string;
    targetPlatforms: string[];
    originalPlatform?: string;
    preserveHashtags?: boolean;
    preserveMentions?: boolean;
  }): Promise<RepurposingOutput> {
    const requestData: RepurposingInput = {
      originalContent: input.originalContent,
      targetPlatforms: input.targetPlatforms,
      originalPlatform: input.originalPlatform,
      preserveHashtags: input.preserveHashtags,
      preserveMentions: input.preserveMentions,
    };

    const response = await apiClient.post('/ai/repurpose', requestData);
    return response.data;
  }

  /**
   * Convert long-form content to social media post
   */
  async longformToSocial(input: {
    longFormContent: string;
    targetPlatform: string;
    focusPoints?: string;
    preserveLinks?: boolean;
    includeHashtags?: boolean;
  }): Promise<LongformToSocialOutput> {
    const requestData: LongformToSocialInput = {
      longFormContent: input.longFormContent,
      targetPlatform: input.targetPlatform,
      focusPoints: input.focusPoints,
      preserveLinks: input.preserveLinks,
      includeHashtags: input.includeHashtags,
    };

    const response = await apiClient.post('/ai/longform-to-social', requestData);
    return response.data;
  }

  /**
   * Generate calendar posts for auto-fill
   */
  async generateCalendarPosts(input: GenerateCalendarInput): Promise<GenerateCalendarOutput> {
    const response = await apiClient.post('/ai/generate-calendar', input);
    return response.data;
  }

  /**
   * Generate caption from image
   */
  async generateImageCaption(input: ImageCaptionInput): Promise<ImageCaptionOutput> {
    const response = await apiClient.post('/ai/image-caption', input);
    return response.data;
  }

  /**
   * Analyze brand voice from sample content
   */
  async analyzeBrandVoice(input: BrandVoiceAnalysisInput): Promise<BrandVoiceAnalysisOutput> {
    const response = await apiClient.post('/ai/brand-voice', input);
    return response.data;
  }

  /**
   * Generate industry-specific templates
   */
  async generateTemplates(input: TemplateGenerationInput): Promise<TemplateGenerationOutput> {
    const response = await apiClient.post('/ai/templates', input);
    return response.data;
  }

  /**
   * Generate call-to-action phrases
   */
  async generateCTAs(input: CTAGenerationInput): Promise<CTAGenerationOutput> {
    const response = await apiClient.post('/ai/cta', input);
    return response.data;
  }

  /**
   * Suggest relevant emojis for content
   */
  async suggestEmojis(input: EmojiSuggestionInput): Promise<EmojiSuggestionOutput> {
    const response = await apiClient.post('/ai/emojis', input);
    return response.data;
  }
}

export const aiService = new AIService();