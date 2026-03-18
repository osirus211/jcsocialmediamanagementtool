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
import { emailNotificationService } from './EmailNotificationService';
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
   * Approve current stage
   */
  async approveCurrentStage(params: {
    postId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    comment?: string;
  }): Promise<void> {
    const { postId, userId, comment } = params;

    const post = await ScheduledPost.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // Check if post has approval stages
    if (!post.approvalStages || post.approvalStages.length === 0) {
      // Fall back to legacy approval
      return this.approvePost({ postId, userId });
    }

    const currentStageIndex = post.currentStage;
    const currentStage = post.approvalStages[currentStageIndex];

    if (!currentStage) {
      throw new Error('No current approval stage found');
    }

    // Check if user is assigned to this stage
    const isAssigned = currentStage.assignedTo.some(id => id.toString() === userId.toString());
    if (!isAssigned) {
      throw new Error('User not assigned to current approval stage');
    }

    // Check current stage status
    if (currentStage.status !== 'pending') {
      throw new Error('Current stage is not pending approval');
    }

    // Approve current stage
    currentStage.status = 'approved';
    currentStage.approvedBy = userId;
    currentStage.approvedAt = new Date();

    // Check if there are more stages
    const nextStageIndex = currentStageIndex + 1;
    if (nextStageIndex < post.approvalStages.length) {
      // Move to next stage
      post.currentStage = nextStageIndex;
      post.status = PostStatus.PENDING_APPROVAL;
    } else {
      // Final stage - approve the post
      post.status = PostStatus.APPROVED;
      post.approvedBy = userId;
      post.approvedAt = new Date();
    }

    await post.save();

    // Log activity
    await this.logActivity({
      workspaceId: post.workspaceId,
      userId,
      action: ActivityAction.POST_APPROVED,
      resourceType: 'ScheduledPost',
      resourceId: postId,
      details: { 
        stage: currentStage.stageName,
        stageOrder: currentStage.stageOrder,
        comment 
      },
    });

    // Notify next stage assignees or creator
    if (nextStageIndex < post.approvalStages.length) {
      await this.notifyNextStageAssignees(post.workspaceId, postId, nextStageIndex);
    } else {
      await this.notifyCreator(post.createdBy, postId, 'approved');
    }

    logger.info(`Stage ${currentStage.stageName} approved for post: ${postId}`);
  }

  /**
   * Reject current stage
   */
  async rejectCurrentStage(params: {
    postId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    reason: string;
  }): Promise<void> {
    const { postId, userId, reason } = params;

    const post = await ScheduledPost.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // Check if post has approval stages
    if (!post.approvalStages || post.approvalStages.length === 0) {
      // Fall back to legacy rejection
      return this.rejectPost({ postId, userId, reason });
    }

    const currentStageIndex = post.currentStage;
    const currentStage = post.approvalStages[currentStageIndex];

    if (!currentStage) {
      throw new Error('No current approval stage found');
    }

    // Check if user is assigned to this stage
    const isAssigned = currentStage.assignedTo.some(id => id.toString() === userId.toString());
    if (!isAssigned) {
      throw new Error('User not assigned to current approval stage');
    }

    // Reject current stage
    currentStage.status = 'rejected';
    currentStage.rejectedBy = userId;
    currentStage.rejectedAt = new Date();
    currentStage.rejectionReason = reason;

    // Reject the entire post
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
      details: { 
        stage: currentStage.stageName,
        stageOrder: currentStage.stageOrder,
        reason 
      },
    });

    // Notify creator
    await this.notifyCreator(post.createdBy, postId, 'rejected', reason);

    logger.info(`Stage ${currentStage.stageName} rejected for post: ${postId}`);
  }

  /**
   * Configure approval stages for workspace
   */
  async configureApprovalStages(params: {
    workspaceId: mongoose.Types.ObjectId;
    stages: { name: string; assignedTo: mongoose.Types.ObjectId[] }[];
  }): Promise<void> {
    const { workspaceId, stages } = params;

    // This would typically be stored in workspace settings
    // For now, we'll apply to new posts via the workspace model
    // Implementation depends on workspace settings structure
    
    logger.info(`Configured ${stages.length} approval stages for workspace: ${workspaceId}`);
  }

  /**
   * Notify next stage assignees
   */
  private async notifyNextStageAssignees(
    workspaceId: mongoose.Types.ObjectId,
    postId: mongoose.Types.ObjectId,
    stageIndex: number
  ): Promise<void> {
    try {
      const post = await ScheduledPost.findById(postId).populate('createdBy', 'name email');
      if (!post || !post.approvalStages || !post.approvalStages[stageIndex]) {
        return;
      }

      const stage = post.approvalStages[stageIndex];
      
      // Get assignee details
      const assignees = await WorkspaceMember.find({
        workspaceId,
        userId: { $in: stage.assignedTo },
        isActive: true,
      }).populate('userId', 'email name');

      // Send notifications
      for (const assignee of assignees) {
        const assigneeUser = assignee.userId as any;
        if (assigneeUser?.email) {
          await emailNotificationService.sendNotification({
            eventType: 'APPROVAL_REQUIRED' as any,
            workspaceId: workspaceId.toString(),
            userId: assigneeUser._id.toString(),
            payload: {
              postId: postId.toString(),
              content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
              platform: post.platform,
              scheduledAt: post.scheduledAt.toISOString(),
              submitterName: (post.createdBy as any)?.name || 'Unknown',
              stageName: stage.stageName,
              stageOrder: stage.stageOrder,
            },
          });
        }
      }

      logger.info(`Notified ${assignees.length} assignees for stage ${stage.stageName}`);
    } catch (error) {
      logger.error('Failed to notify next stage assignees:', error);
    }
  }
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
    try {
      // Get all admins and owners
      const approvers = await WorkspaceMember.find({
        workspaceId,
        role: { $in: [MemberRole.OWNER, MemberRole.ADMIN] },
        isActive: true,
      }).populate('userId', 'email name');

      // Get post details
      const post = await ScheduledPost.findById(postId).populate('createdBy', 'name email');
      if (!post) {
        logger.error(`Post not found for notification: ${postId}`);
        return;
      }

      // Send email notifications to all approvers
      for (const approver of approvers) {
        const approverUser = approver.userId as any;
        if (approverUser?.email) {
          await emailNotificationService.sendNotification({
            eventType: 'APPROVAL_REQUIRED' as any,
            workspaceId: workspaceId.toString(),
            userId: approverUser._id.toString(),
            payload: {
              postId: postId.toString(),
              content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
              platform: post.platform,
              scheduledAt: post.scheduledAt.toISOString(),
              submitterName: (post.createdBy as any)?.name || 'Unknown',
              submitterEmail: (post.createdBy as any)?.email || '',
            },
          });
        }
      }

      logger.info(`Notified ${approvers.length} approvers for post: ${postId}`);
    } catch (error) {
      logger.error('Failed to notify approvers:', error);
    }
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
    try {
      // Get post details
      const post = await ScheduledPost.findById(postId);
      if (!post) {
        logger.error(`Post not found for creator notification: ${postId}`);
        return;
      }

      // Send email notification to creator
      const event = status === 'approved' ? 'POST_APPROVED' : 'POST_REJECTED';
      await emailNotificationService.sendNotification({
        eventType: event as any,
        workspaceId: post.workspaceId.toString(),
        userId: userId.toString(),
        payload: {
          postId: postId.toString(),
          content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
          platform: post.platform,
          scheduledAt: post.scheduledAt.toISOString(),
          status,
          reason: reason || '',
          approvedBy: post.approvedBy?.toString() || '',
          rejectedBy: post.rejectedBy?.toString() || '',
        },
      });

      logger.info(`Notified creator ${userId} about post ${postId}: ${status}`);
    } catch (error) {
      logger.error('Failed to notify creator:', error);
    }
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
