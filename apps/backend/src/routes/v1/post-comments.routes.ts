import { Router } from 'express';
import { z } from 'zod';
import { PostCommentService } from '../../services/PostCommentService';
import { requireAuth } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validate';
import { logger } from '../../utils/logger';

const router = Router();

// Validation schemas
const addCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000),
    parentId: z.string().optional(),
  }),
});

const editCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000),
  }),
});

/**
 * GET /posts/:postId/comments
 * Get all comments for a post
 */
router.get('/:postId/comments', requireAuth, async (req, res): Promise<void> => {
  try {
    const { postId } = req.params;
    const workspaceId = req.workspace?.workspaceId?.toString();
    const userId = req.user?.userId;

    if (!workspaceId) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Workspace context required',
      });
      return;
    }

    const comments = await PostCommentService.getComments(postId, workspaceId, userId);

    res.json({
      success: true,
      data: comments,
    });
  } catch (error: any) {
    logger.error('Error getting comments', {
      postId: req.params.postId,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get comments',
    });
  }
});

/**
 * POST /posts/:postId/comments
 * Add a new comment
 */
router.post(
  '/:postId/comments',
  requireAuth,
  validateRequest(addCommentSchema),
  async (req, res): Promise<void> => {
    try {
      const { postId } = req.params;
      const { content, parentId } = req.body;
      const workspaceId = req.workspace?.workspaceId?.toString();
      const authorId = req.user?.userId;

      if (!workspaceId || !authorId) {
        res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Workspace context and authentication required',
        });
        return;
      }

      const comment = await PostCommentService.addComment(
        postId,
        workspaceId,
        authorId,
        content,
        parentId
      );

      res.status(201).json({
        success: true,
        data: comment,
      });
    } catch (error: any) {
      logger.error('Error adding comment', {
        postId: req.params.postId,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to add comment',
      });
    }
  }
);

/**
 * PATCH /posts/:postId/comments/:commentId
 * Edit a comment
 */
router.patch(
  '/:postId/comments/:commentId',
  requireAuth,
  validateRequest(editCommentSchema),
  async (req, res): Promise<void> => {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const authorId = req.user?.userId;

      if (!authorId) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const comment = await PostCommentService.editComment(commentId, authorId, content);

      res.json({
        success: true,
        data: comment,
      });
    } catch (error: any) {
      logger.error('Error editing comment', {
        commentId: req.params.commentId,
        error: error.message,
      });

      if (error.message === 'Comment not found or unauthorized') {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to edit comment',
      });
    }
  }
);

/**
 * DELETE /posts/:postId/comments/:commentId
 * Delete a comment
 */
router.delete('/:postId/comments/:commentId', requireAuth, async (req, res): Promise<void> => {
  try {
    const { commentId } = req.params;
    const workspaceId = req.workspace?.workspaceId?.toString();
    const authorId = req.user?.userId;

    if (!workspaceId || !authorId) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Workspace context and authentication required',
      });
      return;
    }

    await PostCommentService.deleteComment(commentId, authorId, workspaceId);

    res.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting comment', {
      commentId: req.params.commentId,
      error: error.message,
    });

    if (error.message === 'Comment not found' || error.message === 'Unauthorized to delete comment') {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to delete comment',
    });
  }
});

/**
 * POST /posts/:postId/comments/:commentId/resolve
 * Resolve a comment
 */
router.post('/:postId/comments/:commentId/resolve', requireAuth, async (req, res): Promise<void> => {
  try {
    const { commentId } = req.params;
    const workspaceId = req.workspace?.workspaceId?.toString();
    const userId = req.user?.userId;

    if (!workspaceId || !userId) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Workspace context and authentication required',
      });
      return;
    }

    const comment = await PostCommentService.resolveComment(commentId, userId, workspaceId);

    res.json({
      success: true,
      data: comment,
    });
  } catch (error: any) {
    logger.error('Error resolving comment', {
      commentId: req.params.commentId,
      error: error.message,
    });

    if (error.message === 'Comment not found') {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to resolve comment',
    });
  }
});

/**
 * DELETE /posts/:postId/comments/:commentId/resolve
 * Unresolve a comment
 */
router.delete('/:postId/comments/:commentId/resolve', requireAuth, async (req, res): Promise<void> => {
  try {
    const { commentId } = req.params;
    const workspaceId = req.workspace?.workspaceId?.toString();
    const userId = req.user?.userId;

    if (!workspaceId || !userId) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Workspace context and authentication required',
      });
      return;
    }

    const comment = await PostCommentService.unresolveComment(commentId, userId, workspaceId);

    res.json({
      success: true,
      data: comment,
    });
  } catch (error: any) {
    logger.error('Error unresolving comment', {
      commentId: req.params.commentId,
      error: error.message,
    });

    if (error.message === 'Comment not found') {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to unresolve comment',
    });
  }
});

/**
 * POST /posts/:postId/comments/:commentId/reactions
 * Add reaction to a comment
 */
router.post('/:postId/comments/:commentId/reactions', requireAuth, async (req, res): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { emoji } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    if (!emoji || !['👍', '❤️', '😂', '😮', '😢', '😡'].includes(emoji)) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Valid emoji required',
      });
      return;
    }

    const comment = await PostCommentService.addReaction(commentId, userId, emoji);

    res.json({
      success: true,
      data: comment,
    });
  } catch (error: any) {
    logger.error('Error adding reaction', {
      commentId: req.params.commentId,
      error: error.message,
    });

    if (error.message === 'Comment not found') {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to add reaction',
    });
  }
});

/**
 * DELETE /posts/:postId/comments/:commentId/reactions/:emoji
 * Remove reaction from a comment
 */
router.delete('/:postId/comments/:commentId/reactions/:emoji', requireAuth, async (req, res): Promise<void> => {
  try {
    const { commentId, emoji } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const comment = await PostCommentService.removeReaction(commentId, userId, emoji);

    res.json({
      success: true,
      data: comment,
    });
  } catch (error: any) {
    logger.error('Error removing reaction', {
      commentId: req.params.commentId,
      emoji: req.params.emoji,
      error: error.message,
    });

    if (error.message === 'Comment not found') {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to remove reaction',
    });
  }
});

export default router;