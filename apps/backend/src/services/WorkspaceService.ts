/**
 * Workspace Service
 * 
 * Manages workspace operations and team collaboration
 */

import mongoose from 'mongoose';
import { Workspace, IWorkspace, WorkspacePlan } from '../models/Workspace';
import { WorkspaceMember, IWorkspaceMember, MemberRole } from '../models/WorkspaceMember';
import { WorkspaceActivityLog, ActivityAction, IWorkspaceActivityLog } from '../models/WorkspaceActivityLog';
import { workspacePermissionService, Permission } from './WorkspacePermissionService';
import { logger } from '../utils/logger';

export class WorkspaceService {
  /**
   * Create a new workspace
   */
  async createWorkspace(params: {
    name: string;
    ownerId: mongoose.Types.ObjectId;
    plan?: WorkspacePlan;
  }): Promise<IWorkspace> {
    const { name, ownerId, plan = WorkspacePlan.FREE } = params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create workspace
      const workspace = new Workspace({
        name,
        ownerId,
        plan,
        usage: {
          currentMembers: 1,
          currentPosts: 0,
          currentSocialAccounts: 0,
        },
      });
      await workspace.save({ session });

      // Add owner as member
      const member = new WorkspaceMember({
        workspaceId: workspace._id,
        userId: ownerId,
        role: MemberRole.OWNER,
        joinedAt: new Date(),
      });
      await member.save({ session });

      // Log activity
      await this.logActivity({
        workspaceId: workspace._id,
        userId: ownerId,
        action: ActivityAction.WORKSPACE_CREATED,
        details: { name, plan },
        session,
      });

      await session.commitTransaction();
      logger.info(`Workspace created: ${workspace._id}`);
      return workspace;
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to create workspace:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get workspace by ID
   */
  async getWorkspace(workspaceId: mongoose.Types.ObjectId): Promise<IWorkspace | null> {
    return Workspace.findOne({ _id: workspaceId, isActive: true });
  }

  /**
   * Get user's workspaces
   */
  async getUserWorkspaces(userId: mongoose.Types.ObjectId): Promise<IWorkspace[]> {
    const memberships = await WorkspaceMember.find({
      userId,
      isActive: true,
    }).select('workspaceId');

    const workspaceIds = memberships.map((m) => m.workspaceId);

    return Workspace.find({
      _id: { $in: workspaceIds },
      isActive: true,
    }).sort({ updatedAt: -1 });
  }

  /**
   * Update workspace
   */
  async updateWorkspace(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    updates: Partial<Pick<IWorkspace, 'name' | 'settings' | 'billingEmail' | 'clientPortal'>>;
  }): Promise<IWorkspace> {
    const { workspaceId, userId, updates } = params;

    // Check permission
    const member = await this.getMember(workspaceId, userId);
    if (!member || !workspacePermissionService.hasPermission(member.role, Permission.MANAGE_WORKSPACE)) {
      throw new Error('Insufficient permissions to update workspace');
    }

    const workspace = await Workspace.findByIdAndUpdate(
      workspaceId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Log activity
    await this.logActivity({
      workspaceId,
      userId,
      action: ActivityAction.WORKSPACE_UPDATED,
      details: updates,
    });

    logger.info(`Workspace updated: ${workspaceId}`);
    return workspace;
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
  }): Promise<void> {
    const { workspaceId, userId } = params;

    // Check permission (only owner can delete)
    const member = await this.getMember(workspaceId, userId);
    if (!member || member.role !== MemberRole.OWNER) {
      throw new Error('Only workspace owner can delete workspace');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Soft delete workspace
      await Workspace.findByIdAndUpdate(
        workspaceId,
        { isActive: false },
        { session }
      );

      // Deactivate all members
      await WorkspaceMember.updateMany(
        { workspaceId },
        { isActive: false },
        { session }
      );

      // Log activity
      await this.logActivity({
        workspaceId,
        userId,
        action: ActivityAction.WORKSPACE_DELETED,
        session,
      });

      await session.commitTransaction();
      logger.info(`Workspace deleted: ${workspaceId}`);
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to delete workspace:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Invite member to workspace
   */
  async inviteMember(params: {
    workspaceId: mongoose.Types.ObjectId;
    invitedBy: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    role: MemberRole;
  }): Promise<IWorkspaceMember> {
    const { workspaceId, invitedBy, userId, role } = params;

    // Check permission
    const inviter = await this.getMember(workspaceId, invitedBy);
    if (!inviter || !workspacePermissionService.hasPermission(inviter.role, Permission.INVITE_MEMBER)) {
      throw new Error('Insufficient permissions to invite members');
    }

    // Check if user is already a member
    const existingMember = await WorkspaceMember.findOne({
      workspaceId,
      userId,
    });

    if (existingMember) {
      if (existingMember.isActive) {
        throw new Error('User is already a member of this workspace');
      }
      // Reactivate member
      existingMember.isActive = true;
      existingMember.role = role;
      existingMember.invitedBy = invitedBy;
      existingMember.invitedAt = new Date();
      existingMember.joinedAt = new Date();
      await existingMember.save();
      return existingMember;
    }

    // Check workspace limits
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (workspace.usage.currentMembers >= workspace.limits.maxMembers) {
      throw new Error('Workspace member limit reached');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create member
      const member = new WorkspaceMember({
        workspaceId,
        userId,
        role,
        invitedBy,
        invitedAt: new Date(),
        joinedAt: new Date(),
      });
      await member.save({ session });

      // Update workspace usage
      await Workspace.findByIdAndUpdate(
        workspaceId,
        { $inc: { 'usage.currentMembers': 1 } },
        { session }
      );

      // Log activity
      await this.logActivity({
        workspaceId,
        userId: invitedBy,
        action: ActivityAction.MEMBER_INVITED,
        resourceType: 'User',
        resourceId: userId,
        details: { role },
        session,
      });

      await session.commitTransaction();
      logger.info(`Member invited to workspace: ${workspaceId}`);
      return member;
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to invite member:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Remove member from workspace
   */
  async removeMember(params: {
    workspaceId: mongoose.Types.ObjectId;
    removedBy: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
  }): Promise<void> {
    const { workspaceId, removedBy, userId } = params;

    // Check permission
    const remover = await this.getMember(workspaceId, removedBy);
    if (!remover || !workspacePermissionService.hasPermission(remover.role, Permission.REMOVE_MEMBER)) {
      throw new Error('Insufficient permissions to remove members');
    }

    // Cannot remove owner
    const member = await this.getMember(workspaceId, userId);
    if (!member) {
      throw new Error('Member not found');
    }

    if (member.role === MemberRole.OWNER) {
      throw new Error('Cannot remove workspace owner');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Deactivate member
      await WorkspaceMember.findByIdAndUpdate(
        member._id,
        { isActive: false },
        { session }
      );

      // Update workspace usage
      await Workspace.findByIdAndUpdate(
        workspaceId,
        { $inc: { 'usage.currentMembers': -1 } },
        { session }
      );

      // Log activity
      await this.logActivity({
        workspaceId,
        userId: removedBy,
        action: ActivityAction.MEMBER_REMOVED,
        resourceType: 'User',
        resourceId: userId,
        session,
      });

      await session.commitTransaction();
      logger.info(`Member removed from workspace: ${workspaceId}`);
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to remove member:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Change member role
   */
  async changeMemberRole(params: {
    workspaceId: mongoose.Types.ObjectId;
    changedBy: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    newRole: MemberRole;
  }): Promise<IWorkspaceMember> {
    const { workspaceId, changedBy, userId, newRole } = params;

    // Check permission
    const changer = await this.getMember(workspaceId, changedBy);
    if (!changer) {
      throw new Error('You are not a member of this workspace');
    }

    const member = await this.getMember(workspaceId, userId);
    if (!member) {
      throw new Error('Member not found');
    }

    // Validate role change
    const validation = workspacePermissionService.canChangeRole({
      currentUserRole: changer.role,
      targetUserRole: member.role,
      newRole,
    });

    if (!validation.allowed) {
      throw new Error(validation.reason || 'Cannot change role');
    }

    // Update role
    member.role = newRole;
    await member.save();

    // Log activity
    await this.logActivity({
      workspaceId,
      userId: changedBy,
      action: ActivityAction.MEMBER_ROLE_CHANGED,
      resourceType: 'User',
      resourceId: userId,
      details: { oldRole: member.role, newRole },
    });

    logger.info(`Member role changed in workspace: ${workspaceId}`);
    return member;
  }

  /**
   * Get workspace members
   */
  async getMembers(workspaceId: mongoose.Types.ObjectId): Promise<IWorkspaceMember[]> {
    return WorkspaceMember.find({
      workspaceId,
      isActive: true,
    })
      .populate('userId', 'name email')
      .sort({ role: 1, joinedAt: 1 });
  }

  /**
   * Get member
   */
  async getMember(
    workspaceId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<IWorkspaceMember | null> {
    return WorkspaceMember.findOne({
      workspaceId,
      userId,
      isActive: true,
    });
  }

  /**
   * Check if user has permission
   */
  async hasPermission(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    permission: Permission;
    resourceOwnerId?: string;
  }): Promise<boolean> {
    const { workspaceId, userId, permission, resourceOwnerId } = params;

    const member = await this.getMember(workspaceId, userId);
    if (!member) {
      return false;
    }

    return workspacePermissionService.canPerformAction({
      role: member.role,
      permission,
      resourceOwnerId,
      userId: userId.toString(),
    });
  }

  /**
   * Log activity
   */
  private async logActivity(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    action: ActivityAction;
    resourceType?: string;
    resourceId?: mongoose.Types.ObjectId;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    session?: mongoose.ClientSession;
  }): Promise<void> {
    const log = new WorkspaceActivityLog(params);
    await log.save({ session: params.session });
  }

  /**
   * Get activity logs
   */
  async getActivityLogs(params: {
    workspaceId: mongoose.Types.ObjectId;
    limit?: number;
    skip?: number;
    action?: ActivityAction;
  }): Promise<IWorkspaceActivityLog[]> {
    const { workspaceId, limit = 50, skip = 0, action } = params;

    const query: any = { workspaceId };
    if (action) {
      query.action = action;
    }

    return WorkspaceActivityLog.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
  }

  /**
   * Update workspace usage
   */
  async updateUsage(params: {
    workspaceId: mongoose.Types.ObjectId;
    field: 'currentPosts' | 'currentSocialAccounts';
    increment: number;
  }): Promise<void> {
    const { workspaceId, field, increment } = params;

    await Workspace.findByIdAndUpdate(workspaceId, {
      $inc: { [`usage.${field}`]: increment },
    });
  }

  /**
   * Check workspace limits
   */
  async checkLimit(params: {
    workspaceId: mongoose.Types.ObjectId;
    field: 'maxPosts' | 'maxSocialAccounts' | 'maxMembers';
  }): Promise<{ allowed: boolean; current: number; limit: number }> {
    const { workspaceId, field } = params;

    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const usageField = field.replace('max', 'current') as keyof typeof workspace.usage;
    const current = workspace.usage[usageField];
    const limit = workspace.limits[field];

    return {
      allowed: current < limit,
      current,
      limit,
    };
  }
}

export const workspaceService = new WorkspaceService();
