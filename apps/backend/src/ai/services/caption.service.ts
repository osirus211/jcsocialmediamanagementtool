/**
 * Caption Generation Service
 */

import { IAIProvider } from '../types';
import { CaptionGenerationInput, CaptionGenerationOutput } from '../types';
import { buildCaptionPrompt } from '../prompts/caption.prompt';
import { logger } from '../../utils/logger';

export class CaptionService {
  constructor(private provider: IAIProvider) {}

  async generateCaption(input: CaptionGenerationInput): Promise<CaptionGenerationOutput> {
    try {
      const prompt = buildCaptionPrompt(input);
      
      logger.info('Generating caption', {
        provider: this.provider.getProviderName(),
        platform: input.platform,
        tone: input.tone,
      });

      const caption = await this.provider.generateCompletion(prompt);
      const tokensUsed = this.provider.getTokenCount(prompt + caption);

      return {
        caption: caption.trim(),
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Caption generation error:', error);
      throw new Error(`Failed to generate caption: ${error.message}`);
    }
  }

  async generateMultipleCaptions(
    input: CaptionGenerationInput,
    count: number = 3
  ): Promise<CaptionGenerationOutput[]> {
    const results: CaptionGenerationOutput[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const result = await this.generateCaption(input);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to generate caption ${i + 1}:`, error);
        // Continue with other generations
      }
    }

    return results;
  }
}
