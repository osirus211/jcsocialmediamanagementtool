/**
 * Threads Publisher
 * 
 * Complete Threads publishing service with all API features
 * Supports text, image, video, carousel posts, replies, and analytics
 */

import { BasePublisher } from './BasePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { PublishPostOptions, PublishPostResult } from './IPublisher';
import { logger } from '../../utils/logger';
import axios from 'axios';

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';
const MAX_CONTENT_LENGTH = 500;
const MAX_MEDIA_COUNT = 20; // Carousel support up to 20 items
const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL = 2000; // 2 seconds

interface ContainerResponse {
  id: string;
}

interface PublishResponse {
  id: string;
}

interface ContainerStatus {
  status: 'IN_PROGRESS' | 'FINISHED' | 'ERROR';
  error_message?: string;
}

interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

export class ThreadsPublisher extends BasePublisher {
  readonly platform = 'threads';
  protected readonly requiredScopes = ['threads_basic', 'threads_content_publish', 'threads_manage_insights'];

  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    this.validatePlatformScopes(account);
    const { content, mediaIds = [], metadata } = options;

    this.validateContentLength(content, MAX_CONTENT_LENGTH);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    const accessToken = this.getAccessToken(account);
    const userId = account.providerUserId;

    try {
      // Check if this is a reply
      if (metadata?.replyToId) {
        return await this.replyToThread(account, metadata.replyToId, content);
      }

      // Determine post type and publish accordingly
      if (mediaIds.length === 0) {
        return await this.publishText(account, { content, mediaIds, metadata });
      } else if (mediaIds.length === 1) {
        const mediaUrl = mediaIds[0];
        const isVideo = this.isVideoUrl(mediaUrl);
        
        if (isVideo) {
          return await this.publishVideo(account, { content, mediaIds, metadata });
        } else {
          return await this.publishImage(account, { content, mediaIds, metadata });
        }
      } else {
        // Multiple media items - create carousel
        return await this.publishCarousel(account, { content, mediaIds, metadata });
      }
    } catch (error: any) {
      this.handleApiError(error, 'publishPost');
    }
  }

  /**
   * Publish text-only post
   */
  async publishText(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content } = options;
    const accessToken = this.getAccessToken(account);
    const userId = account.providerUserId;

    try {
      // Step 1: Create container
      const containerId = await this.createContainer(userId, {
        media_type: 'TEXT',
        text: content
      }, accessToken);

      // Step 2: Publish container
      const postId = await this.publishContainer(userId, containerId, accessToken);

      logger.info('[Threads] Text post published successfully', {
        postId,
        accountId: account._id.toString(),
      });

      return {
        platformPostId: postId,
        url: `https://threads.net/@${account.metadata?.username}/post/${postId}`,
        metadata: { containerId, type: 'text' },
      };
    } catch (error: any) {
      logger.error('[Threads] Text post failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Publish single image post
   */
  async publishImage(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds } = options;
    const accessToken = this.getAccessToken(account);
    const userId = account.providerUserId;

    try {
      // Step 1: Create container
      const containerId = await this.createContainer(userId, {
        media_type: 'IMAGE',
        image_url: mediaIds![0],
        text: content
      }, accessToken);

      // Step 2: Publish container
      const postId = await this.publishContainer(userId, containerId, accessToken);

      logger.info('[Threads] Image post published successfully', {
        postId,
        accountId: account._id.toString(),
      });

      return {
        platformPostId: postId,
        url: `https://threads.net/@${account.metadata?.username}/post/${postId}`,
        metadata: { containerId, type: 'image' },
      };
    } catch (error: any) {
      logger.error('[Threads] Image post failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Publish single video post
   */
  async publishVideo(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds } = options;
    const accessToken = this.getAccessToken(account);
    const userId = account.providerUserId;

    try {
      // Step 1: Create container
      const containerId = await this.createContainer(userId, {
        media_type: 'VIDEO',
        video_url: mediaIds![0],
        text: content
      }, accessToken);

      // Step 2: Wait for video processing
      await this.pollContainerStatus(containerId, accessToken);

      // Step 3: Publish container
      const postId = await this.publishContainer(userId, containerId, accessToken);

      logger.info('[Threads] Video post published successfully', {
        postId,
        accountId: account._id.toString(),
      });

      return {
        platformPostId: postId,
        url: `https://threads.net/@${account.metadata?.username}/post/${postId}`,
        metadata: { containerId, type: 'video' },
      };
    } catch (error: any) {
      logger.error('[Threads] Video post failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Publish carousel post (up to 20 items)
   */
  async publishCarousel(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds } = options;
    const accessToken = this.getAccessToken(account);
    const userId = account.providerUserId;

    try {
      // Step 1: Create child containers for each media item
      const childContainerIds: string[] = [];
      
      for (const mediaUrl of mediaIds!) {
        const isVideo = this.isVideoUrl(mediaUrl);
        
        const childContainerId = await this.createContainer(userId, {
          media_type: isVideo ? 'VIDEO' : 'IMAGE',
          [isVideo ? 'video_url' : 'image_url']: mediaUrl,
          is_carousel_item: 'true'
        }, accessToken);
        
        childContainerIds.push(childContainerId);
        
        // Wait for video processing if needed
        if (isVideo) {
          await this.pollContainerStatus(childContainerId, accessToken);
        }
      }

      // Step 2: Create carousel container
      const carouselContainerId = await this.createContainer(userId, {
        media_type: 'CAROUSEL',
        children: childContainerIds.join(','),
        text: content
      }, accessToken);

      // Step 3: Publish carousel
      const postId = await this.publishContainer(userId, carouselContainerId, accessToken);

      logger.info('[Threads] Carousel post published successfully', {
        postId,
        accountId: account._id.toString(),
        itemCount: mediaIds!.length,
      });

      return {
        platformPostId: postId,
        url: `https://threads.net/@${account.metadata?.username}/post/${postId}`,
        metadata: { 
          containerId: carouselContainerId, 
          childContainerIds,
          type: 'carousel',
          itemCount: mediaIds!.length
        },
      };
    } catch (error: any) {
      logger.error('[Threads] Carousel post failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Reply to an existing thread
   */
  async replyToThread(account: ISocialAccount, threadId: string, content: string): Promise<PublishPostResult> {
    const accessToken = this.getAccessToken(account);
    const userId = account.providerUserId;

    try {
      const response = await axios.post(
        `${THREADS_API_BASE}/${userId}/threads`,
        {
          media_type: 'TEXT',
          text: content,
          reply_to_id: threadId,
          access_token: accessToken
        }
      );

      const replyId = response.data.id;

      logger.info('[Threads] Reply posted successfully', {
        replyId,
        threadId,
        accountId: account._id.toString(),
      });

      return {
        platformPostId: replyId,
        url: `https://threads.net/@${account.metadata?.username}/post/${replyId}`,
        metadata: { type: 'reply', replyToId: threadId },
      };
    } catch (error: any) {
      logger.error('[Threads] Reply failed', { threadId, error: error.message });
      throw error;
    }
  }

  /**
   * Create media container
   */
  async createContainer(userId: string, params: Record<string, string>, accessToken: string): Promise<string> {
    try {
      const response = await axios.post(
        `${THREADS_API_BASE}/${userId}/threads`,
        {
          ...params,
          access_token: accessToken
        }
      );

      const containerId = response.data.id;
      logger.info('[Threads] Container created', { containerId, type: params.media_type });
      
      return containerId;
    } catch (error: any) {
      logger.error('[Threads] Container creation failed', { 
        error: error.response?.data || error.message,
        params: { ...params, access_token: '[REDACTED]' }
      });
      throw new Error(`Failed to create container: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Publish container
   */
  async publishContainer(userId: string, containerId: string, accessToken: string): Promise<string> {
    try {
      const response = await axios.post(
        `${THREADS_API_BASE}/${userId}/threads_publish`,
        {
          creation_id: containerId,
          access_token: accessToken
        }
      );

      const postId = response.data.id;
      logger.info('[Threads] Container published', { containerId, postId });
      
      return postId;
    } catch (error: any) {
      logger.error('[Threads] Container publish failed', { 
        containerId,
        error: error.response?.data || error.message 
      });
      throw new Error(`Failed to publish container: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Poll container status until ready
   */
  async pollContainerStatus(containerId: string, accessToken: string): Promise<void> {
    let attempts = 0;
    
    while (attempts < MAX_POLL_ATTEMPTS) {
      try {
        const response = await axios.get(
          `${THREADS_API_BASE}/${containerId}?fields=status,error_message&access_token=${accessToken}`
        );

        const status: ContainerStatus = response.data;
        
        if (status.status === 'FINISHED') {
          logger.info('[Threads] Container ready', { containerId });
          return;
        }
        
        if (status.status === 'ERROR') {
          throw new Error(`Container processing failed: ${status.error_message}`);
        }
        
        // Still in progress, wait and retry
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        attempts++;
        
      } catch (error: any) {
        logger.error('[Threads] Status poll failed', { 
          containerId, 
          attempt: attempts,
          error: error.message 
        });
        
        if (attempts >= MAX_POLL_ATTEMPTS - 1) {
          throw new Error(`Container status polling failed after ${MAX_POLL_ATTEMPTS} attempts`);
        }
        
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        attempts++;
      }
    }
    
    throw new Error(`Container processing timeout after ${MAX_POLL_ATTEMPTS} attempts`);
  }

  /**
   * Delete a thread post
   */
  async deleteThread(account: ISocialAccount, platformPostId: string): Promise<void> {
    const accessToken = this.getAccessToken(account);
    
    try {
      await axios.delete(
        `${THREADS_API_BASE}/${platformPostId}?access_token=${accessToken}`
      );
      
      logger.info('[Threads] Post deleted successfully', { 
        postId: platformPostId,
        accountId: account._id.toString() 
      });
    } catch (error: any) {
      logger.error('[Threads] Delete failed', { 
        postId: platformPostId,
        error: error.response?.data || error.message 
      });
      throw new Error(`Failed to delete post: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Check if URL is a video
   */
  private isVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('video');
  }

  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    // Threads uses URLs directly, no upload needed
    // Validate URLs are accessible
    for (const url of mediaUrls) {
      try {
        const response = await axios.head(url);
        if (response.status !== 200) {
          throw new Error(`Media URL not accessible: ${url}`);
        }
      } catch (error: any) {
        logger.error('[Threads] Media URL validation failed', { url, error: error.message });
        throw new Error(`Invalid media URL: ${url}`);
      }
    }
    
    return mediaUrls;
  }

  getLimits() {
    return {
      maxContentLength: MAX_CONTENT_LENGTH,
      maxMediaCount: MAX_MEDIA_COUNT,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/mov'],
      features: {
        carousel: true,
        maxCarouselItems: 20,
        replies: true,
        videoProcessing: true,
        textOnly: true
      }
    };
  }
}
