/**
 * Invitation Controller
 * 
 * Handles workspace invitation endpoints
 */

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { workspaceService } from '../services/WorkspaceService';
import { WorkspaceInvitation } from '../models/WorkspaceInvitation';
import { MemberRole } from '../models/WorkspaceMember';
import { logger } from '../utils/logger';
import { logAudit } from '../utils/auditLogger';

export class InvitationController {
  /**
   * Create invitation
   * POST /api/v1/workspaces/:workspaceId/invitations
   */
  static async createInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const { email, role } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!email || !role) {
        res.status(400).json({ error: 'Email and role are required' });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }

      // Validate role
      if (!['admin', 'member', 'viewer'].includes(role)) {
        res.status(400).json({ error: 'Invalid role. Must be admin, member, or viewer' });
        return;
      }

      const invitation = await workspaceService.inviteByEmail({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        invitedBy: new mongoose.Types.ObjectId(userId),
        email,
        role,
      });

      // Audit log the invitation creation
      const { SecurityAuditService } = await import('../services/SecurityAuditService');
      const { SecurityEventType } = await import('../models/SecurityEvent');
      const auditService = new SecurityAuditService();
      
      await auditService.logEvent({
        type: SecurityEventType.ROLE_CHANGE,
        userId: new mongoose.Types.ObjectId(userId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        resource: 'workspace_invitation',
        action: 'create',
        success: true,
        metadata: {
          invitedEmail: email,
          role,
          expiresAt: invitation.expiresAt,
          invitationId: invitation._id.toString(),
        },
      });

      res.status(201).json({
        message: 'Invitation sent successfully',
        invitation: {
          _id: invitation._id,
          email: invitation.invitedEmail,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        },
      });
    } catch (error: any) {
      logger.error('Create invitation error:', error);
      
      if (error.message.includes('already has a pending invitation')) {
        res.status(409).json({ error: error.message });
        return;
      }
      
      if (error.message.includes('already a member')) {
        res.status(409).json({ error: error.message });
        return;
      }
      
      if (error.message.includes('Insufficient permissions')) {
        res.status(403).json({ error: error.message });
        return;
      }

      next(error);
    }
  }

  /**
   * Get pending invitations
   * GET /api/v1/workspaces/:workspaceId/invitations
   */
  static async getPendingInvitations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const userId = req.user?.userId;
      const { page = 1, limit = 50, status, search, role } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const skip = (Number(page) - 1) * Number(limit);

      const invitations = await workspaceService.getPendingInvites({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(userId),
        limit: Number(limit),
        skip,
        status: status as string,
        search: search as string,
        role: role as string,
      });

      // Format response to include token for frontend actions
      const formattedInvitations = invitations.map(invitation => ({
        _id: invitation._id,
        token: invitation.token,
        invitedEmail: invitation.invitedEmail,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        inviterName: invitation.inviterName,
      }));

      res.json({
        invitations: formattedInvitations,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: invitations.length,
        },
      });
    } catch (error: any) {
      logger.error('Get pending invitations error:', error);
      
      if (error.message.includes('Insufficient permissions')) {
        res.status(403).json({ error: error.message });
        return;
      }

      next(error);
    }
  }

  /**
   * Resend invitation
   * POST /api/v1/workspaces/:workspaceId/invitations/:token/resend
   */
  static async resendInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId, token } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await workspaceService.resendInvite({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        token,
        userId: new mongoose.Types.ObjectId(userId),
      });

      // Audit log the invitation resend
      logAudit({
        userId: new mongoose.Types.ObjectId(userId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        action: 'invitation.resent',
        entityType: 'invitation',
        metadata: {
          token: token.substring(0, 8) + '...', // Only log partial token for security
        },
        req,
      });

      res.json({ message: 'Invitation resent successfully' });
    } catch (error: any) {
      logger.error('Resend invitation error:', error);
      
      if (error.message.includes('Insufficient permissions')) {
        res.status(403).json({ error: error.message });
        return;
      }
      
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }

      next(error);
    }
  }

  /**
   * Revoke invitation
   * DELETE /api/v1/workspaces/:workspaceId/invitations/:token
   */
  static async revokeInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId, token } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await workspaceService.revokeInvite({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        token,
        userId: new mongoose.Types.ObjectId(userId),
      });

      // Audit log the invitation revocation
      logAudit({
        userId: new mongoose.Types.ObjectId(userId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        action: 'invitation.revoked',
        entityType: 'invitation',
        metadata: {
          token: token.substring(0, 8) + '...', // Only log partial token for security
        },
        req,
      });

      res.json({ message: 'Invitation revoked successfully' });
    } catch (error: any) {
      logger.error('Revoke invitation error:', error);
      
      if (error.message.includes('Insufficient permissions')) {
        res.status(403).json({ error: error.message });
        return;
      }
      
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }

      next(error);
    }
  }

  /**
   * Bulk invite members
   * POST /api/v1/workspaces/:workspaceId/invitations/bulk
   */
  static async bulkInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const { invitations } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!invitations || !Array.isArray(invitations) || invitations.length === 0) {
        res.status(400).json({ error: 'Invitations array is required' });
        return;
      }

      if (invitations.length > 20) {
        res.status(400).json({ error: 'Cannot send more than 20 invitations at once' });
        return;
      }

      // Validate all invitations
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const inv of invitations) {
        if (!inv.email || !emailRegex.test(inv.email)) {
          res.status(400).json({ error: `Invalid email format: ${inv.email}` });
          return;
        }
        if (!inv.role || !['admin', 'member', 'viewer'].includes(inv.role)) {
          res.status(400).json({ error: `Invalid role for ${inv.email}. Must be admin, member, or viewer` });
          return;
        }
      }

      const results = await workspaceService.bulkInviteByEmail({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        invitedBy: new mongoose.Types.ObjectId(userId),
        invitations,
      });

      // Audit log the bulk invitation
      logAudit({
        userId: new mongoose.Types.ObjectId(userId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        action: 'invitation.bulk_created',
        entityType: 'invitation',
        metadata: {
          invitationsCount: invitations.length,
          successCount: results.successCount,
          failureCount: results.failureCount,
        },
        req,
      });

      res.status(201).json({
        message: `Successfully sent ${results.successCount} invitations`,
        results,
      });
    } catch (error: any) {
      logger.error('Bulk invite error:', error);
      
      if (error.message.includes('Insufficient permissions')) {
        res.status(403).json({ error: error.message });
        return;
      }

      next(error);
    }
  }

  /**
   * Bulk cancel invitations
   * DELETE /api/v1/workspaces/:workspaceId/invitations/bulk
   */
  static async bulkCancelInvitations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const { tokens } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        res.status(400).json({ error: 'Tokens array is required' });
        return;
      }

      if (tokens.length > 50) {
        res.status(400).json({ error: 'Cannot cancel more than 50 invitations at once' });
        return;
      }

      const results = await workspaceService.bulkCancelInvites({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        tokens,
        userId: new mongoose.Types.ObjectId(userId),
      });

      // Audit log the bulk cancellation
      logAudit({
        userId: new mongoose.Types.ObjectId(userId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        action: 'invitation.bulk_cancelled',
        entityType: 'invitation',
        metadata: {
          tokensCount: tokens.length,
          successCount: results.successCount,
          failureCount: results.failureCount,
        },
        req,
      });

      res.json({
        message: `Successfully cancelled ${results.successCount} invitations`,
        results,
      });
    } catch (error: any) {
      logger.error('Bulk cancel invitations error:', error);
      
      if (error.message.includes('Insufficient permissions')) {
        res.status(403).json({ error: error.message });
        return;
      }

      next(error);
    }
  }

  /**
   * Bulk update invitation roles
   * PATCH /api/v1/workspaces/:workspaceId/invitations/bulk
   * GAP 18 FIX: Separate from bulk create - this is for editing existing invitations
   */
  static async bulkUpdateInvitations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const { tokens, newRole } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        res.status(400).json({ error: 'Tokens array is required' });
        return;
      }

      if (!newRole || !['admin', 'member', 'viewer'].includes(newRole)) {
        res.status(400).json({ error: 'Valid newRole is required (admin, member, viewer)' });
        return;
      }

      if (tokens.length > 50) {
        res.status(400).json({ error: 'Cannot update more than 50 invitations at once' });
        return;
      }

      const results = await workspaceService.bulkUpdateInvites({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        tokens,
        changedBy: new mongoose.Types.ObjectId(userId),
        newRole: newRole as 'admin' | 'member' | 'viewer',
      });

      // Audit log the bulk update
      logAudit({
        userId: new mongoose.Types.ObjectId(userId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        action: 'invitation.bulk_role_updated',
        entityType: 'invitation',
        metadata: {
          tokensCount: tokens.length,
          newRole,
          updatedCount: results.updated,
          failedCount: results.failed.length,
        },
        req,
      });

      res.json({
        message: `Successfully updated ${results.updated} invitation roles`,
        results,
      });
    } catch (error: any) {
      logger.error('Bulk update invitations error:', error);
      
      if (error.message.includes('Insufficient permissions')) {
        res.status(403).json({ error: error.message });
        return;
      }

      next(error);
    }
  }

  /**
   * Get invitation stats
   * GET /api/v1/workspaces/:workspaceId/invitations/stats
   */
  static async getInvitationStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const stats = await workspaceService.getInvitationStats({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(userId),
      });

      res.json({ stats });
    } catch (error: any) {
      logger.error('Get invitation stats error:', error);
      
      if (error.message.includes('Insufficient permissions')) {
        res.status(403).json({ error: error.message });
        return;
      }

      next(error);
    }
  }

  /**
   * Validate invitation token (public endpoint)
   * GET /api/v1/invitations/:token/validate
   */
  static async validateInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;

      const tokenHash = WorkspaceInvitation.hashToken(token);
      const invitation = await WorkspaceInvitation.findOne({
        tokenHash,
        status: 'pending',
      });

      if (!invitation) {
        res.status(404).json({ error: 'Invitation not found or expired' });
        return;
      }

      if (!invitation.isValid()) {
        res.status(410).json({ error: 'Invitation has expired' });
        return;
      }

      res.json({
        invitation: {
          workspaceName: invitation.workspaceName,
          inviterName: invitation.inviterName,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          invitedEmail: invitation.invitedEmail,
          isValid: true,
        },
      });
    } catch (error: any) {
      logger.error('Validate invitation error:', error);
      next(error);
    }
  }

  /**
   * Accept invitation (public endpoint)
   * POST /api/v1/invitations/:token/accept
   */
  static async acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      const { userId, newUserData } = req.body;

      if (!userId && !newUserData) {
        res.status(400).json({ error: 'Either userId or newUserData must be provided' });
        return;
      }

      if (newUserData) {
        const { name, email, password } = newUserData;
        if (!name || !email || !password) {
          res.status(400).json({ error: 'Name, email, and password are required for new users' });
          return;
        }

        if (password.length < 8) {
          res.status(400).json({ error: 'Password must be at least 8 characters long' });
          return;
        }
      }

      const result = await workspaceService.acceptInvite({
        token,
        userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        newUserData,
      });

      // Audit log the invitation acceptance
      logAudit({
        userId: result.member.userId,
        workspaceId: result.workspace._id,
        action: 'invitation.accepted',
        entityType: 'invitation',
        metadata: {
          token: token.substring(0, 8) + '...', // Only log partial token for security
          role: result.member.role,
          isNewUser: result.isNewUser,
        },
        req,
      });

      res.json({
        message: 'Invitation accepted successfully',
        workspace: result.workspace,
        member: result.member,
        user: result.isNewUser ? {
          _id: result.member.userId,
          name: newUserData?.name,
          email: newUserData?.email,
        } : undefined,
        isNewUser: result.isNewUser,
      });
    } catch (error: any) {
      logger.error('Accept invitation error:', error);
      
      if (error.message.includes('Invalid or expired')) {
        res.status(410).json({ error: error.message });
        return;
      }
      
      if (error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
        return;
      }
      
      if (error.message.includes('already a member')) {
        res.status(409).json({ error: error.message });
        return;
      }
      
      if (error.message.includes('does not match')) {
        res.status(400).json({ error: error.message });
        return;
      }

      next(error);
    }
  }
}