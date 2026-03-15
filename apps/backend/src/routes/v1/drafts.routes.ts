/**
 * Drafts Routes
 * 
 * API endpoints for collaborative draft editing
 */

import { Router } from 'express';
import { z } from 'zod';
import { Post, PostStatus } from '../../models/Post';
import { DraftCollaborationService } from '../../services/DraftCollaborationService';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { logger } from '../../utils/logger';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

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
router.get('/', async (req, res, next): Promise<void> => {
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
router.get('/:id', async (req, res, next): Promise<void> => {
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
      res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
      return;
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
router.get('/:id/status', async (req, res, next): Promise<void> => {
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
      res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
      return;
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
router.post('/:id/lock', async (req, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const { workspaceId } = req.workspace!;
    const userId = req.user!.userId;

    // Verify draft exists and belongs to workspace
    const draft = await Post.findOne({
      _id: id,
      workspaceId,
      status: PostStatus.DRAFT,
    });

    if (!draft) {
      res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
      return;
    }

    const result = await DraftCollaborationService.acquireLock(id, userId);

    if (!result.success) {
      res.status(409).json({
        success: false,
        error: 'Draft is currently being edited by another user',
        data: result,
      });
      return;
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
router.delete('/:id/lock', async (req, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const { workspaceId } = req.workspace!;
    const userId = req.user!.userId;

    // Verify draft exists and belongs to workspace
    const draft = await Post.findOne({
      _id: id,
      workspaceId,
      status: PostStatus.DRAFT,
    });

    if (!draft) {
      res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
      return;
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
router.post('/:id/lock/renew', async (req, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const { workspaceId } = req.workspace!;
    const userId = req.user!.userId;

    // Verify draft exists and belongs to workspace
    const draft = await Post.findOne({
      _id: id,
      workspaceId,
      status: PostStatus.DRAFT,
    });

    if (!draft) {
      res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
      return;
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
router.post('/:id/autosave', validateRequest(autoSaveSchema), async (req, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const { workspaceId } = req.workspace!;
    const userId = req.user!.userId;
    const { content, platformContent, version } = req.body;

    // Verify draft exists and belongs to workspace
    const draft = await Post.findOne({
      _id: id,
      workspaceId,
      status: PostStatus.DRAFT,
    });

    if (!draft) {
      res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
      return;
    }

    // Check version conflict if provided
    if (version && draft.version !== version) {
      res.status(409).json({
        success: false,
        error: 'Version conflict detected',
        data: {
          saved: false,
          version: draft.version,
          conflict: true,
        },
      });
      return;
    }

    const result = await DraftCollaborationService.autoSaveDraft(
      id,
      userId,
      content,
      platformContent
    );

    if (result.conflict) {
      res.status(409).json({
        success: false,
        error: 'Version conflict detected',
        data: result,
      });
      return;
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

/**
 * POST /drafts/:id/duplicate
 * Duplicate a draft
 */
router.post('/:id/duplicate', async (req, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const { workspaceId } = req.workspace!;
    const userId = req.user!.userId;

    // Get original draft
    const originalDraft = await Post.findOne({
      _id: id,
      workspaceId,
      status: PostStatus.DRAFT,
    });

    if (!originalDraft) {
      res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
      return;
    }

    // Create duplicate
    const duplicatedDraft = new Post({
      workspaceId,
      createdBy: userId,
      status: PostStatus.DRAFT,
      content: originalDraft.content,
      platformContent: originalDraft.platformContent,
      socialAccountIds: originalDraft.socialAccountIds,
      mediaIds: originalDraft.mediaIds,
      version: 1,
    });

    await duplicatedDraft.save();

    // Populate for response
    await duplicatedDraft.populate('createdBy', 'name email');
    await duplicatedDraft.populate('socialAccountIds', 'platform accountName');

    res.json({
      success: true,
      data: duplicatedDraft,
    });
  } catch (error) {
    logger.error('Error duplicating draft', { draftId: req.params.id, error });
    next(error);
  }
});

/**
 * DELETE /drafts/:id
 * Delete a draft
 */
router.delete('/:id', async (req, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const { workspaceId } = req.workspace!;
    const userId = req.user!.userId;

    // Find and verify ownership/permissions
    const draft = await Post.findOne({
      _id: id,
      workspaceId,
      status: PostStatus.DRAFT,
    });

    if (!draft) {
      res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
      return;
    }

    // Check if user can delete (owner or admin)
    if (draft.createdBy?.toString() !== userId) {
      // TODO: Add proper permission check for workspace admins
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions to delete this draft',
      });
      return;
    }

    // Release any locks before deletion
    await DraftCollaborationService.releaseLock(id, userId);

    // Delete the draft
    await Post.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Draft deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting draft', { draftId: req.params.id, error });
    next(error);
  }
});

export default router;
