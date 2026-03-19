import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { TaskDetailDrawer } from '../TaskDetailDrawer';
import { tasksService } from '@/services/tasks.service';
import { useWorkspaceStore } from '@/store/workspace.store';

// Mock the task service with enums
vi.mock('@/services/tasks.service', async () => {
  const actual = await vi.importActual('@/services/tasks.service');
  return {
    ...actual,
    tasksService: {
      assignTask: vi.fn(),
      unassignTask: vi.fn(),
      updateTaskStatus: vi.fn(),
      updateTaskPriority: vi.fn(),
      toggleChecklistItem: vi.fn(),
      addComment: vi.fn(),
    },
  };
});

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
    
    // Reset mock implementations directly on the service methods
    vi.mocked(tasksService.assignTask).mockResolvedValue(mockTask);
    vi.mocked(tasksService.unassignTask).mockResolvedValue(mockTask);
    vi.mocked(tasksService.updateTaskStatus).mockResolvedValue(mockTask);
    vi.mocked(tasksService.updateTaskPriority).mockResolvedValue(mockTask);
    vi.mocked(tasksService.toggleChecklistItem).mockResolvedValue(mockTask);
    vi.mocked(tasksService.addComment).mockResolvedValue(mockTask);
    
    vi.mocked(useWorkspaceStore).mockReturnValue({
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
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('Test task description')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    // Check for select labels instead of values
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
  });

  it('assign user calls POST /:id/assign', async () => {
    renderWithRouter(
      <TaskDetailDrawer 
        task={mockTask} 
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
      expect(tasksService.assignTask).toHaveBeenCalledWith('task-1', ['user-2']);
    });
  });

  it('unassign user calls POST /:id/unassign', async () => {
    renderWithRouter(
      <TaskDetailDrawer 
        task={mockTask} 
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    const unassignButton = screen.getByRole('button', { name: /remove.*john doe/i });
    fireEvent.click(unassignButton);

    await waitFor(() => {
      expect(tasksService.unassignTask).toHaveBeenCalledWith('task-1', 'user-1');
    });
  });

  it('status change calls PATCH /:id/status', async () => {
    renderWithRouter(
      <TaskDetailDrawer 
        task={mockTask} 
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    // Find select by label
    const statusSelects = screen.getAllByRole('combobox');
    const statusSelect = statusSelects[0]; // First select is status
    fireEvent.change(statusSelect, { target: { value: 'in_progress' } });

    await waitFor(() => {
      expect(tasksService.updateTaskStatus).toHaveBeenCalledWith('task-1', 'in_progress');
    });
  });

  it('priority change calls PATCH /:id/priority', async () => {
    renderWithRouter(
      <TaskDetailDrawer 
        task={mockTask} 
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    // Find select by label
    const selects = screen.getAllByRole('combobox');
    const prioritySelect = selects[1]; // Second select is priority
    fireEvent.change(prioritySelect, { target: { value: 'high' } });

    await waitFor(() => {
      expect(tasksService.updateTaskPriority).toHaveBeenCalledWith('task-1', 'high');
    });
  });

  it('checklist item toggle calls PATCH /:id/checklist/:itemId', async () => {
    renderWithRouter(
      <TaskDetailDrawer 
        task={mockTask} 
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    const checklistItem = screen.getByRole('checkbox', { name: /checklist item 1/i });
    fireEvent.click(checklistItem);

    await waitFor(() => {
      expect(tasksService.toggleChecklistItem).toHaveBeenCalledWith('task-1', 'item-1');
    });
  });

  it('add comment calls POST /:id/comments', async () => {
    renderWithRouter(
      <TaskDetailDrawer 
        task={mockTask} 
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    const commentInput = screen.getByPlaceholderText(/add a comment/i);
    const submitButton = screen.getByRole('button', { name: /add comment/i });

    fireEvent.change(commentInput, { target: { value: 'Test comment' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(tasksService.addComment).toHaveBeenCalledWith('task-1', 'Test comment');
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
        onClose={() => {}} 
        onUpdate={() => {}} 
      />
    );

    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });
});