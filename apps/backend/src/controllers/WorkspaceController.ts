import { Request, Response, NextFunction } from 'express';
import { WorkspaceService } from '../services/WorkspaceService';
import { WorkspaceRole } from '../models/WorkspaceMember';
import { logger } from '../utils/logger';
import { getPaginationParams } from '../utils/pagination';
import { logAudit } from '../utils/auditLogger';
import mongoose from 'mongoose';

const workspaceService = new WorkspaceService();

export class WorkspaceController {
  /**
   * Create a new workspace
   * POST /api/v1/workspaces
   */
  static async createWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, slug, description, timezone, industry } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const workspace = await workspaceService.createWorkspace({
        name,
        slug,
        description,
        ownerId: new mongoose.Types.ObjectId(userId),
        timezone,
        industry,
      });

      // Audit log: Workspace created
      logAudit({
        userId,
        workspaceId: workspace._id.toString(),
        action: 'workspace.created',
        entityType: 'workspace',
        entityId: workspace._id.toString(),
        metadata: {
          name: workspace.name,
          slug: workspace.slug,
          description: workspace.description,
          plan: workspace.plan,
          timezone,
          industry,
        },
        req,
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

      const workspaces = await workspaceService.getUserWorkspaces(new mongoose.Types.ObjectId(userId));

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
  static async getWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;

      const workspace = await workspaceService.getWorkspace(new mongoose.Types.ObjectId(workspaceId));

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
  static async updateWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const { name, settings } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const workspace = await workspaceService.updateWorkspace({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(userId),
        updates: { name, settings },
      });

      // Audit log: Workspace updated
      logAudit({
        userId,
        workspaceId,
        action: 'workspace.updated',
        entityType: 'workspace',
        entityId: workspaceId,
        metadata: {
          name: workspace.name,
          updatedFields: Object.keys({ name, settings }).filter(key => 
            req.body[key] !== undefined
          ),
        },
        req,
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
   * Upload workspace logo
   * POST /api/v1/workspaces/:workspaceId/logo
   */
  static async uploadLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No logo file provided' });
        return;
      }

      // TODO: Implement actual file upload to cloud storage
      // For now, we'll simulate the upload similar to avatar upload
      const logoUrl = `/uploads/workspace-logos/${workspaceId}-${Date.now()}.${req.file.originalname.split('.').pop()}`;

      // Get current workspace to merge clientPortal settings
      const currentWorkspace = await workspaceService.getWorkspace(new mongoose.Types.ObjectId(workspaceId));
      if (!currentWorkspace) {
        res.status(404).json({ error: 'Workspace not found' });
        return;
      }

      const workspace = await workspaceService.updateWorkspace({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(userId),
        updates: { 
          clientPortal: {
            ...currentWorkspace.clientPortal,
            logoUrl 
          }
        },
      });

      // Audit log: Workspace logo uploaded
      logAudit({
        userId,
        workspaceId,
        action: 'workspace.logo_uploaded',
        entityType: 'workspace',
        entityId: workspaceId,
        metadata: {
          logoUrl,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        },
        req,
      });

      res.status(200).json({
        message: 'Workspace logo uploaded successfully',
        logoUrl,
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

      await workspaceService.deleteWorkspace({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(userId),
      });

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
  static async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;

      const members = await workspaceService.getMembers(new mongoose.Types.ObjectId(workspaceId));

      res.status(200).json({
        members,
        count: members.length,
      });
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

      // First, find the user by email to get their ID
      const { User } = await import('../models/User');
      const invitedUser = await User.findOne({ email });
      
      if (!invitedUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const membership = await workspaceService.inviteMember({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        invitedBy: new mongoose.Types.ObjectId(userId),
        userId: invitedUser._id,
        role: role || WorkspaceRole.MEMBER,
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

      await workspaceService.removeMember({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        removedBy: new mongoose.Types.ObjectId(userId),
        userId: new mongoose.Types.ObjectId(memberUserId),
      });

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

      const membership = await workspaceService.changeMemberRole({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        changedBy: new mongoose.Types.ObjectId(req.user?.userId || ''),
        userId: new mongoose.Types.ObjectId(memberUserId),
        newRole: role,
      });

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

      // Transfer ownership by changing roles
      await workspaceService.changeMemberRole({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        changedBy: new mongoose.Types.ObjectId(userId),
        userId: new mongoose.Types.ObjectId(newOwnerId),
        newRole: WorkspaceRole.OWNER,
      });

      // Change current owner to admin
      await workspaceService.changeMemberRole({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        changedBy: new mongoose.Types.ObjectId(userId),
        userId: new mongoose.Types.ObjectId(userId),
        newRole: WorkspaceRole.ADMIN,
      });

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

      await workspaceService.removeMember({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        removedBy: new mongoose.Types.ObjectId(userId),
        userId: new mongoose.Types.ObjectId(userId),
      });

      res.status(200).json({
        message: 'Left workspace successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
