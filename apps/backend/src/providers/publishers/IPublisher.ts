/**
 * Publisher Interface
 * 
 * Defines the contract for platform-specific publishers
 */

import { ISocialAccount } from '../../models/SocialAccount';

export interface PublishPostOptions {
  content: string;
  mediaIds?: string[];
  threadPosts?: string[];
  metadata?: Record<string, any>;
}

export interface PublishPostResult {
  platformPostId: string;
  url?: string;
  metadata?: Record<string, any>;
}

export interface UploadMediaResult {
  mediaId: string;
  url?: string;
}

/**
 * Publisher interface that all platform publishers must implement
 */
export interface IPublisher {
  /**
   * Platform name
   */
  readonly platform: string;

  /**
   * Publish a post to the platform
   * 
   * @param account - Social account with access token
   * @param options - Post content and media
   * @returns Platform post ID and metadata
   */
  publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult>;

  /**
   * Upload media to the platform
   * 
   * @param account - Social account with access token
   * @param mediaUrls - Array of media URLs to upload
   * @returns Array of platform media IDs
   */
  uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]>;

  /**
   * Validate post before publishing (optional)
   * 
   * @param options - Post content and media
   * @returns Validation result
   */
  validatePost?(options: PublishPostOptions): Promise<{
    valid: boolean;
    errors?: string[];
  }>;

  /**
   * Get platform-specific limits (optional)
   * 
   * @returns Platform limits
   */
  getLimits?(): {
    maxContentLength: number;
    maxMediaCount: number;
    supportedMediaTypes: string[];
  };
}
