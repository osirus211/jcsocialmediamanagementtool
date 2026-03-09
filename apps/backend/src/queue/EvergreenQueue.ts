/**
 * Evergreen Queue
 * 
 * Manages evergreen rule evaluation jobs
 * Reuses existing QueueManager infrastructure
 */

import { Queue } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';

export const EVERGREEN_QUEUE_NAME = 'evergreen-evaluation';

export interface EvergreenJobData {
  ruleId: string;
  workspaceId: string;
  postId: string;
}

export class EvergreenQueue {
  private static queue: Queue<EvergreenJobData> | null = null;

  /**
   * Get or create queue instance
   */
  static getQueue(): Queue<EvergreenJobData> {
    if (!this.queue) {
      const queueManager = QueueManager.getInstance();
      this.queue = queueManager.getQueue(EVERGREEN_QUEUE_NAME);
    }
    return this.queue;
  }

  /**
   * Add rule evaluation job
   */
  static async addRuleEvaluation(data: EvergreenJobData): Promise<void> {
    try {
      const queue = this.getQueue();

      await queue.add(
        'evaluate-rule',
        data,
        {
          jobId: `evergreen-eval-${data.ruleId}`,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info('Evergreen rule evaluation job added', {
        ruleId: data.ruleId,
        workspaceId: data.workspaceId,
        postId: data.postId,
      });
    } catch (error: any) {
      logger.error('Add evergreen evaluation error:', {
        ruleId: data.ruleId,
        workspaceId: data.workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Schedule periodic rule evaluations
   * Called by evergreen evaluation scheduler
   */
  static async scheduleRuleEvaluations(): Promise<void> {
    logger.debug('Evergreen rule evaluation scheduler invoked');
    // Implementation will be added when EvergreenService is created
    // This method will query enabled rules and enqueue evaluation jobs
  }
}
