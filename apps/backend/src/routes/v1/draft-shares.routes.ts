/**
 * Draft Shares Routes
 * 
 * API endpoints for draft sharing functionality
 */

import { Router } from 'express';
import { z } from 'zod';
import { DraftShareService } from '../../services/DraftShareService';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { logger } from '../../utils/logger';

const router = Router();

// Validation schemas
const createShareSchema = z.object({
  body: z.object({
    permissions: z.object({
      canView: z.boolean().default(true),
      canComment: z.boolean().default(false),
      canEdit: z.boolean().default(false)
    }),
    expiresAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
    password: z.string().min(4).max(50).optional()
  })
});

const updateShareSchema = z.object({
  body: z.object({
    permissions: z.object({
      canView: z.boolean(),
      canComment: z.boolean(),
      canEdit: z.boolean()
    }).optional(),
    expiresAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
    password: z.string().min(4).max(50).optional()
  })
});

const accessShareSchema = z.object({
  body: z.object({
    password: z.string().optional()
  })
});

/**
 * POST /drafts/:draftId/shares
 * Create a new share link for a draft
 */
router.post(
  '/:draftId/shares',
  requireAuth,
  requireWorkspace,
  validateRequest(createShareSchema),
  async (req, res, next): Promise<void> => {
    try {
      const { draftId } = req.params;
      const { workspaceId } = req.workspace!;
      const createdBy = req.user!.userId;
      const shareData = req.body;

      const share = await DraftShareService.createShare(
        draftId,
        workspaceId.toString(),
        createdBy,
        shareData
      );

      // Generate share URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const shareUrl = `${baseUrl}/shared/draft/${share.shareToken}`;

      res.status(201).json({
        success: true,
        data: {
          ...share.toJSON(),
          shareUrl
        }
      });
    } catch (error: any) {
      logger.error('Error creating draft share', {
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
  }
);

/**
 * GET /drafts/:draftId/shares
 * Get all shares for a draft
 */
router.get(
  '/:draftId/shares',
  requireAuth,
  requireWorkspace,
  async (req, res, next): Promise<void> => {
    try {
      const { draftId } = req.params;
      const { workspaceId } = req.workspace!;
      const userId = req.user!.userId;

      const shares = await DraftShareService.getSharesForDraft(draftId, workspaceId.toString(), userId);

      // Add share URLs to each share
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const sharesWithUrls = shares.map(share => ({
        ...share.toJSON(),
        shareUrl: `${baseUrl}/shared/draft/${share.shareToken}`
      }));

      res.json({
        success: true,
        data: sharesWithUrls
      });
    } catch (error: any) {
      logger.error('Error getting draft shares', {
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
  }
);

/**
 * PATCH /drafts/:draftId/shares/:shareId
 * Update share permissions
 */
router.patch(
  '/:draftId/shares/:shareId',
  requireAuth,
  requireWorkspace,
  validateRequest(updateShareSchema),
  async (req, res, next): Promise<void> => {
    try {
      const { shareId } = req.params;
      const { workspaceId } = req.workspace!;
      const userId = req.user!.userId;
      const updates = req.body;

      const share = await DraftShareService.updateShare(shareId, workspaceId.toString(), userId, updates);

      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.json({
        success: true,
        data: {
          ...share.toJSON(),
          shareUrl: `${baseUrl}/shared/draft/${share.shareToken}`
        }
      });
    } catch (error: any) {
      logger.error('Error updating draft share', {
        shareId: req.params.shareId,
        error: error.message
      });

      if (error.message === 'Share not found or unauthorized') {
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
 * DELETE /drafts/:draftId/shares/:shareId
 * Revoke a share link
 */
router.delete(
  '/:draftId/shares/:shareId',
  requireAuth,
  requireWorkspace,
  async (req, res, next): Promise<void> => {
    try {
      const { shareId } = req.params;
      const { workspaceId } = req.workspace!;
      const userId = req.user!.userId;

      await DraftShareService.revokeShare(shareId, workspaceId.toString(), userId);

      res.json({
        success: true,
        message: 'Share link revoked successfully'
      });
    } catch (error: any) {
      logger.error('Error revoking draft share', {
        shareId: req.params.shareId,
        error: error.message
      });

      if (error.message === 'Share not found or unauthorized') {
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
 * POST /shared/draft/:shareToken
 * Access a shared draft (public endpoint)
 */
router.post(
  '/shared/draft/:shareToken',
  validateRequest(accessShareSchema),
  async (req, res, next): Promise<void> => {
    try {
      const { shareToken } = req.params;
      const { password } = req.body;
      const userAgent = req.get('User-Agent');
      const ipAddress = req.ip;

      const result = await DraftShareService.accessSharedDraft({
        shareToken,
        password,
        userAgent,
        ipAddress
      });

      if (!result.hasAccess) {
        res.status(401).json({
          success: false,
          error: 'PASSWORD_REQUIRED',
          message: 'Password required to access this draft',
          data: {
            requiresPassword: true,
            permissions: result.share.permissions
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          draft: result.draft,
          permissions: result.share.permissions,
          shareInfo: {
            accessCount: result.share.accessCount,
            expiresAt: result.share.expiresAt
          }
        }
      });
    } catch (error: any) {
      logger.error('Error accessing shared draft', {
        shareToken: req.params.shareToken,
        error: error.message
      });

      if (error.message === 'Share link not found or expired') {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: error.message
        });
        return;
      }

      if (error.message === 'Invalid password') {
        res.status(401).json({
          success: false,
          error: 'INVALID_PASSWORD',
          message: error.message
        });
        return;
      }

      next(error);
    }
  }
);

/**
 * GET /shared/draft/:shareToken
 * Get shared draft info (public endpoint)
 */
router.get('/shared/draft/:shareToken', async (req, res, next): Promise<void> => {
  try {
    const { shareToken } = req.params;

    const result = await DraftShareService.accessSharedDraft({
      shareToken
    });

    // Return basic info without requiring password
    res.json({
      success: true,
      data: {
        requiresPassword: !!result.share.password,
        permissions: result.share.permissions,
        expiresAt: result.share.expiresAt,
        isValid: result.share.isActive && (!result.share.expiresAt || result.share.expiresAt > new Date())
      }
    });
  } catch (error: any) {
    logger.error('Error getting shared draft info', {
      shareToken: req.params.shareToken,
      error: error.message
    });

    if (error.message === 'Share link not found or expired') {
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