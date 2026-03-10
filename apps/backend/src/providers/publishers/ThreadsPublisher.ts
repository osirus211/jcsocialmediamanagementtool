/**
 * Threads Publisher
 * 
 * Publishes posts to Threads using Graph API
 */

import { BasePublisher } from './BasePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { PublishPostOptions, PublishPostResult } from './IPublisher';
import { logger } from '../../utils/logger';

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';
const MAX_CONTENT_LENGTH = 500;
const MAX_MEDIA_COUNT = 10;

export class ThreadsPublisher extends BasePublisher {
  readonly platform = 'threads';

  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [] } = options;

    this.validateContentLength(content, MAX_CONTENT_LENGTH);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    const accessToken = this.getAccessToken(account);
    const userId = account.providerUserId;

    try {
      // Step 1: Create container
      let containerPayload: Record<string, string> = {
        access_token: accessToken,
      };

      if (mediaIds.length === 0) {
        // Text-only post
        containerPayload.media_type = 'TEXT';
        containerPayload.text = content;
      } else {
        // Media post
        const mediaUrl = mediaIds[0];
        const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('video');

        if (isVideo) {
          containerPayload.media_type = 'VIDEO';
          containerPayload.video_url = mediaUrl;
        } else {
          containerPayload.media_type = 'IMAGE';
          containerPayload.image_url = mediaUrl;
        }
        containerPayload.text = content;
      }

      const containerResponse = await this.httpClient.post(
        `${THREADS_API_BASE}/${userId}/threads`,
        containerPayload
      );

      const containerId = containerResponse.data.id;

      // Step 2: Publish container
      const publishResponse = await this.httpClient.post(
        `${THREADS_API_BASE}/${userId}/threads_publish`,
        {
          creation_id: containerId,
          access_token: accessToken,
        }
      );

      const postId = publishResponse.data.id;

      logger.info('Threads post published successfully', {
        postId,
        accountId: account._id.toString(),
      });

      return {
        platformPostId: postId,
        url: `https://threads.net/@${account.accountName}/post/${postId}`,
        metadata: publishResponse.data,
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishPost');
    }
  }

  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    // Threads uses URLs directly, no upload needed
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
