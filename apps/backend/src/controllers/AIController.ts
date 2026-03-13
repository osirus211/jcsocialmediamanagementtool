/**
 * AI Controller
 * Handles AI-powered content generation requests
 */

import { Request, Response, NextFunction } from 'express';
import { getAIModule } from '../ai/ai.module';
import {
  CaptionGenerationInput,
  HashtagGenerationInput,
  RewriteInput,
  SuggestionInput,
  ContentLength,
} from '../ai/types';
import { logger } from '../utils/logger';
import { usageService } from '../services/UsageService';

export class AIController {
  /**
   * Generate caption
   * POST /ai/caption
   */
  static async generateCaption(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: CaptionGenerationInput = req.body;

      // Validate input
      if (!input.topic || !input.tone || !input.platform || !input.length) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: topic, tone, platform, length',
        });
        return;
      }

      const aiModule = getAIModule();
      const result = await aiModule.caption.generateCaption(input);

      // Track AI usage
      const workspaceId = req.workspace?.workspaceId.toString();
      if (workspaceId) {
        await usageService.incrementAI(workspaceId);
      }

      logger.info('Caption generated', {
        workspaceId: req.workspace?.workspaceId,
        userId: req.user?.userId,
        tokensUsed: result.tokensUsed,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Generate caption error:', error);
      next(error);
    }
  }

  /**
   * Generate hashtags
   * POST /ai/hashtags
   */
  static async generateHashtags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: HashtagGenerationInput = req.body;

      // Validate input
      if (!input.caption || !input.platform) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: caption, platform',
        });
        return;
      }

      const aiModule = getAIModule();
      const result = await aiModule.hashtag.generateHashtags(input);

      // Track AI usage
      const workspaceId = req.workspace?.workspaceId.toString();
      if (workspaceId) {
        await usageService.incrementAI(workspaceId);
      }

      logger.info('Hashtags generated', {
        workspaceId: req.workspace?.workspaceId,
        userId: req.user?.userId,
        tokensUsed: result.tokensUsed,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Generate hashtags error:', error);
      next(error);
    }
  }

  /**
   * Rewrite content
   * POST /ai/rewrite
   */
  static async rewriteContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: RewriteInput = req.body;

      // Validate input
      if (!input.content || !input.instruction) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: content, instruction',
        });
        return;
      }

      const aiModule = getAIModule();
      const result = await aiModule.rewrite.rewrite(input);

      // Track AI usage
      const workspaceId = req.workspace?.workspaceId.toString();
      if (workspaceId) {
        await usageService.incrementAI(workspaceId);
      }

      logger.info('Content rewritten', {
        workspaceId: req.workspace?.workspaceId,
        userId: req.user?.userId,
        tokensUsed: result.tokensUsed,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Rewrite content error:', error);
      next(error);
    }
  }

  /**
   * Improve content
   * POST /ai/improve
   */
  static async improveContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, platform } = req.body;

      if (!content) {
        res.status(400).json({
          success: false,
          message: 'Missing required field: content',
        });
        return;
      }

      const aiModule = getAIModule();
      const result = await aiModule.rewrite.improve(content, platform);

      // Track AI usage
      const workspaceId = req.workspace?.workspaceId.toString();
      if (workspaceId) {
        await usageService.incrementAI(workspaceId);
      }

      logger.info('Content improved', {
        workspaceId: req.workspace?.workspaceId,
        userId: req.user?.userId,
        tokensUsed: result.tokensUsed,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Improve content error:', error);
      next(error);
    }
  }

  /**
   * Generate suggestions
   * POST /ai/suggestions
   */
  static async generateSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: SuggestionInput = req.body;

      // Validate input
      if (!input.type) {
        res.status(400).json({
          success: false,
          message: 'Missing required field: type',
        });
        return;
      }

      const aiModule = getAIModule();
      const result = await aiModule.suggestion.generateSuggestions(input);

      // Track AI usage
      const workspaceId = req.workspace?.workspaceId.toString();
      if (workspaceId) {
        await usageService.incrementAI(workspaceId);
      }

      logger.info('Suggestions generated', {
        workspaceId: req.workspace?.workspaceId,
        userId: req.user?.userId,
        tokensUsed: result.tokensUsed,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Generate suggestions error:', error);
      next(error);
    }
  }

  /**
   * Repurpose content for multiple platforms
   * POST /ai/repurpose
   */
  static async repurposeContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { originalContent, originalPlatform, targetPlatforms, preserveHashtags, preserveMentions } = req.body;

      if (!originalContent || !targetPlatforms || !Array.isArray(targetPlatforms)) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: originalContent, targetPlatforms (array)',
        });
        return;
      }

      const aiModule = getAIModule();
      const result = await aiModule.repurposing.repurposeContent({
        originalContent,
        originalPlatform,
        targetPlatforms,
        preserveHashtags,
        preserveMentions,
      });

      const workspaceId = req.workspace?.workspaceId.toString();
      if (workspaceId) {
        await usageService.incrementAI(workspaceId);
      }

      logger.info('Content repurposed', {
        workspaceId: req.workspace?.workspaceId,
        userId: req.user?.userId,
        platformCount: result.platformVersions.length,
        tokensUsed: result.tokensUsed,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Repurpose content error:', error);
      next(error);
    }
  }

  /**
   * Convert long-form content to social post
   * POST /ai/longform-to-social
   */
  static async longformToSocial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { longFormContent, targetPlatform, focusPoints, preserveLinks, includeHashtags } = req.body;

      if (!longFormContent || !targetPlatform) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: longFormContent, targetPlatform',
        });
        return;
      }

      const aiModule = getAIModule();
      const result = await aiModule.longform.convertToShortForm({
        longFormContent,
        targetPlatform,
        focusPoints,
        preserveLinks,
        includeHashtags,
      });

      const workspaceId = req.workspace?.workspaceId.toString();
      if (workspaceId) {
        await usageService.incrementAI(workspaceId);
      }

      logger.info('Long-form converted', {
        workspaceId: req.workspace?.workspaceId,
        userId: req.user?.userId,
        targetPlatform,
        tokensUsed: result.tokensUsed,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Long-form to social error:', error);
      next(error);
    }
  }

  /**
   * Predict engagement for a post
   * POST /ai/predict-engagement
   */
  static async predictEngagement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { platform, caption, scheduledTime, hasMedia, mediaType } = req.body;

      if (!platform || !caption) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: platform, caption',
        });
        return;
      }

      const workspaceId = req.workspace?.workspaceId.toString();
      if (!workspaceId) {
        res.status(400).json({
          success: false,
          message: 'Workspace ID required',
        });
        return;
      }

      const { EngagementPredictionService } = await import('../ai/services/engagement-prediction.service');
      const result = await EngagementPredictionService.predictEngagement({
        workspaceId,
        platform,
        caption,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
        hasMedia,
        mediaType,
      });

      logger.info('Engagement predicted', {
        workspaceId,
        userId: req.user?.userId,
        platform,
        predictedScore: result.predictedScore,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Predict engagement error:', error);
      next(error);
    }
  }

  /**
   * Score a caption
   * POST /ai/score-caption
   */
  static async scoreCaption(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { platform, caption, hashtags } = req.body;

      if (!platform || !caption) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: platform, caption',
        });
        return;
      }

      const workspaceId = req.workspace?.workspaceId.toString();
      if (!workspaceId) {
        res.status(400).json({
          success: false,
          message: 'Workspace ID required',
        });
        return;
      }

      const { CaptionScoringService } = await import('../ai/services/caption-scoring.service');
      const result = await CaptionScoringService.scoreCaption({
        workspaceId,
        platform,
        caption,
        hashtags,
      });

      logger.info('Caption scored', {
        workspaceId,
        userId: req.user?.userId,
        platform,
        overallScore: result.overallScore,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Score caption error:', error);
      next(error);
    }
  }

  /**
   * Recommend best posting time
   * POST /ai/recommend-post-time
   */
  static async recommendPostTime(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { platform, timezone } = req.body;

      if (!platform) {
        res.status(400).json({
          success: false,
          message: 'Missing required field: platform',
        });
        return;
      }

      const workspaceId = req.workspace?.workspaceId.toString();
      if (!workspaceId) {
        res.status(400).json({
          success: false,
          message: 'Workspace ID required',
        });
        return;
      }

      const { PostingTimePredictionService } = await import('../ai/services/posting-time-prediction.service');
      const result = await PostingTimePredictionService.predictBestTimes({
        workspaceId,
        platform,
        timezone,
      });

      logger.info('Posting time recommended', {
        workspaceId,
        userId: req.user?.userId,
        platform,
        bestTime: result.bestTime,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Recommend post time error:', error);
      next(error);
    }
  }

  /**
   * Suggest replies for a message
   * POST /ai/suggest-reply
   */
  static async suggestReply(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { originalMessage, context, platform, tone, maxLength } = req.body;

      if (!originalMessage || !platform) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: originalMessage, platform',
        });
        return;
      }

      const aiModule = getAIModule();
      const result = await aiModule.reply.generateReplySuggestions({
        originalMessage,
        context,
        platform,
        tone,
        maxLength,
      });

      const workspaceId = req.workspace?.workspaceId.toString();
      if (workspaceId) {
        await usageService.incrementAI(workspaceId);
      }

      logger.info('Reply suggestions generated', {
        workspaceId: req.workspace?.workspaceId,
        userId: req.user?.userId,
        platform,
        tokensUsed: result.tokensUsed,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Suggest reply error:', error);
      next(error);
    }
  }

  /**
   * Analyze sentiment of text
   * POST /ai/analyze-sentiment
   */
  static async analyzeSentiment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { text, context } = req.body;

      if (!text) {
        res.status(400).json({
          success: false,
          message: 'Missing required field: text',
        });
        return;
      }

      const aiModule = getAIModule();
      const result = await aiModule.sentiment.analyzeSentiment({
        text,
        context,
      });

      const workspaceId = req.workspace?.workspaceId.toString();
      if (workspaceId && result.tokensUsed > 0) {
        await usageService.incrementAI(workspaceId);
      }

      logger.info('Sentiment analyzed', {
        workspaceId: req.workspace?.workspaceId,
        userId: req.user?.userId,
        sentiment: result.sentiment,
        confidence: result.confidence,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Analyze sentiment error:', error);
      next(error);
    }
  }

  /**
   * Generate calendar posts for auto-fill
   * POST /ai/generate-calendar
   */
  static async generateCalendarPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate, platforms, postsPerDay = 1, topics, tone } = req.body;

      if (!startDate || !endDate || !platforms || !Array.isArray(platforms)) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: startDate, endDate, platforms (array)',
        });
        return;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > 30) {
        res.status(400).json({
          success: false,
          message: 'Date range cannot exceed 30 days',
        });
        return;
      }

      const aiModule = getAIModule();
      const generatedPosts = [];

      // Generate posts for each day and platform
      for (let day = 0; day <= daysDiff; day++) {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + day);

        for (const platform of platforms) {
          for (let postIndex = 0; postIndex < postsPerDay; postIndex++) {
            try {
              // Generate content suggestions
              const suggestionResult = await aiModule.suggestion.generateSuggestions({
                platform,
                type: 'hook',
              });

              const topic = topics && topics.length > 0 
                ? topics[Math.floor(Math.random() * topics.length)]
                : suggestionResult.suggestions[0] || 'Engaging content';

              // Generate caption
              const captionResult = await aiModule.caption.generateCaption({
                topic,
                tone: tone || 'casual',
                platform,
                length: ContentLength.MEDIUM,
              });

              // Generate hashtags
              const hashtagResult = await aiModule.hashtag.generateHashtags({
                caption: captionResult.caption,
                platform,
                count: 5,
              });

              // Calculate optimal posting time (spread across business hours 9am-6pm)
              const scheduledTime = new Date(currentDate);
              const baseHour = 9 + Math.floor((postIndex * 9) / postsPerDay); // Spread across 9am-6pm
              const randomMinutes = Math.floor(Math.random() * 60);
              scheduledTime.setHours(baseHour, randomMinutes, 0, 0);

              generatedPosts.push({
                platform,
                content: captionResult.caption,
                hashtags: hashtagResult.hashtags,
                scheduledAt: scheduledTime.toISOString(),
                suggestedTime: scheduledTime.toISOString(),
              });
            } catch (error) {
              logger.error('Failed to generate post for calendar', {
                day,
                platform,
                postIndex,
                error: error.message,
              });
            }
          }
        }
      }

      // Track AI usage
      const workspaceId = req.workspace?.workspaceId.toString();
      if (workspaceId) {
        // Increment for each AI call made
        const aiCallsCount = generatedPosts.length * 3; // suggestion + caption + hashtag per post
        for (let i = 0; i < aiCallsCount; i++) {
          await usageService.incrementAI(workspaceId);
        }
      }

      logger.info('Calendar posts generated', {
        workspaceId: req.workspace?.workspaceId,
        userId: req.user?.userId,
        totalGenerated: generatedPosts.length,
        dateRange: { startDate, endDate },
        platforms,
      });

      res.json({
        success: true,
        data: {
          posts: generatedPosts,
          totalGenerated: generatedPosts.length,
        },
      });
    } catch (error: any) {
      logger.error('Generate calendar posts error:', error);
      next(error);
    }
  }

  /**
   * Suggest moderation action
   * POST /ai/moderate-content
   */
  static async moderateContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, author, context, platform } = req.body;

      if (!content || !platform) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: content, platform',
        });
        return;
      }

      const aiModule = getAIModule();
      const result = await aiModule.moderation.suggestModeration({
        content,
        author,
        context,
        platform,
      });

      const workspaceId = req.workspace?.workspaceId.toString();
      if (workspaceId && result.tokensUsed > 0) {
        await usageService.incrementAI(workspaceId);
      }

      logger.info('Moderation suggested', {
        workspaceId: req.workspace?.workspaceId,
        userId: req.user?.userId,
        action: result.action,
        confidence: result.confidence,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Moderate content error:', error);
      next(error);
    }
  }
}
