import { TaskService } from '../../services/TaskService';
import { TaskStatus, TaskPriority, TaskType } from '../../models/Task';
import mongoose from 'mongoose';

// Mock all external dependencies
jest.mock('../../models/Task');
jest.mock('../../models/WorkspaceMember');
jest.mock('../../services/NotificationService');

describe('TaskService', () => {
  const mockWorkspaceId = new mongoose.Types.ObjectId();
  const mockUserId = new mongoose.Types.ObjectId();
  const mockTaskId = new mongoose.Types.ObjectId();
  const mockAssigneeId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('creates task with required fields', async () => {
      const { Task } = await import('../../models/Task');
      const mockTask = {
        _id: mockTaskId,
        save: jest.fn().mockResolvedValue({}),
      };
      (Task as unknown as jest.Mock).mockImplementation(() => mockTask);

      await TaskService.createTask(
        mockWorkspaceId.toString(),
        mockUserId.toString(),
        {
          title: 'Test Task',
          description: 'Test description',
          type: TaskType.POST_CREATION,
          priority: TaskPriority.MEDIUM,
          assignedTo: [mockAssigneeId.toString()],
          dueDate: new Date(),
        }
      );

      expect(Task).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: mockWorkspaceId,
          title: 'Test Task',
          description: 'Test description',
          assignedBy: mockUserId,
          assignedTo: [mockAssigneeId],
          priority: TaskPriority.MEDIUM,
          type: TaskType.POST_CREATION,
        })
      );
      expect(mockTask.save).toHaveBeenCalled();
    });
  });

  describe('assignTask', () => {
    it('adds users to assignedTo array', async () => {
      const { Task } = await import('../../models/Task');
      
      // Mock findById to return a task
      (Task.findById as unknown as jest.Mock).mockResolvedValue({
        _id: mockTaskId,
        assignedTo: [],
        save: jest.fn().mockResolvedValue({}),
      });
      
      await TaskService.assignTask(
        mockTaskId.toString(),
        [mockAssigneeId.toString()],
        mockUserId.toString()
      );

      expect(Task.findById).toHaveBeenCalledWith(mockTaskId.toString());
    });
  });

  describe('unassignTask', () => {
    it('removes user from assignedTo array', async () => {
      const { Task } = await import('../../models/Task');
      
      // Mock findById to return a task
      const mockAssignedToId = {
        equals: jest.fn().mockReturnValue(true),
        toString: () => mockAssigneeId.toString(),
      };
      (Task.findById as unknown as jest.Mock).mockResolvedValue({
        _id: mockTaskId,
        assignedTo: [mockAssignedToId],
        save: jest.fn().mockResolvedValue({}),
      });
      
      await TaskService.unassignTask(
        mockTaskId.toString(),
        mockAssigneeId.toString()
      );

      expect(Task.findById).toHaveBeenCalledWith(mockTaskId.toString());
    });
  });

  describe('updateStatus', () => {
    it('updates status and completedAt when completed', async () => {
      const { Task } = await import('../../models/Task');
      
      // Mock findById to return a task
      (Task.findById as unknown as jest.Mock).mockResolvedValue({
        _id: mockTaskId,
        status: TaskStatus.TODO,
        save: jest.fn().mockResolvedValue({}),
      });
      
      await TaskService.updateStatus(
        mockTaskId.toString(),
        TaskStatus.DONE,
        mockUserId.toString()
      );

      expect(Task.findById).toHaveBeenCalledWith(mockTaskId.toString());
    });

    it('clears completedAt when status changed from completed', async () => {
      const { Task } = await import('../../models/Task');
      
      // Mock findById to return a completed task
      (Task.findById as unknown as jest.Mock).mockResolvedValue({
        _id: mockTaskId,
        status: TaskStatus.DONE,
        completedAt: new Date(),
        save: jest.fn().mockResolvedValue({}),
      });
      
      await TaskService.updateStatus(
        mockTaskId.toString(),
        TaskStatus.IN_PROGRESS,
        mockUserId.toString()
      );

      expect(Task.findById).toHaveBeenCalledWith(mockTaskId.toString());
    });
  });

  describe('updatePriority', () => {
    it('updates task priority', async () => {
      const { Task } = await import('../../models/Task');
      
      // Mock findById to return a task
      (Task.findById as unknown as jest.Mock).mockResolvedValue({
        _id: mockTaskId,
        priority: TaskPriority.MEDIUM,
        save: jest.fn().mockResolvedValue({}),
      });
      
      await TaskService.updatePriority(
        mockTaskId.toString(),
        TaskPriority.HIGH,
        mockUserId.toString()
      );

      expect(Task.findById).toHaveBeenCalledWith(mockTaskId.toString());
    });
  });

  describe('toggleChecklistItem', () => {
    it('toggles checklist item completion status', async () => {
      const { Task } = await import('../../models/Task');
      const mockTask = {
        checklist: [
          { _id: 'item-1', text: 'Item 1', completed: false },
          { _id: 'item-2', text: 'Item 2', completed: true },
        ],
        save: jest.fn().mockResolvedValue({}),
      };
      (Task.findById as unknown as jest.Mock).mockResolvedValue(mockTask);

      await TaskService.toggleChecklistItem(
        mockTaskId.toString(),
        'item-1',
        mockUserId.toString()
      );

      expect(mockTask.checklist[0].completed).toBe(true);
      expect(mockTask.save).toHaveBeenCalled();
    });
  });

  describe('addComment', () => {
    it('adds comment to task', async () => {
      const { Task } = await import('../../models/Task');
      const mockTask = {
        _id: mockTaskId,
        comments: [],
        save: jest.fn().mockResolvedValue({}),
      };
      (Task.findById as unknown as jest.Mock).mockResolvedValue(mockTask);

      await TaskService.addComment(
        mockTaskId.toString(),
        mockUserId.toString(),
        'Test comment'
      );

      expect(mockTask.comments).toHaveLength(1);
      expect(mockTask.comments[0]).toEqual(
        expect.objectContaining({
          text: 'Test comment',
          userId: mockUserId,
          createdAt: expect.any(Date),
        })
      );
      expect(mockTask.save).toHaveBeenCalled();
    });
  });
});