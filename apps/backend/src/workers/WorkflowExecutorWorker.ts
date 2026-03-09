/**
 * Workflow Executor Worker
 * 
 * Executes workflow actions sequentially for jobs from WorkflowQueue
 * 
 * Features:
 * - Sequential action execution
 * - Template variable substitution
 * - Distributed locking to prevent duplicate execution
 * - Retry with exponential backoff
 * - Metrics tracking
 * - DLQ integration for failed jobs
 */

import { Worker, Job } from 'bullmq';
import mongoose from 'mongoose';
import { WORKFLOW_QUEUE_NAME, WorkflowJobData } from '../queue/WorkflowQueue';
import { QueueManager } from '../queue/QueueManager';
import { Workflow, IWorkflow, WorkflowActionType } from '../models/Workflow';
import { WorkflowRun, IWorkflowRun, WorkflowRunStatus, ActionResultStatus } from '../models/WorkflowRun';
import { TemplateService } from '../services/TemplateService';
import { logger } from '../utils/logger';

export class WorkflowExecutorWorker {
  private worker: Worker | null = null;
  private isRunning: boolean = false;

  private readonly CONCURRENCY = 5;
  private readonly MAX_ACTIONS_PER_WORKFLOW = 10; // Safety limit

  // Metrics
  private metrics = {
    workflow_executions_total: 0,
    workflow_executions_success: 0,
    workflow_executions_failed: 0,
    workflow_action_failures_total: 0,
    workflow_execution_duration_sum: 0,
    workflow_execution_duration_count: 0,
  };

  /**
   * Start worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Workflow executor worker already running');
      return;
    }

    const queueManager = QueueManager.getInstance();

    this.worker = queueManager.createWorker(
      WORKFLOW_QUEUE_NAME,
      this.processJob.bind(this),
      {
        concurrency: this.CONCURRENCY,
      }
    );

    this.worker.on('completed', (job) => {
      logger.info('Workflow execution job completed', {
        jobId: job.id,
        workflowId: job.data.workflowId,
        runId: job.data.runId,
      });
    });

    this.worker.on('failed', async (job, error) => {
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        logger.error('Workflow execution job exhausted all retries', {
          jobId: job.id,
          workflowId: job.data.workflowId,
          runId: job.data.runId,
          error: error.message,
        });
        // Job will automatically go to Dead Letter Queue
      }
    });

    this.isRunning = true;

    logger.info('Workflow executor worker started', {
      concurrency: this.CONCURRENCY,
    });
  }

  /**
   * Stop worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.worker) return;

    await this.worker.close();
    this.worker = null;
    this.isRunning = false;

    logger.info('Workflow executor worker stopped');
  }

  /**
   * Process workflow execution job
   */
  private async processJob(job: Job<WorkflowJobData>): Promise<void> {
    const { workflowId, workspaceId, triggerType, triggerData, runId } = job.data;
    const startTime = Date.now();

    this.metrics.workflow_executions_total++;

    logger.info('Processing workflow execution job', {
      jobId: job.id,
      workflowId,
      runId,
      triggerType,
    });

    // Acquire distributed lock to prevent concurrent execution of same workflow run
    const { distributedLockService } = await import('../services/DistributedLockService');
    const lockKey = `lock:workflow-run:${runId}`;

    try {
      await distributedLockService.withLock(
        lockKey,
        async () => {
          // Load workflow run
          const workflowRun = await WorkflowRun.findById(runId);
          if (!workflowRun) {
            throw new Error('Workflow run not found');
          }

          // Check if already completed (idempotency)
          if (workflowRun.status === WorkflowRunStatus.COMPLETED) {
            logger.info('Workflow run already completed (idempotency)', {
              runId,
              workflowId,
            });
            return;
          }

          if (workflowRun.status === WorkflowRunStatus.FAILED) {
            logger.info('Workflow run already failed', {
              runId,
              workflowId,
            });
            return;
          }

          // Load workflow configuration
          const workflow = await Workflow.findById(workflowId);
          if (!workflow) {
            throw new Error('Workflow not found');
          }

          // Check if workflow is still enabled
          if (!workflow.enabled) {
            logger.warn('Workflow is disabled, skipping execution', {
              workflowId,
              runId,
            });
            await WorkflowRun.findByIdAndUpdate(runId, {
              status: WorkflowRunStatus.FAILED,
              error: 'Workflow is disabled',
              completedAt: new Date(),
            });
            return;
          }

          // Safety check: Limit number of actions
          if (workflow.actions.length > this.MAX_ACTIONS_PER_WORKFLOW) {
            throw new Error(`Workflow exceeds maximum actions limit (${this.MAX_ACTIONS_PER_WORKFLOW})`);
          }

          // Update status to RUNNING
          await WorkflowRun.findByIdAndUpdate(runId, {
            status: WorkflowRunStatus.RUNNING,
            startedAt: new Date(),
          });

          logger.info('Executing workflow', {
            workflowId,
            runId,
            actionCount: workflow.actions.length,
          });

          // Execute actions sequentially
          await this.executeActions(workflow, workflowRun, triggerData);

          // Update status to COMPLETED
          await WorkflowRun.findByIdAndUpdate(runId, {
            status: WorkflowRunStatus.COMPLETED,
            completedAt: new Date(),
          });

          this.metrics.workflow_executions_success++;

          const duration = Date.now() - startTime;
          this.metrics.workflow_execution_duration_sum += duration;
          this.metrics.workflow_execution_duration_count++;

          logger.info('Workflow execution completed', {
            workflowId,
            runId,
            duration,
            actionCount: workflow.actions.length,
          });
        },
        {
          ttl: 300000, // 5 minutes
          retryCount: 1,
        }
      );
    } catch (error: any) {
      // Check if this is a lock acquisition error
      if (error.name === 'LockAcquisitionError') {
        logger.info('Workflow execution already in progress by another worker', {
          workflowId,
          runId,
        });
        return;
      }

      // Other errors
      this.metrics.workflow_executions_failed++;

      const duration = Date.now() - startTime;

      logger.error('Workflow execution failed', {
        workflowId,
        runId,
        error: error.message,
        duration,
      });

      // Update workflow run status to FAILED
      try {
        await WorkflowRun.findByIdAndUpdate(runId, {
          status: WorkflowRunStatus.FAILED,
          error: error.message,
          completedAt: new Date(),
        });
      } catch (updateError: any) {
        logger.error('Failed to update workflow run status', {
          runId,
          error: updateError.message,
        });
      }

      throw error;
    }
  }

  /**
   * Execute actions sequentially
   */
  private async executeActions(
    workflow: IWorkflow,
    workflowRun: IWorkflowRun,
    triggerData: Record<string, any>
  ): Promise<void> {
    for (let i = 0; i < workflow.actions.length; i++) {
      const action = workflow.actions[i];

      logger.info('Executing action', {
        workflowId: workflow._id.toString(),
        runId: workflowRun._id.toString(),
        actionIndex: i,
        actionType: action.type,
      });

      try {
        const result = await this.executeAction(action, triggerData, workflow.workspaceId.toString());

        // Record successful action result
        await WorkflowRun.findByIdAndUpdate(workflowRun._id, {
          $push: {
            actionResults: {
              actionType: action.type,
              status: ActionResultStatus.SUCCESS,
              result,
              executedAt: new Date(),
            },
          },
        });

        logger.info('Action executed successfully', {
          workflowId: workflow._id.toString(),
          runId: workflowRun._id.toString(),
          actionIndex: i,
          actionType: action.type,
        });
      } catch (error: any) {
        this.metrics.workflow_action_failures_total++;

        logger.error('Action execution failed', {
          workflowId: workflow._id.toString(),
          runId: workflowRun._id.toString(),
          actionIndex: i,
          actionType: action.type,
          error: error.message,
        });

        // Record failed action result
        await WorkflowRun.findByIdAndUpdate(workflowRun._id, {
          $push: {
            actionResults: {
              actionType: action.type,
              status: ActionResultStatus.FAILED,
              error: error.message,
              executedAt: new Date(),
            },
          },
        });

        // Stop execution on first failure
        throw new Error(`Action ${i} (${action.type}) failed: ${error.message}`);
      }
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: any,
    triggerData: Record<string, any>,
    workspaceId: string
  ): Promise<any> {
    // Apply template variable substitution to action config
    const processedConfig = this.applyTemplateSubstitution(action.config, triggerData);

    switch (action.type) {
      case WorkflowActionType.CREATE_POST:
        return await this.executeCreatePost(processedConfig, workspaceId);

      case WorkflowActionType.SCHEDULE_POST:
        return await this.executeSchedulePost(processedConfig, workspaceId);

      case WorkflowActionType.SEND_NOTIFICATION:
        return await this.executeSendNotification(processedConfig, workspaceId);

      case WorkflowActionType.UPDATE_POST_STATUS:
        return await this.executeUpdatePostStatus(processedConfig, workspaceId);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Apply template variable substitution to config
   */
  private applyTemplateSubstitution(
    config: Record<string, any>,
    triggerData: Record<string, any>
  ): Record<string, any> {
    const processed: Record<string, any> = {};

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        // Apply template substitution
        processed[key] = TemplateService.substituteVariables(value, triggerData);
      } else if (Array.isArray(value)) {
        // Process array elements
        processed[key] = value.map(item =>
          typeof item === 'string'
            ? TemplateService.substituteVariables(item, triggerData)
            : item
        );
      } else {
        // Keep non-string values as-is
        processed[key] = value;
      }
    }

    return processed;
  }

  /**
   * Execute CREATE_POST action
   */
  private async executeCreatePost(config: any, workspaceId: string): Promise<any> {
    const { PostService } = await import('../services/PostService');
    const postService = new PostService();

    // Create post immediately (publish now)
    const post = await postService.createPost({
      workspaceId,
      socialAccountId: config.socialAccountId,
      platform: config.platform,
      content: config.content,
      mediaUrls: config.mediaUrls || [],
      mediaIds: config.mediaIds || [],
      scheduledAt: new Date(), // Immediate
    });

    logger.info('Post created via workflow', {
      postId: post._id.toString(),
      workspaceId,
    });

    return {
      postId: post._id.toString(),
      status: 'created',
    };
  }

  /**
   * Execute SCHEDULE_POST action
   */
  private async executeSchedulePost(config: any, workspaceId: string): Promise<any> {
    const { PostService } = await import('../services/PostService');
    const postService = new PostService();

    // Parse scheduled time
    const scheduledAt = new Date(config.scheduledAt);

    // Create scheduled post
    const post = await postService.createPost({
      workspaceId,
      socialAccountId: config.socialAccountId,
      platform: config.platform,
      content: config.content,
      mediaUrls: config.mediaUrls || [],
      mediaIds: config.mediaIds || [],
      scheduledAt,
    });

    logger.info('Post scheduled via workflow', {
      postId: post._id.toString(),
      workspaceId,
      scheduledAt,
    });

    return {
      postId: post._id.toString(),
      status: 'scheduled',
      scheduledAt,
    };
  }

  /**
   * Execute SEND_NOTIFICATION action
   */
  private async executeSendNotification(config: any, workspaceId: string): Promise<any> {
    // For now, just log the notification
    // In production, integrate with NotificationService
    logger.info('Notification sent via workflow', {
      workspaceId,
      type: config.type,
      message: config.message,
      recipient: config.recipient,
    });

    return {
      status: 'sent',
      type: config.type,
      message: config.message,
    };
  }

  /**
   * Execute UPDATE_POST_STATUS action
   */
  private async executeUpdatePostStatus(config: any, workspaceId: string): Promise<any> {
    const { ScheduledPost } = await import('../models/ScheduledPost');

    // Update post status
    const post = await ScheduledPost.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(config.postId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      },
      {
        status: config.status,
      },
      { new: true }
    );

    if (!post) {
      throw new Error('Post not found');
    }

    logger.info('Post status updated via workflow', {
      postId: config.postId,
      workspaceId,
      newStatus: config.status,
    });

    return {
      postId: config.postId,
      status: config.status,
    };
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      concurrency: this.CONCURRENCY,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Get metrics
   */
  getMetrics() {
    const avgDuration = this.metrics.workflow_execution_duration_count > 0
      ? this.metrics.workflow_execution_duration_sum / this.metrics.workflow_execution_duration_count
      : 0;

    return {
      ...this.metrics,
      workflow_execution_duration_avg_ms: Math.round(avgDuration),
    };
  }
}

export const workflowExecutorWorker = new WorkflowExecutorWorker();
