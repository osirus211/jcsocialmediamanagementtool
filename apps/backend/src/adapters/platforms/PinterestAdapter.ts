/**
 * Pinterest Platform Adapter
 * Handles Pinterest-specific platform capabilities and publishing
 */

import { BasePlatformAdapter } from './BasePlatformAdapter';
import { PlatformCapabilities } from './IPlatformAdapter';
import { PinterestPublisher } from '../../providers/publishers/PinterestPublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { IPost } from '../../models/Post';

export class PinterestAdapter extends BasePlatformAdapter {
  private publisher: PinterestPublisher;

  constructor() {
    super();
    this.publisher = new PinterestPublisher();
  }

  getPlatformName(): string {
    return 'pinterest';
  }

  getCapabilities(): PlatformCapabilities {
    return {
      maxImages: 1,
      maxVideos: 1,
      hasStories: false,
      hasReels: false,
      maxChars: 500,
      requiresVideo: false,
    };
  }

  async publish(account: ISocialAccount, post: IPost): Promise<any> {
    return await this.publisher.publish(account, post);
  }

  async validatePost(post: IPost): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Pinterest requires media content
    if (!post.mediaUrls || post.mediaUrls.length === 0) {
      errors.push('Pinterest requires an image or video');
    }

    // Check media count (Pinterest supports 1 media item per pin)
    if (post.mediaUrls && post.mediaUrls.length > 1) {
      errors.push('Pinterest supports only 1 image or video per pin');
    }

    // Check character limit
    if (post.content && post.content.length > 500) {
      errors.push('Content exceeds Pinterest character limit of 500');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}