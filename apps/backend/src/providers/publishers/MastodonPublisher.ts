/**
 * Mastodon Publisher
 * 
 * Handles publishing posts to Mastodon instances
 * Supports text, media, polls, content warnings, and scheduling
 */

import { BasePublisher } from './BasePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { PublishPostOptions, PublishPostResult } from './IPublisher';
import { logger } from '../../utils/logger';
import axios from 'axios';
import FormData from 'form-data';

export interface MastodonPostOptions extends PublishPostOptions {
  visibility?: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive?: boolean;
  spoilerText?: string;
  language?: string;
  scheduledAt?: string;
  inReplyToId?: string;
  poll?: {
    options: string[];
    expiresIn: number;
    multiple?: boolean;
    hideTotals?: boolean;
  };
}

export interface MastodonMediaUpload {
  id: string;
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown';
  url: string;
  preview_url?: string;
  description?: string;
}

export class MastodonPublisher extends BasePublisher {
  readonly platform = 'mastodon';

  /**
   * Publish post to Mastodon
   */
  async publishPost(account: ISocialAccount, options: MastodonPostOptions): Promise<PublishPostResult> {
    try {
      const instanceUrl = account.metadata?.instanceUrl;
      if (!instanceUrl) {
        throw new Error('Instance URL not found in account metadata');
      }

      const accessToken = this.getAccessToken(account);
      
      // Validate content length (Mastodon default is 500 chars, but instances can customize)
      const maxLength = account.metadata?.characterLimit || 500;
      this.validateContentLength(options.content, maxLength);

      // Upload media if provided
      let mediaIds: string[] = [];
      if (options.mediaIds && options.mediaIds.length > 0) {
        // Media already uploaded, use provided IDs
        mediaIds = options.mediaIds;
      }

      // Build status object
      const statusData = this.buildStatus(options.content, {
        mediaIds,
        visibility: options.visibility || 'public',
        sensitive: options.sensitive || false,
        spoilerText: options.spoilerText,
        language: options.language || 'en',
        scheduledAt: options.scheduledAt,
        inReplyToId: options.inReplyToId,
        poll: options.poll
      });

      // Post to Mastodon
      const response = await axios.post(`${instanceUrl}/api/v1/statuses`, statusData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'SocialMediaScheduler/1.0'
        },
        timeout: 30000
      });

      const status = response.data;

      logger.info('Mastodon post published successfully', {
        accountId: account._id,
        instanceUrl,
        statusId: status.id,
        visibility: options.visibility
      });

      return {
        platformPostId: status.id,
        url: status.url || status.uri,
        metadata: {
          visibility: status.visibility,
          repliesCount: status.replies_count || 0,
          reblogsCount: status.reblogs_count || 0,
          favouritesCount: status.favourites_count || 0,
          sensitive: status.sensitive,
          spoilerText: status.spoiler_text,
          language: status.language,
          createdAt: status.created_at,
          instanceUrl
        }
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishPost');
    }
  }

  /**
   * Upload media to Mastodon
   */
  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    try {
      const instanceUrl = account.metadata?.instanceUrl;
      if (!instanceUrl) {
        throw new Error('Instance URL not found in account metadata');
      }

      const accessToken = this.getAccessToken(account);
      
      // Validate media count (Mastodon allows up to 4 media attachments)
      this.validateMediaCount(mediaUrls, 4);

      const mediaIds: string[] = [];

      for (const mediaUrl of mediaUrls) {
        const mediaId = await this.uploadSingleMedia(instanceUrl, accessToken, mediaUrl);
        mediaIds.push(mediaId);
      }

      return mediaIds;
    } catch (error: any) {
      this.handleApiError(error, 'uploadMedia');
    }
  }

  /**
   * Upload single media file to Mastodon
   */
  async uploadSingleMedia(instanceUrl: string, accessToken: string, mediaUrl: string, altText?: string): Promise<string> {
    try {
      // Download media
      const mediaBuffer = await this.downloadMedia(mediaUrl);
      
      // Create form data
      const formData = new FormData();
      formData.append('file', mediaBuffer, {
        filename: this.getFilenameFromUrl(mediaUrl),
        contentType: this.getContentTypeFromUrl(mediaUrl)
      });
      
      if (altText) {
        formData.append('description', altText);
      }

      // Upload to Mastodon (using v2 API for better support)
      const response = await axios.post(`${instanceUrl}/api/v2/media`, formData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'SocialMediaScheduler/1.0',
          ...formData.getHeaders()
        },
        timeout: 60000 // Longer timeout for media uploads
      });

      const media = response.data;

      logger.info('Mastodon media uploaded successfully', {
        instanceUrl,
        mediaId: media.id,
        type: media.type
      });

      return media.id;
    } catch (error: any) {
      logger.error('Failed to upload media to Mastodon', {
        instanceUrl,
        mediaUrl,
        error: error.message
      });
      throw new Error(`Media upload failed: ${error.message}`);
    }
  }

  /**
   * Publish poll to Mastodon
   */
  async publishPoll(account: ISocialAccount, post: MastodonPostOptions): Promise<PublishPostResult> {
    if (!post.poll) {
      throw new Error('Poll data is required');
    }

    // Validate poll options
    if (post.poll.options.length < 2 || post.poll.options.length > 4) {
      throw new Error('Poll must have 2-4 options');
    }

    if (post.poll.options.some(option => option.length > 50)) {
      throw new Error('Poll options must be 50 characters or less');
    }

    return this.publishPost(account, post);
  }

  /**
   * Schedule toot for later posting
   */
  async scheduleToot(account: ISocialAccount, post: MastodonPostOptions, scheduledAt: string): Promise<PublishPostResult> {
    const scheduledPost = {
      ...post,
      scheduledAt
    };

    return this.publishPost(account, scheduledPost);
  }

  /**
   * Reply to a toot
   */
  async replyToToot(account: ISocialAccount, tootId: string, content: string): Promise<PublishPostResult> {
    const replyPost: MastodonPostOptions = {
      content,
      inReplyToId: tootId
    };

    return this.publishPost(account, replyPost);
  }

  /**
   * Delete toot
   */
  async deleteToot(account: ISocialAccount, platformPostId: string): Promise<void> {
    try {
      const instanceUrl = account.metadata?.instanceUrl;
      if (!instanceUrl) {
        throw new Error('Instance URL not found in account metadata');
      }

      const accessToken = this.getAccessToken(account);

      await axios.delete(`${instanceUrl}/api/v1/statuses/${platformPostId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'SocialMediaScheduler/1.0'
        },
        timeout: 10000
      });

      logger.info('Mastodon toot deleted successfully', {
        accountId: account._id,
        instanceUrl,
        statusId: platformPostId
      });
    } catch (error: any) {
      this.handleApiError(error, 'deleteToot');
    }
  }

  /**
   * Build status object for Mastodon API
   */
  buildStatus(content: string, options: {
    mediaIds?: string[];
    visibility?: string;
    sensitive?: boolean;
    spoilerText?: string;
    language?: string;
    scheduledAt?: string;
    inReplyToId?: string;
    poll?: {
      options: string[];
      expiresIn: number;
      multiple?: boolean;
      hideTotals?: boolean;
    };
  }): any {
    const status: any = {
      status: content
    };

    if (options.mediaIds && options.mediaIds.length > 0) {
      status.media_ids = options.mediaIds;
    }

    if (options.visibility) {
      status.visibility = options.visibility;
    }

    if (options.sensitive) {
      status.sensitive = options.sensitive;
    }

    if (options.spoilerText) {
      status.spoiler_text = options.spoilerText;
    }

    if (options.language) {
      status.language = options.language;
    }

    if (options.scheduledAt) {
      status.scheduled_at = options.scheduledAt;
    }

    if (options.inReplyToId) {
      status.in_reply_to_id = options.inReplyToId;
    }

    if (options.poll) {
      status.poll = {
        options: options.poll.options,
        expires_in: options.poll.expiresIn,
        multiple: options.poll.multiple || false,
        hide_totals: options.poll.hideTotals || false
      };
    }

    return status;
  }

  /**
   * Get platform-specific limits
   */
  getLimits() {
    return {
      maxContentLength: 500, // Default Mastodon limit (instances can customize)
      maxMediaCount: 4,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
    };
  }

  /**
   * Validate post before publishing
   */
  async validatePost(options: MastodonPostOptions): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Check content length
    if (options.content.length > 500) {
      errors.push('Content exceeds 500 character limit');
    }

    // Check media count
    if (options.mediaIds && options.mediaIds.length > 4) {
      errors.push('Maximum 4 media attachments allowed');
    }

    // Check poll options
    if (options.poll) {
      if (options.poll.options.length < 2 || options.poll.options.length > 4) {
        errors.push('Poll must have 2-4 options');
      }
      
      if (options.poll.options.some(option => option.length > 50)) {
        errors.push('Poll options must be 50 characters or less');
      }

      if (options.poll.expiresIn < 300 || options.poll.expiresIn > 2629746) {
        errors.push('Poll duration must be between 5 minutes and 1 month');
      }
    }

    // Check visibility
    const validVisibilities = ['public', 'unlisted', 'private', 'direct'];
    if (options.visibility && !validVisibilities.includes(options.visibility)) {
      errors.push('Invalid visibility setting');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Get filename from URL
   */
  private getFilenameFromUrl(url: string): string {
    const pathname = new URL(url).pathname;
    return pathname.split('/').pop() || 'media';
  }

  /**
   * Get content type from URL
   */
  private getContentTypeFromUrl(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mov': 'video/quicktime'
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }
}