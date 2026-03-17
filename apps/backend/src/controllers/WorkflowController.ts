/**
 * Workflow Controller
 * 
 * REST API endpoints for managing automation workflows
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { WorkflowService } from '../services/WorkflowService';
import { logger } from '../utils/logger';
import {
  sendSuccess,
  sendValidationError,
  sendNotFound,
  sendError,
} from '../utils/apiResponse';

export class WorkflowController {
  /**
   * POST /api/v1/workflows
   * Create a workflow
   */
  async createWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.debug('[DEBUG] POST /api/v1/workflows - createWorkflow called', {
        body: req.body,
        user: (req as any).user?.id || 'unauthenticated',
        headers: { 'content-type': req.headers['content-type'] },
      });

      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.debug('[DEBUG] createWorkflow - validation failed', { errors: errors.array() });
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { workspaceId, name, description, trigger, actions, enabled } = req.body;
      const userId = (req as any).user?.id || 'system'; // Get from auth middleware

      // Create workflow
      const workflow = await WorkflowService.createWorkflow({
        workspaceId,
        name,
        description,
        trigger,
        actions,
        enabled: enabled !== undefined ? enabled : true,
        createdBy: userId,
      });

      logger.info('Workflow created via API', {
        workflowId: workflow._id.toString(),
        workspaceId,
        triggerType: trigger.type,
      });

      sendSuccess(res, workflow.toJSON(), 201);
    } catch (error: any) {
      logger.error('Failed to create workflow', {
        error: error.message,
        body: req.body,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/workflows
   * Get workflows with pagination
   */
  async getWorkflows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.debug('[DEBUG] GET /api/v1/workflows - getWorkflows called', {
        query: req.query,
        user: (req as any).user?.id || 'unauthenticated',
      });

      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.debug('[DEBUG] getWorkflows - validation failed', { errors: errors.array() });
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { workspaceId, enabled, triggerType, page, limit } = req.query;

      // Get workflows
      const result = await WorkflowService.listWorkflows(
        workspaceId as string,
        {
          enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
          triggerType: triggerType as any,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 20,
        }
      );

      const totalPages = Math.ceil(result.total / result.limit);

      sendSuccess(
        res,
        {
          workflows: result.workflows.map((workflow) => workflow.toJSON()),
        },
        200,
        {
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages,
          },
        }
      );
    } catch (error: any) {
      logger.error('Failed to get workflows', {
        error: error.message,
        query: req.query,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/workflows/:id
   * Get workflow by ID
   */
  async getWorkflowById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.debug('[DEBUG] GET /api/v1/workflows/:id - getWorkflowById called', {
        params: req.params,
        query: req.query,
        user: (req as any).user?.id || 'unauthenticated',
      });

      const { id } = req.params;
      const { workspaceId } = req.query;

      if (!workspaceId) {
        logger.debug('[DEBUG] getWorkflowById - missing workspaceId');
        sendValidationError(res, [{ field: 'workspaceId', message: 'workspaceId is required' }]);
        return;
      }

      // Get workflow
      const workflow = await WorkflowService.getWorkflow(id, workspaceId as string);

      if (!workflow) {
        sendNotFound(res, 'Workflow not found');
        return;
      }

      sendSuccess(res, workflow.toJSON());
    } catch (error: any) {
      logger.error('Failed to get workflow', {
        error: error.message,
        workflowId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * PUT /api/v1/workflows/:id
   * Update workflow
   */
  async updateWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.debug('[DEBUG] PUT /api/v1/workflows/:id - updateWorkflow called', {
        params: req.params,
        body: req.body,
        user: (req as any).user?.id || 'unauthenticated',
      });

      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.debug('[DEBUG] updateWorkflow - validation failed', { errors: errors.array() });
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { id } = req.params;
      const { workspaceId, name, description, trigger, actions, enabled } = req.body;

      // Update workflow
      const workflow = await WorkflowService.updateWorkflow(id, workspaceId, {
        name,
        description,
        trigger,
        actions,
        enabled,
      });

      if (!workflow) {
        sendNotFound(res, 'Workflow not found');
        return;
      }

      logger.info('Workflow updated via API', {
        workflowId: id,
        workspaceId,
      });

      sendSuccess(res, workflow.toJSON());
    } catch (error: any) {
      logger.error('Failed to update workflow', {
        error: error.message,
        workflowId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * DELETE /api/v1/workflows/:id
   * Delete workflow
   */
  async deleteWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.debug('[DEBUG] DELETE /api/v1/workflows/:id - deleteWorkflow called', {
        params: req.params,
        query: req.query,
        user: (req as any).user?.id || 'unauthenticated',
      });

      const { id } = req.params;
      const { workspaceId } = req.query;

      if (!workspaceId) {
        logger.debug('[DEBUG] deleteWorkflow - missing workspaceId');
        sendValidationError(res, [{ field: 'workspaceId', message: 'workspaceId is required' }]);
        return;
      }

      // Delete workflow
      const deleted = await WorkflowService.deleteWorkflow(id, workspaceId as string);

      if (!deleted) {
        sendNotFound(res, 'Workflow not found');
        return;
      }

      logger.info('Workflow deleted via API', {
        workflowId: id,
        workspaceId,
      });

      sendSuccess(res, { message: 'Workflow deleted successfully' });
    } catch (error: any) {
      logger.error('Failed to delete workflow', {
        error: error.message,
        workflowId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/workflows/:id/executions
   * Get workflow execution history
   */
  async getWorkflowExecutions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.debug('[DEBUG] GET /api/v1/workflows/:id/executions - getWorkflowExecutions called', {
        params: req.params,
        query: req.query,
        user: (req as any).user?.id || 'unauthenticated',
      });

      const { id } = req.params;
      const { workspaceId, page, limit } = req.query;

      if (!workspaceId) {
        logger.debug('[DEBUG] getWorkflowExecutions - missing workspaceId');
        sendValidationError(res, [{ field: 'workspaceId', message: 'workspaceId is required' }]);
        return;
      }

      // Get execution history
      const result = await WorkflowService.getExecutionHistory(
        id,
        workspaceId as string,
        {
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 20,
        }
      );

      const totalPages = Math.ceil(result.total / result.limit);

      sendSuccess(
        res,
        {
          executions: result.runs.map((execution) => execution.toJSON()),
        },
        200,
        {
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages,
          },
        }
      );
    } catch (error: any) {
      logger.error('Failed to get workflow executions', {
        error: error.message,
        workflowId: req.params.id,
      });

      next(error);
    }
  }
}

export const workflowController = new WorkflowController();
