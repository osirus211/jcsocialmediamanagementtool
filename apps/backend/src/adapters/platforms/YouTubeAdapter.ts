/**
 * YouTube Platform Adapter
 * Handles YouTube-specific platform capabilities and publishing
 */

import { BasePlatformAdapter } from '../BasePlatformAdapter';
import { PlatformCapabilities } from './PlatformAdapter';
import { YouTubePublisher } from '../../providers/publishers/YouTubePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { IPost } from '../../models/Post';

export class YouTubeAdapter extends BasePlatformAdapter {
  private publisher: YouTubePublisher;

  constructor() {
    super('youtube', '', ''); // YouTube adapter doesn't need OAuth credentials for basic functionality
    this.publisher = new YouTubePublisher();
  }

  async generateAuthUrl(redirectUri: string, state: string, scopes: string[]): Promise<any> {
    throw new Error('YouTube OAuth not implemented');
  }

  async exchangeCodeForToken(code: string, redirectUri: string, codeVerifier?: string): Promise<any> {
    throw new Error('YouTube OAuth not implemented');
  }

  async refreshAccessToken(refreshToken: string): Promise<any> {
    throw new Error('YouTube OAuth not implemented');
  }

  async discoverAccounts(accessToken: string): Promise<any[]> {
    throw new Error('YouTube account discovery not implemented');
  }

  async validatePermissions(accessToken: string): Promise<any> {
    throw new Error('YouTube permission validation not implemented');
  }

  getPlatformName(): string {
    return 'youtube';
  }

  getCapabilities(): PlatformCapabilities {
    return {
      publishPost: true,
      publishVideo: true,
      publishImage: false,
      publishCarousel: false,
      analytics: true,
      stories: false,
      reels: true,
      scheduling: true,
      maxVideoSize: 128 * 1024 * 1024, // 128MB
      supportedFormats: ['video/mp4', 'video/mov', 'video/avi'],
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