/**
 * Competitor Collection Queue
 * 
 * Schedules periodic competitor metrics collection jobs
 */

import { Queue } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';

export const COMPETITOR_COLLECTION_QUEUE_NAME = 'competitor-collection';

export interface CompetitorCollectionJobData {
  workspaceId: string;
  scheduledAt: Date;
}

export class CompetitorCollectionQueue {
  private static queue: Queue<CompetitorCollectionJobData> | null = null;

  /**
   * Get or create queue instance
   */
  static getQueue(): Queue<CompetitorCollectionJobData> {
    if (!this.queue) {
      const queueManager = QueueManager.getInstance();
      this.queue = queueManager.createQueue<CompetitorCollectionJobData>(
        COMPETITOR_COLLECTION_QUEUE_NAME
      );
    }
    return this.queue;
  }

  /**
   * Schedule competitor collection for workspace
   * Runs every 6 hours
   */
  static async scheduleCompetitorCollection(workspaceId: string): Promise<void> {
    try {
      const queue = this.getQueue();

      await queue.add(
        'collect-competitors',
        {
          workspaceId,
          scheduledAt: new Date(),
        },
        {
          repeat: {
            pattern: '0 */6 * * *', // Every 6 hours
          },
          jobId: `competitor-collection-${workspaceId}`,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info('Competitor collection scheduled', {
        workspaceId,
        interval: '6 hours',
      });
    } catch (error: any) {
      logger.error('Schedule competitor collection error:', {
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel competitor collection for workspace
   */
  static async cancelCompetitorCollection(workspaceId: string): Promise<void> {
    try {
      const queue = this.getQueue();
      const jobId = `competitor-collection-${workspaceId}`;

      await queue.remove(jobId);

      logger.info('Competitor collection cancelled', { workspaceId });
    } catch (error: any) {
      logger.error('Cancel competitor collection error:', {
        workspaceId,
        error: error.message,
      });
    }
  }
}
