/**
 * Instagram Publisher Worker
 * 
 * Processes jobs from instagram_publish_queue
 * Publishes posts to Instagram using InstagramPublisher
 */

import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { ScheduledPost, PostStatus } from '../models/ScheduledPost';
import { PostPublishAttempt, AttemptStatus } from '../models/PostPublishAttempt';
import { SocialAccount } from '../models/SocialAccount';
import { InstagramPublisher } from '../providers/publishers/InstagramPublisher';
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

const QUEUE_NAME = 'instagram_publish_queue';
const PLATFORM = 'instagram';

export interface InstagramPublishJobData {
  postId: string;
  socialAccountId: string;
  content: string;
  mediaUrls: string[];
  attemptNumber?: number;
}

export class InstagramPublisherWorker {
  private worker: Worker<InstagramPublishJobData> | null = null;
  private publisher: InstagramPublisher;

  constructor() {
    this.publisher = new InstagramPublisher();
  }

  start(): void {
    if (this.worker) {
      logger.warn('Instagram publisher worker already running');
      return;
    }

    const redis = getRedisClient();

    this.worker = new Worker<InstagramPublishJobData>(
      QUEUE_NAME,
      async (job: Job<InstagramPublishJobData>) => {
        await this.process(job);
      },
      {
        connection: redis,
        concurrency: 5,
        limiter: {
          max: 15,
          duration: 1000,
        },
      }
    );

    this.worker.on('completed', (job) => {
      logger.debug('Instagram publish job completed', {
        jobId: job.id,
        postId: job.data.postId,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Instagram publish job failed', {
        jobId: job?.id,
        postId: job?.data.postId,
        error: error.message,
      });
    });

    logger.info('Instagram publisher worker started', {
      queue: QUEUE_NAME,
      concurrency: 5,
      rateLimit: '15/sec',
    });
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info('Instagram publisher worker stopped');
    }
  }

  private async process(job: Job<InstagramPublishJobData>): Promise<void> {
    const { postId, socialAccountId, content, mediaUrls, attemptNumber = 1 } = job.data;
    const startTime = Date.now();
    let lockAcquired = false;

    try {
      lockAcquired = await publishingLockService.acquireLock(postId, PLATFORM);

      if (!lockAcquired) {
        logger.warn('Publishing lock already held - skipping duplicate publish', {
          postId,
          platform: PLATFORM,
        });
        return;
      }

      const post = await ScheduledPost.findById(postId);
      if (!post) {
        throw new Error(`Post not found: ${postId}`);
      }

      recordPublishDelay(PLATFORM, post.scheduledAt, new Date());

      if (post.status === PostStatus.PUBLISHED) {
        logger.info('Post already published - skipping', {
          postId,
          platform: PLATFORM,
        });
        return;
      }

      const account = await SocialAccount.findById(socialAccountId).select('+accessToken');
      if (!account) {
        throw new Error(`Social account not found: ${socialAccountId}`);
      }

      post.status = PostStatus.PUBLISHING;
      post.publishingStartedAt = new Date();
      await post.save();

      let uploadedMediaIds: string[] = [];
      if (mediaUrls.length > 0) {
        uploadedMediaIds = await this.publisher.uploadMedia(account, mediaUrls);
      }

      const result = await this.publisher.publishPost(account, {
        content,
        mediaIds: uploadedMediaIds,
      });

      post.status = PostStatus.PUBLISHED;
      post.publishedAt = new Date();
      post.platformPostId = result.platformPostId;
      post.metadata = {
        ...post.metadata,
        publishResult: result,
      };
      await post.save();

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

      recordPostPublished(PLATFORM, 'success', duration);
      recordPublishAttempt(PLATFORM, 'success');

      logger.info('Instagram post published successfully', {
        postId,
        platformPostId: result.platformPostId,
        duration,
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorInfo = classifyPublishingError(error);

      logger.error('Instagram post publishing failed', {
        postId,
        error: error.message,
        errorCategory: errorInfo.category,
        shouldRetry: errorInfo.shouldRetry,
      });

      const post = await ScheduledPost.findById(postId);
      if (post) {
        post.status = PostStatus.FAILED;
        post.failedAt = new Date();
        post.failureReason = `${errorInfo.category}: ${errorInfo.message}`;
        await post.save();
      }

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

      recordPostFailed(PLATFORM, errorInfo.category);
      recordPublishAttempt(PLATFORM, 'failed');
      recordPublishAttemptFailure(PLATFORM, errorInfo.category);

      if (errorInfo.shouldRetry) {
        recordPostRetry(PLATFORM);
        throw error;
      }
    } finally {
      if (lockAcquired) {
        await publishingLockService.releaseLock(postId, PLATFORM);
      }
    }
  }
}
