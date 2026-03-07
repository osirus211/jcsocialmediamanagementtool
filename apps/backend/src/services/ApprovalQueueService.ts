/**
 * Approval Queue Service
 * 
 * Manages post approval workflow and notifications
 */

import mongoose from 'mongoose';
import { ScheduledPost, PostStatus } from '../models/ScheduledPost';
import { WorkspaceMember, MemberRole } from '../models/WorkspaceMember';
import { WorkspaceActivityLog, ActivityAction } from '../models/WorkspaceActivityLog';
import { workspacePermissionService, Permission } from './WorkspacePermissionService';
import { logger } from '../utils/logger';

export interface ApprovalQueueItem {
  postId: string;
  workspaceId: string;
  createdBy: string;
  content: string;
  platform: string;
  scheduledAt: Date;
  submittedForApprovalAt: Date;
}

export class ApprovalQueueService {
  /**
   * Submit post for approval
   */
  async submitForApproval(params: {
    postId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
  }): Promise<void> {
    const { postId, userId } = params;

    const post = await ScheduledPost.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // Check if user is the creator
    if (post.createdBy.toString() !== userId.toString()) {
      throw new Error('Only post creator can submit for approval');
    }

    // Check current status
    if (post.status !== PostStatus.DRAFT) {
      throw new Error('Only draft posts can be submitted for approval');
    }

    // Update post status
    post.status = PostStatus.PENDING_APPROVAL;
    post.submittedForApprovalAt = new Date();
    await post.save();

    // Log activity
    await this.logActivity({
      workspaceId: post.workspaceId,
      userId,
      action: ActivityAction.POST_SUBMITTED_FOR_APPROVAL,
      resourceType: 'ScheduledPost',
      resourceId: postId,
    });

    // Notify approvers
    await this.notifyApprovers(post.workspaceId, postId);

    logger.info(`Post submitted for approval: ${postId}`);
  }

  /**
   * Approve post
   */
  async approvePost(params: {
    postId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
  }): Promise<void> {
    const { postId, userId } = params;

    const post = await ScheduledPost.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // Check permission
    const member = await WorkspaceMember.findOne({
      workspaceId: post.workspaceId,
      userId,
      isActive: true,
    });

    if (!member || !workspacePermissionService.hasPermission(member.role, Permission.APPROVE_POST)) {
      throw new Error('Insufficient permissions to approve posts');
    }

    // Check current status
    if (post.status !== PostStatus.PENDING_APPROVAL) {
      throw new Error('Only pending posts can be approved');
    }

    // Update post status
    post.status = PostStatus.APPROVED;
    post.approvedBy = userId;
    post.approvedAt = new Date();
    await post.save();

    // Log activity
    await this.logActivity({
      workspaceId: post.workspaceId,
      userId,
      action: ActivityAction.POST_APPROVED,
      resourceType: 'ScheduledPost',
      resourceId: postId,
    });

    // Notify creator
    await this.notifyCreator(post.createdBy, postId, 'approved');

    logger.info(`Post approved: ${postId}`);
  }

  /**
   * Reject post
   */
  async rejectPost(params: {
    postId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    reason: string;
  }): Promise<void> {
    const { postId, userId, reason } = params;

    const post = await ScheduledPost.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // Check permission
    const member = await WorkspaceMember.findOne({
      workspaceId: post.workspaceId,
      userId,
      isActive: true,
    });

    if (!member || !workspacePermissionService.hasPermission(member.role, Permission.APPROVE_POST)) {
      throw new Error('Insufficient permissions to reject posts');
    }

    // Check current status
    if (post.status !== PostStatus.PENDING_APPROVAL) {
      throw new Error('Only pending posts can be rejected');
    }

    // Update post status
    post.status = PostStatus.REJECTED;
    post.rejectedBy = userId;
    post.rejectedAt = new Date();
    post.rejectionReason = reason;
    await post.save();

    // Log activity
    await this.logActivity({
      workspaceId: post.workspaceId,
      userId,
      action: ActivityAction.POST_REJECTED,
      resourceType: 'ScheduledPost',
      resourceId: postId,
      details: { reason },
    });

    // Notify creator
    await this.notifyCreator(post.createdBy, postId, 'rejected', reason);

    logger.info(`Post rejected: ${postId}`);
  }

  /**
   * Get pending approvals for workspace
   */
  async getPendingApprovals(params: {
    workspaceId: mongoose.Types.ObjectId;
    limit?: number;
    skip?: number;
  }): Promise<ApprovalQueueItem[]> {
    const { workspaceId, limit = 50, skip = 0 } = params;

    const posts = await ScheduledPost.find({
      workspaceId,
      status: PostStatus.PENDING_APPROVAL,
    })
      .populate('createdBy', 'name email')
      .sort({ submittedForApprovalAt: 1 })
      .limit(limit)
      .skip(skip);

    return posts.map((post) => ({
      postId: post._id.toString(),
      workspaceId: post.workspaceId.toString(),
      createdBy: post.createdBy.toString(),
      content: post.content,
      platform: post.platform,
      scheduledAt: post.scheduledAt,
      submittedForApprovalAt: post.submittedForApprovalAt!,
    }));
  }

  /**
   * Get approval queue count
   */
  async getApprovalQueueCount(workspaceId: mongoose.Types.ObjectId): Promise<number> {
    return ScheduledPost.countDocuments({
      workspaceId,
      status: PostStatus.PENDING_APPROVAL,
    });
  }

  /**
   * Get user's pending posts
   */
  async getUserPendingPosts(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
  }): Promise<ApprovalQueueItem[]> {
    const { workspaceId, userId } = params;

    const posts = await ScheduledPost.find({
      workspaceId,
      createdBy: userId,
      status: PostStatus.PENDING_APPROVAL,
    }).sort({ submittedForApprovalAt: 1 });

    return posts.map((post) => ({
      postId: post._id.toString(),
      workspaceId: post.workspaceId.toString(),
      createdBy: post.createdBy.toString(),
      content: post.content,
      platform: post.platform,
      scheduledAt: post.scheduledAt,
      submittedForApprovalAt: post.submittedForApprovalAt!,
    }));
  }

  /**
   * Notify approvers about new post
   */
  private async notifyApprovers(
    workspaceId: mongoose.Types.ObjectId,
    postId: mongoose.Types.ObjectId
  ): Promise<void> {
    // Get all admins and owners
    const approvers = await WorkspaceMember.find({
      workspaceId,
      role: { $in: [MemberRole.OWNER, MemberRole.ADMIN] },
      isActive: true,
    }).populate('userId', 'email name');

    // TODO: Send notifications (email, in-app, webhook)
    // For now, just log
    logger.info(`Notifying ${approvers.length} approvers for post: ${postId}`);
  }

  /**
   * Notify creator about approval/rejection
   */
  private async notifyCreator(
    userId: mongoose.Types.ObjectId,
    postId: mongoose.Types.ObjectId,
    status: 'approved' | 'rejected',
    reason?: string
  ): Promise<void> {
    // TODO: Send notification to creator
    // For now, just log
    logger.info(`Notifying creator ${userId} about post ${postId}: ${status}`);
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
  }): Promise<void> {
    const log = new WorkspaceActivityLog(params);
    await log.save();
  }

  /**
   * Auto-approve posts if approval not required
   */
  async autoApproveIfNotRequired(postId: mongoose.Types.ObjectId): Promise<void> {
    const post = await ScheduledPost.findById(postId).populate('workspaceId');
    if (!post) {
      return;
    }

    const workspace = post.workspaceId as any;
    if (!workspace.settings?.requireApproval) {
      // Auto-approve
      post.status = PostStatus.APPROVED;
      post.approvedAt = new Date();
      await post.save();
      logger.info(`Post auto-approved: ${postId}`);
    }
  }
}

export const approvalQueueService = new ApprovalQueueService();
