/**
 * Twitter Publisher
 * 
 * Publishes posts to Twitter using Twitter API v2
 */

import { BasePublisher } from './BasePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { PublishPostOptions, PublishPostResult } from './IPublisher';
import { logger } from '../../utils/logger';
import FormData from 'form-data';

const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_UPLOAD_BASE = 'https://upload.twitter.com/1.1';
const MAX_CONTENT_LENGTH = 280;
const MAX_MEDIA_COUNT = 4;

export class TwitterPublisher extends BasePublisher {
  readonly platform = 'twitter';

  /**
   * Publish post to Twitter
   */
  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [] } = options;

    // Validate content length
    this.validateContentLength(content, MAX_CONTENT_LENGTH);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    const accessToken = this.getAccessToken(account);

    try {
      const payload: any = {
        text: content,
      };

      if (mediaIds.length > 0) {
        payload.media = {
          media_ids: mediaIds,
        };
      }

      const response = await this.httpClient.post(
        `${TWITTER_API_BASE}/tweets`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const tweetId = response.data.data.id;

      logger.info('Tweet published successfully', {
        tweetId,
        accountId: account._id.toString(),
      });

      return {
        platformPostId: tweetId,
        url: `https://twitter.com/i/web/status/${tweetId}`,
        metadata: response.data.data,
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishPost');
    }
  }

  /**
   * Upload media to Twitter
   */
  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    const accessToken = this.getAccessToken(account);
    const mediaIds: string[] = [];

    for (const url of mediaUrls) {
      try {
        const mediaBuffer = await this.downloadMedia(url);
        const mediaType = this.getMediaType(url);

        // Initialize upload
        const initResponse = await this.httpClient.post(
          `${TWITTER_UPLOAD_BASE}/media/upload.json`,
          {
            command: 'INIT',
            total_bytes: mediaBuffer.length,
            media_type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const mediaId = initResponse.data.media_id_string;

        // Upload media
        const formData = new FormData();
        formData.append('command', 'APPEND');
        formData.append('media_id', mediaId);
        formData.append('media', mediaBuffer);
        formData.append('segment_index', '0');

        await this.httpClient.post(
          `${TWITTER_UPLOAD_BASE}/media/upload.json`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              ...formData.getHeaders(),
            },
          }
        );

        // Finalize upload
        await this.httpClient.post(
          `${TWITTER_UPLOAD_BASE}/media/upload.json`,
          {
            command: 'FINALIZE',
            media_id: mediaId,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        mediaIds.push(mediaId);

        logger.info('Media uploaded to Twitter', {
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
   * Get platform limits
   */
  getLimits() {
    return {
      maxContentLength: MAX_CONTENT_LENGTH,
      maxMediaCount: MAX_MEDIA_COUNT,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
    };
  }
}
