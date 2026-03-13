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
}

export const permissionService = new PermissionService();
