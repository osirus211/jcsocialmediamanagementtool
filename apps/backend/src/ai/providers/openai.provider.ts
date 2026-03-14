/**
 * OpenAI Provider
 * Production-ready OpenAI integration
 */

import OpenAI from 'openai';
import { BaseAIProvider } from './base.provider';
import { AIProvider, AIProviderConfig } from '../types';
import { logger } from '../../utils/logger';

export class OpenAIProvider extends BaseAIProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: AIProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: this.getTimeout(),
    });

    this.model = config.model || 'gpt-3.5-turbo';
  }

  async generateCompletion(prompt: string, options?: any): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional social media content creator. Generate engaging, platform-optimized content.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: options?.maxTokens || this.getMaxTokens(),
        temperature: options?.temperature || this.getTemperature(),
        ...options,
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content generated');
      }

      return content.trim();
    } catch (error: any) {
      logger.error('OpenAI generation error:', error);
      throw new Error(`OpenAI error: ${error.message}`);
    }
  }

  async generateVisionCompletion(prompt: string, imageUrl: string, options?: any): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a professional social media content creator. Analyze images and generate engaging, platform-optimized captions.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: options?.detail || 'auto',
                },
              },
            ],
          },
        ],
        max_tokens: options?.maxTokens || this.getMaxTokens(),
        temperature: options?.temperature || this.getTemperature(),
        ...options,
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content generated');
      }

      return content.trim();
    } catch (error: any) {
      logger.error('OpenAI vision generation error:', error);
      throw new Error(`OpenAI vision error: ${error.message}`);
    }
  }

  getTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token
    // For production, use tiktoken library
    return Math.ceil(text.length / 4);
  }

  getProviderName(): AIProvider {
    return AIProvider.OPENAI;
  }

  getModelName(): string {
    return this.model;
  }
}
