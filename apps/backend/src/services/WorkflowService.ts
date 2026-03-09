/**
 * Workflow Service
 * 
 * Manages workflow CRUD operations and validation
 * Enforces workspace isolation and business rules
 */

import mongoose from 'mongoose';
import { Workflow, IWorkflow, WorkflowTriggerType, WorkflowActionType } from '../models/Workflow';
import { WorkflowRun, IWorkflowRun } from '../models/WorkflowRun';
import { logger } from '../utils/logger';

export interface CreateWorkflowInput {
  workspaceId: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: {
    type: WorkflowTriggerType;
    config: Record<string, any>;
  };
  actions: Array<{
    type: WorkflowActionType;
    config: Record<string, any>;
  }>;
  createdBy: string;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  enabled?: boolean;
  trigger?: {
    type: WorkflowTriggerType;
    config: Record<string, any>;
  };
  actions?: Array<{
    type: WorkflowActionType;
    config: Record<string, any>;
  }>;
}

export interface ListWorkflowsOptions {
  page?: number;
  limit?: number;
  enabled?: boolean;
  triggerType?: WorkflowTriggerType;
}

export interface GetExecutionHistoryOptions {
  page?: number;
  limit?: number;
  status?: string;
}

export class WorkflowService {
  /**
   * Create a new workflow
   */
  static async createWorkflow(input: CreateWorkflowInput): Promise<IWorkflow> {
    try {
      // Validate trigger config
      this.validateTriggerConfig(input.trigger.type, input.trigger.config);

      // Validate action configs
      for (const action of input.actions) {
        this.validateActionConfig(action.type, action.config);
      }

      const workflow = new Workflow({
        workspaceId: new mongoose.Types.ObjectId(input.workspaceId),
        name: input.name,
        description: input.description,
        enabled: input.enabled,
        trigger: input.trigger,
        actions: input.actions,
        createdBy: new mongoose.Types.ObjectId(input.createdBy),
      });

      await workflow.save();

      logger.info('Workflow created', {
        workflowId: workflow._id.toString(),
        workspaceId: input.workspaceId,
        name: input.name,
        triggerType: input.trigger.type,
        actionCount: input.actions.length,
      });

      return workflow;
    } catch (error: any) {
      logger.error('Create workflow error:', {
        workspaceId: input.workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update an existing workflow
   */
  static async updateWorkflow(
    workflowId: string,
    workspaceId: string,
    input: UpdateWorkflowInput
  ): Promise<IWorkflow | null> {
    try {
      // Validate trigger config if provided
      if (input.trigger) {
        this.validateTriggerConfig(input.trigger.type, input.trigger.config);
      }

      // Validate action configs if provided
      if (input.actions) {
        for (const action of input.actions) {
          this.validateActionConfig(action.type, action.config);
        }
      }

      const workflow = await Workflow.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(workflowId),
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        { $set: input },
        { new: true, runValidators: true }
      );

      if (workflow) {
        logger.info('Workflow updated', {
          workflowId,
          workspaceId,
        });
      }

      return workflow;
    } catch (error: any) {
      logger.error('Update workflow error:', {
        workflowId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete a workflow
   */
  static async deleteWorkflow(workflowId: string, workspaceId: string): Promise<boolean> {
    try {
      const result = await Workflow.deleteOne({
        _id: new mongoose.Types.ObjectId(workflowId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (result.deletedCount > 0) {
        logger.info('Workflow deleted', {
          workflowId,
          workspaceId,
        });
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('Delete workflow error:', {
        workflowId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get workflow by ID
   */
  static async getWorkflow(workflowId: string, workspaceId: string): Promise<IWorkflow | null> {
    try {
      return await Workflow.findOne({
        _id: new mongoose.Types.ObjectId(workflowId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });
    } catch (error: any) {
      logger.error('Get workflow error:', {
        workflowId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * List workflows with pagination and filtering
   */
  static async listWorkflows(
    workspaceId: string,
    options: ListWorkflowsOptions = {}
  ): Promise<{ workflows: IWorkflow[]; total: number; page: number; limit: number }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      const query: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };

      if (options.enabled !== undefined) {
        query.enabled = options.enabled;
      }

      if (options.triggerType) {
        query['trigger.type'] = options.triggerType;
      }

      const [workflows, total] = await Promise.all([
        Workflow.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Workflow.countDocuments(query),
      ]);

      return {
        workflows: workflows as any,
        total,
        page,
        limit,
      };
    } catch (error: any) {
      logger.error('List workflows error:', {
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get execution history for a workflow
   */
  static async getExecutionHistory(
    workflowId: string,
    workspaceId: string,
    options: GetExecutionHistoryOptions = {}
  ): Promise<{ runs: IWorkflowRun[]; total: number; page: number; limit: number }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      const query: any = {
        workflowId: new mongoose.Types.ObjectId(workflowId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };

      if (options.status) {
        query.status = options.status;
      }

      const [runs, total] = await Promise.all([
        WorkflowRun.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        WorkflowRun.countDocuments(query),
      ]);

      return {
        runs: runs as any,
        total,
        page,
        limit,
      };
    } catch (error: any) {
      logger.error('Get execution history error:', {
        workflowId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate trigger configuration
   */
  static validateTriggerConfig(type: WorkflowTriggerType, config: Record<string, any>): void {
    // Basic validation - detailed validation will be added in automation.validators.ts
    if (!config || typeof config !== 'object') {
      throw new Error('Trigger config must be an object');
    }

    switch (type) {
      case WorkflowTriggerType.POST_PUBLISHED:
        // Validate platform filter if present
        if (config.platform && typeof config.platform !== 'string') {
          throw new Error('Platform filter must be a string');
        }
        break;

      case WorkflowTriggerType.ANALYTICS_THRESHOLD:
        // Validate required fields
        if (!config.metric || typeof config.metric !== 'string') {
          throw new Error('Analytics threshold requires metric field');
        }
        if (!config.operator || typeof config.operator !== 'string') {
          throw new Error('Analytics threshold requires operator field');
        }
        if (config.threshold === undefined || typeof config.threshold !== 'number') {
          throw new Error('Analytics threshold requires threshold field');
        }
        break;

      case WorkflowTriggerType.SCHEDULE:
        // Validate cron expression
        if (!config.cronExpression || typeof config.cronExpression !== 'string') {
          throw new Error('Schedule trigger requires cronExpression field');
        }
        break;

      case WorkflowTriggerType.MENTION_DETECTED:
        // Validate platform if present
        if (config.platform && typeof config.platform !== 'string') {
          throw new Error('Platform filter must be a string');
        }
        break;

      case WorkflowTriggerType.RSS_ITEM_FETCHED:
        // Validate feedId if present
        if (config.feedId && typeof config.feedId !== 'string') {
          throw new Error('Feed ID must be a string');
        }
        break;

      default:
        throw new Error(`Unknown trigger type: ${type}`);
    }
  }

  /**
   * Validate action configuration
   */
  static validateActionConfig(type: WorkflowActionType, config: Record<string, any>): void {
    // Basic validation - detailed validation will be added in automation.validators.ts
    if (!config || typeof config !== 'object') {
      throw new Error('Action config must be an object');
    }

    switch (type) {
      case WorkflowActionType.CREATE_POST:
      case WorkflowActionType.SCHEDULE_POST:
        // Validate required fields
        if (!config.content || typeof config.content !== 'string') {
          throw new Error('Post action requires content field');
        }
        if (!config.platforms || !Array.isArray(config.platforms)) {
          throw new Error('Post action requires platforms array');
        }
        break;

      case WorkflowActionType.SEND_NOTIFICATION:
        // Validate required fields
        if (!config.message || typeof config.message !== 'string') {
          throw new Error('Notification action requires message field');
        }
        if (!config.type || typeof config.type !== 'string') {
          throw new Error('Notification action requires type field');
        }
        break;

      case WorkflowActionType.UPDATE_POST_STATUS:
        // Validate required fields
        if (!config.postId || typeof config.postId !== 'string') {
          throw new Error('Update post status action requires postId field');
        }
        if (!config.status || typeof config.status !== 'string') {
          throw new Error('Update post status action requires status field');
        }
        break;

      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }
}
