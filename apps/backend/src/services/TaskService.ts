import { Types } from 'mongoose';
import { Task, ITask, TaskStatus, TaskPriority, TaskType, IChecklistItem, ITaskComment } from '../models/Task';
import { WorkspaceMember } from '../models/WorkspaceMember';
import { User } from '../models/User';
import { notificationQueue } from '../queue/NotificationQueue';
import { SystemEvent } from '../services/EventService';
import { logger } from '../utils/logger';

export interface PopulatedTask extends Omit<ITask, 'assignedTo' | 'assignedBy' | 'watchers'> {
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
  watchers: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }>;
}

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assignedTo?: string[];
  type?: TaskType[];
  labels?: string[];
  dueDate?: {
    from?: Date;
    to?: Date;
  };
  search?: string;
}

export class TaskService {
  /**
   * Create a new task
   */
  static async createTask(
    workspaceId: string,
    assignedBy: string,
    taskData: {
      title: string;
      description?: string;
      type: TaskType;
      priority?: TaskPriority;
      assignedTo?: string[];
      relatedPostId?: string;
      relatedAccountId?: string;
      dueDate?: Date;
      labels?: string[];
      estimatedMinutes?: number;
    }
  ): Promise<ITask> {
    try {
      const task = new Task({
        workspaceId: new Types.ObjectId(workspaceId),
        assignedBy: new Types.ObjectId(assignedBy),
        title: taskData.title,
        description: taskData.description,
        type: taskData.type,
        priority: taskData.priority || TaskPriority.MEDIUM,
        assignedTo: taskData.assignedTo?.map(id => new Types.ObjectId(id)) || [],
        relatedPostId: taskData.relatedPostId ? new Types.ObjectId(taskData.relatedPostId) : undefined,
        relatedAccountId: taskData.relatedAccountId ? new Types.ObjectId(taskData.relatedAccountId) : undefined,
        dueDate: taskData.dueDate,
        labels: taskData.labels || [],
        estimatedMinutes: taskData.estimatedMinutes,
        attachments: [],
        checklist: [],
        comments: [],
        watchers: [new Types.ObjectId(assignedBy)], // Creator is automatically a watcher
      });

      await task.save();

      // Notify assignees
      if (taskData.assignedTo && taskData.assignedTo.length > 0) {
        await this.notifyAssignees(task._id.toString(), 'assigned');
      }

      return task;
    } catch (error: any) {
      logger.error('Error creating task', {
        workspaceId,
        assignedBy,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update a task
   */
  static async updateTask(
    taskId: string,
    userId: string,
    updates: Partial<{
      title: string;
      description: string;
      type: TaskType;
      priority: TaskPriority;
      dueDate: Date;
      labels: string[];
      estimatedMinutes: number;
    }>
  ): Promise<ITask> {
    try {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // Check permissions
      const canUpdate = await this.canUserUpdateTask(taskId, userId);
      if (!canUpdate) {
        throw new Error('Unauthorized to update task');
      }

      // Update fields
      Object.assign(task, updates);
      await task.save();

      // Notify watchers of changes
      await this.notifyWatchers(taskId, userId, 'updated');

      return task;
    } catch (error: any) {
      logger.error('Error updating task', {
        taskId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete a task
   */
  static async deleteTask(taskId: string, userId: string): Promise<void> {
    try {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // Check permissions (only creator or admin can delete)
      const canDelete = await this.canUserDeleteTask(taskId, userId);
      if (!canDelete) {
        throw new Error('Unauthorized to delete task');
      }

      await Task.findByIdAndDelete(taskId);

      // Notify watchers
      await this.notifyWatchers(taskId, userId, 'deleted');
    } catch (error: any) {
      logger.error('Error deleting task', {
        taskId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Assign users to a task
   */
  static async assignTask(taskId: string, userIds: string[], assignedBy: string): Promise<ITask> {
    try {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // Add new assignees (avoid duplicates)
      const newAssignees = userIds
        .map(id => new Types.ObjectId(id))
        .filter(id => !task.assignedTo.some(existing => existing.equals(id)));

      task.assignedTo.push(...newAssignees);
      await task.save();

      // Notify new assignees
      if (newAssignees.length > 0) {
        await this.notifyAssignees(taskId, 'assigned');
      }

      return task;
    } catch (error: any) {
      logger.error('Error assigning task', {
        taskId,
        userIds,
        assignedBy,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Unassign a user from a task
   */
  static async unassignTask(taskId: string, userId: string): Promise<ITask> {
    try {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      task.assignedTo = task.assignedTo.filter(id => !id.equals(new Types.ObjectId(userId)));
      await task.save();

      return task;
    } catch (error: any) {
      logger.error('Error unassigning task', {
        taskId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update task status
   */
  static async updateStatus(taskId: string, status: TaskStatus, userId: string): Promise<ITask> {
    try {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      const oldStatus = task.status;
      task.status = status;

      if (status === TaskStatus.DONE && !task.completedAt) {
        task.completedAt = new Date();
      } else if (status !== TaskStatus.DONE && task.completedAt) {
        task.completedAt = undefined;
      }

      await task.save();

      // Notify watchers of status change
      await this.notifyWatchers(taskId, userId, 'status_changed', {
        oldStatus,
        newStatus: status,
      });

      return task;
    } catch (error: any) {
      logger.error('Error updating task status', {
        taskId,
        status,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update task priority
   */
  static async updatePriority(taskId: string, priority: TaskPriority, userId: string): Promise<ITask> {
    try {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      task.priority = priority;
      await task.save();

      // Notify watchers of priority change
      await this.notifyWatchers(taskId, userId, 'priority_changed', { priority });

      return task;
    } catch (error: any) {
      logger.error('Error updating task priority', {
        taskId,
        priority,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add a comment to a task
   */
  static async addComment(taskId: string, userId: string, text: string): Promise<ITask> {
    try {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      const comment: ITaskComment = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        text,
        createdAt: new Date(),
      };

      task.comments.push(comment);
      await task.save();

      // Notify watchers of new comment
      await this.notifyWatchers(taskId, userId, 'comment_added');

      return task;
    } catch (error: any) {
      logger.error('Error adding task comment', {
        taskId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add a checklist item
   */
  static async addChecklistItem(taskId: string, text: string): Promise<ITask> {
    try {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      const item: IChecklistItem = {
        _id: new Types.ObjectId(),
        text,
        completed: false,
      };

      task.checklist.push(item);
      await task.save();

      return task;
    } catch (error: any) {
      logger.error('Error adding checklist item', {
        taskId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Toggle checklist item completion
   */
  static async toggleChecklistItem(taskId: string, itemId: string, userId: string): Promise<ITask> {
    try {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      const item = task.checklist.find(item => item._id.toString() === itemId);
      if (!item) {
        throw new Error('Checklist item not found');
      }

      item.completed = !item.completed;
      if (item.completed) {
        item.completedBy = new Types.ObjectId(userId);
        item.completedAt = new Date();
      } else {
        item.completedBy = undefined;
        item.completedAt = undefined;
      }

      await task.save();

      return task;
    } catch (error: any) {
      logger.error('Error toggling checklist item', {
        taskId,
        itemId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get tasks assigned to a user
   */
  static async getMyTasks(userId: string, workspaceId: string): Promise<PopulatedTask[]> {
    try {
      const tasks = await Task.find({
        workspaceId: new Types.ObjectId(workspaceId),
        assignedTo: new Types.ObjectId(userId),
      })
      .populate('assignedTo', 'firstName lastName avatar')
      .populate('assignedBy', 'firstName lastName avatar')
      .populate('watchers', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .lean();

      return this.formatTasks(tasks);
    } catch (error: any) {
      logger.error('Error getting user tasks', {
        userId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get workspace tasks with filters
   */
  static async getWorkspaceTasks(
    workspaceId: string,
    filters: TaskFilters = {},
    limit = 50,
    offset = 0
  ): Promise<PopulatedTask[]> {
    try {
      const query: any = { workspaceId: new Types.ObjectId(workspaceId) };

      // Apply filters
      if (filters.status && filters.status.length > 0) {
        query.status = { $in: filters.status };
      }

      if (filters.priority && filters.priority.length > 0) {
        query.priority = { $in: filters.priority };
      }

      if (filters.assignedTo && filters.assignedTo.length > 0) {
        query.assignedTo = { $in: filters.assignedTo.map(id => new Types.ObjectId(id)) };
      }

      if (filters.type && filters.type.length > 0) {
        query.type = { $in: filters.type };
      }

      if (filters.labels && filters.labels.length > 0) {
        query.labels = { $in: filters.labels };
      }

      if (filters.dueDate) {
        query.dueDate = {};
        if (filters.dueDate.from) {
          query.dueDate.$gte = filters.dueDate.from;
        }
        if (filters.dueDate.to) {
          query.dueDate.$lte = filters.dueDate.to;
        }
      }

      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
        ];
      }

      const tasks = await Task.find(query)
        .populate('assignedTo', 'firstName lastName avatar')
        .populate('assignedBy', 'firstName lastName avatar')
        .populate('watchers', 'firstName lastName avatar')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean();

      return this.formatTasks(tasks);
    } catch (error: any) {
      logger.error('Error getting workspace tasks', {
        workspaceId,
        filters,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get tasks by post
   */
  static async getTasksByPost(postId: string): Promise<PopulatedTask[]> {
    try {
      const tasks = await Task.find({
        relatedPostId: new Types.ObjectId(postId),
      })
      .populate('assignedTo', 'firstName lastName avatar')
      .populate('assignedBy', 'firstName lastName avatar')
      .populate('watchers', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .lean();

      return this.formatTasks(tasks);
    } catch (error: any) {
      logger.error('Error getting tasks by post', {
        postId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get overdue tasks
   */
  static async getOverdueTasks(workspaceId: string): Promise<PopulatedTask[]> {
    try {
      const now = new Date();
      const tasks = await Task.find({
        workspaceId: new Types.ObjectId(workspaceId),
        dueDate: { $lt: now },
        status: { $nin: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      })
      .populate('assignedTo', 'firstName lastName avatar')
      .populate('assignedBy', 'firstName lastName avatar')
      .populate('watchers', 'firstName lastName avatar')
      .sort({ dueDate: 1 })
      .lean();

      return this.formatTasks(tasks);
    } catch (error: any) {
      logger.error('Error getting overdue tasks', {
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get a single task by ID
   */
  static async getTaskById(taskId: string): Promise<PopulatedTask | null> {
    try {
      const task = await Task.findById(taskId)
        .populate('assignedTo', 'firstName lastName avatar')
        .populate('assignedBy', 'firstName lastName avatar')
        .populate('watchers', 'firstName lastName avatar')
        .populate('comments.userId', 'firstName lastName avatar')
        .lean();

      if (!task) {
        return null;
      }

      return this.formatTasks([task])[0];
    } catch (error: any) {
      logger.error('Error getting task by ID', {
        taskId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Notify assignees
   */
  private static async notifyAssignees(taskId: string, action: 'assigned' | 'updated'): Promise<void> {
    try {
      const task = await Task.findById(taskId);
      if (!task) return;

      for (const assigneeId of task.assignedTo) {
        await (notificationQueue as any).add('notification', {
          eventType: SystemEvent.TASK_ASSIGNED,
          workspaceId: task.workspaceId.toString(),
          userId: assigneeId.toString(),
          payload: {
            taskId: task._id.toString(),
            taskTitle: task.title,
            action,
          },
        });
      }
    } catch (error: any) {
      logger.error('Error notifying assignees', {
        taskId,
        action,
        error: error.message,
      });
    }
  }

  /**
   * Notify watchers
   */
  private static async notifyWatchers(
    taskId: string,
    userId: string,
    action: string,
    metadata?: any
  ): Promise<void> {
    try {
      const task = await Task.findById(taskId);
      if (!task) return;

      for (const watcherId of task.watchers) {
        // Don't notify the user who made the change
        if (watcherId.toString() === userId) continue;

        await (notificationQueue as any).add('notification', {
          eventType: SystemEvent.TASK_UPDATED,
          workspaceId: task.workspaceId.toString(),
          userId: watcherId.toString(),
          payload: {
            taskId: task._id.toString(),
            taskTitle: task.title,
            action,
            metadata,
          },
        });
      }
    } catch (error: any) {
      logger.error('Error notifying watchers', {
        taskId,
        userId,
        action,
        error: error.message,
      });
    }
  }

  /**
   * Check if user can update task
   */
  private static async canUserUpdateTask(taskId: string, userId: string): Promise<boolean> {
    try {
      const task = await Task.findById(taskId);
      if (!task) return false;

      // Assignees and creator can update
      const isAssignee = task.assignedTo.some(id => id.toString() === userId);
      const isCreator = task.assignedBy.toString() === userId;

      if (isAssignee || isCreator) return true;

      // Check if user is admin
      const member = await WorkspaceMember.findOne({
        workspaceId: task.workspaceId,
        userId: new Types.ObjectId(userId),
      });

      return member?.role === 'admin' || member?.role === 'owner';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user can delete task
   */
  private static async canUserDeleteTask(taskId: string, userId: string): Promise<boolean> {
    try {
      const task = await Task.findById(taskId);
      if (!task) return false;

      // Only creator can delete
      const isCreator = task.assignedBy.toString() === userId;
      if (isCreator) return true;

      // Check if user is admin
      const member = await WorkspaceMember.findOne({
        workspaceId: task.workspaceId,
        userId: new Types.ObjectId(userId),
      });

      return member?.role === 'admin' || member?.role === 'owner';
    } catch (error) {
      return false;
    }
  }

  /**
   * Format tasks for response
   */
  private static formatTasks(tasks: any[]): PopulatedTask[] {
    return tasks.map(task => ({
      ...task,
      assignedTo: task.assignedTo.map((user: any) => ({
        _id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
      })),
      assignedBy: {
        _id: task.assignedBy._id.toString(),
        firstName: task.assignedBy.firstName,
        lastName: task.assignedBy.lastName,
        avatar: task.assignedBy.avatar,
      },
      watchers: task.watchers.map((user: any) => ({
        _id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
      })),
    })) as PopulatedTask[];
  }
}