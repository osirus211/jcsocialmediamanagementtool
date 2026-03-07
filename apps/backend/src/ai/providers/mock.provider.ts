/**
 * Mock AI Provider
 * For development and testing
 */

import { BaseAIProvider } from './base.provider';
import { AIProvider, AIProviderConfig } from '../types';

export class MockAIProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig = { provider: AIProvider.MOCK }) {
    super(config);
  }

  async generateCompletion(prompt: string, options?: any): Promise<string> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Generate mock content based on prompt keywords
    if (prompt.includes('caption') || prompt.includes('post')) {
      return this.generateMockCaption(prompt);
    }

    if (prompt.includes('hashtag')) {
      return this.generateMockHashtags(prompt);
    }

    if (prompt.includes('rewrite') || prompt.includes('improve')) {
      return this.generateMockRewrite(prompt);
    }

    if (prompt.includes('suggestion') || prompt.includes('CTA')) {
      return this.generateMockSuggestions(prompt);
    }

    return 'Mock AI response: This is a placeholder response for development.';
  }

  private generateMockCaption(prompt: string): string {
    const captions = [
      '🚀 Excited to share this amazing update with you all! What do you think? Let me know in the comments below! 💬',
      '✨ Here\'s something special we\'ve been working on. Can\'t wait to hear your thoughts! #Innovation #Growth',
      '💡 Quick tip: Success comes from consistent effort and smart strategy. What\'s your secret? Share below! 👇',
      '🎯 Ready to take your game to the next level? Here\'s what you need to know. Drop a 🔥 if you agree!',
      '🌟 Big announcement coming soon! Stay tuned for something incredible. Who\'s excited? 🙋‍♂️',
    ];

    return captions[Math.floor(Math.random() * captions.length)];
  }

  private generateMockHashtags(prompt: string): string {
    const hashtagSets = [
      '#SocialMedia #Marketing #ContentCreation #DigitalMarketing #GrowthHacking',
      '#Business #Entrepreneur #Success #Motivation #Leadership',
      '#Technology #Innovation #AI #FutureTech #Digital',
      '#Productivity #Tips #LifeHacks #Success #Goals',
      '#Community #Engagement #SocialGrowth #Networking #Connection',
    ];

    return hashtagSets[Math.floor(Math.random() * hashtagSets.length)];
  }

  private generateMockRewrite(prompt: string): string {
    return '✨ Improved version: This content has been optimized for better engagement and clarity. The message is now more compelling and action-oriented! 🚀';
  }

  private generateMockSuggestions(prompt: string): string {
    const suggestions = [
      '• Add a clear call-to-action\n• Include relevant emojis\n• Ask an engaging question\n• Share a personal story\n• Use power words',
      '• Post during peak hours (9-11 AM, 1-3 PM)\n• Use trending hashtags\n• Tag relevant accounts\n• Add visual content\n• Keep it concise',
      '• Start with a hook\n• Use numbers or statistics\n• Create urgency\n• Offer value upfront\n• End with engagement prompt',
    ];

    return suggestions[Math.floor(Math.random() * suggestions.length)];
  }

  getTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  getProviderName(): AIProvider {
    return AIProvider.MOCK;
  }

  getModelName(): string {
    return 'mock-model-v1';
  }
}
