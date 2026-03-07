/**
 * Hashtag Generation Service
 */

import { IAIProvider } from '../types';
import { HashtagGenerationInput, HashtagGenerationOutput } from '../types';
import { buildHashtagPrompt } from '../prompts/hashtag.prompt';
import { logger } from '../../utils/logger';

export class HashtagService {
  constructor(private provider: IAIProvider) {}

  async generateHashtags(input: HashtagGenerationInput): Promise<HashtagGenerationOutput> {
    try {
      const prompt = buildHashtagPrompt(input);
      
      logger.info('Generating hashtags', {
        provider: this.provider.getProviderName(),
        platform: input.platform,
      });

      const response = await this.provider.generateCompletion(prompt);
      const hashtags = this.parseHashtags(response);
      const tokensUsed = this.provider.getTokenCount(prompt + response);

      return {
        hashtags,
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Hashtag generation error:', error);
      throw new Error(`Failed to generate hashtags: ${error.message}`);
    }
  }

  private parseHashtags(response: string): string[] {
    // Extract hashtags from response
    const hashtagRegex = /#[\w]+/g;
    const matches = response.match(hashtagRegex);

    if (!matches || matches.length === 0) {
      // Fallback: split by spaces and add # if missing
      return response
        .split(/\s+/)
        .filter((tag) => tag.trim().length > 0)
        .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
        .filter((tag) => tag.length > 1);
    }

    return matches;
  }

  extractHashtagsFromContent(content: string): string[] {
    const hashtagRegex = /#[\w]+/g;
    const matches = content.match(hashtagRegex);
    return matches || [];
  }
}
