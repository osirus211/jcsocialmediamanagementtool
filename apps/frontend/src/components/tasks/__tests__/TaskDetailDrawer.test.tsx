import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { TaskDetailDrawer } from '../TaskDetailDrawer';

// Mock the task service
vi.mock('@/services/tasks.service', () => ({
  tasksService: {
    assignTask: vi.fn(),
    unassignTask: vi.fn(),
    updateTaskStatus: vi.fn(),
    updateTaskPriority: vi.fn(),
    toggleChecklistItem: vi.fn(),
    addComment: vi.fn(),
  },
}));

// Mock the workspace store
vi.mock('@/store/workspace.store', () => ({
  useWorkspaceStore: vi.fn(),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('TaskDetailDrawer', () => {
  let mockTasksService: any;
  let mockUseWorkspaceStore: any;

  beforeAll(async () => {
    mockTasksService = (await vi.importMock('@/services/tasks.service')).tasksService;
    mockUseWorkspaceStore = (await vi.importMock('@/store/workspace.store')).useWorkspaceStore;
  });

  const mockTask = {
    _id: 'task-1',
    workspaceId: 'workspace-1',
    title: 'Test Task',
    description: 'Test task description',
    type: 'general' as any, // TaskType
    assignedTo: [
      { _id: 'user-1', firstName: 'John', lastName: 'Doe', avatar: null },
    ],
    assignedBy: {
      _id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      avatar: null,
    },
    priority: 'medium' as any, // TaskPriority
    status: 'todo' as any, // TaskStatus
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
    completedAt: undefined,
    relatedPostId: undefined,
    relatedAccountId: undefined,
    labels: [],
    attachments: [],
    watchers: [],
    checklist: [
      { _id: 'item-1', text: 'Checklist item 1', completed: false },
      { _id: 'item-2', text: 'Checklist item 2', completed: true },
    ],
    comments: [],
    estimatedMinutes: undefined,
    actualMinutes: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(mockUseWorkspaceStore).mockReturnValue({
      currentWorkspace: {
        _id: 'workspace-1',
        name: 'Test Workspace',
      },
      members: [
        { _id: 'user-1', firstName: 'John', lastName: 'Doe', avatar: null },
        { _id: 'user-2', firstName: 'Jane', lastName: 'Smith', avatar: null },
      ],
    });
  });

  it('renders task title, description, assignees, and priority', () => {
    renderWithRouter(
      <TaskDetailDrawer 
        task={mockTask} 
        isOpen={true} 
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('Test task description')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('assign user calls POST /:id/assign', async () => {
    vi.mocked(mockTasksService.assignTask).mockResolvedValue(mockTask);

    renderWithRouter(
      <TaskDetailDrawer 
        task={mockTask} 
        isOpen={true} 
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    const assignButton = screen.getByRole('button', { name: /assign/i });
    fireEvent.click(assignButton);

    // Simulate selecting a user
    const userOption = screen.getByText('Jane Smith');
    fireEvent.click(userOption);

    await waitFor(() => {
      expect(vi.mocked(mockTasksService.assignTask)).toHaveBeenCalledWith('task-1', ['user-2']);
    });
  });

  it('unassign user calls POST /:id/unassign', async () => {
    vi.mocked(mockTasksService.unassignTask).mockResolvedValue(mockTask);

    renderWithRouter(
      <TaskDetailDrawer 
        task={mockTask} 
        isOpen={true} 
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    const unassignButton = screen.getByRole('button', { name: /remove.*john doe/i });
    fireEvent.click(unassignButton);

    await waitFor(() => {
      expect(vi.mocked(mockTasksService.unassignTask)).toHaveBeenCalledWith('task-1', 'user-1');
    });
  });

  it('status change calls PATCH /:id/status', async () => {
    vi.mocked(mockTasksService.updateTaskStatus).mockResolvedValue(mockTask);

    renderWithRouter(
      <TaskDetailDrawer 
        task={mockTask} 
        isOpen={true} 
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    const statusSelect = screen.getByDisplayValue('todo');
    fireEvent.change(statusSelect, { target: { value: 'in_progress' } });

    await waitFor(() => {
      expect(vi.mocked(mockTasksService.updateTaskStatus)).toHaveBeenCalledWith('task-1', 'in_progress');
    });
  });

  it('priority change calls PATCH /:id/priority', async () => {
    vi.mocked(mockTasksService.updateTaskPriority).mockResolvedValue(mockTask);

    renderWithRouter(
      <TaskDetailDrawer 
        task={mockTask} 
        isOpen={true} 
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    const prioritySelect = screen.getByDisplayValue('medium');
    fireEvent.change(prioritySelect, { target: { value: 'high' } });

    await waitFor(() => {
      expect(vi.mocked(mockTasksService.updateTaskPriority)).toHaveBeenCalledWith('task-1', 'high');
    });
  });

  it('checklist item toggle calls PATCH /:id/checklist/:itemId', async () => {
    vi.mocked(mockTasksService.toggleChecklistItem).mockResolvedValue(mockTask);

    renderWithRouter(
      <TaskDetailDrawer 
        task={mockTask} 
        isOpen={true} 
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    const checklistItem = screen.getByRole('checkbox', { name: /checklist item 1/i });
    fireEvent.click(checklistItem);

    await waitFor(() => {
      expect(vi.mocked(mockTasksService.toggleChecklistItem)).toHaveBeenCalledWith('task-1', 'item-1');
    });
  });

  it('add comment calls POST /:id/comments', async () => {
    vi.mocked(mockTasksService.addComment).mockResolvedValue(mockTask);

    renderWithRouter(
      <TaskDetailDrawer 
        task={mockTask} 
        isOpen={true} 
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    const commentInput = screen.getByPlaceholderText(/add a comment/i);
    const submitButton = screen.getByRole('button', { name: /post comment/i });

    fireEvent.change(commentInput, { target: { value: 'Test comment' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(vi.mocked(mockTasksService.addComment)).toHaveBeenCalledWith('task-1', 'Test comment');
    });
  });

  it('shows overdue badge when dueDate < today', () => {
    const overdueTask = {
      ...mockTask,
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
    };

    renderWithRouter(
      <TaskDetailDrawer 
        task={overdueTask} 
        isOpen={true} 
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });
});