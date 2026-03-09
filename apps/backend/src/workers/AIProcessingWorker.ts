/**
 * AI Processing Worker
 * 
 * Processes AI-related background jobs
 * - Content repurposing
 * - Engagement predictions
 * - Sentiment analysis
 * - Moderation checks
 */

import { Job, Worker } from 'bullmq';
import { QueueManager } from '../queue/QueueManager';
import { getAIModule } from '../ai/ai.module';
import { EngagementPredictionService } from '../ai/services/engagement-prediction.service';
import { Mention } from '../models/Mention';
import { logger } from '../utils/logger';
import { MetricsCollector } from '../services/metrics/MetricsCollector';
import {
  AIProcessingJobData,
  AIRepurposingJob,
  AIEngagementPredictionJob,
  AISentimentAnalysisJob,
  AIModerationJob,
} from '../queue/AIProcessingQueue';

export class AIProcessingWorker {
  private worker: Worker | null = null;
  private static instance: AIProcessingWorker;

  private constructor() {}

  static getInstance(): AIProcessingWorker {
    if (!AIProcessingWorker.instance) {
      AIProcessingWorker.instance = new AIProcessingWorker();
    }
    return AIProcessingWorker.instance;
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.worker) {
      logger.warn('AIProcessingWorker already running');
      return;
    }

    const queueManager = QueueManager.getInstance();
    
    this.worker = queueManager.createWorker(
      'ai-processing-queue',
      this.processJob.bind(this),
      {
        concurrency: 3, // Process 3 AI jobs concurrently
        limiter: {
          max: 10, // Max 10 jobs
          duration: 60000, // Per minute
        },
      }
    );

    logger.info('AIProcessingWorker started', {
      concurrency: 3,
      rateLimit: '10 jobs/minute',
    });
  }

  /**
   * Process AI job
   */
  private async processJob(job: Job<AIProcessingJobData>): Promise<any> {
    const startTime = Date.now();
    
    try {
      logger.info('Processing AI job', {
        jobId: job.id,
        type: job.data.type,
        workspaceId: job.data.workspaceId,
      });

      let result: any;

      switch (job.data.type) {
        case 'repurpose':
          result = await this.processRepurposing(job.data);
          break;
        case 'engagement-prediction':
          result = await this.processEngagementPrediction(job.data);
          break;
        case 'sentiment-analysis':
          result = await this.processSentimentAnalysis(job.data);
          break;
        case 'moderation':
          result = await this.processModeration(job.data);
          break;
        default:
          throw new Error(`Unknown AI job type: ${(job.data as any).type}`);
      }

      const duration = Date.now() - startTime;

      // Record metrics
      MetricsCollector.recordAIRequest(
        job.data.type,
        'success',
        duration
      );

      logger.info('AI job completed', {
        jobId: job.id,
        type: job.data.type,
        duration,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Record failure metrics
      MetricsCollector.recordAIRequest(
        job.data.type,
        'failure',
        duration
      );

      logger.error('AI job failed', {
        jobId: job.id,
        type: job.data.type,
        error: error.message,
        duration,
      });

      throw error;
    }
  }

  /**
   * Process content repurposing
   */
  private async processRepurposing(data: AIRepurposingJob): Promise<any> {
    const aiModule = getAIModule();
    
    const result = await aiModule.repurposing.repurposeContent({
      originalContent: data.originalContent,
      originalPlatform: data.originalPlatform as any,
      targetPlatforms: data.targetPlatforms as any[],
      preserveHashtags: data.preserveHashtags,
      preserveMentions: data.preserveMentions,
    });

    logger.info('Content repurposed', {
      workspaceId: data.workspaceId,
      platformCount: result.platformVersions.length,
      tokensUsed: result.tokensUsed,
    });

    return result;
  }

  /**
   * Process engagement prediction
   */
  private async processEngagementPrediction(data: AIEngagementPredictionJob): Promise<any> {
    const result = await EngagementPredictionService.predictEngagement({
      workspaceId: data.workspaceId,
      platform: data.platform,
      caption: data.caption,
      scheduledTime: data.scheduledTime,
      hasMedia: data.hasMedia,
      mediaType: data.mediaType,
    });

    logger.info('Engagement predicted', {
      workspaceId: data.workspaceId,
      platform: data.platform,
      predictedScore: result.predictedScore,
      confidence: result.confidence,
    });

    return result;
  }

  /**
   * Process sentiment analysis
   */
  private async processSentimentAnalysis(data: AISentimentAnalysisJob): Promise<any> {
    const aiModule = getAIModule();
    
    const result = await aiModule.sentiment.analyzeSentiment({
      text: data.text,
      context: data.context,
    });

    // Update mention with sentiment
    await Mention.findByIdAndUpdate(data.mentionId, {
      sentiment: result.sentiment,
    });

    logger.info('Sentiment analyzed', {
      workspaceId: data.workspaceId,
      mentionId: data.mentionId,
      sentiment: result.sentiment,
      confidence: result.confidence,
    });

    return result;
  }

  /**
   * Process moderation
   */
  private async processModeration(data: AIModerationJob): Promise<any> {
    const aiModule = getAIModule();
    
    const result = await aiModule.moderation.suggestModeration({
      content: data.content,
      author: data.author,
      platform: data.platform,
    });

    logger.info('Moderation suggested', {
      workspaceId: data.workspaceId,
      mentionId: data.mentionId,
      action: result.action,
      confidence: result.confidence,
    });

    return result;
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info('AIProcessingWorker stopped');
    }
  }

  /**
   * Check if worker is running
   */
  isRunning(): boolean {
    return this.worker !== null && this.worker.isRunning();
  }
}
