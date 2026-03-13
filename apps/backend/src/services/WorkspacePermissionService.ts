/**
 * Workspace Permission Service
 * 
 * Manages permissions for workspace members
 */

import { MemberRole } from '../models/WorkspaceMember';

export enum Permission {
  // Post permissions
  CREATE_POST = 'create_post',
  EDIT_POST = 'edit_post',
  EDIT_OWN_POST = 'edit_own_post',
  DELETE_POST = 'delete_post',
  DELETE_OWN_POST = 'delete_own_post',
  APPROVE_POST = 'approve_post',
  PUBLISH_POST = 'publish_post',
  LOCK_POST = 'lock_post',
  
  // Team permissions
  MANAGE_TEAM = 'manage_team',
  INVITE_MEMBER = 'invite_member',
  REMOVE_MEMBER = 'remove_member',
  CHANGE_MEMBER_ROLE = 'change_member_role',
  
  // Analytics permissions
  VIEW_ANALYTICS = 'view_analytics',
  EXPORT_ANALYTICS = 'export_analytics',
  
  // Social account permissions
  CONNECT_ACCOUNT = 'connect_account',
  DISCONNECT_ACCOUNT = 'disconnect_account',
  
  // Workspace permissions
  MANAGE_WORKSPACE = 'manage_workspace',
  MANAGE_BILLING = 'manage_billing',
  DELETE_WORKSPACE = 'delete_workspace',
  
  // Media permissions
  UPLOAD_MEDIA = 'upload_media',
  DELETE_MEDIA = 'delete_media',
}

// Role-based permission mapping
const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  [MemberRole.OWNER]: [
    // All permissions
    Permission.CREATE_POST,
    Permission.EDIT_POST,
    Permission.EDIT_OWN_POST,
    Permission.DELETE_POST,
    Permission.DELETE_OWN_POST,
    Permission.APPROVE_POST,
    Permission.PUBLISH_POST,
    Permission.LOCK_POST,
    Permission.MANAGE_TEAM,
    Permission.INVITE_MEMBER,
    Permission.REMOVE_MEMBER,
    Permission.CHANGE_MEMBER_ROLE,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_ANALYTICS,
    Permission.CONNECT_ACCOUNT,
    Permission.DISCONNECT_ACCOUNT,
    Permission.MANAGE_WORKSPACE,
    Permission.MANAGE_BILLING,
    Permission.DELETE_WORKSPACE,
    Permission.UPLOAD_MEDIA,
    Permission.DELETE_MEDIA,
  ],
  
  [MemberRole.ADMIN]: [
    // All except billing and workspace deletion
    Permission.CREATE_POST,
    Permission.EDIT_POST,
    Permission.EDIT_OWN_POST,
    Permission.DELETE_POST,
    Permission.DELETE_OWN_POST,
    Permission.APPROVE_POST,
    Permission.PUBLISH_POST,
    Permission.LOCK_POST,
    Permission.MANAGE_TEAM,
    Permission.INVITE_MEMBER,
    Permission.REMOVE_MEMBER,
    Permission.CHANGE_MEMBER_ROLE,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_ANALYTICS,
    Permission.CONNECT_ACCOUNT,
    Permission.DISCONNECT_ACCOUNT,
    Permission.MANAGE_WORKSPACE,
    Permission.UPLOAD_MEDIA,
    Permission.DELETE_MEDIA,
  ],
  
  [MemberRole.EDITOR]: [
    // Create and edit posts, view analytics
    Permission.CREATE_POST,
    Permission.EDIT_OWN_POST,
    Permission.DELETE_OWN_POST,
    Permission.VIEW_ANALYTICS,
    Permission.UPLOAD_MEDIA,
  ],
  
  [MemberRole.VIEWER]: [
    // Read-only access
    Permission.VIEW_ANALYTICS,
  ],
  
  [MemberRole.MEMBER]: [
    // Basic member permissions - can create and manage own content
    Permission.CREATE_POST,
    Permission.EDIT_OWN_POST,
    Permission.DELETE_OWN_POST,
    Permission.VIEW_ANALYTICS,
    Permission.UPLOAD_MEDIA,
    Permission.CONNECT_ACCOUNT,
  ],
};

export class WorkspacePermissionService {
  /**
   * Check if a role has a specific permission
   */
  hasPermission(role: MemberRole, permission: Permission): boolean {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
  }

  /**
   * Check if a role has any of the specified permissions
   */
  hasAnyPermission(role: MemberRole, permissions: Permission[]): boolean {
    return permissions.some((permission) => this.hasPermission(role, permission));
  }

  /**
   * Check if a role has all of the specified permissions
   */
  hasAllPermissions(role: MemberRole, permissions: Permission[]): boolean {
    return permissions.every((permission) => this.hasPermission(role, permission));
  }

  /**
   * Get all permissions for a role
   */
  getRolePermissions(role: MemberRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Check if user can perform action on resource
   */
  canPerformAction(params: {
    role: MemberRole;
    permission: Permission;
    resourceOwnerId?: string;
    userId?: string;
  }): boolean {
    const { role, permission, resourceOwnerId, userId } = params;

    // Check if role has the permission
    if (this.hasPermission(role, permission)) {
      return true;
    }

    // Check "own" permissions
    if (resourceOwnerId && userId && resourceOwnerId === userId) {
      // Check if user has "own" version of permission
      const ownPermission = this.getOwnPermission(permission);
      if (ownPermission && this.hasPermission(role, ownPermission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get "own" version of permission
   */
  private getOwnPermission(permission: Permission): Permission | null {
    switch (permission) {
      case Permission.EDIT_POST:
        return Permission.EDIT_OWN_POST;
      case Permission.DELETE_POST:
        return Permission.DELETE_OWN_POST;
      default:
        return null;
    }
  }

  /**
   * Validate role transition
   */
  canChangeRole(params: {
    currentUserRole: MemberRole;
    targetUserRole: MemberRole;
    newRole: MemberRole;
  }): {
    allowed: boolean;
    reason?: string;
  } {
    const { currentUserRole, targetUserRole, newRole } = params;

    // Only owners and admins can change roles
    if (!this.hasPermission(currentUserRole, Permission.CHANGE_MEMBER_ROLE)) {
      return {
        allowed: false,
        reason: 'Insufficient permissions to change roles',
      };
    }

    // Cannot change owner role
    if (targetUserRole === MemberRole.OWNER) {
      return {
        allowed: false,
        reason: 'Cannot change owner role',
      };
    }

    // Cannot promote to owner (must transfer ownership)
    if (newRole === MemberRole.OWNER) {
      return {
        allowed: false,
        reason: 'Cannot promote to owner, use transfer ownership instead',
      };
    }

    // Admins cannot promote to admin
    if (currentUserRole === MemberRole.ADMIN && newRole === MemberRole.ADMIN) {
      return {
        allowed: false,
        reason: 'Admins cannot promote other members to admin',
      };
    }

    return { allowed: true };
  }

  /**
   * Get permission description
   */
  getPermissionDescription(permission: Permission): string {
    const descriptions: Record<Permission, string> = {
      [Permission.CREATE_POST]: 'Create new posts',
      [Permission.EDIT_POST]: 'Edit any post',
      [Permission.EDIT_OWN_POST]: 'Edit own posts',
      [Permission.DELETE_POST]: 'Delete any post',
      [Permission.DELETE_OWN_POST]: 'Delete own posts',
      [Permission.APPROVE_POST]: 'Approve posts for publishing',
      [Permission.PUBLISH_POST]: 'Publish posts to social media',
      [Permission.LOCK_POST]: 'Lock posts to prevent editing',
      [Permission.MANAGE_TEAM]: 'Manage team members',
      [Permission.INVITE_MEMBER]: 'Invite new members',
      [Permission.REMOVE_MEMBER]: 'Remove team members',
      [Permission.CHANGE_MEMBER_ROLE]: 'Change member roles',
      [Permission.VIEW_ANALYTICS]: 'View analytics and reports',
      [Permission.EXPORT_ANALYTICS]: 'Export analytics data',
      [Permission.CONNECT_ACCOUNT]: 'Connect social media accounts',
      [Permission.DISCONNECT_ACCOUNT]: 'Disconnect social media accounts',
      [Permission.MANAGE_WORKSPACE]: 'Manage workspace settings',
      [Permission.MANAGE_BILLING]: 'Manage billing and subscription',
      [Permission.DELETE_WORKSPACE]: 'Delete workspace',
      [Permission.UPLOAD_MEDIA]: 'Upload media files',
      [Permission.DELETE_MEDIA]: 'Delete media files',
    };

    return descriptions[permission] || 'Unknown permission';
  }
}

export const workspacePermissionService = new WorkspacePermissionService();
