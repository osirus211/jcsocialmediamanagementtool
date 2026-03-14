import { Router } from 'express';
import { z } from 'zod';
import { PostCommentService } from '../../services/PostCommentService';
import { requireAuth } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validate';
import { logger } from '../../utils/logger';

const router = Router();

// Validation schemas
const getMentionsSchema = z.object({
  query: z.object({
    limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
    offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
  }),
});

/**
 * GET /mentions
 * Get all mentions for the current user in the workspace
 */
router.get('/', requireAuth, validateRequest(getMentionsSchema), async (req, res): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const workspaceId = req.workspace?.workspaceId?.toString();
    const { limit, offset } = req.query as any;

    if (!workspaceId || !userId) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Workspace context and authentication required',
      });
      return;
    }

    const mentions = await PostCommentService.getMentions(userId, workspaceId, limit, offset);

    res.json({
      success: true,
      data: mentions,
      pagination: {
        limit,
        offset,
        hasMore: mentions.length === limit,
      },
    });
  } catch (error: any) {
    logger.error('Error getting mentions', {
      userId: req.user?.userId,
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get mentions',
    });
  }
});

export default router;