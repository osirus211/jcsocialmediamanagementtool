/**
 * Google Business Profile Publisher Worker
 * 
 * Processes jobs from google_business_publish_queue
 * Publishes posts to Google Business Profile using GoogleBusinessPublisher
 */

import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { ScheduledPost, PostStatus } from '../models/ScheduledPost';
import { PostPublishAttempt, AttemptStatus } from '../models/PostPublishAttempt';
import { SocialAccount } from '../models/SocialAccount';
import { GoogleBusinessPublisher } from '../providers/publishers/GoogleBusinessPublisher';
import { publishingLockService } from '../services/PublishingLockService';
import { classifyPublishingError } from '../types/PublishingErrors';
import { logger } from '../utils/logger';
import {
  recordPostPublished,
  recordPostFailed,
  recordPostRetry,
  recordPublishAttempt,
  recordPublishAttemptFailure,
} from '../config/publishingMetrics';

const QUEUE_NAME = 'google_business_publish_queue';
const PLATFORM = 'google-business';

export interface GoogleBusinessPublishJobData {
  postId: string;
  socialAccountId: string;
  content: string;
  mediaUrls: string[];
  postType?: 'STANDARD' | 'EVENT' | 'OFFER' | 'PRODUCT' | 'ALERT';
  callToAction?: {
    actionType: 'LEARN_MORE' | 'BOOK' | 'ORDER' | 'SHOP' | 'SIGN_UP' | 'CALL';
    url: string;
  };
  event?: {
    title: string;
    startDate: string;
    endDate: string;
  };
  offer?: {
    couponCode?: string;
    redeemOnlineUrl?: string;
    termsConditions?: string;
  };
  product?: {
    name: string;
    category?: string;
    price?: {
      currencyCode: string;
      units: string;
      nanos: number;
    };
  };
  attemptNumber?: number;
}
export class GoogleBusinessPublisherWorker {
  private worker: Worker<GoogleBusinessPublishJobData> | null = null;
  private publisher: GoogleBusinessPublisher;

  constructor() {
    this.publisher = new GoogleBusinessPublisher();
  }

  start(): void {
    if (this.worker) {
      logger.warn('Google Business Profile publisher worker already running');
      return;
    }

    const redis = getRedisClient();

    this.worker = new Worker<GoogleBusinessPublishJobData>(
      QUEUE_NAME,
      async (job: Job<GoogleBusinessPublishJobData>) => {
        await this.processJob(job);
      },
      {
        connection: redis,
        concurrency: 3,
        limiter: {
          max: 10,
          duration: 1000,
        },
      }
    );

    this.worker.on('completed', (job) => {
      logger.info('Google Business Profile publish job completed', {
        jobId: job.id,
        postId: job.data.postId,
      });
    });

    this.worker.on('failed', (job, err) => {
      logger.error('Google Business Profile publish job failed', {
        jobId: job?.id,
        postId: job?.data?.postId,
        error: err.message,
      });
    });

    logger.info('Google Business Profile publisher worker started');
  }

  async stop(): Promise<void> {
    if (!this.worker) {
      return;
    }

    logger.info('Stopping Google Business Profile publisher worker');
    const worker = this.worker;
    this.worker = null;
    await worker.close();
  }
  private async processJob(job: Job<GoogleBusinessPublishJobData>): Promise<void> {
    const startTime = Date.now();
    const { postId, socialAccountId, content, mediaUrls, postType, callToAction, event, offer, product } = job.data;
    const attemptNumber = job.attemptsMade + 1;

    logger.info('Processing Google Business Profile publish job', {
      jobId: job.id,
      postId,
      socialAccountId,
      attemptNumber,
    });

    let lockAcquired = false;

    try {
      // Acquire publishing lock
      lockAcquired = await publishingLockService.acquireLock(postId, PLATFORM);

      if (!lockAcquired) {
        logger.warn('Publishing lock already held - skipping', {
          postId,
          platform: PLATFORM,
        });
        return;
      }

      // Fetch post and account
      const [post, account] = await Promise.all([
        ScheduledPost.findById(postId),
        SocialAccount.findById(socialAccountId).select('+accessToken'),
      ]);

      if (!post) {
        throw new Error(`Post not found: ${postId}`);
      }

      if (!account) {
        throw new Error(`Social account not found: ${socialAccountId}`);
      }

      if (account.provider !== 'google-business') {
        throw new Error(`Invalid account provider: ${account.provider}`);
      }

      // Check if already published
      if (post.status === PostStatus.PUBLISHED) {
        logger.info('Post already published - skipping', {
          postId,
          platform: PLATFORM,
        });
        return;
      }
      // Update post status to publishing
      post.status = PostStatus.PUBLISHING;
      post.publishingStartedAt = new Date();
      await post.save();

      // Prepare publish options
      const publishOptions = {
        content,
        mediaIds: mediaUrls,
        metadata: {
          topicType: postType || 'STANDARD',
          callToAction,
          event,
          offer,
          product,
        },
      };

      // Publish to Google Business Profile
      const result = await this.publisher.publishPost(account, publishOptions);

      // Update post status
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
        socialAccountId: account._id,
        platform: PLATFORM,
        attemptNumber,
        status: AttemptStatus.SUCCESS,
        platformResponse: result.metadata,
        duration,
        publishedAt: new Date(),
      });

      // Record metrics
      recordPostPublished(PLATFORM, 'success', duration);
      recordPublishAttempt(PLATFORM, 'success');

      logger.info('Google Business Profile post published successfully', {
        jobId: job.id,
        postId,
        platformPostId: result.platformPostId,
        duration,
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorInfo = classifyPublishingError(error);

      logger.error('Google Business Profile post publishing failed', {
        jobId: job.id,
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
        workspaceId: post?.workspaceId,
        socialAccountId,
        platform: PLATFORM,
        attemptNumber,
        status: AttemptStatus.FAILED,
        error: errorInfo.message,
        errorCode: errorInfo.category,
        duration,
      });

      // Record metrics
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