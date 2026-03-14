/**
 * Brand Voice Service
 * Analyzes and learns brand voice from sample content
 */

import { IAIProvider } from '../types';
import { BrandVoiceInput, BrandVoiceOutput } from '../types';
import { buildBrandVoicePrompt } from '../prompts/brand-voice.prompt';
import { logger } from '../../utils/logger';

export class BrandVoiceService {
  constructor(private provider: IAIProvider) {}

  async analyzeBrandVoice(input: BrandVoiceInput): Promise<BrandVoiceOutput> {
    try {
      const prompt = buildBrandVoicePrompt(input);
      
      logger.info('Analyzing brand voice', {
        provider: this.provider.getProviderName(),
        workspaceId: input.workspaceId,
        sampleCount: input.sampleContent.length,
      });

      const analysis = await this.provider.generateCompletion(prompt);
      const tokensUsed = this.provider.getTokenCount(prompt + analysis);

      // Parse the AI response to extract structured voice profile
      const voiceProfile = this.parseVoiceProfile(analysis);

      return {
        voiceProfile,
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Brand voice analysis error:', error);
      throw new Error(`Failed to analyze brand voice: ${error.message}`);
    }
  }

  private parseVoiceProfile(analysis: string): BrandVoiceOutput['voiceProfile'] {
    try {
      // Try to parse JSON response first
      const parsed = JSON.parse(analysis);
      return {
        tone: parsed.tone || 'professional',
        style: parsed.style || 'informative',
        vocabulary: parsed.vocabulary || [],
        phrases: parsed.phrases || [],
      };
    } catch {
      // Fallback to text parsing if JSON fails
      return {
        tone: this.extractTone(analysis),
        style: this.extractStyle(analysis),
        vocabulary: this.extractVocabulary(analysis),
        phrases: this.extractPhrases(analysis),
      };
    }
  }

  private extractTone(text: string): string {
    const toneMatch = text.match(/tone[:\s]+([^\n\r.]+)/i);
    return toneMatch ? toneMatch[1].trim() : 'professional';
  }

  private extractStyle(text: string): string {
    const styleMatch = text.match(/style[:\s]+([^\n\r.]+)/i);
    return styleMatch ? styleMatch[1].trim() : 'informative';
  }

  private extractVocabulary(text: string): string[] {
    const vocabMatch = text.match(/vocabulary[:\s]+([^\n\r]+)/i);
    if (vocabMatch) {
      return vocabMatch[1].split(',').map(word => word.trim()).filter(Boolean);
    }
    return [];
  }

  private extractPhrases(text: string): string[] {
    const phrasesMatch = text.match(/phrases[:\s]+([^\n\r]+)/i);
    if (phrasesMatch) {
      return phrasesMatch[1].split(',').map(phrase => phrase.trim()).filter(Boolean);
    }
    return [];
  }
}