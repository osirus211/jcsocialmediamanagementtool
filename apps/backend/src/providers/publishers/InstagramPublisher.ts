/**
 * Instagram Publisher
 * 
 * Publishes posts to Instagram using Graph API
 */

import { BasePublisher } from './BasePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { PublishPostOptions, PublishPostResult } from './IPublisher';
import { logger } from '../../utils/logger';

const INSTAGRAM_API_BASE = 'https://graph.facebook.com/v18.0';
const MAX_CONTENT_LENGTH = 2200;
const MAX_MEDIA_COUNT = 10;

export class InstagramPublisher extends BasePublisher {
  readonly platform = 'instagram';

  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [] } = options;

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
