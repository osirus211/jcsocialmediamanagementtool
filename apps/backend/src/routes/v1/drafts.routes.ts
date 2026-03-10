/**
 * Drafts Routes
 * 
 * API endpoints for collaborative draft editing
 */

import { Router } from 'express';
import { z } from 'zod';
import { Post, PostStatus } from '../../models/Post';
import { DraftCollaborationService } from '../../services/DraftCollaborationService';
import { authMiddleware } from '../../middleware/auth.middleware';
import { workspaceMiddleware } from '../../middleware/workspace.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { logger } from '../../utils/logger';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(authMiddleware);
router.use(workspaceMiddleware);

// Validation schemas
const autoSaveSchema = z.object({
  content: z.string().min(1).max(10000),
  platformContent: z.array(z.object({
    platform: z.string(),
    text: z.string().optional(),
    mediaIds: z.array(z.string()).optional(),
    enabled: z.boolean().default(true),
  })).optional(),
  version: z.number().int().positive().optional(),
});

/**
 * GET /drafts
 * List all drafts for workspace
 */
router.get('/', async (req, res, next) => {
  try {
    const { workspaceId } = req.workspace!;
    const { limit = 50, skip = 0 } = req.query;

    const drafts = await Post.find({
      workspaceId,
      status: PostStatus.DRAFT,
    })
      .populate('createdBy', 'name email')
      .populate('lastEditedBy', 'name email')
      .populate('lockedBy', 'name email')
      .sort({ updatedAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));

    const total = await Post.countDocuments({
      workspaceId,
      status: PostStatus.DRAFT,
    });

    res.json({
      success: true,
      data: {
        drafts,
        pagination: {
          total,
          limit: Number(limit),
          skip: Number(skip),
          hasMore: Number(skip) + drafts.length < total,
        },
      },
    });
  } catch (error) {
    logger.error('Error listing drafts', { error });
    next(error);
  }
});

/**
 * GET /drafts/:id
 * Get single draft with lock status
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { workspaceId } = req.workspace!;

    const draft = await Post.findOne({
      _id: id,
      workspaceId,
      status: PostStatus.DRAFT,
    })
      .populate('createdBy', 'name email')
      .populate('lastEditedBy', 'name email')
      .populate('lockedBy', 'name email')
      .populate('socialAccountIds', 'platform accountName');

    if (!draft) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
    }

    res.json({
      success: true,
      data: draft,
    });
  } catch (error) {
    logger.error('Error getting draft', { draftId: req.params.id, error });
    next(error);
  }
});

/**
 * GET /drafts/:id/status
 * Get lightweight lock and version status (for polling)
 */
router.get('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { workspaceId } = req.workspace!;

    // Verify draft exists and belongs to workspace
    const draft = await Post.findOne({
      _id: id,
      workspaceId,
      status: PostStatus.DRAFT,
    });

    if (!draft) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
    }

    const status = await DraftCollaborationService.getDraftStatus(id);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Error getting draft status', { draftId: req.params.id, error });
    next(error);
  }
});

/**
 * POST /drafts/:id/lock
 * Acquire edit lock
 */
router.post('/:id/lock', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { workspaceId } = req.workspace!;
    const userId = req.user!._id.toString();

    // Verify draft exists and belongs to workspace
    const draft = await Post.findOne({
      _id: id,
      workspaceId,
      status: PostStatus.DRAFT,
    });

    if (!draft) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
    }

    const result = await DraftCollaborationService.acquireLock(id, userId);

    if (!result.success) {
      return res.status(409).json({
        success: false,
        error: 'Draft is currently being edited by another user',
        data: result,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error acquiring lock', { draftId: req.params.id, error });
    next(error);
  }
});

/**
 * DELETE /drafts/:id/lock
 * Release edit lock
 */
router.delete('/:id/lock', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { workspaceId } = req.workspace!;
    const userId = req.user!._id.toString();

    // Verify draft exists and belongs to workspace
    const draft = await Post.findOne({
      _id: id,
      workspaceId,
      status: PostStatus.DRAFT,
    });

    if (!draft) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
    }

    await DraftCollaborationService.releaseLock(id, userId);

    res.json({
      success: true,
      message: 'Lock released successfully',
    });
  } catch (error) {
    logger.error('Error releasing lock', { draftId: req.params.id, error });
    next(error);
  }
});

/**
 * POST /drafts/:id/lock/renew
 * Renew edit lock
 */
router.post('/:id/lock/renew', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { workspaceId } = req.workspace!;
    const userId = req.user!._id.toString();

    // Verify draft exists and belongs to workspace
    const draft = await Post.findOne({
      _id: id,
      workspaceId,
      status: PostStatus.DRAFT,
    });

    if (!draft) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
    }

    const result = await DraftCollaborationService.renewLock(id, userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error renewing lock', { draftId: req.params.id, error });
    next(error);
  }
});

/**
 * POST /drafts/:id/autosave
 * Auto-save draft content
 */
router.post('/:id/autosave', validateRequest(autoSaveSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { workspaceId } = req.workspace!;
    const userId = req.user!._id.toString();
    const { content, platformContent, version } = req.body;

    // Verify draft exists and belongs to workspace
    const draft = await Post.findOne({
      _id: id,
      workspaceId,
      status: PostStatus.DRAFT,
    });

    if (!draft) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
    }

    // Check version conflict if provided
    if (version && draft.version !== version) {
      return res.status(409).json({
        success: false,
        error: 'Version conflict detected',
        data: {
          saved: false,
          version: draft.version,
          conflict: true,
        },
      });
    }

    const result = await DraftCollaborationService.autoSaveDraft(
      id,
      userId,
      content,
      platformContent
    );

    if (result.conflict) {
      return res.status(409).json({
        success: false,
        error: 'Version conflict detected',
        data: result,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error auto-saving draft', { draftId: req.params.id, error });
    next(error);
  }
});

export default router;