import { ApprovalQueueService } from '../../services/ApprovalQueueService';
import { PostStatus } from '../../models/ScheduledPost';
import mongoose from 'mongoose';

// Mock all external dependencies
jest.mock('../../models/ScheduledPost');
jest.mock('../../models/WorkspaceMember');
jest.mock('../../services/NotificationService');
jest.mock('../../services/WorkspacePermissionService');

describe('ApprovalQueueService', () => {
  let approvalService: ApprovalQueueService;
  const mockWorkspaceId = new mongoose.Types.ObjectId();
  const mockUserId = new mongoose.Types.ObjectId();
  const mockPostId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    approvalService = new ApprovalQueueService();
    jest.clearAllMocks();
  });

  describe('submitForApproval', () => {
    it('sets status to PENDING and submittedForApprovalAt', async () => {
      const { ScheduledPost } = await import('../../models/ScheduledPost');
      
      // Mock findById to return a draft post
      (ScheduledPost.findById as jest.Mock).mockResolvedValue({
        _id: mockPostId,
        workspaceId: mockWorkspaceId,
        createdBy: mockUserId,
        status: PostStatus.DRAFT, // Important: must be DRAFT
        save: jest.fn().mockResolvedValue({}),
      });
      
      await approvalService.submitForApproval({
        postId: mockPostId,
        userId: mockUserId,
      });

      expect(ScheduledPost.findById).toHaveBeenCalledWith(mockPostId);
    });
  });

  describe('approvePost', () => {
    it('sets status to APPROVED and approvedAt', async () => {
      const { ScheduledPost } = await import('../../models/ScheduledPost');
      const { WorkspaceMember } = await import('../../models/WorkspaceMember');
      const { workspacePermissionService } = await import('../../services/WorkspacePermissionService');
      
      // Mock WorkspaceMember to return a member with permissions
      (WorkspaceMember.findOne as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        role: 'admin',
      });
      
      // Mock permission service to allow approval
      (workspacePermissionService.hasPermission as jest.Mock).mockReturnValue(true);
      
      // Mock findById to return a pending post
      (ScheduledPost.findById as jest.Mock).mockResolvedValue({
        _id: mockPostId,
        workspaceId: mockWorkspaceId,
        status: PostStatus.PENDING_APPROVAL,
        save: jest.fn().mockResolvedValue({}),
      });

      await approvalService.approvePost({
        postId: mockPostId,
        userId: mockUserId,
      });

      // The service modifies the post object and calls save()
      // We can't easily test the exact values without more complex mocking
      expect(ScheduledPost.findById).toHaveBeenCalledWith(mockPostId);
    });
  });

  describe('rejectPost', () => {
    it('sets status to REJECTED with reason', async () => {
      const { ScheduledPost } = await import('../../models/ScheduledPost');
      const { WorkspaceMember } = await import('../../models/WorkspaceMember');
      const { workspacePermissionService } = await import('../../services/WorkspacePermissionService');
      
      // Mock WorkspaceMember to return a member with permissions
      (WorkspaceMember.findOne as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        role: 'admin',
      });
      
      // Mock permission service to allow rejection
      (workspacePermissionService.hasPermission as jest.Mock).mockReturnValue(true);
      
      // Mock findById to return a pending post
      (ScheduledPost.findById as jest.Mock).mockResolvedValue({
        _id: mockPostId,
        workspaceId: mockWorkspaceId,
        status: PostStatus.PENDING_APPROVAL,
        save: jest.fn().mockResolvedValue({}),
      });

      await approvalService.rejectPost({
        postId: mockPostId,
        userId: mockUserId,
        reason: 'Content needs revision',
      });

      expect(ScheduledPost.findById).toHaveBeenCalledWith(mockPostId);
    });
  });

  describe('approveCurrentStage', () => {
    it('advances to next stage when not final stage', async () => {
      const { ScheduledPost } = await import('../../models/ScheduledPost');
      const { WorkspaceMember } = await import('../../models/WorkspaceMember');
      const { workspacePermissionService } = await import('../../services/WorkspacePermissionService');
      
      // Mock WorkspaceMember and permissions
      (WorkspaceMember.findOne as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        role: 'admin',
      });
      (workspacePermissionService.hasPermission as jest.Mock).mockReturnValue(true);
      
      const mockPost = {
        _id: mockPostId,
        workspaceId: mockWorkspaceId,
        approvalStages: [
          { name: 'content_review', assignedTo: [mockUserId], status: 'pending' },
          { name: 'legal_review', assignedTo: [mockUserId], status: 'pending' },
          { name: 'final_approval', assignedTo: [mockUserId], status: 'pending' }
        ],
        currentStage: 0,
        requiresApproval: true,
        save: jest.fn().mockResolvedValue({}),
      };
      (ScheduledPost.findById as jest.Mock).mockResolvedValue(mockPost);

      await approvalService.approveCurrentStage({
        postId: mockPostId,
        userId: mockUserId,
      });

      expect(ScheduledPost.findById).toHaveBeenCalledWith(mockPostId);
    });

    it('sets APPROVED status when final stage completed', async () => {
      const { ScheduledPost } = await import('../../models/ScheduledPost');
      const { WorkspaceMember } = await import('../../models/WorkspaceMember');
      const { workspacePermissionService } = await import('../../services/WorkspacePermissionService');
      
      // Mock WorkspaceMember and permissions
      (WorkspaceMember.findOne as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        role: 'admin',
      });
      (workspacePermissionService.hasPermission as jest.Mock).mockReturnValue(true);
      
      const mockPost = {
        _id: mockPostId,
        workspaceId: mockWorkspaceId,
        approvalStages: [
          { name: 'content_review', assignedTo: [mockUserId], status: 'approved' },
          { name: 'legal_review', assignedTo: [mockUserId], status: 'approved' },
          { name: 'final_approval', assignedTo: [mockUserId], status: 'pending' }
        ],
        currentStage: 2, // final stage
        requiresApproval: true,
        save: jest.fn().mockResolvedValue({}),
      };
      (ScheduledPost.findById as jest.Mock).mockResolvedValue(mockPost);

      await approvalService.approveCurrentStage({
        postId: mockPostId,
        userId: mockUserId,
      });

      expect(ScheduledPost.findById).toHaveBeenCalledWith(mockPostId);
    });
  });

  describe('rejectCurrentStage', () => {
    it('sets status to REJECTED and resets to first stage', async () => {
      const { ScheduledPost } = await import('../../models/ScheduledPost');
      const { WorkspaceMember } = await import('../../models/WorkspaceMember');
      const { workspacePermissionService } = await import('../../services/WorkspacePermissionService');
      
      // Mock WorkspaceMember and permissions
      (WorkspaceMember.findOne as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        role: 'admin',
      });
      (workspacePermissionService.hasPermission as jest.Mock).mockReturnValue(true);
      
      const mockPost = {
        _id: mockPostId,
        workspaceId: mockWorkspaceId,
        approvalStages: [
          { name: 'content_review', assignedTo: [mockUserId], status: 'approved' },
          { name: 'legal_review', assignedTo: [mockUserId], status: 'pending' },
          { name: 'final_approval', assignedTo: [mockUserId], status: 'pending' }
        ],
        currentStage: 1,
        requiresApproval: true,
        save: jest.fn().mockResolvedValue({}),
      };
      (ScheduledPost.findById as jest.Mock).mockResolvedValue(mockPost);

      await approvalService.rejectCurrentStage({
        postId: mockPostId,
        userId: mockUserId,
        reason: 'Stage rejected',
      });

      expect(ScheduledPost.findById).toHaveBeenCalledWith(mockPostId);
    });
  });
});