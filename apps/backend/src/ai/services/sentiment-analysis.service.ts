/**
 * Sentiment Analysis Service
 * 
 * Analyzes sentiment of text content
 * Extends Mention model with sentiment field
 */

import { IAIProvider } from '../types';
import { logger } from '../../utils/logger';

export interface SentimentAnalysisInput {
  text: string;
  context?: string;
}

export interface SentimentAnalysisOutput {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number; // 0-100
  score: number; // -1 to 1 (negative to positive)
  keywords: string[];
  tokensUsed: number;
  provider: string;
  model: string;
}

export class SentimentAnalysisService {
  constructor(private provider: IAIProvider) {}

  /**
   * Analyze sentiment of text
   */
  async analyzeSentiment(
    input: SentimentAnalysisInput
  ): Promise<SentimentAnalysisOutput> {
    try {
      logger.info('Analyzing sentiment', {
        provider: this.provider.getProviderName(),
        textLength: input.text.length,
      });

      // Use lightweight keyword-based analysis first
      const quickAnalysis = this.quickSentimentAnalysis(input.text);

      // If confidence is low, use AI for more accurate analysis
      if (quickAnalysis.confidence < 70) {
        return await this.aiSentimentAnalysis(input);
      }

      return {
        ...quickAnalysis,
        tokensUsed: 0,
        provider: 'keyword-based',
        model: 'lightweight',
      };
    } catch (error: any) {
      logger.error('Sentiment analysis error:', error);
      throw new Error(`Failed to analyze sentiment: ${error.message}`);
    }
  }

  /**
   * Quick keyword-based sentiment analysis
   */
  private quickSentimentAnalysis(text: string): Omit<SentimentAnalysisOutput, 'tokensUsed' | 'provider' | 'model'> {
    const positiveKeywords = [
      'love', 'great', 'awesome', 'excellent', 'amazing', 'wonderful', 'fantastic',
      'perfect', 'best', 'happy', 'excited', 'thrilled', 'delighted', 'grateful',
      'thank', 'thanks', 'appreciate', 'brilliant', 'outstanding', 'superb',
    ];

    const negativeKeywords = [
      'hate', 'bad', 'terrible', 'awful', 'horrible', 'worst', 'disappointing',
      'frustrated', 'angry', 'sad', 'upset', 'annoying', 'boring', 'useless',
      'poor', 'fail', 'failed', 'broken', 'issue', 'problem', 'complaint',
    ];

    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    const foundKeywords: string[] = [];

    words.forEach((word) => {
      positiveKeywords.forEach((keyword) => {
        if (word.includes(keyword)) {
          positiveCount++;
          if (!foundKeywords.includes(keyword)) {
            foundKeywords.push(keyword);
          }
        }
      });

      negativeKeywords.forEach((keyword) => {
        if (word.includes(keyword)) {
          negativeCount++;
          if (!foundKeywords.includes(keyword)) {
            foundKeywords.push(keyword);
          }
        }
      });
    });

    const totalSentimentWords = positiveCount + negativeCount;
    const score = totalSentimentWords > 0
      ? (positiveCount - negativeCount) / totalSentimentWords
      : 0;

    let sentiment: 'positive' | 'negative' | 'neutral';
    let confidence: number;

    if (score > 0.2) {
      sentiment = 'positive';
      confidence = Math.min(100, 60 + positiveCount * 10);
    } else if (score < -0.2) {
      sentiment = 'negative';
      confidence = Math.min(100, 60 + negativeCount * 10);
    } else {
      sentiment = 'neutral';
      confidence = totalSentimentWords === 0 ? 50 : 70;
    }

    return {
      sentiment,
      confidence,
      score,
      keywords: foundKeywords,
    };
  }

  /**
   * AI-powered sentiment analysis (for complex cases)
   */
  private async aiSentimentAnalysis(
    input: SentimentAnalysisInput
  ): Promise<SentimentAnalysisOutput> {
    const prompt = this.buildSentimentPrompt(input);
    const response = await this.provider.generateCompletion(prompt);
    const tokensUsed = this.provider.getTokenCount(prompt + response);

    // Parse AI response
    const parsed = this.parseAIResponse(response);

    return {
      ...parsed,
      tokensUsed,
      provider: this.provider.getProviderName(),
      model: this.provider.getModelName(),
    };
  }

  /**
   * Build sentiment analysis prompt
   */
  private buildSentimentPrompt(input: SentimentAnalysisInput): string {
    let prompt = `Analyze the sentiment of the following text:\n\n`;
    prompt += `Text: "${input.text}"\n\n`;
    
    if (input.context) {
      prompt += `Context: ${input.context}\n\n`;
    }
    
    prompt += `Provide your analysis in this exact format:\n`;
    prompt += `Sentiment: [positive/negative/neutral]\n`;
    prompt += `Confidence: [0-100]\n`;
    prompt += `Score: [-1.0 to 1.0]\n`;
    prompt += `Keywords: [comma-separated list of sentiment-indicating words]`;

    return prompt;
  }

  /**
   * Parse AI response
   */
  private parseAIResponse(response: string): Omit<SentimentAnalysisOutput, 'tokensUsed' | 'provider' | 'model'> {
    const lines = response.split('\n');
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    let confidence = 50;
    let score = 0;
    let keywords: string[] = [];

    lines.forEach((line) => {
      const lower = line.toLowerCase();
      
      if (lower.includes('sentiment:')) {
        if (lower.includes('positive')) sentiment = 'positive';
        else if (lower.includes('negative')) sentiment = 'negative';
        else sentiment = 'neutral';
      } else if (lower.includes('confidence:')) {
        const match = line.match(/\d+/);
        if (match) confidence = parseInt(match[0]);
      } else if (lower.includes('score:')) {
        const match = line.match(/-?\d+\.?\d*/);
        if (match) score = parseFloat(match[0]);
      } else if (lower.includes('keywords:')) {
        const keywordsPart = line.split(':')[1];
        if (keywordsPart) {
          keywords = keywordsPart.split(',').map((k) => k.trim()).filter((k) => k.length > 0);
        }
      }
    });

    return {
      sentiment,
      confidence,
      score,
      keywords,
    };
  }

  /**
   * Batch analyze sentiment for multiple texts
   */
  async analyzeBatch(texts: string[]): Promise<SentimentAnalysisOutput[]> {
    const results: SentimentAnalysisOutput[] = [];

    for (const text of texts) {
      try {
        const result = await this.analyzeSentiment({ text });
        results.push(result);
      } catch (error) {
        logger.error('Batch sentiment analysis error:', error);
        // Add neutral result for failed analysis
        results.push({
          sentiment: 'neutral',
          confidence: 0,
          score: 0,
          keywords: [],
          tokensUsed: 0,
          provider: 'error',
          model: 'error',
        });
      }
    }

    return results;
  }
}
