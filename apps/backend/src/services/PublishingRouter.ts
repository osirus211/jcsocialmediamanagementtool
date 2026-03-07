/**
 * Publishing Router
 * 
 * Routes publishing jobs from main queue to platform-specific queues
 * Implements platform-based routing logic
 */

import { FacebookPublishQueue } from '../queue/FacebookPublishQueue';
import { InstagramPublishQueue } from '../queue/InstagramPublishQueue';
import { TwitterPublishQueue } from '../queue/TwitterPublishQueue';
import { LinkedInPublishQueue } from '../queue/LinkedInPublishQueue';
import { TikTokPublishQueue } from '../queue/TikTokPublishQueue';
import { logger } from '../utils/logger';

export interface PublishJobData {
  postId: string;
  socialAccountId: string;
  platform: string;
  content: string;
  mediaUrls: string[];
  attemptNumber?: number;
}

export class PublishingRouter {
  private facebookQueue: FacebookPublishQueue;
  private instagramQueue: InstagramPublishQueue;
  private twitterQueue: TwitterPublishQueue;
  private linkedinQueue: LinkedInPublishQueue;
  private tiktokQueue: TikTokPublishQueue;

  constructor() {
    this.facebookQueue = new FacebookPublishQueue();
    this.instagramQueue = new InstagramPublishQueue();
    this.twitterQueue = new TwitterPublishQueue();
    this.linkedinQueue = new LinkedInPublishQueue();
    this.tiktokQueue = new TikTokPublishQueue();

    logger.info('Publishing router initialized', {
      platforms: ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'],
    });
  }

  /**
   * Route job to appropriate platform queue
   */
  async route(data: PublishJobData): Promise<void> {
    const { platform, postId } = data;

    logger.debug('Routing publish job', {
      postId,
      platform,
    });

    switch (platform.toLowerCase()) {
      case 'facebook':
        await this.facebookQueue.add({
          postId: data.postId,
          socialAccountId: data.socialAccountId,
          content: data.content,
          mediaUrls: data.mediaUrls,
          attemptNumber: data.attemptNumber,
        });
        break;

      case 'instagram':
        await this.instagramQueue.add({
          postId: data.postId,
          socialAccountId: data.socialAccountId,
          content: data.content,
          mediaUrls: data.mediaUrls,
          attemptNumber: data.attemptNumber,
        });
        break;

      case 'twitter':
        await this.twitterQueue.add({
          postId: data.postId,
          socialAccountId: data.socialAccountId,
          content: data.content,
          mediaUrls: data.mediaUrls,
          attemptNumber: data.attemptNumber,
        });
        break;

      case 'linkedin':
        await this.linkedinQueue.add({
          postId: data.postId,
          socialAccountId: data.socialAccountId,
          content: data.content,
          mediaUrls: data.mediaUrls,
          attemptNumber: data.attemptNumber,
        });
        break;

      case 'tiktok':
        await this.tiktokQueue.add({
          postId: data.postId,
          socialAccountId: data.socialAccountId,
          content: data.content,
          mediaUrls: data.mediaUrls,
          attemptNumber: data.attemptNumber,
        });
        break;

      default:
        logger.error('Unknown platform for routing', {
          platform,
          postId,
        });
        throw new Error(`Unknown platform: ${platform}`);
    }

    logger.info('Publish job routed successfully', {
      postId,
      platform,
      queue: `${platform}_publish_queue`,
    });
  }

  /**
   * Close all platform queues
   */
  async closeAll(): Promise<void> {
    await Promise.all([
      this.facebookQueue.close(),
      this.instagramQueue.close(),
      this.twitterQueue.close(),
      this.linkedinQueue.close(),
      this.tiktokQueue.close(),
    ]);

    logger.info('All platform queues closed');
  }

  /**
   * Get queue for specific platform
   */
  getQueueForPlatform(platform: string): any {
    switch (platform.toLowerCase()) {
      case 'facebook':
        return this.facebookQueue.getQueue();
      case 'instagram':
        return this.instagramQueue.getQueue();
      case 'twitter':
        return this.twitterQueue.getQueue();
      case 'linkedin':
        return this.linkedinQueue.getQueue();
      case 'tiktok':
        return this.tiktokQueue.getQueue();
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }
}
