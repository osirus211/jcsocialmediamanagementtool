import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { WorkspaceMember, MemberRole } from '../models/WorkspaceMember';
import { Workspace } from '../models/Workspace';
import { UnauthorizedError, ForbiddenError, BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import { workspacePermissionService, Permission } from '../services/WorkspacePermissionService';

// Extend Express Request to include workspace context
declare global {
  namespace Express {
    interface Request {
      workspace?: {
        workspaceId: mongoose.Types.ObjectId;
        role: MemberRole;
        memberId: mongoose.Types.ObjectId;
      };
    }
  }
}

/**
 * Tenant middleware - Enforces multi-tenant data isolation
 * 
 * CRITICAL SECURITY:
 * - Extracts workspaceId from request (header or param)
 * - Validates user is an active member of the workspace
 * - Attaches workspace context to request
 * - Blocks unauthorized access
 * 
 * USAGE:
 * - Apply to all tenant-scoped routes
 * - Must be used AFTER requireAuth middleware
 * - Ensures all queries include workspaceId filter
 */
export const requireWorkspace = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    logger.info('RUNTIME_TRACE TENANT_CHECK', { timestamp: new Date().toISOString() });
    // Ensure user is authenticated
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Extract workspaceId from header or route param
    const workspaceIdStr =
      req.headers['x-workspace-id'] as string ||
      req.params.workspaceId ||
      req.body.workspaceId;

    if (!workspaceIdStr) {
      throw new BadRequestError('Workspace ID is required');
    }

    // Validate workspaceId format
    if (!mongoose.Types.ObjectId.isValid(workspaceIdStr)) {
      throw new BadRequestError('Invalid workspace ID format');
    }

    const workspaceId = new mongoose.Types.ObjectId(workspaceIdStr);

    // Check if user is blocked from this workspace
    const { WorkspaceMemberBlocklist } = await import('../models/WorkspaceMemberBlocklist');
    const blocked = await WorkspaceMemberBlocklist.findOne({
      workspaceId,
      userId: req.user.userId,
    });

    if (blocked) {
      logger.warn('Blocked user attempted workspace access', {
        userId: req.user.userId,
        workspaceId: workspaceId.toString(),
        removedAt: blocked.removedAt,
        ip: req.ip,
        securityEvent: true,
      });
      throw new ForbiddenError('Your access to this workspace has been revoked');
    }

    // Check if workspace exists and is not deleted
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      deletedAt: null,
    });

    if (!workspace) {
      throw new ForbiddenError('Workspace not found or has been deleted');
    }

    // Check if user is an active member of the workspace
    const membership = await WorkspaceMember.findOne({
      workspaceId,
      userId: req.user.userId,
      isActive: true,
    });

    if (!membership || !membership.workspaceId) {
      // Log non-member access attempt to Winston security log
      logger.warn('Unauthorized workspace access attempt', {
        userId: req.user.userId,
        workspaceId: workspaceId.toString(),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        method: req.method,
        reason: !membership ? 'No membership found' : 'Null workspace in membership',
        securityEvent: true
      });
      logger.error('RUNTIME_TRACE TENANT_FAILED', { timestamp: new Date().toISOString() });
      throw new ForbiddenError('You do not have access to this workspace');
    }

    logger.info('RUNTIME_TRACE TENANT_SUCCESS', { timestamp: new Date().toISOString() });
    // Attach workspace context to request
    req.workspace = {
      workspaceId: membership.workspaceId,
      role: membership.role,
      memberId: membership._id,
    };

    logger.debug('Workspace context attached', {
      userId: req.user.userId,
      workspaceId: workspaceId.toString(),
      role: membership.role,
    });

    next();
  } catch (error) {
    logger.error('Tenant middleware error:', error);
    next(error);
  }
};

/**
 * Role-based authorization middleware
 * Requires user to have one of the specified roles in the workspace
 * 
 * USAGE:
 * - Apply AFTER requireWorkspace middleware
 * - Enforces role-based access control (RBAC)
 * 
 * @param allowedRoles - Array of roles that are allowed to access the route
 */
export const requireWorkspaceRole = (...allowedRoles: MemberRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.workspace) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (!allowedRoles.includes(req.workspace.role)) {
        logger.warn('Insufficient workspace permissions', {
          userId: req.user?.userId,
          workspaceId: req.workspace.workspaceId.toString(),
          userRole: req.workspace.role,
          requiredRoles: allowedRoles,
        });
        throw new ForbiddenError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`
        );
      }

      next();
    } catch (error) {
      logger.error('Role authorization error:', error);
      next(error);
    }
  };
};

/**
 * Owner-only middleware
 * Requires user to be the workspace owner
 */
export const requireOwner = requireWorkspaceRole(MemberRole.OWNER);

/**
 * Admin or Owner middleware
 * Requires user to be admin or owner
 */
export const requireAdmin = requireWorkspaceRole(MemberRole.OWNER, MemberRole.ADMIN);

/**
 * Member or above middleware
 * Requires user to be at least a member (excludes viewers)
 */
export const requireMember = requireWorkspaceRole(
  MemberRole.OWNER,
  MemberRole.ADMIN,
  MemberRole.MEMBER
);

/**
 * Optional workspace middleware
 * Attaches workspace context if workspaceId is provided, but doesn't require it
 * Useful for routes that can work with or without workspace context
 */
export const optionalWorkspace = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next();
    }

    const workspaceIdStr =
      req.headers['x-workspace-id'] as string ||
      req.params.workspaceId ||
      req.body.workspaceId;

    if (!workspaceIdStr || !mongoose.Types.ObjectId.isValid(workspaceIdStr)) {
      return next();
    }

    const workspaceId = new mongoose.Types.ObjectId(workspaceIdStr);

    const membership = await WorkspaceMember.findOne({
      workspaceId,
      userId: req.user.userId,
      isActive: true,
    });

    if (membership) {
      req.workspace = {
        workspaceId: membership.workspaceId,
        role: membership.role,
        memberId: membership._id,
      };
    }

    next();
  } catch (error) {
    // Don't fail if optional workspace context fails
    next();
  }
};

/**
 * Workspace ownership check
 * Verifies that the authenticated user is the owner of the workspace
 */
export const verifyWorkspaceOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user || !req.workspace) {
      throw new UnauthorizedError('Authentication and workspace context required');
    }

    const workspace = await Workspace.findOne({
      _id: req.workspace.workspaceId,
      deletedAt: null,
    });

    if (!workspace) {
      throw new ForbiddenError('Workspace not found');
    }

    if (workspace.ownerId.toString() !== req.user.userId) {
      throw new ForbiddenError('Only the workspace owner can perform this action');
    }

    next();
  } catch (error) {
    logger.error('Ownership verification error:', error);
    next(error);
  }
};
/**
 * Permission-based authorization middleware
 * Requires user to have a specific permission in the workspace
 * 
 * @param permission - The permission required to access the route
 */
export const requirePermission = (permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.workspace) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (!workspacePermissionService.hasPermission(req.workspace.role, permission)) {
        // Log failed permission check to WorkspaceActivityLog
        try {
          const { workspaceService } = await import('../services/WorkspaceService');
          await workspaceService.logActivityPublic({
            workspaceId: req.workspace.workspaceId,
            userId: new mongoose.Types.ObjectId(req.user.userId),
            action: 'LOGIN_FAILED' as any, // Using existing action for security events
            details: {
              action: 'permission_denied',
              requiredPermission: permission,
              userRole: req.workspace.role,
              endpoint: req.path,
              method: req.method
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          });
        } catch (logError) {
          logger.error('Failed to log permission denial:', logError);
        }

        logger.warn('Insufficient workspace permissions', {
          userId: req.user?.userId,
          workspaceId: req.workspace.workspaceId.toString(),
          userRole: req.workspace.role,
          requiredPermission: permission,
        });
        throw new ForbiddenError(
          `Access denied. Required permission: ${workspacePermissionService.getPermissionDescription(permission)}`
        );
      }

      next();
    } catch (error) {
      logger.error('Permission authorization error:', error);
      next(error);
    }
  };
};