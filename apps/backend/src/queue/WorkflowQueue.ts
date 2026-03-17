/**
 * Workflow Queue
 * 
 * Manages workflow execution jobs
 * Reuses existing QueueManager infrastructure
 */

import { Queue } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';

export const WORKFLOW_QUEUE_NAME = 'workflow-execution';

export interface WorkflowJobData {
  workflowId: string;
  workspaceId: string;
  triggerType: string;
  triggerData: Record<string, any>;
  runId: string;
}

export class WorkflowQueue {
  private static queue: Queue<WorkflowJobData> | null = null;

  /**
   * Get or create queue instance
   */
  static getQueue(): Queue<WorkflowJobData> {
    if (!this.queue) {
      const queueManager = QueueManager.getInstance();
      this.queue = queueManager.getQueue(WORKFLOW_QUEUE_NAME);
    }
    return this.queue;
  }

  /**
   * Add workflow execution job
   */
  static async addWorkflowExecution(data: WorkflowJobData): Promise<void> {
    try {
      const queue = this.getQueue();

      await queue.add(
        'execute-workflow',
        data,
        {
          jobId: `workflow-${data.workflowId}-${data.runId}`,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info('Workflow execution job added', {
        workflowId: data.workflowId,
        workspaceId: data.workspaceId,
        triggerType: data.triggerType,
        runId: data.runId,
      });

      // #region agent log
      fetch('http://127.0.0.1:7299/ingest/bd0f3255-cb97-4c4f-8cc3-98b58e5f32d9', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': 'f1222c',
        },
        body: JSON.stringify({
          sessionId: 'f1222c',
          runId: 'initial',
          hypothesisId: 'H1',
          location: 'WorkflowQueue.ts:53',
          message: 'Workflow execution job enqueued',
          data: {
            workflowId: data.workflowId,
            workspaceId: data.workspaceId,
            triggerType: data.triggerType,
            runId: data.runId,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    } catch (error: any) {
      logger.error('Add workflow execution error:', {
        workflowId: data.workflowId,
        workspaceId: data.workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  static async getJob(jobId: string): Promise<any> {
    try {
      const queue = this.getQueue();
      return await queue.getJob(jobId);
    } catch (error: any) {
      logger.error('Get workflow job error:', {
        jobId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove job from queue
   */
  static async removeJob(jobId: string): Promise<void> {
    try {
      const queue = this.getQueue();
      const job = await queue.getJob(jobId);
      
      if (job) {
        await job.remove();
        logger.info('Workflow job removed', { jobId });
      }
    } catch (error: any) {
      logger.error('Remove workflow job error:', {
        jobId,
        error: error.message,
      });
    }
  }
}
