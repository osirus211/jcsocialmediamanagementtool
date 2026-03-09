/**
 * Reply Suggestion Service
 * 
 * Generates suggested replies for comments and messages
 * Integrates with SocialListening mentions
 */

import { IAIProvider } from '../types';
import { logger } from '../../utils/logger';

export interface ReplySuggestionInput {
  originalMessage: string;
  context?: string;
  platform: string;
  tone?: 'professional' | 'friendly' | 'casual' | 'humorous';
  maxLength?: number;
}

export interface ReplySuggestionOutput {
  suggestions: string[];
  tokensUsed: number;
  provider: string;
  model: string;
}

export class ReplySuggestionService {
  constructor(private provider: IAIProvider) {}

  /**
   * Generate reply suggestions
   */
  async generateReplySuggestions(
    input: ReplySuggestionInput
  ): Promise<ReplySuggestionOutput> {
    try {
      logger.info('Generating reply suggestions', {
        provider: this.provider.getProviderName(),
        platform: input.platform,
        tone: input.tone || 'friendly',
      });

      const prompt = this.buildReplyPrompt(input);
      const response = await this.provider.generateCompletion(prompt);
      const tokensUsed = this.provider.getTokenCount(prompt + response);

      // Parse suggestions (expecting numbered list)
      const suggestions = this.parseSuggestions(response);

      return {
        suggestions,
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Reply suggestion error:', error);
      throw new Error(`Failed to generate reply suggestions: ${error.message}`);
    }
  }

  /**
   * Build reply prompt
   */
  private buildReplyPrompt(input: ReplySuggestionInput): string {
    const tone = input.tone || 'friendly';
    const maxLength = input.maxLength || 280;

    let prompt = `Generate 3 suggested replies to the following ${input.platform} message:\n\n`;
    prompt += `Message: "${input.originalMessage}"\n\n`;
    
    if (input.context) {
      prompt += `Context: ${input.context}\n\n`;
    }
    
    prompt += `Requirements:\n`;
    prompt += `- Tone: ${tone}\n`;
    prompt += `- Maximum length: ${maxLength} characters per reply\n`;
    prompt += `- Platform: ${input.platform}\n`;
    prompt += `- Be helpful, engaging, and authentic\n`;
    prompt += `- Avoid generic responses\n\n`;
    prompt += `Format: Provide exactly 3 replies, numbered 1-3, one per line.`;

    return prompt;
  }

  /**
   * Parse suggestions from AI response
   */
  private parseSuggestions(response: string): string[] {
    const lines = response.split('\n').filter((line) => line.trim().length > 0);
    const suggestions: string[] = [];

    lines.forEach((line) => {
      // Remove numbering (1., 2., 3., etc.)
      const cleaned = line.replace(/^\d+[\.\)]\s*/, '').trim();
      if (cleaned.length > 0) {
        suggestions.push(cleaned);
      }
    });

    // Ensure we have at least 3 suggestions
    while (suggestions.length < 3) {
      suggestions.push('Thank you for your message!');
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Generate reply for specific sentiment
   */
  async generateSentimentAwareReply(
    input: ReplySuggestionInput,
    sentiment: 'positive' | 'negative' | 'neutral'
  ): Promise<ReplySuggestionOutput> {
    const enhancedInput = {
      ...input,
      context: `${input.context || ''} The message has a ${sentiment} sentiment.`.trim(),
    };

    // Adjust tone based on sentiment
    if (sentiment === 'negative' && !input.tone) {
      enhancedInput.tone = 'professional';
    } else if (sentiment === 'positive' && !input.tone) {
      enhancedInput.tone = 'friendly';
    }

    return this.generateReplySuggestions(enhancedInput);
  }
}
