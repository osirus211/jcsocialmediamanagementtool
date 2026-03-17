import { Post } from '../models/Post';
import { Workspace } from '../models/Workspace';
import { WorkspaceMember, WorkspaceRole } from '../models/WorkspaceMember';
import { logger } from '../utils/logger';

export interface PermissionContext {
  userId: string;
  workspaceId?: string;
  postId?: string;
  role?: string;
}

export class PermissionService {
  /**
   * Check if user is owner of a workspace
   */
  async isWorkspaceOwner(userId: string, workspaceId: string): Promise<boolean> {
    try {
      const workspace = await Workspace.findById(workspaceId).select('ownerId');
      
      if (!workspace) {
        logger.warn('Workspace not found for permission check', { workspaceId, userId });
        return false;
      }

      return workspace.ownerId.toString() === userId;
    } catch (error: any) {
      logger.error('Error checking workspace ownership', { 
        userId, 
        workspaceId, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Check if user is admin or owner of a workspace
   */
  async isAdminOrOwner(userId: string, workspaceId: string): Promise<boolean> {
    try {
      const workspace = await Workspace.findById(workspaceId).select('ownerId');
      
      if (!workspace) {
        logger.warn('Workspace not found for permission check', { workspaceId, userId });
        return false;
      }

      // Check if user is owner
      if (workspace.ownerId.toString() === userId) {
        return true;
      }

      // Check if user is admin member
      const member = await WorkspaceMember.findOne({
        workspaceId,
        userId,
        isActive: true,
      });

      return member?.role === WorkspaceRole.ADMIN;
    } catch (error: any) {
      logger.error('Error checking admin or owner permission', { 
        userId, 
        workspaceId, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Check if user owns a post or is admin of the workspace
   */
  async canAccessPost(userId: string, postId: string): Promise<boolean> {
    try {
      const post = await Post.findById(postId)
        .select('createdBy workspaceId');
      
      if (!post) {
        logger.warn('Post not found for permission check', { postId, userId });
        return false;
      }

      // Check if user created the post
      if (post.createdBy.toString() === userId) {
        return true;
      }

      // Check if user is workspace owner
      const workspace = await Workspace.findById(post.workspaceId).select('ownerId');
      if (!workspace) {
        return false;
      }

      if (workspace.ownerId.toString() === userId) {
        return true;
      }

      // Check if user is admin member
      const member = await WorkspaceMember.findOne({
        workspaceId: post.workspaceId,
        userId,
        isActive: true,
      });

      return member?.role === WorkspaceRole.ADMIN;
    } catch (error: any) {
      logger.error('Error checking post access permission', { 
        userId, 
        postId, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Check if user has a specific permission in a workspace
   */
  async hasPermission(userId: string, workspaceId: string, permission: string): Promise<boolean> {
    try {
      // Validate permission format
      if (!permission || typeof permission !== 'string') {
        throw new Error('Invalid permission');
      }

      // Check if user is workspace owner (owners have all permissions)
      const isOwner = await this.isWorkspaceOwner(userId, workspaceId);
      if (isOwner) {
        return true;
      }

      // Get user's workspace membership
      const member = await WorkspaceMember.findOne({
        workspaceId,
        userId,
        isActive: true,
      });

      if (!member) {
        return false;
      }

      // Role-based permissions
      switch (member.role) {
        case WorkspaceRole.ADMIN:
          // Admins have most permissions except billing
          return !permission.startsWith('billing:');
        case WorkspaceRole.EDITOR:
          // Editors can read/write posts and analytics
          return permission.startsWith('posts:') || permission.startsWith('analytics:read');
        case WorkspaceRole.VIEWER:
          // Viewers can only read
          return permission.endsWith(':read');
        default:
          return false;
      }
    } catch (error: any) {
      logger.error('Error checking permission', { 
        userId, 
        workspaceId, 
        permission,
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Add a permission to a user (for testing purposes)
   */
  async addPermission(userId: string, workspaceId: string, permission: string): Promise<void> {
    // This is a stub for testing - in a real system this would modify user permissions
    logger.info('Adding permission (stub)', { userId, workspaceId, permission });
  }
}

export const permissionService = new PermissionService();
