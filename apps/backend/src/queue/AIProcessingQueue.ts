/**
 * AI Processing Queue
 * 
 * Handles background AI processing tasks
 * - Content repurposing
 * - Engagement predictions
 * - Sentiment analysis
 * - Moderation checks
 */

import { Queue } from 'bullmq';
import { QueueManager } from './QueueManager';
import { logger } from '../utils/logger';

export interface AIRepurposingJob {
  type: 'repurpose';
  workspaceId: string;
  originalContent: string;
  originalPlatform?: string;
  targetPlatforms: string[];
  preserveHashtags?: boolean;
  preserveMentions?: boolean;
}

export interface AIEngagementPredictionJob {
  type: 'engagement-prediction';
  workspaceId: string;
  platform: string;
  caption: string;
  scheduledTime?: Date;
  hasMedia?: boolean;
  mediaType?: 'image' | 'video' | 'carousel';
}

export interface AISentimentAnalysisJob {
  type: 'sentiment-analysis';
  workspaceId: string;
  mentionId: string;
  text: string;
  context?: string;
}

export interface AIModerationJob {
  type: 'moderation';
  workspaceId: string;
  mentionId: string;
  content: string;
  author?: {
    username: string;
    followerCount?: number;
  };
  platform: string;
}

export type AIProcessingJobData =
  | AIRepurposingJob
  | AIEngagementPredictionJob
  | AISentimentAnalysisJob
  | AIModerationJob;

export class AIProcessingQueue {
  private queue: Queue;
  private static instance: AIProcessingQueue;

  private constructor() {
    const queueManager = QueueManager.getInstance();
    this.queue = queueManager.getQueue('ai-processing-queue', {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600, // 1 hour
          count: 100,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // 7 days
          count: 1000,
        },
      },
    });

    logger.info('AIProcessingQueue initialized');
  }

  static getInstance(): AIProcessingQueue {
    if (!AIProcessingQueue.instance) {
      AIProcessingQueue.instance = new AIProcessingQueue();
    }
    return AIProcessingQueue.instance;
  }

  /**
   * Add content repurposing job
   */
  async addRepurposingJob(data: Omit<AIRepurposingJob, 'type'>): Promise<void> {
    try {
      const queueManager = QueueManager.getInstance();
      await queueManager.addJob(
        'ai-processing-queue',
        'ai-repurpose',
        { type: 'repurpose', ...data },
        {
          jobId: `repurpose-${data.workspaceId}-${Date.now()}`,
        }
      );

      logger.info('Repurposing job added', {
        workspaceId: data.workspaceId,
        targetPlatforms: data.targetPlatforms,
      });
    } catch (error: any) {
      logger.error('Add repurposing job error:', error);
      throw error;
    }
  }

  /**
   * Add engagement prediction job
   */
  async addEngagementPredictionJob(data: Omit<AIEngagementPredictionJob, 'type'>): Promise<void> {
    try {
      const queueManager = QueueManager.getInstance();
      await queueManager.addJob(
        'ai-processing-queue',
        'ai-engagement-prediction',
        { type: 'engagement-prediction', ...data },
        {
          jobId: `engagement-${data.workspaceId}-${Date.now()}`,
        }
      );

      logger.info('Engagement prediction job added', {
        workspaceId: data.workspaceId,
        platform: data.platform,
      });
    } catch (error: any) {
      logger.error('Add engagement prediction job error:', error);
      throw error;
    }
  }

  /**
   * Add sentiment analysis job
   */
  async addSentimentAnalysisJob(data: Omit<AISentimentAnalysisJob, 'type'>): Promise<void> {
    try {
      const queueManager = QueueManager.getInstance();
      await queueManager.addJob(
        'ai-processing-queue',
        'ai-sentiment-analysis',
        { type: 'sentiment-analysis', ...data },
        {
          jobId: `sentiment-${data.mentionId}`,
        }
      );

      logger.info('Sentiment analysis job added', {
        workspaceId: data.workspaceId,
        mentionId: data.mentionId,
      });
    } catch (error: any) {
      logger.error('Add sentiment analysis job error:', error);
      throw error;
    }
  }

  /**
   * Add moderation job
   */
  async addModerationJob(data: Omit<AIModerationJob, 'type'>): Promise<void> {
    try {
      const queueManager = QueueManager.getInstance();
      await queueManager.addJob(
        'ai-processing-queue',
        'ai-moderation',
        { type: 'moderation', ...data },
        {
          jobId: `moderation-${data.mentionId}`,
        }
      );

      logger.info('Moderation job added', {
        workspaceId: data.workspaceId,
        mentionId: data.mentionId,
      });
    } catch (error: any) {
      logger.error('Add moderation job error:', error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<any> {
    const queueManager = QueueManager.getInstance();
    return queueManager.getQueueStats('ai-processing-queue');
  }
}
