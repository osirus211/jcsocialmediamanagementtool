import { apiClient } from '../lib/api-client';

export enum TaskType {
  POST_CREATION = 'post_creation',
  POST_REVIEW = 'post_review',
  POST_APPROVAL = 'post_approval',
  CONTENT_RESEARCH = 'content_research',
  ACCOUNT_MANAGEMENT = 'account_management',
  CUSTOM = 'custom',
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface ChecklistItem {
  _id: string;
  text: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

export interface TaskComment {
  _id: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  text: string;
  createdAt: string;
}

export interface Attachment {
  url: string;
  name: string;
  type: 'image' | 'document' | 'video' | 'other';
  size?: number;
}

export interface Task {
  _id: string;
  workspaceId: string;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }>;
  assignedBy: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  relatedPostId?: string;
  relatedAccountId?: string;
  dueDate?: string;
  completedAt?: string;
  labels: string[];
  attachments: Attachment[];
  checklist: ChecklistItem[];
  comments: TaskComment[];
  watchers: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }>;
  estimatedMinutes?: number;
  actualMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  type: TaskType;
  priority?: TaskPriority;
  assignedTo?: string[];
  relatedPostId?: string;
  relatedAccountId?: string;
  dueDate?: string;
  labels?: string[];
  estimatedMinutes?: number;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  type?: TaskType;
  priority?: TaskPriority;
  dueDate?: string;
  labels?: string[];
  estimatedMinutes?: number;
}

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assignedTo?: string[];
  type?: TaskType[];
  labels?: string[];
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
}

class TasksService {
  /**
   * Create a new task
   */
  async createTask(request: CreateTaskRequest): Promise<Task> {
    const response = await apiClient.post('/tasks', request);
    return response.data;
  }

  /**
   * Get workspace tasks with filters
   */
  async getTasks(filters: TaskFilters = {}, limit = 50, offset = 0): Promise<{
    data: Task[];
    pagination: {
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const params = new URLSearchParams();
    
    if (filters.status && filters.status.length > 0) {
      params.append('status', filters.status.join(','));
    }
    if (filters.priority && filters.priority.length > 0) {
      params.append('priority', filters.priority.join(','));
    }
    if (filters.assignedTo && filters.assignedTo.length > 0) {
      params.append('assignedTo', filters.assignedTo.join(','));
    }
    if (filters.type && filters.type.length > 0) {
      params.append('type', filters.type.join(','));
    }
    if (filters.labels && filters.labels.length > 0) {
      params.append('labels', filters.labels.join(','));
    }
    if (filters.dueDateFrom) {
      params.append('dueDateFrom', filters.dueDateFrom);
    }
    if (filters.dueDateTo) {
      params.append('dueDateTo', filters.dueDateTo);
    }
    if (filters.search) {
      params.append('search', filters.search);
    }
    
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const response = await apiClient.get(`/tasks?${params.toString()}`);
    return response;
  }

  /**
   * Get my assigned tasks
   */
  async getMyTasks(): Promise<Task[]> {
    const response = await apiClient.get('/tasks/my');
    return response.data;
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(): Promise<Task[]> {
    const response = await apiClient.get('/tasks/overdue');
    return response.data;
  }

  /**
   * Get tasks by post ID
   */
  async getTasksByPost(postId: string): Promise<Task[]> {
    const response = await apiClient.get(`/tasks/by-post/${postId}`);
    return response.data;
  }

  /**
   * Get a single task
   */
  async getTask(taskId: string): Promise<Task> {
    const response = await apiClient.get(`/tasks/${taskId}`);
    return response.data;
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, request: UpdateTaskRequest): Promise<Task> {
    const response = await apiClient.patch(`/tasks/${taskId}`, request);
    return response.data;
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    await apiClient.delete(`/tasks/${taskId}`);
  }

  /**
   * Assign users to a task
   */
  async assignTask(taskId: string, userIds: string[]): Promise<Task> {
    const response = await apiClient.post(`/tasks/${taskId}/assign`, { userIds });
    return response.data;
  }

  /**
   * Unassign a user from a task
   */
  async unassignTask(taskId: string, userId?: string): Promise<Task> {
    const response = await apiClient.post(`/tasks/${taskId}/unassign`, { userId });
    return response.data;
  }

  /**
   * Update task status
   */
  async updateStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const response = await apiClient.patch(`/tasks/${taskId}/status`, { status });
    return response.data;
  }

  /**
   * Update task priority
   */
  async updatePriority(taskId: string, priority: TaskPriority): Promise<Task> {
    const response = await apiClient.patch(`/tasks/${taskId}/priority`, { priority });
    return response.data;
  }

  /**
   * Add a comment to a task
   */
  async addComment(taskId: string, text: string): Promise<Task> {
    const response = await apiClient.post(`/tasks/${taskId}/comments`, { text });
    return response.data;
  }

  /**
   * Add a checklist item
   */
  async addChecklistItem(taskId: string, text: string): Promise<Task> {
    const response = await apiClient.post(`/tasks/${taskId}/checklist`, { text });
    return response.data;
  }

  /**
   * Toggle checklist item completion
   */
  async toggleChecklistItem(taskId: string, itemId: string): Promise<Task> {
    const response = await apiClient.patch(`/tasks/${taskId}/checklist/${itemId}`);
    return response.data;
  }
}

export const tasksService = new TasksService();