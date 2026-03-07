import { Request, Response, NextFunction } from 'express';
import { permissionService } from '../services/PermissionService';
import { logger } from '../utils/logger';

/**
 * Structured 403 error response
 */
interface ForbiddenError {
  error: string;
  message: string;
  code: 'FORBIDDEN';
  details?: {
    userId?: string;
    workspaceId?: string;
    postId?: string;
    requiredPermission: string;
  };
}

/**
 * Create structured 403 error response
 */
function createForbiddenError(
  message: string,
  requiredPermission: string,
  context: { userId?: string; workspaceId?: string; postId?: string }
): ForbiddenError {
  return {
    error: 'Forbidden',
    message,
    code: 'FORBIDDEN',
    details: {
      ...context,
      requiredPermission,
    },
  };
}

/**
 * Middleware: Require user to be workspace owner
 * 
 * Expects:
 * - req.user.id (from JWT)
 * - req.params.workspaceId OR req.body.workspaceId
 */
export const requireOwner = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract userId from JWT
    const userId = req.user?.userId;
    if (!userId) {
      logger.warn('RBAC: Missing user ID in request', { path: req.path });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    // Resolve workspaceId from params or body
    const workspaceId = req.params.workspaceId || req.body.workspaceId;
    if (!workspaceId) {
      logger.warn('RBAC: Missing workspace ID', { userId, path: req.path });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Workspace ID required',
        code: 'BAD_REQUEST',
      });
      return;
    }

    // Check ownership
    const isOwner = await permissionService.isWorkspaceOwner(userId, workspaceId);
    
    if (!isOwner) {
      logger.warn('RBAC: Permission denied - not workspace owner', {
        userId,
        workspaceId,
        path: req.path,
        method: req.method,
      });
      
      res.status(403).json(
        createForbiddenError(
          'You must be the workspace owner to perform this action',
          'workspace:owner',
          { userId, workspaceId }
        )
      );
      return;
    }

    // Permission granted
    logger.debug('RBAC: Permission granted - workspace owner', {
      userId,
      workspaceId,
      path: req.path,
    });
    
    next();
  } catch (error: any) {
    logger.error('RBAC: Error in requireOwner middleware', {
      error: error.message,
      stack: error.stack,
      path: req.path,
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Permission check failed',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Middleware: Require user to be workspace owner OR admin
 * 
 * Expects:
 * - req.user.id (from JWT)
 * - req.params.workspaceId OR req.body.workspaceId
 */
export const requireAdminOrOwner = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract userId from JWT
    const userId = req.user?.userId;
    if (!userId) {
      logger.warn('RBAC: Missing user ID in request', { path: req.path });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    // Resolve workspaceId from params or body
    const workspaceId = req.params.workspaceId || req.body.workspaceId;
    if (!workspaceId) {
      logger.warn('RBAC: Missing workspace ID', { userId, path: req.path });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Workspace ID required',
        code: 'BAD_REQUEST',
      });
      return;
    }

    // Check admin or owner permission
    const hasPermission = await permissionService.isAdminOrOwner(userId, workspaceId);
    
    if (!hasPermission) {
      logger.warn('RBAC: Permission denied - not admin or owner', {
        userId,
        workspaceId,
        path: req.path,
        method: req.method,
      });
      
      res.status(403).json(
        createForbiddenError(
          'You must be a workspace owner or admin to perform this action',
          'workspace:admin_or_owner',
          { userId, workspaceId }
        )
      );
      return;
    }

    // Permission granted
    logger.debug('RBAC: Permission granted - admin or owner', {
      userId,
      workspaceId,
      path: req.path,
    });
    
    next();
  } catch (error: any) {
    logger.error('RBAC: Error in requireAdminOrOwner middleware', {
      error: error.message,
      stack: error.stack,
      path: req.path,
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Permission check failed',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Middleware: Require user to own the post OR be workspace admin
 * 
 * Expects:
 * - req.user.id (from JWT)
 * - req.params.postId OR req.params.id
 */
export const requirePostOwnershipOrAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract userId from JWT
    const userId = req.user?.userId;
    if (!userId) {
      logger.warn('RBAC: Missing user ID in request', { path: req.path });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    // Resolve postId from params
    const postId = req.params.postId || req.params.id;
    if (!postId) {
      logger.warn('RBAC: Missing post ID', { userId, path: req.path });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Post ID required',
        code: 'BAD_REQUEST',
      });
      return;
    }

    // Check post access permission
    const hasAccess = await permissionService.canAccessPost(userId, postId);
    
    if (!hasAccess) {
      logger.warn('RBAC: Permission denied - not post owner or admin', {
        userId,
        postId,
        path: req.path,
        method: req.method,
      });
      
      res.status(403).json(
        createForbiddenError(
          'You must own this post or be a workspace admin to perform this action',
          'post:owner_or_admin',
          { userId, postId }
        )
      );
      return;
    }

    // Permission granted
    logger.debug('RBAC: Permission granted - post owner or admin', {
      userId,
      postId,
      path: req.path,
    });
    
    next();
  } catch (error: any) {
    logger.error('RBAC: Error in requirePostOwnershipOrAdmin middleware', {
      error: error.message,
      stack: error.stack,
      path: req.path,
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Permission check failed',
      code: 'INTERNAL_ERROR',
    });
  }
};
