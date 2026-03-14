/**
 * Image Caption Generation Service
 * Generates captions from images using vision AI
 */

import { IAIProvider } from '../types';
import { ImageCaptionInput, ImageCaptionOutput } from '../types';
import { buildImageCaptionPrompt } from '../prompts/image-caption.prompt';
import { logger } from '../../utils/logger';

export class ImageCaptionService {
  constructor(private provider: IAIProvider) {}

  async generateCaptionFromImage(input: ImageCaptionInput): Promise<ImageCaptionOutput> {
    try {
      if (!this.provider.generateVisionCompletion) {
        throw new Error('Vision capabilities not supported by current AI provider');
      }

      const prompt = buildImageCaptionPrompt(input);
      
      logger.info('Generating caption from image', {
        provider: this.provider.getProviderName(),
        platform: input.platform,
        tone: input.tone,
        imageUrl: input.imageUrl.substring(0, 50) + '...',
      });

      const caption = await this.provider.generateVisionCompletion(prompt, input.imageUrl);
      const tokensUsed = this.provider.getTokenCount(prompt + caption);

      return {
        caption: caption.trim(),
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Image caption generation error:', error);
      throw new Error(`Failed to generate caption from image: ${error.message}`);
    }
  }

  async generateMultipleCaptionsFromImage(
    input: ImageCaptionInput,
    count: number = 3
  ): Promise<ImageCaptionOutput[]> {
    const results: ImageCaptionOutput[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const result = await this.generateCaptionFromImage(input);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to generate image caption ${i + 1}:`, error);
        // Continue with other generations
      }
    }

    return results;
  }
}