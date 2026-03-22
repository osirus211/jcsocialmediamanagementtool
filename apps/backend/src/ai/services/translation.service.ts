/**
 * Translation Service
 */

import { IAIProvider } from '../types';
import { TranslationInput, buildTranslationPrompt } from '../prompts/translation.prompt';
import { logger } from '../../utils/logger';
import { scrubPii } from '../../utils/piiScrubber';

export interface TranslationOutput {
  translatedContent: string;
  targetLanguage: string;
  sourceLanguage?: string;
  tokensUsed: number;
  provider: string;
  model: string;
}

export const SUPPORTED_LANGUAGES = [
  'Arabic', 'Chinese (Simplified)', 'Chinese (Traditional)',
  'Dutch', 'French', 'German', 'Hindi', 'Indonesian',
  'Italian', 'Japanese', 'Korean', 'Polish', 'Portuguese',
  'Russian', 'Spanish', 'Swedish', 'Thai', 'Turkish',
  'Ukrainian', 'Vietnamese',
];

export class TranslationService {
  constructor(private provider: IAIProvider) {}

  async translate(input: TranslationInput): Promise<TranslationOutput> {
    try {
      if (!SUPPORTED_LANGUAGES.includes(input.targetLanguage)) {
        throw new Error(`Unsupported target language: ${input.targetLanguage}`);
      }

      // Scrub PII before sending to AI provider
      const safeContent = scrubPii(input.content.trim().slice(0, 5000));

      const prompt = buildTranslationPrompt({ ...input, content: safeContent });

      logger.info('Translating content', {
        provider: this.provider.getProviderName(),
        targetLanguage: input.targetLanguage,
        platform: input.platform,
        contentLength: safeContent.length,
      });

      const translated = await this.provider.generateCompletion(prompt);
      const tokensUsed = this.provider.getTokenCount(prompt + translated);

      return {
        translatedContent: translated.trim(),
        targetLanguage: input.targetLanguage,
        sourceLanguage: input.sourceLanguage,
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Translation failed', { error: error.message });
      throw error;
    }
  }
}
