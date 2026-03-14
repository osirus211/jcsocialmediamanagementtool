/**
 * Post Publishing Worker
 * 
 * Processes jobs from the post-publishing-queue
 * Publishes posts to social media platforms
 */

import { Job } from 'bullmq';
import { ScheduledPost, PostStatus } from '../models/ScheduledPost';
import { PostPublishAttempt, AttemptStatus } from '../models/PostPublishAttempt';
import { SocialAccount } from '../models/SocialAccount';
import { PostPublishingJobData } from '../queue/PostPublishingQueue';
import { PublisherRegistry } from '../providers/publishers/PublisherRegistry';
import { TwitterPublisher } from '../providers/publishers/TwitterPublisher';
import { FacebookPublisher } from '../providers/publishers/FacebookPublisher';
import { InstagramPublisher } from '../providers/publishers/InstagramPublisher';
import { LinkedInPublisher } from '../providers/publishers/LinkedInPublisher';
import { TikTokPublisher } from '../providers/publishers/TikTokPublisher';
import { GoogleBusinessPublisher } from '../providers/publishers/GoogleBusinessPublisher';
import { MastodonPublisher } from '../providers/publishers/MastodonPublisher';
import { publishingLockService } from '../services/PublishingLockService';
import { classifyPublishingError, PublishingErrorCategory } from '../types/PublishingErrors';
import { logger } from '../utils/logger';
import { withSpan, recordSpanException } from '../config/telemetry';
import {
  postsPublishedTotal,
  postsFailedTotal,
  publishDuration,
  publishRetryTotal,
  recordPublishDelay,
  recordPublishAttempt,
  recordPublishAttemptFailure,
} from '../config/publishingMetrics';

export class PostPublishingWorker {
  private publisherRegistry: PublisherRegistry;

  constructor() {
    this.publisherRegistry = new PublisherRegistry();
    
    // Register all publishers
    this.publisherRegistry.register('twitter', new TwitterPublisher());
    this.publisherRegistry.register('facebook', new FacebookPublisher());
    this.publisherRegistry.register('instagram', new InstagramPublisher());
    this.publisherRegistry.register('linkedin', new LinkedInPublisher());
    this.publisherRegistry.register('tiktok', new TikTokPublisher());
    this.publisherRegistry.register('google-business', new GoogleBusinessPublisher());
    this.publisherRegistry.register('mastodon', new MastodonPublisher());
  }

  /**
   * Process publishing job
   */
  async process(job: Job<PostPublishingJobData>): Promise<void> {
    const { postId, socialAccountId, platform, content, mediaUrls, attemptNumber = 1 } = job.data;

    await withSpan('publish-post', async (span) => {
      span.setAttribute('post_id', postId);
      span.setAttribute('platform', platform);
      span.setAttribute('attempt_number', attemptNumber);

      const startTime = Date.now();
      let lockAcquired = false;

      try {
        // STEP 1: Acquire publishing lock for idempotency
        lockAcquired = await publishingLockService.acquireLock(postId, platform);
        
        if (!lockAcquired) {
          logger.warn('Publishing lock already held - skipping duplicate publish', {
            postId,
            platform,
            attemptNumber,
          });
          return; // Skip this job - already being processed
        }

        // Fetch post
        const post = await ScheduledPost.findById(postId);
        if (!post) {
          throw new Error(`Post not found: ${postId}`);
        }

        // Record publish delay metric (difference between scheduled time and actual execution)
        recordPublishDelay(platform, post.scheduledAt, new Date());

        // Check if post is already published (race condition protection)
        if (post.status === PostStatus.PUBLISHED) {
          logger.info('Post already published - skipping', {
            postId,
            platform,
            publishedAt: post.publishedAt,
          });
          return;
        }

        // Fetch social account
        const account = await SocialAccount.findById(socialAccountId).select('+accessToken');
        if (!account) {
          throw new Error(`Social account not found: ${socialAccountId}`);
        }

        // Update post status to publishing with timestamp
        post.status = PostStatus.PUBLISHING;
        post.publishingStartedAt = new Date();
        await post.save();

        // Get publisher for platform
        const publisher = this.publisherRegistry.getPublisher(platform);

        // Upload media if required
        let uploadedMediaIds: string[] = [];
        if (mediaUrls.length > 0) {
          uploadedMediaIds = await withSpan('upload-media', async (mediaSpan) => {
            mediaSpan.setAttribute('media_count', mediaUrls.length);
            return await publisher.uploadMedia(account, mediaUrls);
          });
        }

        // Publish post
        const result = await withSpan('publish-to-platform', async (publishSpan) => {
          return await publisher.publishPost(account, {
            content,
            mediaIds: uploadedMediaIds,
          });
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
          platform,
          socialAccountId: post.socialAccountId,
          attemptNumber,
          status: AttemptStatus.SUCCESS,
          platformResponse: result,
          duration,
          publishedAt: new Date(),
        });

        // Update metrics
        postsPublishedTotal.inc({ platform, status: 'success' });
        publishDuration.observe({ platform, status: 'success' }, duration);
        recordPublishAttempt(platform, 'success');

        logger.info('Post published successfully', {
          postId,
          platform,
          platformPostId: result.platformPostId,
          duration,
          attemptNumber,
        });
      } catch (error: unknown) {
        const duration = Date.now() - startTime;

        // Record span exception
        recordSpanException(error instanceof Error ? error : new Error(String(error)));

        // Classify error and determine retry strategy
        const errorInfo = classifyPublishingError(error);

        logger.error('Post publishing failed', {
          postId,
          platform,
          error: error instanceof Error ? error.message : String(error),
          errorCategory: errorInfo.category,
          shouldRetry: errorInfo.shouldRetry,
          attemptNumber,
          duration,
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
          platform,
          socialAccountId: post.socialAccountId,
          attemptNumber,
          status: AttemptStatus.FAILED,
          error: errorInfo.message,
          errorCode: errorInfo.category,
          duration,
        });

        // Update metrics
        postsFailedTotal.inc({ platform, error_type: errorInfo.category });
        publishDuration.observe({ platform, status: 'error' }, duration);
        recordPublishAttempt(platform, 'failed');
        recordPublishAttemptFailure(platform, errorInfo.category);
        
        if (errorInfo.shouldRetry) {
          publishRetryTotal.inc({ platform });
        }

        // Only re-throw if error should be retried
        if (errorInfo.shouldRetry) {
          throw error; // Trigger BullMQ retry
        } else {
          logger.warn('Error is not retryable - marking job as complete', {
            postId,
            platform,
            errorCategory: errorInfo.category,
          });
          // Don't throw - mark job as complete (failed permanently)
        }
      } finally {
        // Always release lock
        if (lockAcquired) {
          await publishingLockService.releaseLock(postId, platform);
        }
      }
    });
  }
}
