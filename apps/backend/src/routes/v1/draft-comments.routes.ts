/**
 * Draft Comments Routes
 * 
 * API endpoints for draft-specific comments
 */

import { Router } from 'express';
import { z } from 'zod';
import { DraftCommentService } from '../../services/DraftCommentService';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { logger } from '../../utils/logger';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

// Validation schemas
const addCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000),
    parentId: z.string().optional(),
    position: z.object({
      field: z.string(),
      selectionStart: z.number().int().min(0),
      selectionEnd: z.number().int().min(0),
      selectedText: z.string().max(500).optional()
    }).optional()
  })
});

const editCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000)
  })
});

/**
 * GET /drafts/:draftId/comments
 * Get all comments for a draft
 */
router.get('/:draftId/comments', async (req, res, next): Promise<void> => {
  try {
    const { draftId } = req.params;
    const { workspaceId } = req.workspace!;
    const userId = req.user!.userId;

    const comments = await DraftCommentService.getComments(draftId, workspaceId.toString(), userId);

    res.json({
      success: true,
      data: comments
    });
  } catch (error: any) {
    logger.error('Error getting draft comments', {
      draftId: req.params.draftId,
      error: error.message
    });

    if (error.message === 'Draft not found or access denied') {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message
      });
      return;
    }

    next(error);
  }
});

/**
 * POST /drafts/:draftId/comments
 * Add a new comment to a draft
 */
router.post(
  '/:draftId/comments',
  validateRequest(addCommentSchema),
  async (req, res, next): Promise<void> => {
    try {
      const { draftId } = req.params;
      const { workspaceId } = req.workspace!;
      const authorId = req.user!.userId;
      const commentData = req.body;

      const comment = await DraftCommentService.addComment(
        draftId,
        workspaceId.toString(),
        authorId,
        commentData
      );

      res.status(201).json({
        success: true,
        data: comment
      });
    } catch (error: any) {
      logger.error('Error adding draft comment', {
        draftId: req.params.draftId,
        error: error.message
      });

      if (error.message === 'Draft not found or access denied') {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: error.message
        });
        return;
      }

      if (error.message === 'Parent comment not found') {
        res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: error.message
        });
        return;
      }

      next(error);
    }
  }
);

/**
 * PATCH /drafts/:draftId/comments/:commentId
 * Edit a comment
 */
router.patch(
  '/:draftId/comments/:commentId',
  validateRequest(editCommentSchema),
  async (req, res, next): Promise<void> => {
    try {
      const { commentId } = req.params;
      const authorId = req.user!.userId;
      const updateData = req.body;

      const comment = await DraftCommentService.editComment(commentId, authorId, updateData);

      res.json({
        success: true,
        data: comment
      });
    } catch (error: any) {
      logger.error('Error editing draft comment', {
        commentId: req.params.commentId,
        error: error.message
      });

      if (error.message === 'Comment not found or unauthorized') {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: error.message
        });
        return;
      }

      next(error);
    }
  }
);

/**
 * DELETE /drafts/:draftId/comments/:commentId
 * Delete a comment
 */
router.delete('/:draftId/comments/:commentId', async (req, res, next): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { workspaceId } = req.workspace!;
    const authorId = req.user!.userId;

    await DraftCommentService.deleteComment(commentId, authorId, workspaceId.toString());

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error deleting draft comment', {
      commentId: req.params.commentId,
      error: error.message
    });

    if (error.message === 'Comment not found or unauthorized') {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message
      });
      return;
    }

    next(error);
  }
});

/**
 * POST /drafts/:draftId/comments/:commentId/resolve
 * Resolve a comment
 */
router.post('/:draftId/comments/:commentId/resolve', async (req, res, next): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { workspaceId } = req.workspace!;
    const userId = req.user!.userId;

    const comment = await DraftCommentService.resolveComment(commentId, userId, workspaceId.toString());

    res.json({
      success: true,
      data: comment
    });
  } catch (error: any) {
    logger.error('Error resolving draft comment', {
      commentId: req.params.commentId,
      error: error.message
    });

    if (error.message === 'Comment not found') {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message
      });
      return;
    }

    next(error);
  }
});

/**
 * DELETE /drafts/:draftId/comments/:commentId/resolve
 * Unresolve a comment
 */
router.delete('/:draftId/comments/:commentId/resolve', async (req, res, next): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { workspaceId } = req.workspace!;
    const userId = req.user!.userId;

    const comment = await DraftCommentService.unresolveComment(commentId, userId, workspaceId.toString());

    res.json({
      success: true,
      data: comment
    });
  } catch (error: any) {
    logger.error('Error unresolving draft comment', {
      commentId: req.params.commentId,
      error: error.message
    });

    if (error.message === 'Comment not found') {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message
      });
      return;
    }

    next(error);
  }
});

/**
 * GET /drafts/:draftId/comments/stats
 * Get comment statistics for a draft
 */
router.get('/:draftId/comments/stats', async (req, res, next): Promise<void> => {
  try {
    const { draftId } = req.params;
    const { workspaceId } = req.workspace!;

    const stats = await DraftCommentService.getCommentStats(draftId, workspaceId.toString());

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting draft comment stats', {
      draftId: req.params.draftId,
      error
    });
    next(error);
  }
});

/**
 * GET /drafts/:draftId/comments/position
 * Get comments by position (for inline comments)
 */
router.get('/:draftId/comments/position', async (req, res, next): Promise<void> => {
  try {
    const { draftId } = req.params;
    const { workspaceId } = req.workspace!;
    const { field, selectionStart, selectionEnd } = req.query;

    if (!field || selectionStart === undefined || selectionEnd === undefined) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'field, selectionStart, and selectionEnd are required'
      });
      return;
    }

    const comments = await DraftCommentService.getCommentsByPosition(
      draftId,
      workspaceId.toString(),
      field as string,
      parseInt(selectionStart as string),
      parseInt(selectionEnd as string)
    );

    res.json({
      success: true,
      data: comments
    });
  } catch (error) {
    logger.error('Error getting comments by position', {
      draftId: req.params.draftId,
      error
    });
    next(error);
  }
});

export default router;