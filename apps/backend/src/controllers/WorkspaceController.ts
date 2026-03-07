import { Request, Response, NextFunction } from 'express';
import { WorkspaceService } from '../services/WorkspaceService';
import { WorkspaceRole } from '../models/WorkspaceMember';
import { logger } from '../utils/logger';
import { getPaginationParams } from '../utils/pagination';
import { logAudit } from '../utils/auditLogger';

export class WorkspaceController {
  /**
   * Create a new workspace
   * POST /api/v1/workspaces
   */
  static async createWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, slug } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const workspace = await WorkspaceService.createWorkspace({
        name,
        slug,
        ownerId: userId,
      });

      res.status(201).json({
        message: 'Workspace created successfully',
        workspace,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all workspaces for current user
   * GET /api/v1/workspaces
   */
  static async getUserWorkspaces(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const workspaces = await WorkspaceService.getUserWorkspaces(userId);

      res.status(200).json({
        workspaces,
        count: workspaces.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get workspace by ID
   * GET /api/v1/workspaces/:workspaceId
   */
  static async getWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params;

      const workspace = await WorkspaceService.getWorkspaceById(workspaceId);

      res.status(200).json({
        workspace,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update workspace
   * PATCH /api/v1/workspaces/:workspaceId
   */
  static async updateWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params;
      const { name, slug, settings } = req.body;

      const workspace = await WorkspaceService.updateWorkspace(workspaceId, {
        name,
        slug,
        settings,
      });

      res.status(200).json({
        message: 'Workspace updated successfully',
        workspace,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete workspace (soft delete)
   * DELETE /api/v1/workspaces/:workspaceId
   */
  static async deleteWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await WorkspaceService.deleteWorkspace(workspaceId, userId);

      // Audit log: Workspace deleted
      logAudit({
        userId,
        workspaceId,
        action: 'workspace.deleted',
        entityType: 'workspace',
        entityId: workspaceId,
        req,
      });

      res.status(200).json({
        message: 'Workspace deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get workspace members
   * GET /api/v1/workspaces/:workspaceId/members
   */
  static async getMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params;

      // Get pagination params using utility
      const { page, limit, skip } = getPaginationParams(req.query);

      const result = await WorkspaceService.getWorkspaceMembers(
        workspaceId,
        page,
        limit,
        skip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Invite member to workspace
   * POST /api/v1/workspaces/:workspaceId/members
   */
  static async inviteMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const { email, role } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const membership = await WorkspaceService.inviteMember({
        workspaceId,
        email,
        role: role || WorkspaceRole.MEMBER,
        invitedBy: userId,
      });

      res.status(201).json({
        message: 'Member invited successfully',
        membership,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove member from workspace
   * DELETE /api/v1/workspaces/:workspaceId/members/:userId
   */
  static async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId, userId: memberUserId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await WorkspaceService.removeMember(workspaceId, memberUserId, userId);

      res.status(200).json({
        message: 'Member removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update member role
   * PATCH /api/v1/workspaces/:workspaceId/members/:userId
   */
  static async updateMemberRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId, userId: memberUserId } = req.params;
      const { role } = req.body;

      // Get old role before update for audit log
      const { WorkspaceMember } = await import('../models/WorkspaceMember');
      const oldMembership = await WorkspaceMember.findOne({
        workspaceId,
        userId: memberUserId,
      });
      const oldRole = oldMembership?.role;

      const membership = await WorkspaceService.updateMemberRole(
        workspaceId,
        memberUserId,
        role
      );

      // Audit log: Member role changed
      logAudit({
        userId: req.user?.userId,
        workspaceId,
        action: 'member.role_changed',
        entityType: 'member',
        entityId: memberUserId,
        metadata: {
          oldRole,
          newRole: role,
        },
        req,
      });

      res.status(200).json({
        message: 'Member role updated successfully',
        membership,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Transfer workspace ownership
   * POST /api/v1/workspaces/:workspaceId/transfer-ownership
   */
  static async transferOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const { newOwnerId } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await WorkspaceService.transferOwnership(workspaceId, userId, newOwnerId);

      res.status(200).json({
        message: 'Ownership transferred successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Leave workspace
   * POST /api/v1/workspaces/:workspaceId/leave
   */
  static async leaveWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await WorkspaceService.leaveWorkspace(workspaceId, userId);

      res.status(200).json({
        message: 'Left workspace successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
