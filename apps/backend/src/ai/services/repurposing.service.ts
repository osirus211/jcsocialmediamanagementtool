/**
 * Content Repurposing Service
 * 
 * Converts content for different social media platforms
 * Reuses existing AI providers without duplication
 */

import { IAIProvider, SocialPlatform } from '../types';
import { logger } from '../../utils/logger';

export interface RepurposingInput {
  originalContent: string;
  originalPlatform?: SocialPlatform;
  targetPlatforms: SocialPlatform[];
  preserveHashtags?: boolean;
  preserveMentions?: boolean;
}

export interface PlatformVersion {
  platform: SocialPlatform;
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

export class ContentRepurposingService {
  constructor(private provider: IAIProvider) {}

  /**
   * Repurpose content for multiple platforms
   */
  async repurposeContent(input: RepurposingInput): Promise<RepurposingOutput> {
    try {
      logger.info('Repurposing content', {
        provider: this.provider.getProviderName(),
        targetPlatforms: input.targetPlatforms,
      });

      const platformVersions: PlatformVersion[] = [];
      let totalTokensUsed = 0;

      // Generate version for each target platform
      for (const platform of input.targetPlatforms) {
        const version = await this.generatePlatformVersion(
          input.originalContent,
          platform,
          input.originalPlatform,
          input.preserveHashtags,
          input.preserveMentions
        );

        platformVersions.push(version);
        totalTokensUsed += this.provider.getTokenCount(
          input.originalContent + version.content
        );
      }

      return {
        platformVersions,
        tokensUsed: totalTokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Content repurposing error:', error);
      throw new Error(`Failed to repurpose content: ${error.message}`);
    }
  }

  /**
   * Generate platform-specific version
   */
  private async generatePlatformVersion(
    originalContent: string,
    targetPlatform: SocialPlatform,
    originalPlatform?: SocialPlatform,
    preserveHashtags?: boolean,
    preserveMentions?: boolean
  ): Promise<PlatformVersion> {
    const prompt = this.buildRepurposingPrompt(
      originalContent,
      targetPlatform,
      originalPlatform,
      preserveHashtags,
      preserveMentions
    );

    const adaptedContent = await this.provider.generateCompletion(prompt);
    const hashtags = this.extractHashtags(adaptedContent);

    return {
      platform: targetPlatform,
      content: adaptedContent.trim(),
      hashtags,
      characterCount: adaptedContent.trim().length,
    };
  }

  /**
   * Build repurposing prompt with platform-specific rules
   */
  private buildRepurposingPrompt(
    originalContent: string,
    targetPlatform: SocialPlatform,
    originalPlatform?: SocialPlatform,
    preserveHashtags?: boolean,
    preserveMentions?: boolean
  ): string {
    const platformRules = this.getPlatformRules(targetPlatform);
    
    let prompt = `Adapt the following social media content for ${targetPlatform}:\n\n`;
    prompt += `Original content: "${originalContent}"\n\n`;
    
    if (originalPlatform) {
      prompt += `Original platform: ${originalPlatform}\n`;
    }
    
    prompt += `Target platform: ${targetPlatform}\n\n`;
    prompt += `Platform-specific requirements:\n`;
    prompt += `- Tone: ${platformRules.tone}\n`;
    prompt += `- Style: ${platformRules.style}\n`;
    prompt += `- Character limit: ${platformRules.characterLimit}\n`;
    prompt += `- Emoji usage: ${platformRules.emojiUsage}\n`;
    prompt += `- Hashtag strategy: ${platformRules.hashtagStrategy}\n\n`;
    
    if (preserveHashtags) {
      prompt += `- Preserve existing hashtags if possible\n`;
    }
    
    if (preserveMentions) {
      prompt += `- Preserve @mentions if possible\n`;
    }
    
    prompt += `\nGenerate only the adapted content, no explanations or additional formatting.`;
    
    return prompt;
  }

  /**
   * Get platform-specific adaptation rules
   */
  private getPlatformRules(platform: SocialPlatform): {
    tone: string;
    style: string;
    characterLimit: number;
    emojiUsage: string;
    hashtagStrategy: string;
  } {
    switch (platform) {
      case SocialPlatform.TWITTER:
        return {
          tone: 'concise and punchy',
          style: 'short sentences, direct language',
          characterLimit: 280,
          emojiUsage: 'moderate, 1-2 emojis',
          hashtagStrategy: '1-2 relevant hashtags',
        };

      case SocialPlatform.LINKEDIN:
        return {
          tone: 'professional and insightful',
          style: 'longer form, thought leadership',
          characterLimit: 3000,
          emojiUsage: 'minimal, professional context only',
          hashtagStrategy: '3-5 industry-specific hashtags',
        };

      case SocialPlatform.INSTAGRAM:
        return {
          tone: 'engaging and visual',
          style: 'storytelling, conversational',
          characterLimit: 2200,
          emojiUsage: 'generous, 3-5 emojis',
          hashtagStrategy: '10-15 hashtags for discovery',
        };

      case SocialPlatform.FACEBOOK:
        return {
          tone: 'conversational and friendly',
          style: 'medium length, community-focused',
          characterLimit: 63206,
          emojiUsage: 'moderate, 2-3 emojis',
          hashtagStrategy: '2-3 hashtags, less important',
        };

      default:
        return {
          tone: 'neutral',
          style: 'standard',
          characterLimit: 500,
          emojiUsage: 'moderate',
          hashtagStrategy: '2-3 hashtags',
        };
    }
  }

  /**
   * Extract hashtags from content
   */
  private extractHashtags(content: string): string[] {
    const hashtagRegex = /#[\w]+/g;
    const matches = content.match(hashtagRegex);
    return matches || [];
  }

  /**
   * Validate platform version meets requirements
   */
  validatePlatformVersion(version: PlatformVersion): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const rules = this.getPlatformRules(version.platform);

    if (version.characterCount > rules.characterLimit) {
      errors.push(
        `Content exceeds ${version.platform} character limit (${version.characterCount}/${rules.characterLimit})`
      );
    }

    if (version.characterCount === 0) {
      errors.push('Content is empty');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
