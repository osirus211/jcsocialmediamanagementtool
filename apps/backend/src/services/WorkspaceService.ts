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
  }): Promise<IWorkspaceInvitation[]> {
    const { workspaceId, userId, limit = 50, skip = 0 } = params;

    // Check permission
    const member = await this.getMember(workspaceId, userId);
    if (!member || !workspacePermissionService.hasPermission(member.role, Permission.INVITE_MEMBER)) {
      throw new Error('Insufficient permissions to view invitations');
    }

    return WorkspaceInvitation.find({
      workspaceId,
      status: { $in: [InvitationStatus.PENDING, InvitationStatus.EXPIRED] },
    })
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
}

export const workspaceService = new WorkspaceService();
