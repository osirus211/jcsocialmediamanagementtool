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

const INSTAGRAM_API_BASE = 'https://graph.facebook.com/v18.0';
const MAX_CONTENT_LENGTH = 2200;
const MAX_MEDIA_COUNT = 10;

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

    // Default: regular post
    this.validateContentLength(content, MAX_CONTENT_LENGTH);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    const accessToken = this.getAccessToken(account);
    const instagramAccountId = account.providerUserId;

    try {
      // Create media container
      const containerResponse = await this.httpClient.post(
        `${INSTAGRAM_API_BASE}/${instagramAccountId}/media`,
        {
          image_url: mediaIds[0], // Instagram requires at least one image
          caption: content,
          access_token: accessToken,
        }
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

      logger.info('Instagram post published successfully', {
        postId,
        accountId: account._id.toString(),
      });

      return {
        platformPostId: postId,
        url: `https://instagram.com/p/${postId}`,
        metadata: publishResponse.data,
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishPost');
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
        caption: content,
        share_to_feed: true, // Default to true
        access_token: accessToken,
      };

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

      logger.info('Instagram reel published successfully', {
        reelId,
        accountId: account._id.toString(),
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
      supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4'],
    };
  }
}
