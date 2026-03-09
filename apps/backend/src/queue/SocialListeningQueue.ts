/**
 * Social Listening Queue
 * 
 * Schedules periodic social listening collection jobs
 * Reuses existing QueueManager infrastructure
 */

import { Queue } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';

export const SOCIAL_LISTENING_QUEUE_NAME = 'social-listening';

export interface SocialListeningJobData {
  workspaceId: string;
  platform: string;
  jobType: 'keyword' | 'hashtag' | 'competitor' | 'trends';
  scheduledAt: Date;
}

export class SocialListeningQueue {
  private static queue: Queue<SocialListeningJobData> | null = null;

  /**
   * Get or create queue instance
   */
  static getQueue(): Queue<SocialListeningJobData> {
    if (!this.queue) {
      const queueManager = QueueManager.getInstance();
      this.queue = queueManager.getQueue(
        SOCIAL_LISTENING_QUEUE_NAME
      ) as Queue<SocialListeningJobData>;
    }
    return this.queue;
  }

  /**
   * Schedule keyword mention collection
   * Runs every 15 minutes
   */
  static async scheduleKeywordCollection(workspaceId: string, platform: string): Promise<void> {
    try {
      const queue = this.getQueue();

      await queue.add(
        'collect-keywords',
        {
          workspaceId,
          platform,
          jobType: 'keyword',
          scheduledAt: new Date(),
        },
        {
          repeat: {
            pattern: '*/15 * * * *', // Every 15 minutes
          },
          jobId: `keyword-collection-${workspaceId}-${platform}`,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info('Keyword collection scheduled', {
        workspaceId,
        platform,
        interval: '15 minutes',
      });
    } catch (error: any) {
      logger.error('Schedule keyword collection error:', {
        workspaceId,
        platform,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Schedule hashtag mention collection
   * Runs every 15 minutes
   */
  static async scheduleHashtagCollection(workspaceId: string, platform: string): Promise<void> {
    try {
      const queue = this.getQueue();

      await queue.add(
        'collect-hashtags',
        {
          workspaceId,
          platform,
          jobType: 'hashtag',
          scheduledAt: new Date(),
        },
        {
          repeat: {
            pattern: '*/15 * * * *', // Every 15 minutes
          },
          jobId: `hashtag-collection-${workspaceId}-${platform}`,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info('Hashtag collection scheduled', {
        workspaceId,
        platform,
        interval: '15 minutes',
      });
    } catch (error: any) {
      logger.error('Schedule hashtag collection error:', {
        workspaceId,
        platform,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Schedule competitor mention collection
   * Runs every 15 minutes
   */
  static async scheduleCompetitorCollection(workspaceId: string, platform: string): Promise<void> {
    try {
      const queue = this.getQueue();

      await queue.add(
        'collect-competitors',
        {
          workspaceId,
          platform,
          jobType: 'competitor',
          scheduledAt: new Date(),
        },
        {
          repeat: {
            pattern: '*/15 * * * *', // Every 15 minutes
          },
          jobId: `competitor-collection-${workspaceId}-${platform}`,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info('Competitor mention collection scheduled', {
        workspaceId,
        platform,
        interval: '15 minutes',
      });
    } catch (error: any) {
      logger.error('Schedule competitor collection error:', {
        workspaceId,
        platform,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Schedule trend calculation
   * Runs every 30 minutes
   */
  static async scheduleTrendCalculation(workspaceId: string): Promise<void> {
    try {
      const queue = this.getQueue();

      await queue.add(
        'calculate-trends',
        {
          workspaceId,
          platform: 'all',
          jobType: 'trends',
          scheduledAt: new Date(),
        },
        {
          repeat: {
            pattern: '*/30 * * * *', // Every 30 minutes
          },
          jobId: `trend-calculation-${workspaceId}`,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info('Trend calculation scheduled', {
        workspaceId,
        interval: '30 minutes',
      });
    } catch (error: any) {
      logger.error('Schedule trend calculation error:', {
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel all listening jobs for workspace
   */
  static async cancelListeningJobs(workspaceId: string): Promise<void> {
    try {
      const queue = this.getQueue();
      
      // Get all repeatable jobs
      const repeatableJobs = await queue.getRepeatableJobs();
      
      // Remove jobs for this workspace
      for (const job of repeatableJobs) {
        if (job.id?.includes(workspaceId)) {
          await queue.removeRepeatableByKey(job.key);
          logger.debug('Listening job cancelled', {
            workspaceId,
            jobId: job.id,
          });
        }
      }

      logger.info('All listening jobs cancelled', { workspaceId });
    } catch (error: any) {
      logger.error('Cancel listening jobs error:', {
        workspaceId,
        error: error.message,
      });
    }
  }
}
