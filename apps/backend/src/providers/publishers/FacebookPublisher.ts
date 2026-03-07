/**
 * Facebook Publisher
 * 
 * Publishes posts to Facebook using Graph API
 */

import { BasePublisher } from './BasePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { PublishPostOptions, PublishPostResult } from './IPublisher';
import { logger } from '../../utils/logger';

const FACEBOOK_API_BASE = 'https://graph.facebook.com/v18.0';
const MAX_CONTENT_LENGTH = 63206;
const MAX_MEDIA_COUNT = 10;

export class FacebookPublisher extends BasePublisher {
  readonly platform = 'facebook';

  /**
   * Publish post to Facebook
   */
  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [] } = options;

    this.validateContentLength(content, MAX_CONTENT_LENGTH);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    const accessToken = this.getAccessToken(account);
    const pageId = account.metadata?.pageId || account.providerUserId;

    try {
      const payload: any = {
        message: content,
        access_token: accessToken,
      };

      // Add media if present
      if (mediaIds.length > 0) {
        payload.attached_media = mediaIds.map((id) => ({ media_fbid: id }));
      }

      const response = await this.httpClient.post(
        `${FACEBOOK_API_BASE}/${pageId}/feed`,
        payload
      );

      const postId = response.data.id;

      logger.info('Facebook post published successfully', {
        postId,
        accountId: account._id.toString(),
      });

      return {
        platformPostId: postId,
        url: `https://facebook.com/${postId}`,
        metadata: response.data,
      };
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

  getLimits() {
    return {
      maxContentLength: MAX_CONTENT_LENGTH,
      maxMediaCount: MAX_MEDIA_COUNT,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
    };
  }
}
