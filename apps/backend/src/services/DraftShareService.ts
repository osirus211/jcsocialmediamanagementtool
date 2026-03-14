/**
 * Draft Share Service
 * 
 * Manages draft sharing with permissions, expiry, and password protection
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { DraftShare, IDraftShare } from '../models/DraftShare';
import { Post, PostStatus } from '../models/Post';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export interface CreateShareData {
  permissions: {
    canView: boolean;
    canComment: boolean;
    canEdit: boolean;
  };
  expiresAt?: Date;
  password?: string;
}

export interface ShareAccessData {
  shareToken: string;
  password?: string;
  userAgent?: string;
  ipAddress?: string;
}

export class DraftShareService {
  /**
   * Create a new share link for a draft
   */
  static async createShare(
    draftId: string,
    workspaceId: string,
    createdBy: string,
    data: CreateShareData
  ): Promise<IDraftShare> {
    try {
      // Verify draft exists and user has access
      const draft = await Post.findOne({
        _id: draftId,
        workspaceId,
        status: PostStatus.DRAFT
      });

      if (!draft) {
        throw new Error('Draft not found or access denied');
      }

      // Hash password if provided
      let hashedPassword;
      if (data.password) {
        hashedPassword = await bcrypt.hash(data.password, 10);
      }

      // Create share
      const share = new DraftShare({
        draftId: new mongoose.Types.ObjectId(draftId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        createdBy: new mongoose.Types.ObjectId(createdBy),
        permissions: data.permissions,
        expiresAt: data.expiresAt,
        password: hashedPassword,
        isActive: true,
        accessCount: 0
      });

      await share.save();

      logger.debug('Draft share created', {
        shareId: share._id,
        draftId,
        createdBy,
        permissions: data.permissions
      });

      return share;
    } catch (error) {
      logger.error('Error creating draft share', { draftId, createdBy, error });
      throw error;
    }
  }

  /**
   * Get all shares for a draft
   */
  static async getSharesForDraft(
    draftId: string,
    workspaceId: string,
    userId: string
  ): Promise<IDraftShare[]> {
    try {
      // Verify user has access to draft
      const draft = await Post.findOne({
        _id: draftId,
        workspaceId,
        status: PostStatus.DRAFT
      });

      if (!draft) {
        throw new Error('Draft not found or access denied');
      }

      const shares = await DraftShare.find({
        draftId,
        isActive: true
      })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

      return shares;
    } catch (error) {
      logger.error('Error getting draft shares', { draftId, userId, error });
      throw error;
    }
  }

  /**
   * Access a shared draft
   */
  static async accessSharedDraft(
    accessData: ShareAccessData
  ): Promise<{ draft: any; share: IDraftShare; hasAccess: boolean }> {
    try {
      // Find the share
      const share = await DraftShare.findOne({
        shareToken: accessData.shareToken,
        isActive: true
      });

      if (!share || !share.isActive || (share.expiresAt && share.expiresAt < new Date())) {
        throw new Error('Share link not found or expired');
      }

      // Check password if required
      if (share.password) {
        if (!accessData.password) {
          return {
            draft: null,
            share,
            hasAccess: false
          };
        }

        const passwordValid = await bcrypt.compare(accessData.password, share.password);
        if (!passwordValid) {
          throw new Error('Invalid password');
        }
      }

      // Get the draft
      const draft = await Post.findOne({
        _id: share.draftId,
        status: PostStatus.DRAFT
      })
        .populate('createdBy', 'name email')
        .populate('lastEditedBy', 'name email');

      if (!draft) {
        throw new Error('Draft not found');
      }

      // Update access tracking
      share.accessCount += 1;
      share.lastAccessedAt = new Date();
      share.lastAccessedBy = accessData.ipAddress || accessData.userAgent || 'Unknown';
      await share.save();

      logger.debug('Draft share accessed', {
        shareToken: accessData.shareToken,
        draftId: share.draftId,
        accessCount: share.accessCount
      });

      return {
        draft,
        share,
        hasAccess: true
      };
    } catch (error) {
      logger.error('Error accessing shared draft', { 
        shareToken: accessData.shareToken, 
        error 
      });
      throw error;
    }
  }

  /**
   * Update share permissions
   */
  static async updateShare(
    shareId: string,
    workspaceId: string,
    userId: string,
    updates: Partial<CreateShareData>
  ): Promise<IDraftShare> {
    try {
      const share = await DraftShare.findOne({
        _id: shareId,
        workspaceId,
        createdBy: userId,
        isActive: true
      });

      if (!share) {
        throw new Error('Share not found or unauthorized');
      }

      // Update permissions
      if (updates.permissions) {
        share.permissions = updates.permissions;
      }

      // Update expiry
      if (updates.expiresAt !== undefined) {
        share.expiresAt = updates.expiresAt;
      }

      // Update password
      if (updates.password !== undefined) {
        if (updates.password) {
          share.password = await bcrypt.hash(updates.password, 10);
        } else {
          share.password = undefined;
        }
      }

      await share.save();

      logger.debug('Draft share updated', { shareId, userId });

      return share;
    } catch (error) {
      logger.error('Error updating draft share', { shareId, userId, error });
      throw error;
    }
  }

  /**
   * Revoke a share (deactivate)
   */
  static async revokeShare(
    shareId: string,
    workspaceId: string,
    userId: string
  ): Promise<void> {
    try {
      const share = await DraftShare.findOne({
        _id: shareId,
        workspaceId,
        createdBy: userId,
        isActive: true
      });

      if (!share) {
        throw new Error('Share not found or unauthorized');
      }

      share.isActive = false;
      await share.save();

      logger.debug('Draft share revoked', { shareId, userId });
    } catch (error) {
      logger.error('Error revoking draft share', { shareId, userId, error });
      throw error;
    }
  }

  /**
   * Clean up expired shares
   */
  static async cleanupExpiredShares(): Promise<void> {
    try {
      const result = await DraftShare.updateMany(
        {
          expiresAt: { $lt: new Date() },
          isActive: true
        },
        {
          isActive: false
        }
      );

      if (result.modifiedCount > 0) {
        logger.debug('Cleaned up expired shares', { count: result.modifiedCount });
      }
    } catch (error) {
      logger.error('Error cleaning up expired shares', { error });
    }
  }

  /**
   * Get share statistics for a workspace
   */
  static async getShareStats(workspaceId: string) {
    try {
      const stats = await DraftShare.aggregate([
        {
          $match: {
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            totalShares: { $sum: 1 },
            totalAccesses: { $sum: '$accessCount' },
            passwordProtected: {
              $sum: { $cond: [{ $ne: ['$password', null] }, 1, 0] }
            },
            withExpiry: {
              $sum: { $cond: [{ $ne: ['$expiresAt', null] }, 1, 0] }
            }
          }
        }
      ]);

      return stats[0] || {
        totalShares: 0,
        totalAccesses: 0,
        passwordProtected: 0,
        withExpiry: 0
      };
    } catch (error) {
      logger.error('Error getting share stats', { workspaceId, error });
      throw error;
    }
  }
}