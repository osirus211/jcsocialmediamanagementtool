import { Router } from 'express';
import { z } from 'zod';
import { AccountPermissionService } from '../../services/AccountPermissionService';
import { requireAdminOrOwner } from '../../middleware/rbac';
import { validateRequest } from '../../middleware/validation';
import { logger } from '../../utils/logger';

const router = Router();

// Validation schemas
const setPermissionSchema = z.object({
  body: z.object({
    canPost: z.boolean().optional(),
    canViewAnalytics: z.boolean().optional(),
    canManage: z.boolean().optional(),
  }),
});

const bulkSetPermissionsSchema = z.object({
  body: z.object({
    permissions: z.array(
      z.object({
        socialAccountId: z.string(),
        canPost: z.boolean(),
        canViewAnalytics: z.boolean(),
        canManage: z.boolean(),
      })
    ),
  }),
});

/**
 * GET /account-permissions/:userId
 * Get all account permissions for a member
 */
router.get('/:userId', requireAdminOrOwner, async (req, res) => {
  try {
    const { userId } = req.params;
    const workspaceId = req.workspace?.workspaceId?.toString();

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Workspace context required',
      });
    }

    const permissions = await AccountPermissionService.getAccountPermissions(
      workspaceId,
      userId
    );

    res.json({
      success: true,
      data: permissions,
    });
  } catch (error: any) {
    logger.error('Error getting account permissions', {
      userId: req.params.userId,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get account permissions',
    });
  }
});

/**
 * PUT /account-permissions/:userId/:socialAccountId
 * Set permissions for user + account
 */
router.put(
  '/:userId/:socialAccountId',
  requireAdminOrOwner,
  validateRequest(setPermissionSchema),
  async (req, res) => {
    try {
      const { userId, socialAccountId } = req.params;
      const workspaceId = req.workspace?.workspaceId?.toString();
      const grantedBy = req.user?.userId;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Workspace context required',
        });
      }

      if (!grantedBy) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      const permission = await AccountPermissionService.setAccountPermission(
        workspaceId,
        userId,
        socialAccountId,
        req.body,
        grantedBy
      );

      res.json({
        success: true,
        data: permission,
      });
    } catch (error: any) {
      logger.error('Error setting account permission', {
        userId: req.params.userId,
        socialAccountId: req.params.socialAccountId,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to set account permission',
      });
    }
  }
);

/**
 * DELETE /account-permissions/:userId/:socialAccountId
 * Remove custom permissions (revert to default)
 */
router.delete('/:userId/:socialAccountId', requireAdminOrOwner, async (req, res) => {
  try {
    const { userId, socialAccountId } = req.params;
    const workspaceId = req.workspace?.workspaceId?.toString();

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Workspace context required',
      });
    }

    await AccountPermissionService.removeAccountPermission(
      workspaceId,
      userId,
      socialAccountId
    );

    res.json({
      success: true,
      message: 'Account permission removed successfully',
    });
  } catch (error: any) {
    logger.error('Error removing account permission', {
      userId: req.params.userId,
      socialAccountId: req.params.socialAccountId,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to remove account permission',
    });
  }
});

/**
 * GET /account-permissions/:userId/effective
 * Get effective permissions summary
 */
router.get('/:userId/effective', requireAdminOrOwner, async (req, res) => {
  try {
    const { userId } = req.params;
    const workspaceId = req.workspace?.workspaceId?.toString();

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Workspace context required',
      });
    }

    const permissions = await AccountPermissionService.getWorkspaceMemberPermissions(
      workspaceId,
      userId
    );

    if (!permissions) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Member not found in workspace',
      });
    }

    res.json({
      success: true,
      data: permissions,
    });
  } catch (error: any) {
    logger.error('Error getting effective permissions', {
      userId: req.params.userId,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get effective permissions',
    });
  }
});

/**
 * POST /account-permissions/:userId/bulk
 * Bulk set permissions for all accounts
 */
router.post(
  '/:userId/bulk',
  requireAdminOrOwner,
  validateRequest(bulkSetPermissionsSchema),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { permissions } = req.body;
      const workspaceId = req.workspace?.workspaceId?.toString();
      const grantedBy = req.user?.userId;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Workspace context required',
        });
      }

      if (!grantedBy) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      const results = await AccountPermissionService.bulkSetPermissions(
        workspaceId,
        userId,
        permissions,
        grantedBy
      );

      res.json({
        success: true,
        data: results,
      });
    } catch (error: any) {
      logger.error('Error bulk setting permissions', {
        userId: req.params.userId,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to bulk set permissions',
      });
    }
  }
);

export default router;