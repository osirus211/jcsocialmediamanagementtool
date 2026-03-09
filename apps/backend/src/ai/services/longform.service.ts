/**
 * Long-Form Content Service
 * 
 * Converts long-form content (blogs, articles) to social media posts
 * Extends existing RewriteService functionality
 */

import { IAIProvider, SocialPlatform } from '../types';
import { logger } from '../../utils/logger';

export interface LongFormInput {
  longFormContent: string;
  targetPlatform: SocialPlatform;
  focusPoints?: string[];
  preserveLinks?: boolean;
  includeHashtags?: boolean;
}

export interface LongFormOutput {
  shortFormContent: string;
  characterCount: number;
  tokensUsed: number;
  provider: string;
  model: string;
}

export class LongFormContentService {
  constructor(private provider: IAIProvider) {}

  /**
   * Convert long-form content to short-form social post
   */
  async convertToShortForm(input: LongFormInput): Promise<LongFormOutput> {
    try {
      logger.info('Converting long-form to short-form', {
        provider: this.provider.getProviderName(),
        targetPlatform: input.targetPlatform,
        contentLength: input.longFormContent.length,
      });

      const prompt = this.buildConversionPrompt(input);
      const shortFormContent = await this.provider.generateCompletion(prompt);
      const tokensUsed = this.provider.getTokenCount(prompt + shortFormContent);

      return {
        shortFormContent: shortFormContent.trim(),
        characterCount: shortFormContent.trim().length,
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Long-form conversion error:', error);
      throw new Error(`Failed to convert long-form content: ${error.message}`);
    }
  }

  /**
   * Build conversion prompt
   */
  private buildConversionPrompt(input: LongFormInput): string {
    const platformLimits = this.getPlatformLimits(input.targetPlatform);
    
    let prompt = `Convert the following long-form content into a compelling ${input.targetPlatform} post:\n\n`;
    prompt += `Long-form content:\n"${input.longFormContent}"\n\n`;
    prompt += `Requirements:\n`;
    prompt += `- Platform: ${input.targetPlatform}\n`;
    prompt += `- Maximum length: ${platformLimits.maxLength} characters\n`;
    prompt += `- Tone: ${platformLimits.tone}\n`;
    
    if (input.focusPoints && input.focusPoints.length > 0) {
      prompt += `- Focus on these key points: ${input.focusPoints.join(', ')}\n`;
    }
    
    if (input.preserveLinks) {
      prompt += `- Preserve any URLs from the original content\n`;
    }
    
    if (input.includeHashtags) {
      prompt += `- Include ${platformLimits.hashtagCount} relevant hashtags\n`;
    }
    
    prompt += `\nGenerate only the short-form post content, no explanations.`;
    
    return prompt;
  }

  /**
   * Get platform-specific limits and guidelines
   */
  private getPlatformLimits(platform: SocialPlatform): {
    maxLength: number;
    tone: string;
    hashtagCount: number;
  } {
    switch (platform) {
      case SocialPlatform.TWITTER:
        return {
          maxLength: 280,
          tone: 'concise and punchy',
          hashtagCount: 2,
        };
      case SocialPlatform.LINKEDIN:
        return {
          maxLength: 1300,
          tone: 'professional and insightful',
          hashtagCount: 5,
        };
      case SocialPlatform.INSTAGRAM:
        return {
          maxLength: 2200,
          tone: 'engaging and visual',
          hashtagCount: 10,
        };
      case SocialPlatform.FACEBOOK:
        return {
          maxLength: 500,
          tone: 'conversational and friendly',
          hashtagCount: 3,
        };
      default:
        return {
          maxLength: 500,
          tone: 'neutral',
          hashtagCount: 3,
        };
    }
  }
}
