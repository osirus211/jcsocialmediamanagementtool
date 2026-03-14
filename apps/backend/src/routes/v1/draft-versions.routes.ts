/**
 * Draft Versions Routes
 * 
 * API endpoints for draft version history
 */

import { Router } from 'express';
import { z } from 'zod';
import { DraftVersionService } from '../../services/DraftVersionService';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { logger } from '../../utils/logger';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

// Validation schemas
const createVersionSchema = z.object({
  body: z.object({
    content: z.string().min(1),
    platformContent: z.array(z.object({
      platform: z.string(),
      text: z.string().optional(),
      mediaIds: z.array(z.string()).optional(),
      enabled: z.boolean().default(true)
    })).optional(),
    changeDescription: z.string().max(500).optional()
  })
});

/**
 * GET /drafts/:draftId/versions
 * Get version history for a draft
 */
router.get('/:draftId/versions', async (req, res, next): Promise<void> => {
  try {
    const { draftId } = req.params;
    const { workspaceId } = req.workspace!;
    const { limit = 50, offset = 0 } = req.query;

    const result = await DraftVersionService.getVersionHistory(
      draftId,
      workspaceId.toString(),
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error getting version history', {
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
 * GET /drafts/:draftId/versions/:version
 * Get a specific version
 */
router.get('/:draftId/versions/:version', async (req, res, next): Promise<void> => {
  try {
    const { draftId, version } = req.params;
    const { workspaceId } = req.workspace!;

    const versionDoc = await DraftVersionService.getVersion(
      draftId,
      parseInt(version),
      workspaceId.toString()
    );

    if (!versionDoc) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Version not found'
      });
      return;
    }

    res.json({
      success: true,
      data: versionDoc
    });
  } catch (error: any) {
    logger.error('Error getting version', {
      draftId: req.params.draftId,
      version: req.params.version,
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
 * POST /drafts/:draftId/versions
 * Create a new version manually
 */
router.post(
  '/:draftId/versions',
  validateRequest(createVersionSchema),
  async (req, res, next): Promise<void> => {
    try {
      const { draftId } = req.params;
      const { workspaceId } = req.workspace!;
      const changedBy = req.user!.userId;
      const versionData = req.body;

      const version = await DraftVersionService.createVersion(
        draftId,
        workspaceId.toString(),
        changedBy,
        {
          ...versionData,
          changeType: 'manual'
        }
      );

      res.status(201).json({
        success: true,
        data: version
      });
    } catch (error: any) {
      logger.error('Error creating version', {
        draftId: req.params.draftId,
        error: error.message
      });

      if (error.message === 'Draft not found') {
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
 * POST /drafts/:draftId/versions/:version/restore
 * Restore draft to a specific version
 */
router.post('/:draftId/versions/:version/restore', async (req, res, next): Promise<void> => {
  try {
    const { draftId, version } = req.params;
    const { workspaceId } = req.workspace!;
    const restoredBy = req.user!.userId;

    const newVersion = await DraftVersionService.restoreToVersion(
      draftId,
      parseInt(version),
      workspaceId.toString(),
      restoredBy
    );

    res.json({
      success: true,
      data: newVersion,
      message: `Draft restored to version ${version}`
    });
  } catch (error: any) {
    logger.error('Error restoring version', {
      draftId: req.params.draftId,
      version: req.params.version,
      error: error.message
    });

    if (error.message === 'Version not found' || error.message === 'Draft not found') {
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

export default router;