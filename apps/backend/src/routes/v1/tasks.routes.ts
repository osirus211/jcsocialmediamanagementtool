import { Router } from 'express';
import { z } from 'zod';
import { TaskService, TaskFilters } from '../../services/TaskService';
import { TaskType, TaskStatus, TaskPriority } from '../../models/Task';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { logger } from '../../utils/logger';

const router = Router();

// Apply workspace isolation to all task routes
router.use(requireAuth);
router.use(requireWorkspace);

// Validation schemas
const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    type: z.nativeEnum(TaskType),
    priority: z.nativeEnum(TaskPriority).optional(),
    assignedTo: z.array(z.string()).optional(),
    relatedPostId: z.string().optional(),
    relatedAccountId: z.string().optional(),
    dueDate: z.string().datetime().optional(),
    labels: z.array(z.string().max(50)).optional(),
    estimatedMinutes: z.number().min(0).optional(),
  }),
});

const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    type: z.nativeEnum(TaskType).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueDate: z.string().datetime().optional(),
    labels: z.array(z.string().max(50)).optional(),
    estimatedMinutes: z.number().min(0).optional(),
  }),
});

const assignTaskSchema = z.object({
  body: z.object({
    userIds: z.array(z.string()),
  }),
});

const updateStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(TaskStatus),
  }),
});

const updatePrioritySchema = z.object({
  body: z.object({
    priority: z.nativeEnum(TaskPriority),
  }),
});

const addCommentSchema = z.object({
  body: z.object({
    text: z.string().min(1).max(2000),
  }),
});

const addChecklistItemSchema = z.object({
  body: z.object({
    text: z.string().min(1).max(500),
  }),
});

const getTasksSchema = z.object({
  query: z.object({
    status: z.string().optional(),
    priority: z.string().optional(),
    assignedTo: z.string().optional(),
    type: z.string().optional(),
    labels: z.string().optional(),
    dueDateFrom: z.string().datetime().optional(),
    dueDateTo: z.string().datetime().optional(),
    search: z.string().optional(),
    limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
    offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
  }),
});

/**
 * POST /tasks
 * Create a new task
 */
router.post(
  '/',
  validateRequest(createTaskSchema),
  async (req, res): Promise<void> => {
    try {
      const workspaceId = req.workspace?.workspaceId?.toString();
      const userId = req.user?.userId;

      if (!workspaceId || !userId) {
        res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Workspace context and authentication required',
        });
        return;
      }

      const taskData = {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      };

      const task = await TaskService.createTask(workspaceId, userId, taskData);

      res.status(201).json({
        success: true,
        data: task,
      });
    } catch (error: any) {
      logger.error('Error creating task', {
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to create task',
      });
    }
  }
);

/**
 * GET /tasks
 * Get workspace tasks with filters
 */
router.get(
  '/',
  validateRequest(getTasksSchema),
  async (req, res): Promise<void> => {
    try {
      const workspaceId = req.workspace?.workspaceId?.toString();

      if (!workspaceId) {
        res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Workspace context required',
        });
        return;
      }

      const { limit, offset, ...filterParams } = req.query as any;

      // Parse filters
      const filters: TaskFilters = {};
      
      if (filterParams.status) {
        filters.status = filterParams.status.split(',') as TaskStatus[];
      }
      
      if (filterParams.priority) {
        filters.priority = filterParams.priority.split(',') as TaskPriority[];
      }
      
      if (filterParams.assignedTo) {
        filters.assignedTo = filterParams.assignedTo.split(',');
      }
      
      if (filterParams.type) {
        filters.type = filterParams.type.split(',') as TaskType[];
      }
      
      if (filterParams.labels) {
        filters.labels = filterParams.labels.split(',');
      }
      
      if (filterParams.dueDateFrom || filterParams.dueDateTo) {
        filters.dueDate = {};
        if (filterParams.dueDateFrom) {
          filters.dueDate.from = new Date(filterParams.dueDateFrom);
        }
        if (filterParams.dueDateTo) {
          filters.dueDate.to = new Date(filterParams.dueDateTo);
        }
      }
      
      if (filterParams.search) {
        filters.search = filterParams.search;
      }

      const tasks = await TaskService.getWorkspaceTasks(workspaceId, filters, limit, offset);

      res.json({
        success: true,
        data: tasks,
        pagination: {
          limit,
          offset,
          hasMore: tasks.length === limit,
        },
      });
    } catch (error: any) {
      logger.error('Error getting tasks', {
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to get tasks',
      });
    }
  }
);

/**
 * GET /tasks/my
 * Get my assigned tasks
 */
router.get('/my', async (req, res): Promise<void> => {
  try {
    const workspaceId = req.workspace?.workspaceId?.toString();
    const userId = req.user?.userId;

    if (!workspaceId || !userId) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Workspace context and authentication required',
      });
      return;
    }

    const tasks = await TaskService.getMyTasks(userId, workspaceId);

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error: any) {
    logger.error('Error getting my tasks', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get my tasks',
    });
  }
});

/**
 * GET /tasks/overdue
 * Get overdue tasks
 */
router.get('/overdue', async (req, res): Promise<void> => {
  try {
    const workspaceId = req.workspace?.workspaceId?.toString();

    if (!workspaceId) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Workspace context required',
      });
      return;
    }

    const tasks = await TaskService.getOverdueTasks(workspaceId);

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error: any) {
    logger.error('Error getting overdue tasks', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get overdue tasks',
    });
  }
});

/**
 * GET /tasks/by-post/:postId
 * Get tasks by post ID
 */
router.get('/by-post/:postId', async (req, res): Promise<void> => {
  try {
    const { postId } = req.params;
    const tasks = await TaskService.getTasksByPost(postId);

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error: any) {
    logger.error('Error getting tasks by post', {
      postId: req.params.postId,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get tasks by post',
    });
  }
});

/**
 * GET /tasks/:id
 * Get a single task
 */
router.get('/:id', async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.workspaceId?.toString();
    const task = await TaskService.getTaskById(id, workspaceId);

    if (!task) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Task not found',
      });
      return;
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error: any) {
    logger.error('Error getting task', {
      taskId: req.params.id,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get task',
    });
  }
});

/**
 * PATCH /tasks/:id
 * Update a task
 */
router.patch(
  '/:id',
  validateRequest(updateTaskSchema),
  async (req, res): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const workspaceId = req.workspace?.workspaceId?.toString();

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const updates = {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      };

      const task = await TaskService.updateTask(id, userId, updates, workspaceId);

      res.json({
        success: true,
        data: task,
      });
    } catch (error: any) {
      logger.error('Error updating task', {
        taskId: req.params.id,
        error: error.message,
      });

      if (error.message === 'Task not found' || error.message === 'Unauthorized to update task') {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to update task',
      });
    }
  }
);

/**
 * DELETE /tasks/:id
 * Delete a task
 */
router.delete('/:id', async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const workspaceId = req.workspace?.workspaceId?.toString();

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    await TaskService.deleteTask(id, userId, workspaceId);

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting task', {
      taskId: req.params.id,
      error: error.message,
    });

    if (error.message === 'Task not found' || error.message === 'Unauthorized to delete task') {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to delete task',
    });
  }
});

/**
 * POST /tasks/:id/assign
 * Assign users to a task
 */
router.post(
  '/:id/assign',
  validateRequest(assignTaskSchema),
  async (req, res): Promise<void> => {
    try {
      const { id } = req.params;
      const { userIds } = req.body;
      const userId = req.user?.userId;
      const workspaceId = req.workspace?.workspaceId?.toString();

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const task = await TaskService.assignTask(id, userIds, userId, workspaceId);

      res.json({
        success: true,
        data: task,
      });
    } catch (error: any) {
      logger.error('Error assigning task', {
        taskId: req.params.id,
        error: error.message,
      });

      if (error.message === 'Task not found') {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to assign task',
      });
    }
  }
);

/**
 * POST /tasks/:id/unassign
 * Unassign a user from a task
 */
router.post('/:id/unassign', async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId: targetUserId } = req.body;
    const userId = req.user?.userId;
    const workspaceId = req.workspace?.workspaceId?.toString();

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const task = await TaskService.unassignTask(id, targetUserId || userId, workspaceId);

    res.json({
      success: true,
      data: task,
    });
  } catch (error: any) {
    logger.error('Error unassigning task', {
      taskId: req.params.id,
      error: error.message,
    });

    if (error.message === 'Task not found') {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to unassign task',
    });
  }
});

/**
 * PATCH /tasks/:id/status
 * Update task status
 */
router.patch(
  '/:id/status',
  validateRequest(updateStatusSchema),
  async (req, res): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user?.userId;
      const workspaceId = req.workspace?.workspaceId?.toString();

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const task = await TaskService.updateStatus(id, status, userId, workspaceId);

      res.json({
        success: true,
        data: task,
      });
    } catch (error: any) {
      logger.error('Error updating task status', {
        taskId: req.params.id,
        error: error.message,
      });

      if (error.message === 'Task not found') {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
      error: 'INTERNAL_ERROR',
        message: 'Failed to update task status',
      });
    }
  }
);

/**
 * PATCH /tasks/:id/priority
 * Update task priority
 */
router.patch(
  '/:id/priority',
  validateRequest(updatePrioritySchema),
  async (req, res): Promise<void> => {
    try {
      const { id } = req.params;
      const { priority } = req.body;
      const userId = req.user?.userId;
      const workspaceId = req.workspace?.workspaceId?.toString();

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const task = await TaskService.updatePriority(id, priority, userId, workspaceId);

      res.json({
        success: true,
        data: task,
      });
    } catch (error: any) {
      logger.error('Error updating task priority', {
        taskId: req.params.id,
        error: error.message,
      });

      if (error.message === 'Task not found') {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to update task priority',
      });
    }
  }
);

/**
 * POST /tasks/:id/comments
 * Add a comment to a task
 */
router.post(
  '/:id/comments',
  validateRequest(addCommentSchema),
  async (req, res): Promise<void> => {
    try {
      const { id } = req.params;
      const { text } = req.body;
      const userId = req.user?.userId;
      const workspaceId = req.workspace?.workspaceId?.toString();

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const task = await TaskService.addComment(id, userId, text, workspaceId);

      res.json({
        success: true,
        data: task,
      });
    } catch (error: any) {
      logger.error('Error adding task comment', {
        taskId: req.params.id,
        error: error.message,
      });

      if (error.message === 'Task not found') {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to add comment',
      });
    }
  }
);

/**
 * POST /tasks/:id/checklist
 * Add a checklist item
 */
router.post(
  '/:id/checklist',
  validateRequest(addChecklistItemSchema),
  async (req, res): Promise<void> => {
    try {
      const { id } = req.params;
      const { text } = req.body;
      const workspaceId = req.workspace?.workspaceId?.toString();

      const task = await TaskService.addChecklistItem(id, text, workspaceId);

      res.json({
        success: true,
        data: task,
      });
    } catch (error: any) {
      logger.error('Error adding checklist item', {
        taskId: req.params.id,
        error: error.message,
      });

      if (error.message === 'Task not found') {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to add checklist item',
      });
    }
  }
);

/**
 * PATCH /tasks/:id/checklist/:itemId
 * Toggle checklist item completion
 */
router.patch('/:id/checklist/:itemId', async (req, res): Promise<void> => {
  try {
    const { id, itemId } = req.params;
    const userId = req.user?.userId;
    const workspaceId = req.workspace?.workspaceId?.toString();

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const task = await TaskService.toggleChecklistItem(id, itemId, userId, workspaceId);

    res.json({
      success: true,
      data: task,
    });
  } catch (error: any) {
    logger.error('Error toggling checklist item', {
      taskId: req.params.id,
      itemId: req.params.itemId,
      error: error.message,
    });

    if (error.message === 'Task not found' || error.message === 'Checklist item not found') {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to toggle checklist item',
    });
  }
});

export default router;
