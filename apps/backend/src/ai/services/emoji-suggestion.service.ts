/**
 * Emoji Suggestion Service
 * Suggests relevant emojis for content
 */

import { IAIProvider } from '../types';
import { SocialPlatform, ContentTone } from '../types';
import { logger } from '../../utils/logger';

export interface EmojiSuggestionInput {
  content: string;
  platform: SocialPlatform;
  tone: ContentTone;
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

export class EmojiSuggestionService {
  constructor(private provider: IAIProvider) {}

  async suggestEmojis(input: EmojiSuggestionInput): Promise<EmojiSuggestionOutput> {
    try {
      const prompt = this.buildEmojiPrompt(input);
      
      logger.info('Suggesting emojis', {
        provider: this.provider.getProviderName(),
        platform: input.platform,
        contentLength: input.content.length,
      });

      const response = await this.provider.generateCompletion(prompt);
      const tokensUsed = this.provider.getTokenCount(prompt + response);

      // Parse emojis from response
      const emojis = this.parseEmojis(response);

      return {
        emojis,
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Emoji suggestion error:', error);
      throw new Error(`Failed to suggest emojis: ${error.message}`);
    }
  }

  private buildEmojiPrompt(input: EmojiSuggestionInput): string {
    const { content, platform, tone, maxEmojis = 8 } = input;

    let prompt = `Suggest ${maxEmojis} relevant emojis for this ${platform} post with a ${tone} tone:

Content: "${content}"

Requirements:
- Choose emojis that match the content theme and emotion
- Consider the ${tone} tone
- Be appropriate for ${platform}
- Avoid overused or generic emojis when possible
- Include a mix of emotion, object, and action emojis
- Ensure cultural sensitivity

For each emoji, provide:
1. The emoji character
2. Brief description of why it's relevant
3. Relevance score (1-100)

Format as JSON:
{
  "suggestions": [
    {
      "emoji": "😊",
      "description": "Conveys positive emotion",
      "relevance": 85
    }
  ]
}`;

    return prompt;
  }

  private parseEmojis(response: string): EmojiSuggestionOutput['emojis'] {
    try {
      const parsed = JSON.parse(response);
      return parsed.suggestions || [];
    } catch {
      // Fallback parsing if JSON fails
      const lines = response.split('\n').filter(line => line.trim());
      const emojis: EmojiSuggestionOutput['emojis'] = [];

      for (const line of lines) {
        const emojiMatch = line.match(/([^\w\s])/);
        if (emojiMatch) {
          emojis.push({
            emoji: emojiMatch[1],
            description: line.replace(emojiMatch[1], '').trim(),
            relevance: Math.floor(Math.random() * 30) + 70, // Mock relevance
          });
        }
      }

      return emojis.slice(0, 8);
    }
  }
}