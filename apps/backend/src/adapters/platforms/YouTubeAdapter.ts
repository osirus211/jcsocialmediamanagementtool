/**
 * YouTube Platform Adapter
 * Handles YouTube-specific platform capabilities and publishing
 */

import { BasePlatformAdapter } from './BasePlatformAdapter';
import { PlatformCapabilities } from './IPlatformAdapter';
import { YouTubePublisher } from '../../providers/publishers/YouTubePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { IPost } from '../../models/Post';

export class YouTubeAdapter extends BasePlatformAdapter {
  private publisher: YouTubePublisher;

  constructor() {
    super();
    this.publisher = new YouTubePublisher();
  }

  getPlatformName(): string {
    return 'youtube';
  }

  getCapabilities(): PlatformCapabilities {
    return {
      maxImages: 0,
      maxVideos: 1,
      hasStories: false,
      hasReels: true,
      maxChars: 5000,
      requiresVideo: true,
    };
  }

  async publish(account: ISocialAccount, post: IPost): Promise<any> {
    return await this.publisher.publish(account, post);
  }

  async validatePost(post: IPost): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // YouTube requires video content
    if (!post.mediaUrls || post.mediaUrls.length === 0) {
      errors.push('YouTube requires a video file');
    }

    // Check for images (not supported)
    if (post.mediaUrls && post.mediaUrls.some(url => this.isImageUrl(url))) {
      errors.push('YouTube does not support image posts');
    }

    // Check character limit
    if (post.content && post.content.length > 5000) {
      errors.push('Content exceeds YouTube character limit of 5000');
    }

    // Validate Shorts requirements
    if (post.contentType === 'reel') {
      // Additional validation for Shorts would go here
      // For now, we assume the video meets requirements
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private isImageUrl(url: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
  }
}