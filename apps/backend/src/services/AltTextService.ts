/**
 * Alt Text Service
 * 
 * Provides AI-powered alt text generation and validation
 * Supports WCAG 2.1 compliance and platform-specific optimization
 */

import { logger } from '../utils/logger';
import OpenAI from 'openai';

export interface AltTextValidationResult {
  valid: boolean;
  score: number; // 0-100 quality score
  issues: string[];
  suggestions: string[];
}

export interface AltTextGenerationOptions {
  platform?: string;
  context?: string;
  style?: 'descriptive' | 'seo' | 'concise';
  maxLength?: number;
}

export class AltTextService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate AI-powered alt text for an image
   */
  async generateAltText(imageUrl: string, options: AltTextGenerationOptions = {}): Promise<string> {
    const { platform = 'general', context = '', style = 'descriptive', maxLength = 1000 } = options;

    try {
      const prompt = this.buildPrompt(platform, context, style, maxLength);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
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
                },
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.3,
      });

      const altText = response.choices[0]?.message?.content?.trim() || '';
      
      // Ensure it meets length requirements
      if (altText.length > maxLength) {
        return altText.substring(0, maxLength - 3) + '...';
      }

      logger.info('Alt text generated successfully', {
        platform,
        style,
        length: altText.length,
      });

      return altText;
    } catch (error: any) {
      logger.error('Failed to generate alt text', {
        error: error.message,
        imageUrl: imageUrl.substring(0, 100),
      });
      throw new Error('Failed to generate alt text');
    }
  }

  /**
   * Generate multiple alt text variations
   */
  async getAltTextSuggestions(imageUrl: string, options: AltTextGenerationOptions = {}): Promise<string[]> {
    const suggestions: string[] = [];

    try {
      // Generate 3 different styles
      const styles: Array<'descriptive' | 'seo' | 'concise'> = ['descriptive', 'seo', 'concise'];
      
      for (const style of styles) {
        const altText = await this.generateAltText(imageUrl, { ...options, style });
        suggestions.push(altText);
      }

      return suggestions;
    } catch (error: any) {
      logger.error('Failed to generate alt text suggestions', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Validate alt text quality and WCAG compliance
   */
  validateAltText(text: string, platform?: string): AltTextValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check if empty
    if (!text || text.trim().length === 0) {
      issues.push('Alt text is empty');
      score -= 50;
    }

    // Check for common bad practices
    if (text.toLowerCase().startsWith('image of') || text.toLowerCase().startsWith('photo of')) {
      issues.push('Avoid starting with "Image of" or "Photo of"');
      suggestions.push('Start directly with the description');
      score -= 15;
    }

    if (text.toLowerCase().startsWith('picture of') || text.toLowerCase().startsWith('pic of')) {
      issues.push('Avoid starting with "Picture of" or "Pic of"');
      suggestions.push('Start directly with the description');
      score -= 15;
    }

    // Check if it's just a filename
    if (/\.(jpg|jpeg|png|gif|webp|mp4|mov)$/i.test(text)) {
      issues.push('Alt text appears to be a filename');
      suggestions.push('Describe what\'s actually in the image');
      score -= 30;
    }

    // Check length appropriateness
    if (text.length < 10) {
      issues.push('Alt text is too short to be descriptive');
      suggestions.push('Add more detail about what\'s in the image');
      score -= 20;
    }

    // Platform-specific validation
    if (platform) {
      const platformLimits = this.getPlatformLimits(platform);
      if (text.length > platformLimits.maxLength) {
        issues.push(`Alt text exceeds ${platform} limit of ${platformLimits.maxLength} characters`);
        suggestions.push(`Shorten to ${platformLimits.maxLength} characters or less`);
        score -= 25;
      }
    }

    // Check for accessibility best practices
    if (text.includes('click here') || text.includes('see more')) {
      issues.push('Avoid action words like "click here" in alt text');
      suggestions.push('Focus on describing the visual content');
      score -= 10;
    }

    // Check for redundant words
    const redundantPhrases = ['this image shows', 'the image contains', 'you can see'];
    for (const phrase of redundantPhrases) {
      if (text.toLowerCase().includes(phrase)) {
        issues.push(`Avoid redundant phrase: "${phrase}"`);
        suggestions.push('Be more direct in your description');
        score -= 5;
      }
    }

    // Positive scoring for good practices
    if (text.length >= 20 && text.length <= 125) {
      score += 5; // Good length range
    }

    if (/[.!?]$/.test(text)) {
      score += 5; // Proper sentence ending
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    return {
      valid: issues.length === 0,
      score,
      issues,
      suggestions,
    };
  }

  /**
   * Get platform-specific alt text limits and requirements
   */
  getPlatformLimits(platform: string) {
    const limits: Record<string, { maxLength: number; recommendations: string[] }> = {
      instagram: {
        maxLength: 100,
        recommendations: ['Keep it concise', 'Include relevant hashtags in caption, not alt text'],
      },
      twitter: {
        maxLength: 1000,
        recommendations: ['Be descriptive but concise', 'Include text visible in image'],
      },
      linkedin: {
        maxLength: 300,
        recommendations: ['Professional tone', 'Include business context if relevant'],
      },
      facebook: {
        maxLength: 255,
        recommendations: ['Conversational tone', 'Include emotional context'],
      },
      pinterest: {
        maxLength: 500,
        recommendations: ['SEO-friendly', 'Include keywords naturally'],
      },
      tiktok: {
        maxLength: 150,
        recommendations: ['Short and engaging', 'Match video content'],
      },
    };

    return limits[platform] || { maxLength: 1000, recommendations: [] };
  }

  /**
   * Build AI prompt for alt text generation
   */
  private buildPrompt(platform: string, context: string, style: string, maxLength: number): string {
    const basePrompt = `Generate alt text for this image that follows WCAG 2.1 accessibility guidelines.`;
    
    const styleInstructions = {
      descriptive: 'Be detailed and descriptive, focusing on visual elements, colors, composition, and any text visible in the image.',
      seo: 'Be SEO-friendly while remaining accessible, naturally incorporating relevant keywords.',
      concise: 'Be brief but informative, capturing the essential elements in fewer words.',
    };

    const platformInstructions = {
      instagram: 'Optimize for Instagram (max 100 chars). Be engaging and social media friendly.',
      twitter: 'Optimize for Twitter/X. Include any text visible in the image.',
      linkedin: 'Optimize for LinkedIn with a professional tone.',
      facebook: 'Optimize for Facebook with a conversational tone.',
      pinterest: 'Optimize for Pinterest with SEO keywords.',
      tiktok: 'Optimize for TikTok, keep it short and engaging.',
    };

    let prompt = basePrompt;
    
    if (styleInstructions[style as keyof typeof styleInstructions]) {
      prompt += ` ${styleInstructions[style as keyof typeof styleInstructions]}`;
    }

    if (platformInstructions[platform as keyof typeof platformInstructions]) {
      prompt += ` ${platformInstructions[platform as keyof typeof platformInstructions]}`;
    }

    if (context) {
      prompt += ` Context: ${context}`;
    }

    prompt += ` Maximum length: ${maxLength} characters.`;
    prompt += ` Rules: Don't start with "Image of" or "Photo of". Don't include redundant phrases. Be specific and helpful for screen reader users.`;

    return prompt;
  }

  /**
   * Get accessibility score for a post based on alt text coverage
   */
  getAccessibilityScore(mediaCount: number, altTextCount: number): {
    score: number;
    level: 'poor' | 'good' | 'excellent';
    message: string;
  } {
    if (mediaCount === 0) {
      return {
        score: 100,
        level: 'excellent',
        message: 'No images to describe',
      };
    }

    const coverage = altTextCount / mediaCount;
    const score = Math.round(coverage * 100);

    if (score === 100) {
      return {
        score,
        level: 'excellent',
        message: 'All images have alt text',
      };
    } else if (score >= 50) {
      return {
        score,
        level: 'good',
        message: `${altTextCount}/${mediaCount} images have alt text`,
      };
    } else {
      return {
        score,
        level: 'poor',
        message: `Only ${altTextCount}/${mediaCount} images have alt text`,
      };
    }
  }
}