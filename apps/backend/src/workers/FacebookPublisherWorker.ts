/**
 * Facebook Publisher Worker
 * 
 * Processes jobs from facebook_publish_queue
 * Publishes posts to Facebook using FacebookPublisher
 */

import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { ScheduledPost, PostStatus } from '../models/ScheduledPost';
import { PostPublishAttempt, AttemptStatus } from '../models/PostPublishAttempt';
import { SocialAccount } from '../models/SocialAccount';
import { FacebookPublisher } from '../providers/publishers/FacebookPublisher';
import { publishingLockService } from '../services/PublishingLockService';
import { classifyPublishingError } from '../types/PublishingErrors';
import { logger } from '../utils/logger';
import {
  recordPostPublished,
  recordPostFailed,
  recordPostRetry,
  recordPublishDelay,
  recordPublishAttempt,
  recordPublishAttemptFailure,
} from '../config/publishingMetrics';

const QUEUE_NAME = 'facebook_publish_queue';
const PLATFORM = 'facebook';

export interface FacebookPublishJobData {
  postId: string;
  socialAccountId: string;
  content: string;
  mediaUrls: string[];
  attemptNumber?: number;
}

export class FacebookPublisherWorker {
  private worker: Worker<FacebookPublishJobData> | null = null;
  private publisher: FacebookPublisher;

  constructor() {
    this.publisher = new FacebookPublisher();
  }

  /**
   * Start worker
   */
  start(): void {
    if (this.worker) {
      logger.warn('Facebook publisher worker already running');
      return;
    }

    const redis = getRedisClient();

    this.worker = new Worker<FacebookPublishJobData>(
      QUEUE_NAME,
      async (job: Job<FacebookPublishJobData>) => {
        await this.process(job);
      },
      {
        connection: redis,
        concurrency: 5,
        limiter: {
          max: 20, // 20 requests
          duration: 1000, // per second
        },
      }
    );

    this.worker.on('completed', (job) => {
      logger.debug('Facebook publish job completed', {
        jobId: job.id,
        postId: job.data.postId,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Facebook publish job failed', {
        jobId: job?.id,
        postId: job?.data.postId,
        error: error.message,
      });
    });

    logger.info('Facebook publisher worker started', {
      queue: QUEUE_NAME,
      concurrency: 5,
      rateLimit: '20/sec',
    });
  }

  /**
   * Stop worker
   */
  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info('Facebook publisher worker stopped');
    }
  }

  /**
   * Process publishing job
   */
  private async process(job: Job<FacebookPublishJobData>): Promise<void> {
    const { postId, socialAccountId, content, mediaUrls, attemptNumber = 1 } = job.data;
    const startTime = Date.now();
    let lockAcquired = false;

    try {
      // Acquire publishing lock
      lockAcquired = await publishingLockService.acquireLock(postId, PLATFORM);

      if (!lockAcquired) {
        logger.warn('Publishing lock already held - skipping duplicate publish', {
          postId,
          platform: PLATFORM,
        });
        return;
      }

      // Fetch post
      const post = await ScheduledPost.findById(postId);
      if (!post) {
        throw new Error(`Post not found: ${postId}`);
      }

      // Record publish delay
      recordPublishDelay(PLATFORM, post.scheduledAt, new Date());

      // Check if already published
      if (post.status === PostStatus.PUBLISHED) {
        logger.info('Post already published - skipping', {
          postId,
          platform: PLATFORM,
        });
        return;
      }

      // Fetch social account
      const account = await SocialAccount.findById(socialAccountId).select('+accessToken');
      if (!account) {
        throw new Error(`Social account not found: ${socialAccountId}`);
      }

      // Update post status to publishing
      post.status = PostStatus.PUBLISHING;
      post.publishingStartedAt = new Date();
      await post.save();

      // Upload media if required
      let uploadedMediaIds: string[] = [];
      if (mediaUrls.length > 0) {
        uploadedMediaIds = await this.publisher.uploadMedia(account, mediaUrls);
      }

      // Publish post
      const result = await this.publisher.publishPost(account, {
        content,
        mediaIds: uploadedMediaIds,
      });

      // Update post status to published
      post.status = PostStatus.PUBLISHED;
      post.publishedAt = new Date();
      post.platformPostId = result.platformPostId;
      post.metadata = {
        ...post.metadata,
        publishResult: result,
      };
      await post.save();

      // Record successful attempt
      const duration = Date.now() - startTime;
      await PostPublishAttempt.recordAttempt({
        postId: post._id,
        workspaceId: post.workspaceId,
        platform: PLATFORM,
        socialAccountId: post.socialAccountId,
        attemptNumber,
        status: AttemptStatus.SUCCESS,
        platformResponse: result,
        duration,
        publishedAt: new Date(),
      });

      // Update metrics
      recordPostPublished(PLATFORM, 'success', duration);
      recordPublishAttempt(PLATFORM, 'success');

      logger.info('Facebook post published successfully', {
        postId,
        platformPostId: result.platformPostId,
        duration,
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorInfo = classifyPublishingError(error);

      logger.error('Facebook post publishing failed', {
        postId,
        error: error.message,
        errorCategory: errorInfo.category,
        shouldRetry: errorInfo.shouldRetry,
      });

      // Update post status to failed
      const post = await ScheduledPost.findById(postId);
      if (post) {
        post.status = PostStatus.FAILED;
        post.failedAt = new Date();
        post.failureReason = `${errorInfo.category}: ${errorInfo.message}`;
        await post.save();
      }

      // Record failed attempt
      await PostPublishAttempt.recordAttempt({
        postId,
        workspaceId: post.workspaceId,
        platform: PLATFORM,
        socialAccountId: post.socialAccountId,
        attemptNumber,
        status: AttemptStatus.FAILED,
        error: errorInfo.message,
        errorCode: errorInfo.category,
        duration,
      });

      // Update metrics
      recordPostFailed(PLATFORM, errorInfo.category);
      recordPublishAttempt(PLATFORM, 'failed');
      recordPublishAttemptFailure(PLATFORM, errorInfo.category);

      if (errorInfo.shouldRetry) {
        recordPostRetry(PLATFORM);
        throw error; // Trigger BullMQ retry
      }
    } finally {
      if (lockAcquired) {
        await publishingLockService.releaseLock(postId, PLATFORM);
      }
    }
  }
}
