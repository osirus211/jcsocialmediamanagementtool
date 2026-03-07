/**
 * Content Rewrite Service
 */

import { IAIProvider } from '../types';
import { RewriteInput, RewriteOutput } from '../types';
import {
  buildRewritePrompt,
  buildImprovePrompt,
  buildShortenPrompt,
  buildExpandPrompt,
} from '../prompts/rewrite.prompt';
import { logger } from '../../utils/logger';

export class RewriteService {
  constructor(private provider: IAIProvider) {}

  async rewrite(input: RewriteInput): Promise<RewriteOutput> {
    try {
      const prompt = buildRewritePrompt(input);
      
      logger.info('Rewriting content', {
        provider: this.provider.getProviderName(),
        instruction: input.instruction,
      });

      const rewrittenContent = await this.provider.generateCompletion(prompt);
      const tokensUsed = this.provider.getTokenCount(prompt + rewrittenContent);

      return {
        rewrittenContent: rewrittenContent.trim(),
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Rewrite error:', error);
      throw new Error(`Failed to rewrite content: ${error.message}`);
    }
  }

  async improve(content: string, platform?: any): Promise<RewriteOutput> {
    try {
      const prompt = buildImprovePrompt(content, platform);
      
      logger.info('Improving content', {
        provider: this.provider.getProviderName(),
      });

      const rewrittenContent = await this.provider.generateCompletion(prompt);
      const tokensUsed = this.provider.getTokenCount(prompt + rewrittenContent);

      return {
        rewrittenContent: rewrittenContent.trim(),
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Improve error:', error);
      throw new Error(`Failed to improve content: ${error.message}`);
    }
  }

  async shorten(content: string, maxLength: number): Promise<RewriteOutput> {
    try {
      const prompt = buildShortenPrompt(content, maxLength);
      
      logger.info('Shortening content', {
        provider: this.provider.getProviderName(),
        maxLength,
      });

      const rewrittenContent = await this.provider.generateCompletion(prompt);
      const tokensUsed = this.provider.getTokenCount(prompt + rewrittenContent);

      return {
        rewrittenContent: rewrittenContent.trim(),
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Shorten error:', error);
      throw new Error(`Failed to shorten content: ${error.message}`);
    }
  }

  async expand(content: string): Promise<RewriteOutput> {
    try {
      const prompt = buildExpandPrompt(content);
      
      logger.info('Expanding content', {
        provider: this.provider.getProviderName(),
      });

      const rewrittenContent = await this.provider.generateCompletion(prompt);
      const tokensUsed = this.provider.getTokenCount(prompt + rewrittenContent);

      return {
        rewrittenContent: rewrittenContent.trim(),
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Expand error:', error);
      throw new Error(`Failed to expand content: ${error.message}`);
    }
  }
}
