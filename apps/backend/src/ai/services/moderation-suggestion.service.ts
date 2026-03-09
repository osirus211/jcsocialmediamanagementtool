/**
 * Moderation Suggestion Service
 * 
 * Suggests moderation actions for comments and messages
 * Detects toxicity, spam, and inappropriate content
 */

import { IAIProvider } from '../types';
import { logger } from '../../utils/logger';

export interface ModerationInput {
  content: string;
  author?: {
    username: string;
    followerCount?: number;
  };
  context?: string;
  platform: string;
}

export interface ModerationOutput {
  action: 'approve' | 'reply' | 'ignore' | 'hide' | 'flag' | 'block';
  confidence: number; // 0-100
  reasons: string[];
  flags: {
    toxicity: boolean;
    spam: boolean;
    harassment: boolean;
    inappropriate: boolean;
  };
  suggestedReply?: string;
  tokensUsed: number;
  provider: string;
  model: string;
}

export class ModerationSuggestionService {
  constructor(private provider: IAIProvider) {}

  /**
   * Suggest moderation action
   */
  async suggestModeration(input: ModerationInput): Promise<ModerationOutput> {
    try {
      logger.info('Suggesting moderation action', {
        provider: this.provider.getProviderName(),
        platform: input.platform,
        contentLength: input.content.length,
      });

      // Quick rule-based check first
      const quickCheck = this.quickModerationCheck(input);

      // If high confidence from quick check, return immediately
      if (quickCheck.confidence >= 80) {
        return {
          ...quickCheck,
          tokensUsed: 0,
          provider: 'rule-based',
          model: 'lightweight',
        };
      }

      // Use AI for complex cases
      return await this.aiModerationCheck(input);
    } catch (error: any) {
      logger.error('Moderation suggestion error:', error);
      throw new Error(`Failed to suggest moderation: ${error.message}`);
    }
  }

  /**
   * Quick rule-based moderation check
   */
  private quickModerationCheck(input: ModerationInput): Omit<ModerationOutput, 'tokensUsed' | 'provider' | 'model'> {
    const content = input.content.toLowerCase();
    const flags = {
      toxicity: false,
      spam: false,
      harassment: false,
      inappropriate: false,
    };
    const reasons: string[] = [];

    // Toxicity keywords
    const toxicKeywords = [
      'hate', 'stupid', 'idiot', 'dumb', 'kill', 'die', 'worst', 'terrible',
      'awful', 'disgusting', 'pathetic', 'loser', 'trash', 'garbage',
    ];

    // Spam indicators
    const spamIndicators = [
      'click here', 'buy now', 'limited time', 'act now', 'free money',
      'make money fast', 'work from home', 'weight loss', 'viagra',
    ];

    // Harassment keywords
    const harassmentKeywords = [
      'harass', 'bully', 'threaten', 'stalk', 'attack', 'abuse',
    ];

    // Check toxicity
    const toxicCount = toxicKeywords.filter((keyword) => content.includes(keyword)).length;
    if (toxicCount >= 2) {
      flags.toxicity = true;
      reasons.push('Contains toxic language');
    }

    // Check spam
    const spamCount = spamIndicators.filter((indicator) => content.includes(indicator)).length;
    const hasMultipleLinks = (content.match(/https?:\/\//g) || []).length >= 3;
    const hasExcessiveCaps = content.replace(/[^A-Z]/g, '').length / content.length > 0.5;
    
    if (spamCount >= 1 || hasMultipleLinks || hasExcessiveCaps) {
      flags.spam = true;
      reasons.push('Appears to be spam');
    }

    // Check harassment
    const harassmentCount = harassmentKeywords.filter((keyword) => content.includes(keyword)).length;
    if (harassmentCount >= 1) {
      flags.harassment = true;
      reasons.push('Contains harassment indicators');
    }

    // Check inappropriate content
    const inappropriateKeywords = ['porn', 'sex', 'nude', 'xxx'];
    const inappropriateCount = inappropriateKeywords.filter((keyword) => content.includes(keyword)).length;
    if (inappropriateCount >= 1) {
      flags.inappropriate = true;
      reasons.push('Contains inappropriate content');
    }

    // Determine action
    let action: ModerationOutput['action'] = 'approve';
    let confidence = 50;

    if (flags.toxicity || flags.harassment) {
      action = 'flag';
      confidence = 85;
    } else if (flags.spam) {
      action = 'hide';
      confidence = 80;
    } else if (flags.inappropriate) {
      action = 'flag';
      confidence = 85;
    } else if (reasons.length === 0) {
      action = 'approve';
      confidence = 70;
      reasons.push('No issues detected');
    }

    return {
      action,
      confidence,
      reasons,
      flags,
    };
  }

  /**
   * AI-powered moderation check
   */
  private async aiModerationCheck(input: ModerationInput): Promise<ModerationOutput> {
    const prompt = this.buildModerationPrompt(input);
    const response = await this.provider.generateCompletion(prompt);
    const tokensUsed = this.provider.getTokenCount(prompt + response);

    const parsed = this.parseAIResponse(response);

    return {
      ...parsed,
      tokensUsed,
      provider: this.provider.getProviderName(),
      model: this.provider.getModelName(),
    };
  }

  /**
   * Build moderation prompt
   */
  private buildModerationPrompt(input: ModerationInput): string {
    let prompt = `Analyze the following ${input.platform} content for moderation:\n\n`;
    prompt += `Content: "${input.content}"\n\n`;
    
    if (input.author) {
      prompt += `Author: ${input.author.username}`;
      if (input.author.followerCount) {
        prompt += ` (${input.author.followerCount} followers)`;
      }
      prompt += `\n\n`;
    }
    
    if (input.context) {
      prompt += `Context: ${input.context}\n\n`;
    }
    
    prompt += `Evaluate for:\n`;
    prompt += `- Toxicity (hate speech, insults, threats)\n`;
    prompt += `- Spam (promotional content, excessive links)\n`;
    prompt += `- Harassment (bullying, stalking, abuse)\n`;
    prompt += `- Inappropriate content (explicit material)\n\n`;
    prompt += `Provide your analysis in this exact format:\n`;
    prompt += `Action: [approve/reply/ignore/hide/flag/block]\n`;
    prompt += `Confidence: [0-100]\n`;
    prompt += `Toxicity: [yes/no]\n`;
    prompt += `Spam: [yes/no]\n`;
    prompt += `Harassment: [yes/no]\n`;
    prompt += `Inappropriate: [yes/no]\n`;
    prompt += `Reasons: [comma-separated list of reasons]\n`;
    prompt += `SuggestedReply: [optional reply if action is 'reply']`;

    return prompt;
  }

  /**
   * Parse AI response
   */
  private parseAIResponse(response: string): Omit<ModerationOutput, 'tokensUsed' | 'provider' | 'model'> {
    const lines = response.split('\n');
    let action: ModerationOutput['action'] = 'approve';
    let confidence = 50;
    const flags = {
      toxicity: false,
      spam: false,
      harassment: false,
      inappropriate: false,
    };
    let reasons: string[] = [];
    let suggestedReply: string | undefined;

    lines.forEach((line) => {
      const lower = line.toLowerCase();
      
      if (lower.includes('action:')) {
        if (lower.includes('flag')) action = 'flag';
        else if (lower.includes('block')) action = 'block';
        else if (lower.includes('hide')) action = 'hide';
        else if (lower.includes('ignore')) action = 'ignore';
        else if (lower.includes('reply')) action = 'reply';
        else action = 'approve';
      } else if (lower.includes('confidence:')) {
        const match = line.match(/\d+/);
        if (match) confidence = parseInt(match[0]);
      } else if (lower.includes('toxicity:')) {
        flags.toxicity = lower.includes('yes');
      } else if (lower.includes('spam:')) {
        flags.spam = lower.includes('yes');
      } else if (lower.includes('harassment:')) {
        flags.harassment = lower.includes('yes');
      } else if (lower.includes('inappropriate:')) {
        flags.inappropriate = lower.includes('yes');
      } else if (lower.includes('reasons:')) {
        const reasonsPart = line.split(':')[1];
        if (reasonsPart) {
          reasons = reasonsPart.split(',').map((r) => r.trim()).filter((r) => r.length > 0);
        }
      } else if (lower.includes('suggestedreply:')) {
        const replyPart = line.split(':')[1];
        if (replyPart && replyPart.trim().length > 0) {
          suggestedReply = replyPart.trim();
        }
      }
    });

    if (reasons.length === 0) {
      reasons.push('No specific issues detected');
    }

    return {
      action,
      confidence,
      reasons,
      flags,
      suggestedReply,
    };
  }

  /**
   * Batch moderation check
   */
  async moderateBatch(inputs: ModerationInput[]): Promise<ModerationOutput[]> {
    const results: ModerationOutput[] = [];

    for (const input of inputs) {
      try {
        const result = await this.suggestModeration(input);
        results.push(result);
      } catch (error) {
        logger.error('Batch moderation error:', error);
        // Add safe default for failed moderation
        results.push({
          action: 'flag',
          confidence: 0,
          reasons: ['Moderation check failed'],
          flags: {
            toxicity: false,
            spam: false,
            harassment: false,
            inappropriate: false,
          },
          tokensUsed: 0,
          provider: 'error',
          model: 'error',
        });
      }
    }

    return results;
  }
}
