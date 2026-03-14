/**
 * Pinterest Platform Adapter
 * Handles Pinterest-specific platform capabilities and publishing
 */

import { PlatformAdapter, PlatformCapabilities } from './PlatformAdapter';
import { PinterestPublisher } from '../../providers/publishers/PinterestPublisher';
import { PinterestOAuthProvider } from '../../providers/oauth/PinterestOAuthProvider';
import { ISocialAccount } from '../../models/SocialAccount';
import { IPost } from '../../models/Post';

export class PinterestAdapter implements PlatformAdapter {
  private publisher: PinterestPublisher;
  private oauthProvider: PinterestOAuthProvider;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.publisher = new PinterestPublisher();
    this.oauthProvider = new PinterestOAuthProvider(clientId, clientSecret, redirectUri);
  }

  getPlatformName(): string {
    return 'pinterest';
  }

  getCapabilities(): PlatformCapabilities {
    return {
      maxImageSize: 1,
      maxVideos: 1,
      hasStories: false,
      hasReels: false,
      maxChars: 500,
      requiresVideo: false,
      supportsScheduling: true,
      supportsHashtags: true,
      supportsMultipleImages: true, // For Idea Pins
      supportsVideoUpload: true,
      maxHashtags: 20,
      maxMentions: 0,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/mov'],
      maxMediaSize: 100 * 1024 * 1024, // 100MB
    } as any;
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

    // Check media count (Pinterest supports up to 20 images for Idea Pins)
    if (post.mediaUrls && post.mediaUrls.length > 20) {
      errors.push('Pinterest supports maximum 20 images per Idea Pin');
    }

    // Check character limit for title (100 chars)
    const title = this.extractTitle(post.content);
    if (title && title.length > 100) {
      errors.push('Pin title exceeds Pinterest limit of 100 characters');
    }

    // Check character limit for description (500 chars)
    const description = this.extractDescription(post.content);
    if (description && description.length > 500) {
      errors.push('Pin description exceeds Pinterest limit of 500 characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Required PlatformAdapter methods
  async generateAuthUrl(): Promise<any> {
    return await this.oauthProvider.getAuthorizationUrl();
  }

  async exchangeCodeForToken(code: string, state: string): Promise<any> {
    return await this.oauthProvider.exchangeCodeForTokens(code, state);
  }

  async discoverAccounts(accessToken: string): Promise<any[]> {
    return await this.oauthProvider.discoverAccounts(accessToken);
  }

  async validatePermissions(accessToken: string): Promise<any> {
    return await this.oauthProvider.validatePermissions(accessToken);
  }

  // OAuth methods
  async getAuthorizationUrl(): Promise<{ url: string; state: string }> {
    return await this.oauthProvider.getAuthorizationUrl();
  }

  async exchangeCodeForTokens(code: string, state: string): Promise<any> {
    return await this.oauthProvider.exchangeCodeForTokens(code, state);
  }

  async refreshAccessToken(refreshToken: string): Promise<any> {
    return await this.oauthProvider.refreshAccessToken(refreshToken);
  }

  async getAccountInfo(accessToken: string): Promise<any> {
    return await this.oauthProvider.getAccountInfo(accessToken);
  }

  async validateToken(accessToken: string): Promise<boolean> {
    return await this.oauthProvider.validateToken(accessToken);
  }

  // Helper methods
  private extractTitle(content: string): string {
    const lines = content.split('\n');
    return lines[0] || '';
  }

  private extractDescription(content: string): string {
    const lines = content.split('\n');
    if (lines.length > 1) {
      return lines.slice(1).join('\n').trim();
    }
    return content;
  }
}