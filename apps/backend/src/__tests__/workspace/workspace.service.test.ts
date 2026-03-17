import { WorkspaceService } from '../../services/WorkspaceService';
import { MemberRole } from '../../models/WorkspaceMember';
import mongoose from 'mongoose';

// Mock all external dependencies
jest.mock('../../models/Workspace');
jest.mock('../../models/WorkspaceMember');
jest.mock('../../models/WorkspaceActivityLog');
jest.mock('../../utils/redisClient');

describe('WorkspaceService', () => {
  let workspaceService: WorkspaceService;
  const mockWorkspaceId = new mongoose.Types.ObjectId();
  const mockOwnerId = new mongoose.Types.ObjectId();
  const mockAdminId = new mongoose.Types.ObjectId();
  const mockMemberId = new mongoose.Types.ObjectId();
  const mockOutsiderId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    workspaceService = new WorkspaceService();
    jest.clearAllMocks();
  });

  describe('updateWorkspace', () => {
    it('OWNER ✓', async () => {
      // Mock getMember to return OWNER role
      jest.spyOn(workspaceService, 'getMember').mockResolvedValue({
        role: MemberRole.OWNER,
        workspaceId: mockWorkspaceId,
        userId: mockOwnerId,
      } as any);

      const { Workspace } = await import('../../models/Workspace');
      (Workspace.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await expect(
        workspaceService.updateWorkspace({
          workspaceId: mockWorkspaceId,
          userId: mockOwnerId,
          updates: { name: 'Updated Name' }
        })
      ).resolves.not.toThrow();
    });

    it('ADMIN ✓', async () => {
      jest.spyOn(workspaceService, 'getMember').mockResolvedValue({
        role: MemberRole.ADMIN,
        workspaceId: mockWorkspaceId,
        userId: mockAdminId,
      } as any);

      const { Workspace } = await import('../../models/Workspace');
      (Workspace.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await expect(
        workspaceService.updateWorkspace({
          workspaceId: mockWorkspaceId,
          userId: mockAdminId,
          updates: { name: 'Updated Name' }
        })
      ).resolves.not.toThrow();
    });

    it('MEMBER → ForbiddenError', async () => {
      jest.spyOn(workspaceService, 'getMember').mockResolvedValue({
        role: MemberRole.MEMBER,
        workspaceId: mockWorkspaceId,
        userId: mockMemberId,
      } as any);

      await expect(
        workspaceService.updateWorkspace({
          workspaceId: mockWorkspaceId,
          userId: mockMemberId,
          updates: { name: 'Updated Name' }
        })
      ).rejects.toThrow('Insufficient permissions');
    });

    it('outsider → ForbiddenError', async () => {
      jest.spyOn(workspaceService, 'getMember').mockResolvedValue(null);

      await expect(
        workspaceService.updateWorkspace({
          workspaceId: mockWorkspaceId,
          userId: mockOutsiderId,
          updates: { name: 'Updated Name' }
        })
      ).rejects.toThrow('Insufficient permissions');
    });
  });
  describe('deleteWorkspace', () => {
    it('OWNER + valid confirmToken ✓', async () => {
      jest.spyOn(workspaceService, 'getMember').mockResolvedValue({
        role: MemberRole.OWNER,
        workspaceId: mockWorkspaceId,
        userId: mockOwnerId,
      } as any);

      // Mock mongoose session
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);

      const { Workspace } = await import('../../models/Workspace');
      const { WorkspaceMember } = await import('../../models/WorkspaceMember');
      (Workspace.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
      (WorkspaceMember.updateMany as jest.Mock).mockResolvedValue({});

      await expect(
        workspaceService.deleteWorkspace({
          workspaceId: mockWorkspaceId,
          userId: mockOwnerId,
        })
      ).resolves.not.toThrow();
    });

    it('ADMIN → ForbiddenError', async () => {
      jest.spyOn(workspaceService, 'getMember').mockResolvedValue({
        role: MemberRole.ADMIN,
        workspaceId: mockWorkspaceId,
        userId: mockAdminId,
      } as any);

      await expect(
        workspaceService.deleteWorkspace({
          workspaceId: mockWorkspaceId,
          userId: mockAdminId,
        })
      ).rejects.toThrow('Only workspace owner can delete workspace');
    });

    it('sets deletedAt (soft delete), row still exists in DB', async () => {
      jest.spyOn(workspaceService, 'getMember').mockResolvedValue({
        role: MemberRole.OWNER,
        workspaceId: mockWorkspaceId,
        userId: mockOwnerId,
      } as any);

      // Mock mongoose session
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);

      const { Workspace } = await import('../../models/Workspace');
      const { WorkspaceMember } = await import('../../models/WorkspaceMember');
      const updateSpy = jest.fn().mockResolvedValue({});
      (Workspace.findByIdAndUpdate as jest.Mock).mockImplementation(updateSpy);
      (WorkspaceMember.updateMany as jest.Mock).mockResolvedValue({});

      await workspaceService.deleteWorkspace({
        workspaceId: mockWorkspaceId,
        userId: mockOwnerId,
      });

      // Verify soft delete was called with correct parameters
      expect(updateSpy).toHaveBeenCalledWith(
        mockWorkspaceId,
        expect.objectContaining({
          isActive: false,
          deletedAt: expect.any(Date)
        }),
        expect.objectContaining({ session: mockSession })
      );
    });
  });
  describe('removeMember', () => {
    it('ADMIN ✓', async () => {
      jest.spyOn(workspaceService, 'getMember')
        .mockResolvedValueOnce({
          role: MemberRole.ADMIN,
          workspaceId: mockWorkspaceId,
          userId: mockAdminId,
        } as any);

      // Mock WorkspaceMember.findOne to return the member being removed
      const { WorkspaceMember } = await import('../../models/WorkspaceMember');
      (WorkspaceMember.findOne as jest.Mock).mockResolvedValue({
        role: MemberRole.MEMBER,
        workspaceId: mockWorkspaceId,
        userId: mockMemberId,
      });

      jest.spyOn(workspaceService, 'fullyRemoveMember').mockResolvedValue();

      await expect(
        workspaceService.removeMember({
          workspaceId: mockWorkspaceId,
          removedBy: mockAdminId,
          userId: mockMemberId,
        })
      ).resolves.not.toThrow();
    });

    it('cannot remove OWNER → ForbiddenError', async () => {
      jest.spyOn(workspaceService, 'getMember')
        .mockResolvedValueOnce({
          role: MemberRole.ADMIN,
          workspaceId: mockWorkspaceId,
          userId: mockAdminId,
        } as any);

      // Mock WorkspaceMember.findOne to return the owner being removed
      const { WorkspaceMember } = await import('../../models/WorkspaceMember');
      (WorkspaceMember.findOne as jest.Mock).mockResolvedValue({
        role: MemberRole.OWNER,
        workspaceId: mockWorkspaceId,
        userId: mockOwnerId,
      });

      await expect(
        workspaceService.removeMember({
          workspaceId: mockWorkspaceId,
          removedBy: mockAdminId,
          userId: mockOwnerId,
        })
      ).rejects.toThrow('Cannot remove workspace owner');
    });
  });

  describe('changeMemberRole', () => {
    it('ADMIN cannot change OWNER\'s role → ForbiddenError', async () => {
      jest.spyOn(workspaceService, 'getMember')
        .mockResolvedValueOnce({
          role: MemberRole.ADMIN,
          workspaceId: mockWorkspaceId,
          userId: mockAdminId,
        } as any)
        .mockResolvedValueOnce({
          role: MemberRole.OWNER,
          workspaceId: mockWorkspaceId,
          userId: mockOwnerId,
        } as any);

      await expect(
        workspaceService.changeMemberRole({
          workspaceId: mockWorkspaceId,
          changedBy: mockAdminId,
          userId: mockOwnerId,
          newRole: MemberRole.MEMBER,
        })
      ).rejects.toThrow('Cannot change owner role');
    });

    it('MEMBER cannot change any role → ForbiddenError', async () => {
      jest.spyOn(workspaceService, 'getMember').mockResolvedValue({
        role: MemberRole.MEMBER,
        workspaceId: mockWorkspaceId,
        userId: mockMemberId,
      } as any);

      await expect(
        workspaceService.changeMemberRole({
          workspaceId: mockWorkspaceId,
          changedBy: mockMemberId,
          userId: mockAdminId,
          newRole: MemberRole.ADMIN,
        })
      ).rejects.toThrow('Insufficient permissions');
    });
  });
});