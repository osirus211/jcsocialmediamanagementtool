/**
 * Workspace Service
 * 
 * Manages workspace operations and team collaboration
 */

import mongoose from 'mongoose';
import { Workspace, IWorkspace, WorkspacePlan } from '../models/Workspace';
import { WorkspaceMember, IWorkspaceMember, MemberRole } from '../models/WorkspaceMember';
import { WorkspaceActivityLog, ActivityAction, IWorkspaceActivityLog } from '../models/WorkspaceActivityLog';
import { WorkspaceInvitation, IWorkspaceInvitation, InvitationStatus } from '../models/WorkspaceInvitation';
import { workspacePermissionService, Permission } from './WorkspacePermissionService';
import { emailService } from './EmailService';
import { logger } from '../utils/logger';

export class WorkspaceService {
  /**
   * Create a new workspace
   */
  async createWorkspace(params: {
    name: string;
    slug: string;
    description?: string;
    ownerId: mongoose.Types.ObjectId;
    plan?: WorkspacePlan;
    timezone?: string;
    industry?: string;
  }): Promise<IWorkspace> {
    const { name, slug, description, ownerId, plan = WorkspacePlan.FREE, timezone = 'UTC', industry } = params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check if slug is already taken
      const existingWorkspace = await Workspace.findOne({ slug, isActive: true });
      if (existingWorkspace) {
        throw new Error('Workspace slug is already taken');
      }

      // Create workspace
      const workspace = new Workspace({
        name,
        slug: slug.toLowerCase(),
        description,
        ownerId,
        plan,
        settings: {
          requireApproval: false,
          allowedDomains: [],
          timezone,
          language: 'en',
          industry,
        },
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
        details: { name, slug, plan, timezone, industry },
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
    updates: Partial<Pick<IWorkspace, 'name' | 'slug' | 'description' | 'settings' | 'billingEmail' | 'clientPortal'>>;
  }): Promise<IWorkspace> {
    const { workspaceId, userId, updates } = params;

    // Check permission
    const member = await this.getMember(workspaceId, userId);
    if (!member || !workspacePermissionService.hasPermission(member.role, Permission.MANAGE_WORKSPACE)) {
      throw new Error('Insufficient permissions to update workspace');
    }

    // If updating slug, check uniqueness
    if (updates.slug) {
      const existingWorkspace = await Workspace.findOne({ 
        slug: updates.slug.toLowerCase(), 
        isActive: true,
        _id: { $ne: workspaceId }
      });
      if (existingWorkspace) {
        throw new Error('Workspace slug is already taken');
      }
      updates.slug = updates.slug.toLowerCase();
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
   * Remove member from workspace (legacy method - now calls fullyRemoveMember)
   */
  async removeMember(params: {
    workspaceId: mongoose.Types.ObjectId;
    removedBy: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
  }): Promise<void> {
    // Use the new fully remove method for backward compatibility
    return this.fullyRemoveMember(params);
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
   * Deactivate member (suspend without removing)
   */
  async deactivateMember(params: {
    workspaceId: mongoose.Types.ObjectId;
    deactivatedBy: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
  }): Promise<void> {
    const { workspaceId, deactivatedBy, userId } = params;

    // Check permission
    const deactivator = await this.getMember(workspaceId, deactivatedBy);
    if (!deactivator || !workspacePermissionService.hasPermission(deactivator.role, Permission.REMOVE_MEMBER)) {
      throw new Error('Insufficient permissions to deactivate members');
    }

    // Cannot deactivate owner
    const member = await WorkspaceMember.findOne({
      workspaceId,
      userId,
    });

    if (!member) {
      throw new Error('Member not found');
    }

    if (member.role === MemberRole.OWNER) {
      throw new Error('Cannot deactivate workspace owner');
    }

    if (!member.isActive) {
      throw new Error('Member is already deactivated');
    }

    // Cannot deactivate yourself
    if (userId.toString() === deactivatedBy.toString()) {
      throw new Error('Cannot deactivate yourself. Use leave workspace instead.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Deactivate member (keep record but mark inactive)
      await WorkspaceMember.findByIdAndUpdate(
        member._id,
        { 
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: deactivatedBy
        },
        { session }
      );

      // Update workspace usage
      await Workspace.findByIdAndUpdate(
        workspaceId,
        { $inc: { 'usage.currentMembers': -1 } },
        { session }
      );

      // Revoke active sessions for this user in this workspace
      await this.revokeUserSessions(userId, workspaceId);

      // Log activity
      await this.logActivity({
        workspaceId,
        userId: deactivatedBy,
        action: ActivityAction.MEMBER_REMOVED, // Using existing action
        resourceType: 'User',
        resourceId: userId,
        details: { action: 'deactivated' },
        session,
      });

      await session.commitTransaction();
      logger.info(`Member deactivated in workspace: ${workspaceId}`);
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to deactivate member:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Reactivate member
   */
  async reactivateMember(params: {
    workspaceId: mongoose.Types.ObjectId;
    reactivatedBy: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
  }): Promise<void> {
    const { workspaceId, reactivatedBy, userId } = params;

    // Check permission
    const reactivator = await this.getMember(workspaceId, reactivatedBy);
    if (!reactivator || !workspacePermissionService.hasPermission(reactivator.role, Permission.INVITE_MEMBER)) {
      throw new Error('Insufficient permissions to reactivate members');
    }

    // Find deactivated member
    const member = await WorkspaceMember.findOne({
      workspaceId,
      userId,
    });

    if (!member) {
      throw new Error('Member not found');
    }

    if (member.isActive) {
      throw new Error('Member is already active');
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
      // Reactivate member
      await WorkspaceMember.findByIdAndUpdate(
        member._id,
        { 
          isActive: true,
          reactivatedAt: new Date(),
          reactivatedBy: reactivatedBy,
          $unset: { deactivatedAt: 1, deactivatedBy: 1 }
        },
        { session }
      );

      // Update workspace usage
      await Workspace.findByIdAndUpdate(
        workspaceId,
        { $inc: { 'usage.currentMembers': 1 } },
        { session }
      );

      // Log activity
      await this.logActivity({
        workspaceId,
        userId: reactivatedBy,
        action: ActivityAction.MEMBER_INVITED, // Using existing action
        resourceType: 'User',
        resourceId: userId,
        details: { action: 'reactivated' },
        session,
      });

      await session.commitTransaction();
      logger.info(`Member reactivated in workspace: ${workspaceId}`);
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to reactivate member:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Fully remove member (delete record and revoke sessions)
   */
  async fullyRemoveMember(params: {
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
    const member = await WorkspaceMember.findOne({
      workspaceId,
      userId,
    });

    if (!member) {
      throw new Error('Member not found');
    }

    if (member.role === MemberRole.OWNER) {
      throw new Error('Cannot remove workspace owner');
    }

    // Cannot remove yourself
    if (userId.toString() === removedBy.toString()) {
      throw new Error('Cannot remove yourself. Use leave workspace instead.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Delete member record completely
      await WorkspaceMember.findByIdAndDelete(member._id, { session });

      // Update workspace usage if member was active
      if (member.isActive) {
        await Workspace.findByIdAndUpdate(
          workspaceId,
          { $inc: { 'usage.currentMembers': -1 } },
          { session }
        );
      }

      // Revoke active sessions for this user in this workspace
      await this.revokeUserSessions(userId, workspaceId);

      // Cancel any pending invitations for this user
      await this.cancelPendingInvitations(userId, workspaceId, session);

      // Reassign or archive their scheduled posts
      await this.handleMemberPostsOnRemoval(userId, workspaceId, session);

      // Log activity
      await this.logActivity({
        workspaceId,
        userId: removedBy,
        action: ActivityAction.MEMBER_REMOVED,
        resourceType: 'User',
        resourceId: userId,
        details: { action: 'fully_removed' },
        session,
      });

      await session.commitTransaction();
      logger.info(`Member fully removed from workspace: ${workspaceId}`);
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to fully remove member:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Revoke all active sessions for a user in a workspace
   */
  private async revokeUserSessions(userId: mongoose.Types.ObjectId, workspaceId: mongoose.Types.ObjectId): Promise<void> {
    try {
      // TODO: Implement session revocation when SessionService is available
      // For now, we'll log this action for future implementation
      logger.info(`Session revocation requested for user ${userId} in workspace ${workspaceId}`);
    } catch (error) {
      logger.warn('Failed to revoke user sessions:', error);
      // Don't fail the main operation if session revocation fails
    }
  }

  /**
   * Cancel pending invitations for a user
   */
  private async cancelPendingInvitations(userId: mongoose.Types.ObjectId, workspaceId: mongoose.Types.ObjectId, session: mongoose.ClientSession): Promise<void> {
    try {
      // Get user email to find invitations
      const { User } = await import('../models/User');
      const user = await User.findById(userId);
      
      if (user) {
        await WorkspaceInvitation.updateMany(
          {
            workspaceId,
            invitedEmail: user.email.toLowerCase(),
            status: InvitationStatus.PENDING
          },
          {
            status: InvitationStatus.REVOKED,
            revokedAt: new Date()
          },
          { session }
        );
      }
    } catch (error) {
      logger.warn('Failed to cancel pending invitations:', error);
      // Don't fail the main operation
    }
  }

  /**
   * Handle member's posts when they are removed
   */
  private async handleMemberPostsOnRemoval(userId: mongoose.Types.ObjectId, workspaceId: mongoose.Types.ObjectId, session: mongoose.ClientSession): Promise<void> {
    try {
      // TODO: Implement post handling when PostService is available
      // For now, we'll log this action for future implementation
      logger.info(`Post handling requested for user ${userId} removal from workspace ${workspaceId}`);
    } catch (error) {
      logger.warn('Failed to handle member posts on removal:', error);
      // Don't fail the main operation
    }
  }

  /**
   * Get workspace members (including deactivated ones)
   */
  async getMembers(workspaceId: mongoose.Types.ObjectId, includeDeactivated: boolean = true): Promise<IWorkspaceMember[]> {
    const query: any = { workspaceId };
    
    if (!includeDeactivated) {
      query.isActive = true;
    }

    return WorkspaceMember.find(query)
      .populate('userId', 'firstName lastName email avatar')
      .populate('invitedBy', 'firstName lastName email')
      .populate('deactivatedBy', 'firstName lastName email')
      .populate('reactivatedBy', 'firstName lastName email')
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

  /**
   * Invite user by email to workspace
   * Works for both existing and new users
   */
  async inviteByEmail(params: {
    workspaceId: mongoose.Types.ObjectId;
    invitedBy: mongoose.Types.ObjectId;
    email: string;
    role: 'admin' | 'member' | 'viewer';
  }): Promise<IWorkspaceInvitation> {
    const { workspaceId, invitedBy, email, role } = params;

    // Check permission
    const inviter = await this.getMember(workspaceId, invitedBy);
    if (!inviter || !workspacePermissionService.hasPermission(inviter.role, Permission.INVITE_MEMBER)) {
      throw new Error('Insufficient permissions to invite members');
    }

    // Get workspace and inviter details
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const { User } = await import('../models/User');
    const inviterUser = await User.findById(invitedBy);
    if (!inviterUser) {
      throw new Error('Inviter not found');
    }

    // Check if there's already a pending invitation
    const existingInvitation = await WorkspaceInvitation.findOne({
      workspaceId,
      invitedEmail: email.toLowerCase(),
      status: InvitationStatus.PENDING,
    });

    if (existingInvitation) {
      throw new Error('User already has a pending invitation to this workspace');
    }

    // Check if user is already a member
    const existingMember = await WorkspaceMember.findOne({
      workspaceId,
      userId: { $exists: true },
    }).populate('userId');

    const existingUserMember = existingMember && 
      typeof existingMember.userId === 'object' && 
      'email' in existingMember.userId &&
      existingMember.userId.email === email.toLowerCase();

    if (existingUserMember) {
      throw new Error('User is already a member of this workspace');
    }

    // Generate secure token
    const token = WorkspaceInvitation.generateToken();
    const tokenHash = WorkspaceInvitation.hashToken(token);

    // Create invitation
    const invitation = new WorkspaceInvitation({
      workspaceId,
      invitedEmail: email.toLowerCase(),
      invitedBy,
      role,
      token,
      tokenHash,
      inviterName: `${inviterUser.firstName} ${inviterUser.lastName}`,
      workspaceName: workspace.name,
    });

    await invitation.save();

    // Send invitation email
    try {
      await emailService.sendInvitationEmail({
        to: email,
        inviterName: `${inviterUser.firstName} ${inviterUser.lastName}`,
        workspaceName: workspace.name,
        role,
        inviteUrl: `${process.env.FRONTEND_URL}/accept-invite/${token}`,
        expiresAt: invitation.expiresAt,
      });
    } catch (error) {
      logger.error('Failed to send invitation email:', error);
      // Don't fail the invitation creation if email fails
    }

    // Log activity
    await this.logActivity({
      workspaceId,
      userId: invitedBy,
      action: ActivityAction.MEMBER_INVITED,
      resourceType: 'Invitation',
      resourceId: invitation._id,
      details: { email, role },
    });

    logger.info(`Email invitation sent to ${email} for workspace ${workspaceId}`);
    return invitation;
  }

  /**
   * Resend invitation email
   */
  async resendInvite(params: {
    workspaceId: mongoose.Types.ObjectId;
    token: string;
    userId: mongoose.Types.ObjectId;
  }): Promise<void> {
    const { workspaceId, token, userId } = params;

    // Check permission
    const member = await this.getMember(workspaceId, userId);
    if (!member || !workspacePermissionService.hasPermission(member.role, Permission.INVITE_MEMBER)) {
      throw new Error('Insufficient permissions to resend invitations');
    }

    // Find invitation
    const tokenHash = WorkspaceInvitation.hashToken(token);
    const invitation = await WorkspaceInvitation.findOne({
      workspaceId,
      tokenHash,
      status: { $in: [InvitationStatus.PENDING, InvitationStatus.EXPIRED] },
    });

    if (!invitation) {
      throw new Error('Invitation not found or already processed');
    }

    // Update expiry date (7 days from now)
    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    invitation.status = InvitationStatus.PENDING;
    await invitation.save();

    // Resend email
    try {
      await emailService.sendInvitationEmail({
        to: invitation.invitedEmail,
        inviterName: invitation.inviterName,
        workspaceName: invitation.workspaceName,
        role: invitation.role,
        inviteUrl: `${process.env.FRONTEND_URL}/accept-invite/${token}`,
        expiresAt: invitation.expiresAt,
      });
    } catch (error) {
      logger.error('Failed to resend invitation email:', error);
      throw new Error('Failed to resend invitation email');
    }

    logger.info(`Invitation resent to ${invitation.invitedEmail} for workspace ${workspaceId}`);
  }

  /**
   * Revoke pending invitation
   */
  async revokeInvite(params: {
    workspaceId: mongoose.Types.ObjectId;
    token: string;
    userId: mongoose.Types.ObjectId;
  }): Promise<void> {
    const { workspaceId, token, userId } = params;

    // Check permission
    const member = await this.getMember(workspaceId, userId);
    if (!member || !workspacePermissionService.hasPermission(member.role, Permission.INVITE_MEMBER)) {
      throw new Error('Insufficient permissions to revoke invitations');
    }

    // Find and revoke invitation
    const tokenHash = WorkspaceInvitation.hashToken(token);
    const invitation = await WorkspaceInvitation.findOne({
      workspaceId,
      tokenHash,
      status: InvitationStatus.PENDING,
    });

    if (!invitation) {
      throw new Error('Invitation not found or already processed');
    }

    await invitation.markAsRevoked();

    // Log activity
    await this.logActivity({
      workspaceId,
      userId,
      action: ActivityAction.MEMBER_REMOVED, // Using existing action for revocation
      resourceType: 'Invitation',
      resourceId: invitation._id,
      details: { email: invitation.invitedEmail, action: 'revoked' },
    });

    logger.info(`Invitation revoked for ${invitation.invitedEmail} in workspace ${workspaceId}`);
  }

  /**
   * Get pending invitations for workspace
   */
  async getPendingInvites(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    limit?: number;
    skip?: number;
    status?: string;
    search?: string;
    role?: string;
  }): Promise<IWorkspaceInvitation[]> {
    const { workspaceId, userId, limit = 50, skip = 0, status, search, role } = params;

    // Check permission
    const member = await this.getMember(workspaceId, userId);
    if (!member || !workspacePermissionService.hasPermission(member.role, Permission.INVITE_MEMBER)) {
      throw new Error('Insufficient permissions to view invitations');
    }

    // Build query
    const query: any = { workspaceId };

    // Status filter
    if (status && status !== 'all') {
      if (status === 'pending') {
        query.status = InvitationStatus.PENDING;
      } else if (status === 'expired') {
        query.status = InvitationStatus.EXPIRED;
      } else if (status === 'accepted') {
        query.status = InvitationStatus.ACCEPTED;
      } else if (status === 'revoked') {
        query.status = InvitationStatus.REVOKED;
      }
    } else {
      // Default: show pending and expired
      query.status = { $in: [InvitationStatus.PENDING, InvitationStatus.EXPIRED] };
    }

    // Role filter
    if (role && role !== 'all') {
      query.role = role;
    }

    // Search filter
    if (search) {
      query.$or = [
        { invitedEmail: { $regex: search, $options: 'i' } },
        { inviterName: { $regex: search, $options: 'i' } },
      ];
    }

    return WorkspaceInvitation.find(query)
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
  }

  /**
   * Accept invitation and join workspace
   * Handles both existing and new users
   */
  async acceptInvite(params: {
    token: string;
    userId?: mongoose.Types.ObjectId;
    newUserData?: {
      name: string;
      email: string;
      password: string;
    };
  }): Promise<{ workspace: IWorkspace; member: IWorkspaceMember; isNewUser: boolean }> {
    const { token, userId, newUserData } = params;

    // Find invitation
    const tokenHash = WorkspaceInvitation.hashToken(token);
    const invitation = await WorkspaceInvitation.findOne({
      tokenHash,
      status: InvitationStatus.PENDING,
    });

    if (!invitation || !invitation.isValid()) {
      throw new Error('Invalid or expired invitation');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let user;
      let isNewUser = false;

      if (userId) {
        // Existing user
        const { User } = await import('../models/User');
        user = await User.findById(userId);
        if (!user) {
          throw new Error('User not found');
        }

        // Verify email matches invitation
        if (user.email.toLowerCase() !== invitation.invitedEmail) {
          throw new Error('Email does not match invitation');
        }
      } else if (newUserData) {
        // New user signup
        const { User } = await import('../models/User');
        
        // Verify email matches invitation
        if (newUserData.email.toLowerCase() !== invitation.invitedEmail) {
          throw new Error('Email does not match invitation');
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: newUserData.email.toLowerCase() });
        if (existingUser) {
          throw new Error('User already exists with this email');
        }

        // Create new user
        user = new User({
          name: newUserData.name,
          email: newUserData.email.toLowerCase(),
          password: newUserData.password, // Will be hashed by User model
        });
        await user.save({ session });
        isNewUser = true;
      } else {
        throw new Error('Either userId or newUserData must be provided');
      }

      // Check if user is already a member
      const existingMember = await WorkspaceMember.findOne({
        workspaceId: invitation.workspaceId,
        userId: user._id,
      });

      if (existingMember && existingMember.isActive) {
        throw new Error('User is already a member of this workspace');
      }

      // Create or reactivate membership
      let member;
      if (existingMember) {
        // Reactivate existing member
        existingMember.isActive = true;
        existingMember.role = invitation.role as MemberRole;
        existingMember.joinedAt = new Date();
        member = await existingMember.save({ session });
      } else {
        // Create new member
        member = new WorkspaceMember({
          workspaceId: invitation.workspaceId,
          userId: user._id,
          role: invitation.role as MemberRole,
          invitedBy: invitation.invitedBy,
          invitedAt: invitation.createdAt,
          joinedAt: new Date(),
        });
        await member.save({ session });

        // Update workspace member count
        await Workspace.findByIdAndUpdate(
          invitation.workspaceId,
          { $inc: { 'usage.currentMembers': 1 } },
          { session }
        );
      }

      // Mark invitation as accepted
      invitation.status = InvitationStatus.ACCEPTED;
      invitation.acceptedAt = new Date();
      await invitation.save({ session });

      // Get workspace
      const workspace = await Workspace.findById(invitation.workspaceId);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Log activity
      await this.logActivity({
        workspaceId: invitation.workspaceId,
        userId: user._id,
        action: ActivityAction.MEMBER_JOINED,
        resourceType: 'User',
        resourceId: user._id,
        details: { role: invitation.role, fromInvitation: true },
        session,
      });

      await session.commitTransaction();

      logger.info(`User ${user.email} accepted invitation and joined workspace ${invitation.workspaceId}`);

      return { workspace, member, isNewUser };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to accept invitation:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Bulk cancel invitations
   */
  async bulkCancelInvites(params: {
    workspaceId: mongoose.Types.ObjectId;
    tokens: string[];
    userId: mongoose.Types.ObjectId;
  }): Promise<{ successCount: number; failureCount: number; errors: string[] }> {
    const { workspaceId, tokens, userId } = params;

    // Check permissions
    const member = await this.getMember(workspaceId, userId);
    if (!member || !workspacePermissionService.hasPermission(member.role, Permission.MANAGE_TEAM)) {
      throw new Error('Insufficient permissions to cancel invitations');
    }

    const results = {
      successCount: 0,
      failureCount: 0,
      errors: [] as string[],
    };

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const token of tokens) {
        try {
          const tokenHash = WorkspaceInvitation.hashToken(token);
          const invitation = await WorkspaceInvitation.findOne({
            workspaceId,
            tokenHash,
            status: InvitationStatus.PENDING,
          }).session(session);

          if (!invitation) {
            results.failureCount++;
            results.errors.push(`Invitation not found: ${token.substring(0, 8)}...`);
            continue;
          }

          await invitation.markAsRevoked();
          results.successCount++;

          // Log activity
          await this.logActivity({
            workspaceId,
            userId,
            action: ActivityAction.MEMBER_REMOVED,
            details: {
              invitedEmail: invitation.invitedEmail,
              role: invitation.role,
              token: token.substring(0, 8) + '...',
            },
            session,
          });
        } catch (error: any) {
          results.failureCount++;
          results.errors.push(`Failed to cancel ${token.substring(0, 8)}...: ${error.message}`);
        }
      }

      await session.commitTransaction();
      logger.info(`Bulk cancelled ${results.successCount} invitations for workspace ${workspaceId}`);
      return results;
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to bulk cancel invitations:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get invitation statistics
   */
  async getInvitationStats(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
  }): Promise<{
    totalSent: number;
    pending: number;
    accepted: number;
    expired: number;
    revoked: number;
    acceptanceRate: number;
  }> {
    const { workspaceId, userId } = params;

    // Check permissions
    const member = await this.getMember(workspaceId, userId);
    if (!member || !workspacePermissionService.hasPermission(member.role, Permission.MANAGE_TEAM)) {
      throw new Error('Insufficient permissions to view invitation statistics');
    }

    try {
      const stats = await WorkspaceInvitation.aggregate([
        { $match: { workspaceId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      const statusCounts = stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {} as Record<string, number>);

      const totalSent = stats.reduce((sum, stat) => sum + stat.count, 0);
      const pending = statusCounts[InvitationStatus.PENDING] || 0;
      const accepted = statusCounts[InvitationStatus.ACCEPTED] || 0;
      const expired = statusCounts[InvitationStatus.EXPIRED] || 0;
      const revoked = statusCounts[InvitationStatus.REVOKED] || 0;

      // Calculate acceptance rate (accepted / (accepted + expired + revoked))
      const totalProcessed = accepted + expired + revoked;
      const acceptanceRate = totalProcessed > 0 ? (accepted / totalProcessed) * 100 : 0;

      return {
        totalSent,
        pending,
        accepted,
        expired,
        revoked,
        acceptanceRate: Math.round(acceptanceRate * 100) / 100, // Round to 2 decimal places
      };
    } catch (error) {
      logger.error('Failed to get invitation stats:', error);
      throw error;
    }
  }
}

export const workspaceService = new WorkspaceService();
