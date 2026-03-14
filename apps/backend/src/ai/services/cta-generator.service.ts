/**
 * CTA (Call-to-Action) Generator Service
 * Generates compelling call-to-action phrases
 */

import { IAIProvider } from '../types';
import { SocialPlatform, ContentTone } from '../types';
import { logger } from '../../utils/logger';

export interface CTAGenerationInput {
  platform: SocialPlatform;
  tone: ContentTone;
  objective: 'engagement' | 'conversion' | 'traffic' | 'awareness' | 'sales';
  context?: string;
}

export interface CTAGenerationOutput {
  ctas: string[];
  tokensUsed: number;
  provider: string;
  model: string;
}

export class CTAGeneratorService {
  constructor(private provider: IAIProvider) {}

  async generateCTAs(input: CTAGenerationInput): Promise<CTAGenerationOutput> {
    try {
      const prompt = this.buildCTAPrompt(input);
      
      logger.info('Generating CTAs', {
        provider: this.provider.getProviderName(),
        platform: input.platform,
        objective: input.objective,
      });

      const response = await this.provider.generateCompletion(prompt);
      const tokensUsed = this.provider.getTokenCount(prompt + response);

      // Parse CTAs from response
      const ctas = this.parseCTAs(response);

      return {
        ctas,
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('CTA generation error:', error);
      throw new Error(`Failed to generate CTAs: ${error.message}`);
    }
  }

  private buildCTAPrompt(input: CTAGenerationInput): string {
    const { platform, tone, objective, context } = input;

    let prompt = `Generate 5 compelling call-to-action (CTA) phrases for ${platform} that are ${tone} in tone and designed to drive ${objective}.

Platform: ${platform}
Tone: ${tone}
Objective: ${objective}

Requirements:
- Each CTA should be short and actionable (2-6 words)
- Match the ${tone} tone
- Be optimized for ${platform}
- Drive ${objective}
- Use action verbs
- Create urgency when appropriate
- Be engaging and clickable`;

    if (context) {
      prompt += `\n\nContext: ${context}`;
    }

    prompt += `\n\nReturn only the CTA phrases, one per line, without numbers or bullets.`;

    return prompt;
  }

  private parseCTAs(response: string): string[] {
    return response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^\d+\./) && !line.startsWith('-'))
      .slice(0, 5); // Limit to 5 CTAs
  }
}