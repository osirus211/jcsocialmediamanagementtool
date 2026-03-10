import { Types } from 'mongoose';
import { AccountPermission, IAccountPermission } from '../models/AccountPermission';
import { WorkspaceMember, MemberRole } from '../models/WorkspaceMember';
import { logger } from '../utils/logger';

export interface AccountPermissionData {
  socialAccountId: string;
  canPost: boolean;
  canViewAnalytics: boolean;
  canManage: boolean;
}

export interface EffectivePermissions {
  role: MemberRole;
  accountPermissions: IAccountPermission[];
  effectivePermissions: {
    [socialAccountId: string]: {
      canPost: boolean;
      canViewAnalytics: boolean;
      canManage: boolean;
      source: 'role' | 'custom';
    };
  };
}

export class AccountPermissionService {
  /**
   * Get all account permissions for a user in a workspace
   */
  static async getAccountPermissions(
    workspaceId: string,
    userId: string
  ): Promise<IAccountPermission[]> {
    try {
      return await AccountPermission.find({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
      }).populate('socialAccountId');
    } catch (error: any) {
      logger.error('Error getting account permissions', {
        workspaceId,
        userId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get permission for a specific account
   */
  static async getPermissionForAccount(
    workspaceId: string,
    userId: string,
    socialAccountId: string
  ): Promise<IAccountPermission | null> {
    try {
      return await AccountPermission.findOne({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
        socialAccountId: new Types.ObjectId(socialAccountId),
      });
    } catch (error: any) {
      logger.error('Error getting permission for account', {
        workspaceId,
        userId,
        socialAccountId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Set account permission (upsert)
   */
  static async setAccountPermission(
    workspaceId: string,
    userId: string,
    socialAccountId: string,
    permissions: Partial<AccountPermissionData>,
    grantedBy: string
  ): Promise<IAccountPermission> {
    try {
      const filter = {
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
        socialAccountId: new Types.ObjectId(socialAccountId),
      };

      const update = {
        ...permissions,
        grantedBy: new Types.ObjectId(grantedBy),
        grantedAt: new Date(),
      };

      return await AccountPermission.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
      });
    } catch (error: any) {
      logger.error('Error setting account permission', {
        workspaceId,
        userId,
        socialAccountId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove account permission
   */
  static async removeAccountPermission(
    workspaceId: string,
    userId: string,
    socialAccountId: string
  ): Promise<void> {
    try {
      await AccountPermission.deleteOne({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
        socialAccountId: new Types.ObjectId(socialAccountId),
      });
    } catch (error: any) {
      logger.error('Error removing account permission', {
        workspaceId,
        userId,
        socialAccountId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if user can access account for specific action
   */
  static async canUserAccessAccount(
    workspaceId: string,
    userId: string,
    socialAccountId: string,
    action: 'post' | 'analytics' | 'manage'
  ): Promise<boolean> {
    try {
      // Get user's role in workspace
      const member = await WorkspaceMember.findOne({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
      });

      if (!member) {
        return false;
      }

      // OWNER and ADMIN always have access
      if (member.role === MemberRole.OWNER || member.role === MemberRole.ADMIN) {
        return true;
      }

      // For EDITOR and VIEWER, check AccountPermission record
      const permission = await this.getPermissionForAccount(
        workspaceId,
        userId,
        socialAccountId
      );

      // Default to true if no record exists
      if (!permission) {
        return true;
      }

      // Check specific action
      switch (action) {
        case 'post':
          return permission.canPost;
        case 'analytics':
          return permission.canViewAnalytics;
        case 'manage':
          return permission.canManage;
        default:
          return false;
      }
    } catch (error: any) {
      logger.error('Error checking user account access', {
        workspaceId,
        userId,
        socialAccountId,
        action,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Bulk set permissions for multiple accounts
   */
  static async bulkSetPermissions(
    workspaceId: string,
    userId: string,
    permissions: AccountPermissionData[],
    grantedBy: string
  ): Promise<IAccountPermission[]> {
    try {
      const results: IAccountPermission[] = [];

      for (const permission of permissions) {
        const result = await this.setAccountPermission(
          workspaceId,
          userId,
          permission.socialAccountId,
          {
            canPost: permission.canPost,
            canViewAnalytics: permission.canViewAnalytics,
            canManage: permission.canManage,
          },
          grantedBy
        );
        results.push(result);
      }

      return results;
    } catch (error: any) {
      logger.error('Error bulk setting permissions', {
        workspaceId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get workspace member permissions with effective permissions
   */
  static async getWorkspaceMemberPermissions(
    workspaceId: string,
    userId: string
  ): Promise<EffectivePermissions | null> {
    try {
      // Get user's role
      const member = await WorkspaceMember.findOne({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
      });

      if (!member) {
        return null;
      }

      // Get account permissions
      const accountPermissions = await this.getAccountPermissions(workspaceId, userId);

      // Build effective permissions map
      const effectivePermissions: EffectivePermissions['effectivePermissions'] = {};

      // For OWNER and ADMIN, all accounts have full access
      if (member.role === MemberRole.OWNER || member.role === MemberRole.ADMIN) {
        // We don't populate effectivePermissions here as they have access to all accounts
        // This would be populated by the frontend when displaying accounts
      } else {
        // For EDITOR and VIEWER, use custom permissions or defaults
        for (const permission of accountPermissions) {
          effectivePermissions[permission.socialAccountId.toString()] = {
            canPost: permission.canPost,
            canViewAnalytics: permission.canViewAnalytics,
            canManage: permission.canManage,
            source: 'custom',
          };
        }
      }

      return {
        role: member.role,
        accountPermissions,
        effectivePermissions,
      };
    } catch (error: any) {
      logger.error('Error getting workspace member permissions', {
        workspaceId,
        userId,
        error: error.message,
      });
      return null;
    }
  }
}