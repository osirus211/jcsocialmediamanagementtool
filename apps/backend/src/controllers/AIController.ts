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
}
