import { Job } from 'bullmq';
import { logger } from '../utils/logger';
import { Post } from '../models/Post';
import { FirstCommentPublisher } from '../services/FirstCommentPublisher';

export interface FirstCommentJobData {
  postId: string;
  accountId: string;
  platformPostId: string;
  content: string;
  platform: string;
}

export class FirstCommentJob {
  private firstCommentPublisher: FirstCommentPublisher;

  constructor() {
    this.firstCommentPublisher = new FirstCommentPublisher();
  }

  async process(job: Job<FirstCommentJobData>): Promise<void> {
    const { postId, accountId, platformPostId, content, platform } = job.data;

    logger.info('Processing first comment job', {
      postId,
      accountId,
      platform,
      jobId: job.id,
    });

    try {
      // Update status to pending
      await Post.findByIdAndUpdate(postId, {
        firstCommentStatus: 'pending',
      });

      let result;

      // Post comment based on platform
      switch (platform) {
        case 'instagram':
          result = await this.firstCommentPublisher.postInstagramFirstComment(
            accountId,
            platformPostId,
            content
          );
          break;
        case 'facebook':
          result = await this.firstCommentPublisher.postFacebookFirstComment(
            accountId,
            platformPostId,
            content
          );
          break;
        case 'linkedin':
          result = await this.firstCommentPublisher.postLinkedInFirstComment(
            accountId,
            platformPostId,
            content
          );
          break;
        default:
          throw new Error(`Platform ${platform} not supported for first comments`);
      }

      if (result.success) {
        // Update post with success
        await Post.findByIdAndUpdate(postId, {
          firstCommentId: result.commentId,
          firstCommentPostedAt: new Date(),
          firstCommentStatus: 'posted',
        });

        logger.info('First comment job completed successfully', {
          postId,
          commentId: result.commentId,
          platform,
        });
      } else {
        // Handle failure
        await this.firstCommentPublisher.handleFirstCommentFailure(
          postId,
          result.error || 'Unknown error'
        );

        throw new Error(result.error || 'Failed to post first comment');
      }
    } catch (error: any) {
      logger.error('First comment job failed', {
        postId,
        platform,
        error: error.message,
        jobId: job.id,
      });

      // Update post with failure
      await this.firstCommentPublisher.handleFirstCommentFailure(postId, error.message);

      throw error; // Re-throw to mark job as failed
    }
  }
}