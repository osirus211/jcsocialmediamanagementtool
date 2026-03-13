/**
 * Follower Collection Queue
 * 
 * Schedules periodic follower count collection jobs
 */

import { Queue } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';

export const FOLLOWER_COLLECTION_QUEUE_NAME = 'follower-collection';

export interface FollowerCollectionJobData {
  workspaceId: string;
  scheduledAt: Date;
}

export class FollowerCollectionQueue {
  private static queue: Queue<FollowerCollectionJobData> | null = null;

  /**
   * Get or create queue instance
   */
  static getQueue(): Queue<FollowerCollectionJobData> {
    if (!this.queue) {
      const queueManager = QueueManager.getInstance();
      this.queue = queueManager.getQueue(
        FOLLOWER_COLLECTION_QUEUE_NAME
      ) as Queue<FollowerCollectionJobData>;
    }
    return this.queue;
  }

  /**
   * Schedule follower collection for workspace
   * Runs every 6 hours
   */
  static async scheduleFollowerCollection(workspaceId: string): Promise<void> {
    try {
      const queue = this.getQueue();

      await queue.add(
        'collect-followers',
        {
          workspaceId,
          scheduledAt: new Date(),
        },
        {
          repeat: {
            pattern: '0 */6 * * *', // Every 6 hours
          },
          jobId: `follower-collection-${workspaceId}`,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info('Follower collection scheduled', {
        workspaceId,
        interval: '6 hours',
      });
    } catch (error: any) {
      logger.error('Schedule follower collection error:', {
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel follower collection for workspace
   */
  static async cancelFollowerCollection(workspaceId: string): Promise<void> {
    try {
      const queue = this.getQueue();
      const jobId = `follower-collection-${workspaceId}`;

      await queue.remove(jobId);

      logger.info('Follower collection cancelled', { workspaceId });
    } catch (error: any) {
      logger.error('Cancel follower collection error:', {
        workspaceId,
        error: error.message,
      });
    }
  }
}
