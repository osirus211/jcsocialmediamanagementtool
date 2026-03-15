/**
 * AI Image Generation Service
 * DALL-E 3 integration for superior image generation
 * Beats all competitors: Buffer, Hootsuite, Sprout Social, Later
 */

import OpenAI from 'openai';
import { BaseAIProvider } from '../providers/base.provider';
import { AIProvider, AIProviderConfig, IAIProvider } from '../types';
import { logger } from '../../utils/logger';
import { MediaService } from '../../services/MediaService';

export interface ImageGenerationInput {
  prompt: string;
  size: '1024x1024' | '1024x1792' | '1792x1024';
  quality: 'standard' | 'hd';
  style: 'vivid' | 'natural';
  workspaceId: string;
  userId: string;
}

export interface ImageGenerationOutput {
  imageUrl: string;
  revisedPrompt: string;
  mediaId: string;
  size: string;
  quality: string;
  style: string;
  tokensUsed: number;
  provider: AIProvider;
  model: string;
  cost: number;
}

export interface ImageVariationInput {
  imageUrl: string;
  size: '1024x1024' | '1024x1792' | '1792x1024';
  workspaceId: string;
  userId: string;
}

export interface ImageVariationOutput {
  imageUrl: string;
  mediaId: string;
  size: string;
  tokensUsed: number;
  provider: AIProvider;
  model: string;
  cost: number;
}

export interface ImageGenerationHistory {
  _id: string;
  workspaceId: string;
  userId: string;
  prompt: string;
  revisedPrompt: string;
  imageUrl: string;
  mediaId: string;
  size: string;
  quality: string;
  style: string;
  cost: number;
  createdAt: Date;
}

export class ImageGenService {
  private client: OpenAI;
  private model: string = 'dall-e-3';

  constructor(private provider: IAIProvider) {
    // Get the API key from the provider
    let apiKey: string;
    
    if ('config' in provider && (provider as any).config?.apiKey) {
      apiKey = (provider as any).config.apiKey;
    } else {
      throw new Error('OpenAI API key is required for image generation');
    }

    this.client = new OpenAI({
      apiKey,
      timeout: 60000, // 60 seconds for image generation
    });
  }

  /**
   * Generate image using DALL-E 3
   * Superior to all competitors - they don't have this feature!
   */
  async generateImage(input: ImageGenerationInput): Promise<ImageGenerationOutput> {
    try {
      logger.info('Generating image with DALL-E 3', { 
        prompt: input.prompt.substring(0, 100),
        size: input.size,
        quality: input.quality,
        style: input.style 
      });

      const response = await this.client.images.generate({
        model: this.model,
        prompt: input.prompt,
        size: input.size,
        quality: input.quality,
        style: input.style,
        n: 1,
        response_format: 'url',
      });

      const imageData = response.data[0];
      if (!imageData?.url) {
        throw new Error('No image generated');
      }

      // Save generated image to media library
      const mediaService = MediaService.getInstance();
      const mediaResponse = await mediaService.saveFromUrl({
        url: imageData.url,
        filename: `ai-generated-${Date.now()}.png`,
        workspaceId: input.workspaceId,
        userId: input.userId,
        source: 'ai-generation',
        metadata: {
          prompt: input.prompt,
          revisedPrompt: imageData.revised_prompt,
          model: this.model,
          size: input.size,
          quality: input.quality,
          style: input.style,
        },
      });

      // Calculate cost (DALL-E 3 pricing)
      const cost = this.calculateImageCost(input.size, input.quality);

      // Save to generation history
      await this.saveGenerationHistory({
        workspaceId: input.workspaceId,
        userId: input.userId,
        prompt: input.prompt,
        revisedPrompt: imageData.revised_prompt || input.prompt,
        imageUrl: imageData.url,
        mediaId: mediaResponse._id.toString(),
        size: input.size,
        quality: input.quality,
        style: input.style,
        cost,
      });

      return {
        imageUrl: imageData.url,
        revisedPrompt: imageData.revised_prompt || input.prompt,
        mediaId: mediaResponse._id.toString(),
        size: input.size,
        quality: input.quality,
        style: input.style,
        tokensUsed: 0, // DALL-E doesn't use tokens
        provider: AIProvider.OPENAI,
        model: this.model,
        cost,
      };
    } catch (error: any) {
      logger.error('DALL-E 3 image generation error:', error);
      throw new Error(`Image generation failed: ${error.message}`);
    }
  }

  /**
   * Generate image variation using DALL-E 2 (DALL-E 3 doesn't support variations)
   */
  async generateImageVariation(input: ImageVariationInput): Promise<ImageVariationOutput> {
    try {
      logger.info('Generating image variation with DALL-E 2', { 
        imageUrl: input.imageUrl.substring(0, 100),
        size: input.size 
      });

      // Convert image URL to buffer for OpenAI API
      const imageResponse = await fetch(input.imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      
      // Create a proper File-like object for the API
      const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
      const imageFile = new File([imageBlob], 'image.png', { type: 'image/png' });

      // Map size to DALL-E 2 supported sizes
      let dalleSize: '1024x1024' | '512x512' | '256x256' = '1024x1024';
      if (input.size === '1024x1024') dalleSize = '1024x1024';
      else dalleSize = '512x512'; // Fallback for unsupported sizes

      const response = await this.client.images.createVariation({
        model: 'dall-e-2', // Only DALL-E 2 supports variations
        image: imageFile,
        size: dalleSize,
        n: 1,
        response_format: 'url',
      });

      const imageData = response.data[0];
      if (!imageData?.url) {
        throw new Error('No variation generated');
      }

      // Save variation to media library
      const mediaService = MediaService.getInstance();
      const mediaResponse = await mediaService.saveFromUrl({
        url: imageData.url,
        filename: `ai-variation-${Date.now()}.png`,
        workspaceId: input.workspaceId,
        userId: input.userId,
        source: 'ai-variation',
        metadata: {
          originalImageUrl: input.imageUrl,
          model: 'dall-e-2',
          size: input.size,
        },
      });

      // Calculate cost (DALL-E 2 pricing for variations)
      const cost = this.calculateVariationCost(input.size);

      return {
        imageUrl: imageData.url,
        mediaId: mediaResponse._id.toString(),
        size: input.size,
        tokensUsed: 0,
        provider: AIProvider.OPENAI,
        model: 'dall-e-2',
        cost,
      };
    } catch (error: any) {
      logger.error('DALL-E 2 image variation error:', error);
      throw new Error(`Image variation failed: ${error.message}`);
    }
  }

  /**
   * Get image generation history for workspace
   */
  async getGenerationHistory(workspaceId: string, limit: number = 10): Promise<ImageGenerationHistory[]> {
    try {
      const mongoose = await import('mongoose');
      
      const history = await mongoose.connection.db.collection('image_generation_history')
        .find({ workspaceId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      return history as unknown as ImageGenerationHistory[];
    } catch (error: any) {
      logger.error('Error fetching generation history:', error);
      throw new Error('Failed to fetch generation history');
    }
  }

  /**
   * Calculate DALL-E 3 image generation cost
   */
  private calculateImageCost(size: string, quality: string): number {
    // DALL-E 3 pricing (as of 2024)
    const pricing = {
      '1024x1024': { standard: 0.040, hd: 0.080 },
      '1024x1792': { standard: 0.080, hd: 0.120 },
      '1792x1024': { standard: 0.080, hd: 0.120 },
    };

    return pricing[size as keyof typeof pricing]?.[quality as 'standard' | 'hd'] || 0.040;
  }

  /**
   * Calculate DALL-E 2 variation cost
   */
  private calculateVariationCost(size: string): number {
    // DALL-E 2 pricing (as of 2024)
    const pricing = {
      '1024x1024': 0.020,
      '1024x1792': 0.018,
      '1792x1024': 0.018,
    };

    return pricing[size as keyof typeof pricing] || 0.020;
  }

  /**
   * Save generation to history
   */
  private async saveGenerationHistory(data: Omit<ImageGenerationHistory, '_id' | 'createdAt'>): Promise<void> {
    try {
      const mongoose = await import('mongoose');
      
      await mongoose.connection.db.collection('image_generation_history').insertOne({
        ...data,
        createdAt: new Date(),
      });
    } catch (error: any) {
      logger.error('Error saving generation history:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get usage statistics for workspace
   */
  async getUsageStats(workspaceId: string, days: number = 30): Promise<{
    totalGenerations: number;
    totalCost: number;
    averageCostPerImage: number;
    mostUsedSize: string;
    mostUsedQuality: string;
    mostUsedStyle: string;
  }> {
    try {
      const mongoose = await import('mongoose');
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await mongoose.connection.db.collection('image_generation_history').aggregate([
        {
          $match: {
            workspaceId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalGenerations: { $sum: 1 },
            totalCost: { $sum: '$cost' },
            sizes: { $push: '$size' },
            qualities: { $push: '$quality' },
            styles: { $push: '$style' }
          }
        }
      ]).toArray();

      if (!stats.length) {
        return {
          totalGenerations: 0,
          totalCost: 0,
          averageCostPerImage: 0,
          mostUsedSize: '1024x1024',
          mostUsedQuality: 'standard',
          mostUsedStyle: 'vivid',
        };
      }

      const stat = stats[0];
      
      // Find most used values
      const mostUsedSize = this.getMostFrequent(stat.sizes) || '1024x1024';
      const mostUsedQuality = this.getMostFrequent(stat.qualities) || 'standard';
      const mostUsedStyle = this.getMostFrequent(stat.styles) || 'vivid';

      return {
        totalGenerations: stat.totalGenerations,
        totalCost: stat.totalCost,
        averageCostPerImage: stat.totalCost / stat.totalGenerations,
        mostUsedSize,
        mostUsedQuality,
        mostUsedStyle,
      };
    } catch (error: any) {
      logger.error('Error fetching usage stats:', error);
      throw new Error('Failed to fetch usage statistics');
    }
  }

  /**
   * Helper to find most frequent value in array
   */
  private getMostFrequent(arr: string[]): string | null {
    if (!arr.length) return null;
    
    const frequency: Record<string, number> = {};
    arr.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
    });

    return Object.keys(frequency).reduce((a, b) => 
      frequency[a] > frequency[b] ? a : b
    );
  }
}