/**
 * Base Publisher
 * 
 * Abstract base class for platform publishers
 * Provides common functionality
 */

import { IPublisher, PublishPostOptions } from './IPublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';
import axios, { AxiosInstance } from 'axios';

export abstract class BasePublisher implements IPublisher {
  abstract readonly platform: string;
  protected abstract readonly requiredScopes: string[];
  protected httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      timeout: 30000, // 30 seconds
      headers: {
        'User-Agent': 'SocialMediaScheduler/1.0',
      },
    });
  }

  /**
   * Validate platform scopes before publishing
   */
  protected validatePlatformScopes(account: ISocialAccount): void {
    const grantedScopes: string[] = account.scopes || [];
    const missingScopes = this.requiredScopes.filter(scope => !grantedScopes.includes(scope));

    if (missingScopes.length > 0) {
      const error: any = new Error(`Missing required scopes: ${missingScopes.join(', ')}`);
      error.code = 'INSUFFICIENT_SCOPES';
      error.details = {
        missing: missingScopes,
        granted: grantedScopes,
        required: this.requiredScopes,
      };
      throw error;
    }
  }

  /**
   * Get access token from account
   */
  protected getAccessToken(account: ISocialAccount): string {
    return account.getDecryptedAccessToken();
  }

  /**
   * Validate post content length
   */
  protected validateContentLength(content: string, maxLength: number): void {
    if (content.length > maxLength) {
      throw new Error(
        `Content exceeds maximum length of ${maxLength} characters (${content.length} characters)`
      );
    }
  }

  /**
   * Validate media count
   */
  protected validateMediaCount(mediaUrls: string[], maxCount: number): void {
    if (mediaUrls.length > maxCount) {
      throw new Error(
        `Media count exceeds maximum of ${maxCount} (${mediaUrls.length} media items)`
      );
    }
  }

  /**
   * Download media from URL
   */
  protected async downloadMedia(url: string): Promise<Buffer> {
    try {
      const response = await this.httpClient.get(url, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      logger.error('Failed to download media', {
        url,
        error: error.message,
      });
      throw new Error(`Failed to download media: ${error.message}`);
    }
  }

  /**
   * Get media type from URL
   */
  protected getMediaType(url: string): 'image' | 'video' | 'unknown' {
    const extension = url.split('.').pop()?.toLowerCase();
    
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const videoExtensions = ['mp4', 'mov', 'avi', 'webm'];

    if (imageExtensions.includes(extension || '')) return 'image';
    if (videoExtensions.includes(extension || '')) return 'video';
    return 'unknown';
  }

  /**
   * Handle API error
   */
  protected handleApiError(error: any, operation: string): never {
    const errorMessage = error.response?.data?.error?.message || error.message;
    const errorCode = error.response?.data?.error?.code || error.code || 'UNKNOWN';

    logger.error(`${this.platform} API error`, {
      operation,
      error: errorMessage,
      errorCode,
      status: error.response?.status,
    });

    const err = new Error(`${this.platform} API error: ${errorMessage}`);
    (err as any).code = errorCode;
    throw err;
  }

  // Abstract methods that must be implemented by subclasses
  abstract publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<any>;
  abstract uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]>;
}
