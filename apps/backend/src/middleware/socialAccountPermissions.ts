import { Request, Response, NextFunction } from 'express';
import { workspacePermissionService, Permission } from '../services/WorkspacePermissionService';
import { logger } from '../utils/logger';

/**
 * Middleware to check social account permissions
 * Ensures users have proper permissions to connect/disconnect social accounts
 */
export const requireSocialAccountPermission = (permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    try {
      if (!req.workspace) {
        return res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Workspace context required'
        });
      }

      const hasPermission = workspacePermissionService.hasPermission(
        req.workspace.role,
        permission
      );

      if (!hasPermission) {
        logger.warn('Social account permission denied', {
          userId: req.user?.userId,
          workspaceId: req.workspace.workspaceId.toString(),
          userRole: req.workspace.role,
          requiredPermission: permission,
          endpoint: req.path,
          method: req.method
        });

        return res.status(403).json({
          code: 'FORBIDDEN',
          message: `Access denied. Required permission: ${workspacePermissionService.getPermissionDescription(permission)}`,
          details: {
            userRole: req.workspace.role,
            requiredPermission: permission
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Social account permission check error:', error);
      next(error);
    }
  };
};

/**
 * Require permission to connect social accounts
 */
export const requireConnectAccount = requireSocialAccountPermission(Permission.CONNECT_ACCOUNT);

/**
 * Require permission to disconnect social accounts
 */
export const requireDisconnectAccount = requireSocialAccountPermission(Permission.DISCONNECT_ACCOUNT);