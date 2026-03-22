import { Router } from 'express';
import { z } from 'zod';
import { Mention } from '../../models/Mention';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { logger } from '../../utils/logger';
import { ReplySuggestionService } from '../../ai/services/reply-suggestion.service';
import { AIProviderFactory } from '../../ai/providers';
import { SlidingWindowRateLimiter } from '../../middleware/composerRateLimits';
import { WorkspaceActivityLog, ActivityAction } from '../../models/WorkspaceActivityLog';

const router = Router();

// Redis-backed rate limiter for reply suggestions (200 per workspace per hour)
export const replySuggestionLimit = new SlidingWindowRateLimiter({
  maxRequests: 200,
  windowMs: 60 * 60 * 1000,
  keyPrefix: 'rateLimit:replySuggestion',
});

// Validation schemas
const getMentionsSchema = z.object({
  query: z.object({
    platform: z.string().optional(),
    sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
    keyword: z.string().optional(),
    limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
    offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
  }),
});

const markReadSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

/**
 * GET /mentions
 * Get social listening mentions for workspace
 */
router.get('/', requireAuth, requireWorkspace, validateRequest(getMentionsSchema), async (req, res): Promise<void> => {
  try {
    const workspaceId = req.workspace!.workspaceId;
    const { platform, sentiment, keyword, limit, offset } = req.query as any;

    const query: any = { workspaceId };

    if (platform) {
      query.platform = platform;
    }

    if (sentiment) {
      query.sentiment = sentiment;
    }

    if (keyword) {
      query.keyword = { $regex: keyword, $options: 'i' };
    }

    const mentions = await Mention.find(query)
      .sort({ collectedAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    const total = await Mention.countDocuments(query);

    res.json({
      success: true,
      data: mentions,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + mentions.length < total,
      },
    });
  } catch (error: any) {
    logger.error('Error getting mentions', {
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to get mentions',
    });
  }
});

/**
 * GET /mentions/:id/reply-suggestions
 * Get AI-generated reply suggestions for a mention
 */
router.get('/:id/reply-suggestions', requireAuth, requireWorkspace, validateRequest(markReadSchema), async (req, res): Promise<void> => {
  try {
    const workspaceId = req.workspace!.workspaceId;
    const { id } = req.params;

    // Rate limit check (200 per workspace per hour)
    const { allowed, remaining } = await replySuggestionLimit.checkLimit(workspaceId.toString());
    
    if (!allowed) {
      res.status(429).json({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Reply suggestion limit reached. Try again later.',
      });
      return;
    }

    const mention = await Mention.findOne({ _id: id, workspaceId }).lean();

    if (!mention) {
      res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Mention not found',
      });
      return;
    }

    // Generate reply suggestions
    const aiProvider = AIProviderFactory.createProvider();
    const replySuggestionService = new ReplySuggestionService(aiProvider);

    const result = await replySuggestionService.generateReplySuggestions({
      originalMessage: mention.text,
      platform: mention.platform,
      tone: mention.sentiment === 'negative' ? 'professional' : 'friendly',
      maxLength: 280,
    });

    res.json({
      success: true,
      data: {
        suggestions: result.suggestions,
      },
    });
  } catch (error: any) {
    logger.error('Error generating reply suggestions', {
      workspaceId: req.workspace?.workspaceId,
      mentionId: req.params.id,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to generate reply suggestions',
    });
  }
});

/**
 * POST /mentions/:id/mark-read
 * Mark a mention as read
 */
router.post('/:id/mark-read', requireAuth, requireWorkspace, validateRequest(markReadSchema), async (req, res): Promise<void> => {
  try {
    const workspaceId = req.workspace!.workspaceId;
    const { id } = req.params;

    const mention = await Mention.findOneAndUpdate(
      { _id: id, workspaceId },
      { $set: { readAt: new Date() } },
      { new: true }
    );

    if (!mention) {
      res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Mention not found',
      });
      return;
    }

    // Audit log
    WorkspaceActivityLog.create({
      workspaceId,
      userId: req.user!.userId,
      action: ActivityAction.MENTION_READ,
      metadata: { mentionId: req.params.id },
    }).catch(() => {});

    res.json({
      success: true,
    });
  } catch (error: any) {
    logger.error('Error marking mention as read', {
      workspaceId: req.workspace?.workspaceId,
      mentionId: req.params.id,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to mark mention as read',
    });
  }
});

/**
 * GET /mentions/stats
 * Get mention statistics for workspace
 */
router.get('/stats', requireAuth, requireWorkspace, async (req, res): Promise<void> => {
  try {
    const workspaceId = req.workspace!.workspaceId;

    const [total, byPlatform, bySentiment, unreadCount] = await Promise.all([
      Mention.countDocuments({ workspaceId }),
      Mention.aggregate([
        { $match: { workspaceId } },
        { $group: { _id: '$platform', count: { $sum: 1 } } },
      ]),
      Mention.aggregate([
        { $match: { workspaceId, sentiment: { $exists: true } } },
        { $group: { _id: '$sentiment', count: { $sum: 1 } } },
      ]),
      Mention.countDocuments({ workspaceId, readAt: { $exists: false } }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        byPlatform: byPlatform.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
        bySentiment: bySentiment.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
        unreadCount,
      },
    });
  } catch (error: any) {
    logger.error('Error getting mention stats', {
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to get mention stats',
    });
  }
});

export default router;
