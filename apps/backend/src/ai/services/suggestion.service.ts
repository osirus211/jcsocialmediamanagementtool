/**
 * Content Suggestion Service
 */

import { IAIProvider } from '../types';
import { SuggestionInput, SuggestionOutput } from '../types';
import { buildSuggestionPrompt } from '../prompts/suggestion.prompt';
import { logger } from '../../utils/logger';

export class SuggestionService {
  constructor(private provider: IAIProvider) {}

  async generateSuggestions(input: SuggestionInput): Promise<SuggestionOutput> {
    try {
      const prompt = buildSuggestionPrompt(input);
      
      logger.info('Generating suggestions', {
        provider: this.provider.getProviderName(),
        type: input.type,
      });

      const response = await this.provider.generateCompletion(prompt);
      const suggestions = this.parseSuggestions(response);
      const tokensUsed = this.provider.getTokenCount(prompt + response);

      return {
        suggestions,
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Suggestion generation error:', error);
      throw new Error(`Failed to generate suggestions: ${error.message}`);
    }
  }

  private parseSuggestions(response: string): string[] {
    // Parse numbered list or line-separated suggestions
    const lines = response
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Remove numbering (1., 2., etc.) if present
    return lines.map((line) => line.replace(/^\d+[\.\)]\s*/, '').trim());
  }

  async generateCTASuggestions(caption?: string, platform?: any): Promise<string[]> {
    const result = await this.generateSuggestions({
      caption,
      platform,
      type: 'cta',
    });
    return result.suggestions;
  }

  async generateHookSuggestions(caption?: string, platform?: any): Promise<string[]> {
    const result = await this.generateSuggestions({
      caption,
      platform,
      type: 'hook',
    });
    return result.suggestions;
  }

  async generateTimingSuggestions(platform?: any): Promise<string[]> {
    const result = await this.generateSuggestions({
      platform,
      type: 'timing',
    });
    return result.suggestions;
  }

  async generateStyleSuggestions(caption?: string, platform?: any): Promise<string[]> {
    const result = await this.generateSuggestions({
      caption,
      platform,
      type: 'style',
    });
    return result.suggestions;
  }
}
