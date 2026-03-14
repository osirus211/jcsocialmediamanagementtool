/**
 * Instagram Publisher
 * 
 * Publishes posts to Instagram using Graph API
 */

import { BasePublisher } from './BasePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { PublishPostOptions, PublishPostResult } from './IPublisher';
import { logger } from '../../utils/logger';
import { IPost, ContentType } from '../../models/Post';
import axios from 'axios';

const INSTAGRAM_API_BASE = 'https://graph.instagram.com/v21.0';
const MAX_CONTENT_LENGTH = 2200;
const MAX_MEDIA_COUNT = 20; // Instagram supports up to 20 carousel items
const MAX_HASHTAGS = 30;

interface InstagramMediaContainer {
  id: string;
  status_code?: string;
}

interface InstagramLocation {
  id: string;
  name: string;
}

interface InstagramUser {
  id: string;
  username: string;
}

interface CarouselItem {
  media_url: string;
  media_type: 'IMAGE' | 'VIDEO';
  alt_text?: string;
  user_tags?: Array<{
    user: { username: string };
    x: number;
    y: number;
  }>;
}

export class InstagramPublisher extends BasePublisher {
  readonly platform = 'instagram';

  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [] } = options;
    const post = (options as any).post;

    // Route based on content type
    if (post && 'contentType' in post) {
      const postDoc = post as IPost;
      if (postDoc.contentType === ContentType.STORY) {
        return this.publishStory(account, options);
      } else if (postDoc.contentType === ContentType.REEL) {
        return this.publishReel(account, options);
      }
    }

    // Check if this is a carousel post (multiple media items)
    if (mediaIds.length > 1) {
      return this.publishCarousel(account, options);
    }

    // Default: single image/video post
    return this.publishSinglePost(account, options);
  }

  async publishSinglePost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [] } = options;
    const post = (options as any).post;

    this.validateContentLength(content, MAX_CONTENT_LENGTH);
    this.validateMediaCount(mediaIds, 1);

    const accessToken = this.getAccessToken(account);
    const instagramAccountId = account.providerUserId;

    try {
      const mediaUrl = mediaIds[0];
      const isVideo = this.isVideoUrl(mediaUrl);

      // Create media container
      const containerPayload: Record<string, any> = {
        access_token: accessToken,
      };

      if (isVideo) {
        containerPayload.media_type = 'VIDEO';
        containerPayload.video_url = mediaUrl;
      } else {
        containerPayload.media_type = 'IMAGE';
        containerPayload.image_url = mediaUrl;
      }

      // Add caption (or save for first comment)
      const { caption, firstComment } = this.processCaption(content, post);
      if (caption) {
        containerPayload.caption = caption;
      }

      // Add alt text for accessibility
      if (post && 'instagramOptions' in post && post.instagramOptions?.altText) {
        containerPayload.alt_text = post.instagramOptions.altText;
      }

      // Add location tagging
      if (post && 'instagramOptions' in post && post.instagramOptions?.locationId) {
        containerPayload.location_id = post.instagramOptions.locationId;
      }

      // Add user tags
      if (post && 'instagramOptions' in post && post.instagramOptions?.userTags?.length) {
        containerPayload.user_tags = post.instagramOptions.userTags.map((tag: any) => ({
          user: { username: tag.username },
          x: tag.x,
          y: tag.y,
        }));
      }

      // Add collaborators
      if (post && 'instagramOptions' in post && post.instagramOptions?.collaborators?.length) {
        containerPayload.collaborators = post.instagramOptions.collaborators;
      }

      const containerResponse = await this.httpClient.post(
        `${INSTAGRAM_API_BASE}/${instagramAccountId}/media`,
        containerPayload
      );

      const containerId = containerResponse.data.id;

      // Publish container
      const publishResponse = await this.httpClient.post(
        `${INSTAGRAM_API_BASE}/${instagramAccountId}/media_publish`,
        {
          creation_id: containerId,
          access_token: accessToken,
        }
      );

      const postId = publishResponse.data.id;

      // Schedule first comment if needed
      if (firstComment) {
        await this.scheduleFirstComment(instagramAccountId, postId, firstComment, accessToken);
      }

      logger.info('Instagram post published successfully', {
        postId,
        accountId: account._id.toString(),
        hasFirstComment: !!firstComment,
      });

      return {
        platformPostId: postId,
        url: `https://instagram.com/p/${postId}`,
        metadata: publishResponse.data,
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishSinglePost');
    }
  }

  async publishCarousel(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [] } = options;
    const post = (options as any).post;

    this.validateContentLength(content, MAX_CONTENT_LENGTH);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    const accessToken = this.getAccessToken(account);
    const instagramAccountId = account.providerUserId;

    try {
      // Use carousel items if available, otherwise fall back to mediaIds
      const carouselItems = post?.carouselItems || [];
      const mediaToProcess = carouselItems.length > 0 ? carouselItems : mediaIds.map((url: string, index: number) => ({
        order: index,
        mediaUrl: url,
        mediaType: this.isVideoUrl(url) ? 'video' : 'image',
        altText: post?.instagramOptions?.carouselItems?.[index]?.altText,
        userTags: post?.instagramOptions?.carouselItems?.[index]?.userTags,
      }));

      // Sort by order to ensure correct sequence
      const sortedItems = mediaToProcess.sort((a: any, b: any) => a.order - b.order);

      // Create individual media containers for each item
      const childContainers: string[] = [];

      for (const item of sortedItems) {
        const isVideo = item.mediaType === 'video' || this.isVideoUrl(item.mediaUrl);

        const containerPayload: Record<string, any> = {
          access_token: accessToken,
          is_carousel_item: true,
        };

        if (isVideo) {
          containerPayload.media_type = 'VIDEO';
          containerPayload.video_url = item.mediaUrl;
        } else {
          containerPayload.media_type = 'IMAGE';
          containerPayload.image_url = item.mediaUrl;
        }

        // Add alt text for this specific item
        if (item.altText) {
          containerPayload.alt_text = item.altText;
        }

        // Add user tags for this specific item
        if (item.userTags?.length) {
          containerPayload.user_tags = item.userTags.map((tag: any) => ({
            user: { username: tag.username },
            x: tag.x,
            y: tag.y,
          }));
        }

        const containerResponse = await this.httpClient.post(
          `${INSTAGRAM_API_BASE}/${instagramAccountId}/media`,
          containerPayload
        );

        childContainers.push(containerResponse.data.id);
      }

      // Create carousel container
      const { caption, firstComment } = this.processCaption(content, post);
      
      const carouselPayload: Record<string, any> = {
        media_type: 'CAROUSEL',
        children: childContainers.join(','),
        access_token: accessToken,
      };

      if (caption) {
        carouselPayload.caption = caption;
      }

      // Add location tagging
      if (post && 'instagramOptions' in post && post.instagramOptions?.locationId) {
        carouselPayload.location_id = post.instagramOptions.locationId;
      }

      // Add collaborators
      if (post && 'instagramOptions' in post && post.instagramOptions?.collaborators?.length) {
        carouselPayload.collaborators = post.instagramOptions.collaborators;
      }

      const carouselResponse = await this.httpClient.post(
        `${INSTAGRAM_API_BASE}/${instagramAccountId}/media`,
        carouselPayload
      );

      const carouselId = carouselResponse.data.id;

      // Publish carousel
      const publishResponse = await this.httpClient.post(
        `${INSTAGRAM_API_BASE}/${instagramAccountId}/media_publish`,
        {
          creation_id: carouselId,
          access_token: accessToken,
        }
      );

      const postId = publishResponse.data.id;

      // Schedule first comment if needed
      if (firstComment) {
        await this.scheduleFirstComment(instagramAccountId, postId, firstComment, accessToken);
      }

      logger.info('Instagram carousel published successfully', {
        postId,
        accountId: account._id.toString(),
        itemCount: sortedItems.length,
        hasFirstComment: !!firstComment,
        hasPerSlideAltText: sortedItems.some((item: any) => !!item.altText),
      });

      return {
        platformPostId: postId,
        url: `https://instagram.com/p/${postId}`,
        metadata: { 
          ...publishResponse.data, 
          contentType: 'carousel', 
          itemCount: sortedItems.length,
          carouselItems: sortedItems.map((item: any) => ({
            mediaType: item.mediaType,
            hasAltText: !!item.altText,
            hasUserTags: !!(item.userTags?.length),
          })),
        },
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishCarousel');
    }
  }

  async publishStory(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [] } = options;
    const post = (options as any).post;

    this.validateMediaCount(mediaIds, 1);

    const accessToken = this.getAccessToken(account);
    const instagramAccountId = account.providerUserId;

    try {
      const mediaUrl = mediaIds[0];
      const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('video');

      // Create story container
      const containerPayload: Record<string, any> = {
        media_type: 'STORIES',
        access_token: accessToken,
      };

      if (isVideo) {
        containerPayload.video_url = mediaUrl;
      } else {
        containerPayload.image_url = mediaUrl;
      }

      // Add story link if provided
      if (post && 'storyOptions' in post) {
        const postDoc = post as IPost;
        if (postDoc.storyOptions?.link) {
          containerPayload.link = postDoc.storyOptions.link;
        }
      }

      const containerResponse = await this.httpClient.post(
        `${INSTAGRAM_API_BASE}/${instagramAccountId}/media`,
        containerPayload
      );

      const containerId = containerResponse.data.id;

      // Publish story
      const publishResponse = await this.httpClient.post(
        `${INSTAGRAM_API_BASE}/${instagramAccountId}/media_publish`,
        {
          creation_id: containerId,
          access_token: accessToken,
        }
      );

      const storyId = publishResponse.data.id;

      logger.info('Instagram story published successfully', {
        storyId,
        accountId: account._id.toString(),
      });

      return {
        platformPostId: storyId,
        url: `https://instagram.com/stories/${account.accountName}`,
        metadata: { ...publishResponse.data, contentType: 'story' },
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishStory');
    }
  }

  async publishReel(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [] } = options;
    const post = (options as any).post;

    this.validateMediaCount(mediaIds, 1);

    const accessToken = this.getAccessToken(account);
    const instagramAccountId = account.providerUserId;

    try {
      const videoUrl = mediaIds[0];

      // Create reel container
      const containerPayload: Record<string, any> = {
        media_type: 'REELS',
        video_url: videoUrl,
        share_to_feed: true, // Default to true
        access_token: accessToken,
      };

      // Add caption (or save for first comment)
      const { caption, firstComment } = this.processCaption(content, post);
      if (caption) {
        containerPayload.caption = caption;
      }

      // Add reel options if provided
      if (post && 'reelOptions' in post) {
        const postDoc = post as IPost;
        if (postDoc.reelOptions) {
          if (postDoc.reelOptions.shareToFeed !== undefined) {
            containerPayload.share_to_feed = postDoc.reelOptions.shareToFeed;
          }
          if (postDoc.reelOptions.audioName) {
            containerPayload.audio_name = postDoc.reelOptions.audioName;
          }
        }
      }

      // Add Instagram-specific options
      if (post && 'instagramOptions' in post) {
        const instagramOptions = post.instagramOptions;
        
        // Cover image for reel
        if (instagramOptions?.coverImageUrl) {
          containerPayload.thumb_offset = instagramOptions.coverImageOffset || 0;
        }

        // Location tagging
        if (instagramOptions?.locationId) {
          containerPayload.location_id = instagramOptions.locationId;
        }

        // Collaborators
        if (instagramOptions?.collaborators?.length) {
          containerPayload.collaborators = instagramOptions.collaborators;
        }
      }

      const containerResponse = await this.httpClient.post(
        `${INSTAGRAM_API_BASE}/${instagramAccountId}/media`,
        containerPayload
      );

      const containerId = containerResponse.data.id;

      // Publish reel
      const publishResponse = await this.httpClient.post(
        `${INSTAGRAM_API_BASE}/${instagramAccountId}/media_publish`,
        {
          creation_id: containerId,
          access_token: accessToken,
        }
      );

      const reelId = publishResponse.data.id;

      // Schedule first comment if needed
      if (firstComment) {
        await this.scheduleFirstComment(instagramAccountId, reelId, firstComment, accessToken);
      }

      logger.info('Instagram reel published successfully', {
        reelId,
        accountId: account._id.toString(),
        hasFirstComment: !!firstComment,
      });

      return {
        platformPostId: reelId,
        url: `https://instagram.com/reel/${reelId}`,
        metadata: { ...publishResponse.data, contentType: 'reel' },
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishReel');
    }
  }

  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    // Instagram uses URLs directly, no upload needed
    return mediaUrls;
  }

  getLimits() {
    return {
      maxContentLength: MAX_CONTENT_LENGTH,
      maxMediaCount: MAX_MEDIA_COUNT,
      maxHashtags: MAX_HASHTAGS,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4'],
      supportedAspectRatios: {
        feed: ['1:1', '4:5', '16:9'],
        story: ['9:16'],
        reel: ['9:16'],
      },
    };
  }

  /**
   * Process caption to separate main caption from first comment
   */
  private processCaption(content: string, post: any): { caption: string; firstComment?: string } {
    // Check if first comment is enabled and has content
    if (post?.firstComment?.enabled && post.firstComment?.content) {
      return { 
        caption: content, 
        firstComment: post.firstComment.content 
      };
    }

    // Legacy support for instagramOptions.useFirstComment (hashtag extraction)
    if (post?.instagramOptions?.useFirstComment) {
      // Extract hashtags from content
      const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
      const hashtags = content.match(hashtagRegex) || [];
      
      if (hashtags.length === 0) {
        return { caption: content };
      }

      // Remove hashtags from main caption
      const caption = content.replace(hashtagRegex, '').trim();
      const firstComment = hashtags.join(' ');

      return { caption, firstComment };
    }

    return { caption: content };
  }

  /**
   * Schedule first comment with hashtags
   */
  private async scheduleFirstComment(
    instagramAccountId: string,
    postId: string,
    comment: string,
    accessToken: string
  ): Promise<void> {
    try {
      // Wait a moment for post to be fully published
      await new Promise(resolve => setTimeout(resolve, 2000));

      await this.httpClient.post(
        `${INSTAGRAM_API_BASE}/${postId}/comments`,
        {
          message: comment,
          access_token: accessToken,
        }
      );

      logger.info('First comment scheduled successfully', {
        postId,
        comment: comment.substring(0, 50) + '...',
      });
    } catch (error: any) {
      logger.error('Failed to schedule first comment', {
        postId,
        error: error.message,
      });
      // Don't throw - first comment failure shouldn't fail the entire post
    }
  }

  /**
   * Check if URL is a video
   */
  private isVideoUrl(url: string): boolean {
    return /\.(mp4|mov|avi|wmv|flv|webm|mkv)$/i.test(url) || url.includes('video');
  }

  /**
   * Search Instagram locations
   */
  async searchLocations(account: ISocialAccount, query: string): Promise<InstagramLocation[]> {
    const accessToken = this.getAccessToken(account);

    try {
      const response = await this.httpClient.get(
        `${INSTAGRAM_API_BASE}/search`,
        {
          params: {
            type: 'place',
            q: query,
            access_token: accessToken,
          },
        }
      );

      return response.data.data || [];
    } catch (error: any) {
      logger.error('Failed to search Instagram locations', {
        query,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Search Instagram users for tagging
   */
  async searchUsers(account: ISocialAccount, query: string): Promise<InstagramUser[]> {
    const accessToken = this.getAccessToken(account);

    try {
      const response = await this.httpClient.get(
        `${INSTAGRAM_API_BASE}/search`,
        {
          params: {
            type: 'user',
            q: query,
            access_token: accessToken,
          },
        }
      );

      return response.data.data || [];
    } catch (error: any) {
      logger.error('Failed to search Instagram users', {
        query,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Validate aspect ratio for Instagram content
   */
  validateAspectRatio(aspectRatio: string, contentType: 'feed' | 'story' | 'reel'): boolean {
    const limits = this.getLimits();
    return limits.supportedAspectRatios[contentType].includes(aspectRatio);
  }

  /**
   * Count hashtags in content
   */
  countHashtags(content: string): number {
    const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
    const hashtags = content.match(hashtagRegex) || [];
    return hashtags.length;
  }
}
