/**
 * RSS Queue
 * 
 * Manages RSS feed polling jobs
 * Reuses existing QueueManager infrastructure
 */

import { Queue } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';

export const RSS_QUEUE_NAME = 'rss-collection';

export interface RSSJobData {
  feedId: string;
  workspaceId: string;
  feedUrl: string;
}

export class RSSQueue {
  private static queue: Queue<RSSJobData> | null = null;

  /**
   * Get or create queue instance
   */
  static getQueue(): Queue<RSSJobData> {
    if (!this.queue) {
      const queueManager = QueueManager.getInstance();
      this.queue = queueManager.getQueue(RSS_QUEUE_NAME);
    }
    return this.queue;
  }

  /**
   * Add feed poll job
   */
  static async addFeedPoll(data: RSSJobData): Promise<void> {
    try {
      const queue = this.getQueue();

      await queue.add(
        'poll-feed',
        data,
        {
          jobId: `rss-poll-${data.feedId}`,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info('RSS feed poll job added', {
        feedId: data.feedId,
        workspaceId: data.workspaceId,
        feedUrl: data.feedUrl,
      });
    } catch (error: any) {
      logger.error('Add RSS feed poll error:', {
        feedId: data.feedId,
        workspaceId: data.workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Schedule periodic feed polls
   * Called by RSS polling scheduler
   */
  static async scheduleFeedPolls(): Promise<void> {
    logger.debug('RSS feed polling scheduler invoked');
    // Implementation will be added when RSSFeedService is created
    // This method will query enabled feeds and enqueue poll jobs
  }
}
