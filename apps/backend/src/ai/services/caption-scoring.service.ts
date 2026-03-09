/**
 * Caption Scoring Service
 * 
 * Evaluates caption quality on a 0-100 scale
 * Considers sentiment, keywords, hashtags, and historical performance
 */

import { PostAnalytics } from '../../models/PostAnalytics';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

export interface CaptionScoringInput {
  workspaceId: string;
  platform: string;
  caption: string;
  hashtags?: string[];
}

export interface CaptionScoringOutput {
  overallScore: number; // 0-100
  breakdown: {
    sentiment: number;
    length: number;
    readability: number;
    hashtagQuality: number;
    keywordDensity: number;
  };
  suggestions: string[];
}

export class CaptionScoringService {
  /**
   * Score a caption
   */
  static async scoreCaption(
    input: CaptionScoringInput
  ): Promise<CaptionScoringOutput> {
    try {
      logger.info('Scoring caption', {
        workspaceId: input.workspaceId,
        platform: input.platform,
        captionLength: input.caption.length,
      });

      const breakdown = {
        sentiment: this.scoreSentiment(input.caption),
        length: this.scoreLength(input.caption, input.platform),
        readability: this.scoreReadability(input.caption),
        hashtagQuality: this.scoreHashtags(input.hashtags || [], input.platform),
        keywordDensity: this.scoreKeywordDensity(input.caption),
      };

      // Weighted average
      const overallScore = Math.round(
        breakdown.sentiment * 0.25 +
        breakdown.length * 0.20 +
        breakdown.readability * 0.25 +
        breakdown.hashtagQuality * 0.15 +
        breakdown.keywordDensity * 0.15
      );

      const suggestions = this.generateSuggestions(breakdown, input);

      return {
        overallScore,
        breakdown,
        suggestions,
      };
    } catch (error: any) {
      logger.error('Caption scoring error:', error);
      throw new Error(`Failed to score caption: ${error.message}`);
    }
  }

  /**
   * Score sentiment (positive = higher score)
   */
  private static scoreSentiment(caption: string): number {
    const positiveWords = [
      'amazing', 'awesome', 'excellent', 'great', 'love', 'best', 'perfect',
      'wonderful', 'fantastic', 'incredible', 'excited', 'happy', 'thrilled',
      'delighted', 'grateful', 'inspiring', 'beautiful', 'brilliant', 'outstanding',
    ];

    const negativeWords = [
      'bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disappointing',
      'frustrated', 'angry', 'sad', 'upset', 'annoying', 'boring', 'useless',
    ];

    const words = caption.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    words.forEach((word) => {
      if (positiveWords.some((pw) => word.includes(pw))) positiveCount++;
      if (negativeWords.some((nw) => word.includes(nw))) negativeCount++;
    });

    // Positive sentiment scores higher
    if (positiveCount > negativeCount) {
      return Math.min(100, 70 + positiveCount * 10);
    } else if (negativeCount > positiveCount) {
      return Math.max(30, 70 - negativeCount * 10);
    }

    return 60; // Neutral
  }

  /**
   * Score caption length
   */
  private static scoreLength(caption: string, platform: string): number {
    const length = caption.length;
    
    const optimalRanges: Record<string, { min: number; max: number }> = {
      twitter: { min: 100, max: 280 },
      linkedin: { min: 150, max: 300 },
      instagram: { min: 125, max: 300 },
      facebook: { min: 100, max: 250 },
    };

    const range = optimalRanges[platform] || { min: 100, max: 300 };

    if (length >= range.min && length <= range.max) {
      return 100; // Perfect length
    } else if (length < range.min) {
      const ratio = length / range.min;
      return Math.round(ratio * 100);
    } else {
      const excess = length - range.max;
      const penalty = Math.min(50, (excess / range.max) * 100);
      return Math.max(50, 100 - penalty);
    }
  }

  /**
   * Score readability
   */
  private static scoreReadability(caption: string): number {
    const sentences = caption.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const words = caption.split(/\s+/);
    const avgWordsPerSentence = words.length / Math.max(1, sentences.length);

    // Optimal: 10-20 words per sentence
    let score = 70;

    if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 20) {
      score = 100;
    } else if (avgWordsPerSentence < 10) {
      score = 70 + (avgWordsPerSentence / 10) * 30;
    } else {
      const penalty = Math.min(40, ((avgWordsPerSentence - 20) / 20) * 40);
      score = 100 - penalty;
    }

    // Check for emojis (adds engagement)
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    if (emojiRegex.test(caption)) {
      score = Math.min(100, score + 10);
    }

    return Math.round(score);
  }

  /**
   * Score hashtag quality
   */
  private static scoreHashtags(hashtags: string[], platform: string): number {
    if (hashtags.length === 0) return 50; // Neutral if no hashtags

    const optimalCounts: Record<string, { min: number; max: number }> = {
      twitter: { min: 1, max: 2 },
      linkedin: { min: 3, max: 5 },
      instagram: { min: 10, max: 15 },
      facebook: { min: 2, max: 3 },
    };

    const range = optimalCounts[platform] || { min: 2, max: 5 };
    const count = hashtags.length;

    let score = 70;

    if (count >= range.min && count <= range.max) {
      score = 100;
    } else if (count < range.min) {
      score = 70 + ((count / range.min) * 30);
    } else {
      const excess = count - range.max;
      const penalty = Math.min(40, (excess / range.max) * 40);
      score = 100 - penalty;
    }

    // Check hashtag length (shorter is better)
    const avgLength = hashtags.reduce((sum, tag) => sum + tag.length, 0) / hashtags.length;
    if (avgLength > 20) {
      score = Math.max(50, score - 10);
    }

    return Math.round(score);
  }

  /**
   * Score keyword density
   */
  private static scoreKeywordDensity(caption: string): number {
    const words = caption.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    
    // Calculate keyword density (unique words / total words)
    const density = uniqueWords.size / words.length;

    // Optimal density: 0.6-0.8 (some repetition is okay)
    if (density >= 0.6 && density <= 0.8) {
      return 100;
    } else if (density < 0.6) {
      // Too much repetition
      return Math.round(density / 0.6 * 100);
    } else {
      // Too many unique words (might be too complex)
      return Math.round((1 - (density - 0.8) / 0.2) * 100);
    }
  }

  /**
   * Generate improvement suggestions
   */
  private static generateSuggestions(
    breakdown: any,
    input: CaptionScoringInput
  ): string[] {
    const suggestions: string[] = [];

    if (breakdown.sentiment < 60) {
      suggestions.push('Consider using more positive language to increase engagement.');
    }

    if (breakdown.length < 70) {
      const optimalRanges: Record<string, { min: number; max: number }> = {
        twitter: { min: 100, max: 280 },
        linkedin: { min: 150, max: 300 },
        instagram: { min: 125, max: 300 },
        facebook: { min: 100, max: 250 },
      };
      const range = optimalRanges[input.platform] || { min: 100, max: 300 };
      
      if (input.caption.length < range.min) {
        suggestions.push(`Caption is too short. Aim for ${range.min}-${range.max} characters.`);
      } else {
        suggestions.push(`Caption is too long. Try to keep it under ${range.max} characters.`);
      }
    }

    if (breakdown.readability < 70) {
      suggestions.push('Improve readability by using shorter sentences and adding emojis.');
    }

    if (breakdown.hashtagQuality < 70) {
      const optimalCounts: Record<string, { min: number; max: number }> = {
        twitter: { min: 1, max: 2 },
        linkedin: { min: 3, max: 5 },
        instagram: { min: 10, max: 15 },
        facebook: { min: 2, max: 3 },
      };
      const range = optimalCounts[input.platform] || { min: 2, max: 5 };
      
      if ((input.hashtags || []).length < range.min) {
        suggestions.push(`Add more hashtags. Optimal for ${input.platform}: ${range.min}-${range.max} hashtags.`);
      } else {
        suggestions.push(`Reduce hashtags. Optimal for ${input.platform}: ${range.min}-${range.max} hashtags.`);
      }
    }

    if (breakdown.keywordDensity < 70) {
      suggestions.push('Reduce keyword repetition to improve content quality.');
    }

    if (suggestions.length === 0) {
      suggestions.push('Great caption! No major improvements needed.');
    }

    return suggestions;
  }
}
