/**
 * Facebook Publisher
 * 
 * Publishes posts to Facebook using Graph API v21.0
 * 
 * Supported Post Types:
 * - Text posts
 * - Photo posts (single and albums)
 * - Video posts
 * - Facebook Reels
 * - Stories (photo and video)
 * - Link posts
 * - Scheduled posts
 */

import { BasePublisher } from './BasePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { PublishPostOptions, PublishPostResult } from './IPublisher';
import { logger } from '../../utils/logger';

const FACEBOOK_API_BASE = 'https://graph.facebook.com/v21.0';
const MAX_CONTENT_LENGTH = 63206;
const MAX_MEDIA_COUNT = 10;

export interface FacebookPublishOptions extends PublishPostOptions {
  postType?: 'feed' | 'photo' | 'video' | 'reel' | 'story' | 'link' | 'album';
  link?: string;
  scheduledPublishTime?: number; // Unix timestamp
  published?: boolean; // For draft posts
}

export class FacebookPublisher extends BasePublisher {
  readonly platform = 'facebook';

  /**
   * Publish post to Facebook
   */
  async publishPost(account: ISocialAccount, options: FacebookPublishOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [], postType = 'feed', link, scheduledPublishTime, published = true } = options;

    this.validateContentLength(content, MAX_CONTENT_LENGTH);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    const accessToken = this.getAccessToken(account);
    const pageId = account.metadata?.pageId || account.providerUserId;

    try {
      // Route to specific post type handler
      switch (postType) {
        case 'photo':
          return await this.publishPhotoPost(account, options);
        case 'video':
          return await this.publishVideoPost(account, options);
        case 'reel':
          return await this.publishReel(account, options);
        case 'story':
          return await this.publishStory(account, options);
        case 'link':
          return await this.publishLinkPost(account, options);
        case 'album':
          return await this.publishAlbumPost(account, options);
        default:
          return await this.publishTextPost(account, options);
      }
    } catch (error: any) {
      this.handleApiError(error, 'publishPost');
    }
  }

  /**
   * Upload media to Facebook
   */
  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    const accessToken = this.getAccessToken(account);
    const pageId = account.metadata?.pageId || account.providerUserId;
    const mediaIds: string[] = [];

    for (const url of mediaUrls) {
      try {
        const response = await this.httpClient.post(
          `${FACEBOOK_API_BASE}/${pageId}/photos`,
          {
            url,
            published: false,
            access_token: accessToken,
          }
        );

        const mediaId = response.data.id;
        mediaIds.push(mediaId);

        logger.info('Media uploaded to Facebook', {
          mediaId,
          url,
        });
      } catch (error: any) {
        this.handleApiError(error, 'uploadMedia');
      }
    }

    return mediaIds;
  }

  /**
   * Publish text post to Facebook page
   */
  async publishTextPost(account: ISocialAccount, options: FacebookPublishOptions): Promise<PublishPostResult> {
    const { content, scheduledPublishTime, published = true } = options;
    const accessToken = this.getAccessToken(account);
    const pageId = account.metadata?.pageId || account.providerUserId;

    const payload: any = {
      message: content,
      published,
      access_token: accessToken,
    };

    if (scheduledPublishTime) {
      payload.scheduled_publish_time = scheduledPublishTime;
      payload.published = false;
    }

    const response = await this.httpClient.post(
      `${FACEBOOK_API_BASE}/${pageId}/feed`,
      payload
    );

    const postId = response.data.id;

    logger.info('Facebook text post published', {
      postId,
      scheduled: !!scheduledPublishTime,
      accountId: account._id.toString(),
    });

    return {
      platformPostId: postId,
      url: `https://facebook.com/${postId}`,
      metadata: response.data,
    };
  }

  /**
   * Publish photo post to Facebook page
   */
  async publishPhotoPost(account: ISocialAccount, options: FacebookPublishOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [], scheduledPublishTime, published = true, metadata } = options;
    const accessToken = this.getAccessToken(account);
    const pageId = account.metadata?.pageId || account.providerUserId;

    if (mediaIds.length === 0) {
      throw new Error('Photo post requires at least one media item');
    }

    const altTexts = (metadata?.altTexts as string[]) || [];

    const payload: any = {
      url: mediaIds[0], // Assuming mediaIds contain URLs for photos
      caption: content,
      published,
      access_token: accessToken,
    };

    // Add alt text if provided
    if (altTexts[0]) {
      payload.alt_text_custom = altTexts[0];
    }

    if (scheduledPublishTime) {
      payload.scheduled_publish_time = scheduledPublishTime;
      payload.published = false;
    }

    const response = await this.httpClient.post(
      `${FACEBOOK_API_BASE}/${pageId}/photos`,
      payload
    );

    const postId = response.data.id;

    logger.info('Facebook photo post published', {
      postId,
      scheduled: !!scheduledPublishTime,
      hasAltText: !!altTexts[0],
      accountId: account._id.toString(),
    });

    return {
      platformPostId: postId,
      url: `https://facebook.com/${postId}`,
      metadata: response.data,
    };
  }

  /**
   * Publish album (multiple photos) to Facebook page
   */
  async publishAlbumPost(account: ISocialAccount, options: FacebookPublishOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [], scheduledPublishTime, published = true, metadata } = options;
    const accessToken = this.getAccessToken(account);
    const pageId = account.metadata?.pageId || account.providerUserId;

    if (mediaIds.length < 2) {
      throw new Error('Album post requires at least 2 media items');
    }

    const altTexts = (metadata?.altTexts as string[]) || [];

    // Step 1: Upload all photos as unpublished with alt text
    const uploadedMediaIds: string[] = [];
    for (let i = 0; i < mediaIds.length; i++) {
      const mediaUrl = mediaIds[i];
      const altText = altTexts[i];

      const photoPayload: any = {
        url: mediaUrl,
        published: false,
        access_token: accessToken,
      };

      // Add alt text if provided
      if (altText) {
        photoPayload.alt_text_custom = altText;
      }

      const response = await this.httpClient.post(
        `${FACEBOOK_API_BASE}/${pageId}/photos`,
        photoPayload
      );
      uploadedMediaIds.push(response.data.id);
    }

    // Step 2: Create feed post with attached media
    const payload: any = {
      message: content,
      attached_media: uploadedMediaIds.map(id => ({ media_fbid: id })),
      published,
      access_token: accessToken,
    };

    if (scheduledPublishTime) {
      payload.scheduled_publish_time = scheduledPublishTime;
      payload.published = false;
    }

    const response = await this.httpClient.post(
      `${FACEBOOK_API_BASE}/${pageId}/feed`,
      payload
    );

    const postId = response.data.id;

    logger.info('Facebook album post published', {
      postId,
      mediaCount: uploadedMediaIds.length,
      scheduled: !!scheduledPublishTime,
      hasAltText: altTexts.some(text => !!text),
      accountId: account._id.toString(),
    });

    return {
      platformPostId: postId,
      url: `https://facebook.com/${postId}`,
      metadata: response.data,
    };
  }

  /**
   * Publish video post to Facebook page
   */
  async publishVideoPost(account: ISocialAccount, options: FacebookPublishOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [], scheduledPublishTime, published = true } = options;
    const accessToken = this.getAccessToken(account);
    const pageId = account.metadata?.pageId || account.providerUserId;

    if (mediaIds.length === 0) {
      throw new Error('Video post requires a video file');
    }

    const payload: any = {
      file_url: mediaIds[0], // Assuming mediaIds contain URLs for videos
      description: content,
      title: content.substring(0, 100), // Facebook video title limit
      published,
      access_token: accessToken,
    };

    if (scheduledPublishTime) {
      payload.scheduled_publish_time = scheduledPublishTime;
      payload.published = false;
    }

    const response = await this.httpClient.post(
      `${FACEBOOK_API_BASE}/${pageId}/videos`,
      payload
    );

    const postId = response.data.id;

    logger.info('Facebook video post published', {
      postId,
      scheduled: !!scheduledPublishTime,
      accountId: account._id.toString(),
    });

    return {
      platformPostId: postId,
      url: `https://facebook.com/${postId}`,
      metadata: response.data,
    };
  }

  /**
   * Publish Facebook Reel
   */
  async publishReel(account: ISocialAccount, options: FacebookPublishOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [] } = options;
    const accessToken = this.getAccessToken(account);
    const pageId = account.metadata?.pageId || account.providerUserId;

    if (mediaIds.length === 0) {
      throw new Error('Reel requires a video file');
    }

    // Step 1: Start upload session
    const startResponse = await this.httpClient.post(
      `${FACEBOOK_API_BASE}/${pageId}/video_reels`,
      {
        upload_phase: 'start',
        access_token: accessToken,
      }
    );

    const videoId = startResponse.data.video_id;
    const uploadUrl = startResponse.data.upload_url;

    // Step 2: Upload video (simplified - in production, handle chunked upload)
    // This would typically involve uploading the video file to the upload_url

    // Step 3: Finish upload and publish
    const response = await this.httpClient.post(
      `${FACEBOOK_API_BASE}/${pageId}/video_reels`,
      {
        video_id: videoId,
        upload_phase: 'finish',
        description: content,
        published: true,
        access_token: accessToken,
      }
    );

    const postId = response.data.id;

    logger.info('Facebook Reel published', {
      postId,
      videoId,
      accountId: account._id.toString(),
    });

    return {
      platformPostId: postId,
      url: `https://facebook.com/reel/${postId}`,
      metadata: response.data,
    };
  }

  /**
   * Publish Story to Facebook page
   */
  async publishStory(account: ISocialAccount, options: FacebookPublishOptions): Promise<PublishPostResult> {
    const { mediaIds = [] } = options;
    const accessToken = this.getAccessToken(account);
    const pageId = account.metadata?.pageId || account.providerUserId;

    if (mediaIds.length === 0) {
      throw new Error('Story requires media (photo or video)');
    }

    const mediaUrl = mediaIds[0];
    const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('.mov');

    const endpoint = isVideo ? 'video_stories' : 'photo_stories';
    const payload: any = {
      access_token: accessToken,
    };

    if (isVideo) {
      payload.video_url = mediaUrl;
    } else {
      payload.photo_url = mediaUrl;
    }

    const response = await this.httpClient.post(
      `${FACEBOOK_API_BASE}/${pageId}/${endpoint}`,
      payload
    );

    const storyId = response.data.id;

    logger.info('Facebook Story published', {
      storyId,
      type: isVideo ? 'video' : 'photo',
      accountId: account._id.toString(),
    });

    return {
      platformPostId: storyId,
      url: `https://facebook.com/story/${storyId}`,
      metadata: response.data,
    };
  }

  /**
   * Publish link post to Facebook page
   */
  async publishLinkPost(account: ISocialAccount, options: FacebookPublishOptions): Promise<PublishPostResult> {
    const { content, link, scheduledPublishTime, published = true } = options;
    const accessToken = this.getAccessToken(account);
    const pageId = account.metadata?.pageId || account.providerUserId;

    if (!link) {
      throw new Error('Link post requires a URL');
    }

    const payload: any = {
      message: content,
      link,
      published,
      access_token: accessToken,
    };

    if (scheduledPublishTime) {
      payload.scheduled_publish_time = scheduledPublishTime;
      payload.published = false;
    }

    const response = await this.httpClient.post(
      `${FACEBOOK_API_BASE}/${pageId}/feed`,
      payload
    );

    const postId = response.data.id;

    logger.info('Facebook link post published', {
      postId,
      link,
      scheduled: !!scheduledPublishTime,
      accountId: account._id.toString(),
    });

    return {
      platformPostId: postId,
      url: `https://facebook.com/${postId}`,
      metadata: response.data,
    };
  }

  /**
   * Delete Facebook post
   */
  async deletePost(account: ISocialAccount, platformPostId: string): Promise<void> {
    const accessToken = this.getAccessToken(account);

    try {
      await this.httpClient.delete(
        `${FACEBOOK_API_BASE}/${platformPostId}`,
        {
          params: {
            access_token: accessToken,
          },
        }
      );

      logger.info('Facebook post deleted', {
        postId: platformPostId,
        accountId: account._id.toString(),
      });
    } catch (error: any) {
      this.handleApiError(error, 'deletePost');
    }
  }

  /**
   * Schedule post for later publishing
   */
  async schedulePost(account: ISocialAccount, options: FacebookPublishOptions, publishTime: Date): Promise<PublishPostResult> {
    const scheduledPublishTime = Math.floor(publishTime.getTime() / 1000);
    
    return await this.publishPost(account, {
      ...options,
      scheduledPublishTime,
      published: false,
    });
  }

  getLimits() {
    return {
      maxContentLength: MAX_CONTENT_LENGTH,
      maxMediaCount: MAX_MEDIA_COUNT,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/mov'],
      supportedPostTypes: ['feed', 'photo', 'video', 'reel', 'story', 'link', 'album'],
      supportsScheduling: true,
      supportsAnalytics: true,
    };
  }
}
