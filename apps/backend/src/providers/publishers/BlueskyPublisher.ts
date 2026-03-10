/**
 * Bluesky Publisher
 * 
 * Publishes posts to Bluesky using AT Protocol
 */

import { BskyAgent } from '@atproto/api';
import { BasePublisher } from './BasePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { PublishPostOptions, PublishPostResult } from './IPublisher';
import { logger } from '../../utils/logger';
import axios from 'axios';

const MAX_CONTENT_LENGTH = 300;
const MAX_MEDIA_COUNT = 4;

export class BlueskyPublisher extends BasePublisher {
  readonly platform = 'bluesky';
  private readonly service = 'https://bsky.social';

  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [] } = options;

    this.validateContentLength(content, MAX_CONTENT_LENGTH);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    const accessToken = this.getAccessToken(account);
    const refreshToken = account.refreshToken || '';

    try {
      // Create agent and resume session
      const agent = new BskyAgent({ service: this.service });
      
      await agent.resumeSession({
        accessJwt: accessToken,
        refreshJwt: refreshToken,
        did: account.providerUserId,
        handle: account.accountName,
      });

      // Prepare post record
      const postRecord: Record<string, any> = {
        text: content,
        createdAt: new Date().toISOString(),
      };

      // Upload and attach images if present
      if (mediaIds.length > 0) {
        const images = [];

        for (const mediaUrl of mediaIds) {
          try {
            // Download image
            const response = await axios.get(mediaUrl, {
              responseType: 'arraybuffer',
            });

            const imageBuffer = Buffer.from(response.data);
            const mimeType = response.headers['content-type'] || 'image/jpeg';

            // Upload blob to Bluesky
            const uploadResponse = await agent.uploadBlob(imageBuffer, {
              encoding: mimeType,
            });

            images.push({
              alt: '',
              image: uploadResponse.data.blob,
            });
          } catch (uploadError: any) {
            logger.error('Failed to upload image to Bluesky', {
              mediaUrl,
              error: uploadError.message,
            });
            // Continue with other images
          }
        }

        if (images.length > 0) {
          postRecord.embed = {
            $type: 'app.bsky.embed.images',
            images,
          };
        }
      }

      // Publish post
      const result = await agent.post(postRecord);

      logger.info('Bluesky post published successfully', {
        uri: result.uri,
        accountId: account._id.toString(),
      });

      // Extract post ID from URI (at://did/app.bsky.feed.post/postId)
      const postId = result.uri.split('/').pop() || result.uri;

      return {
        platformPostId: postId,
        url: `https://bsky.app/profile/${account.accountName}/post/${postId}`,
        metadata: {
          uri: result.uri,
          cid: result.cid,
        },
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishPost');
    }
  }

  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    // Bluesky handles media upload during post creation
    return mediaUrls;
  }

  getLimits() {
    return {
      maxContentLength: MAX_CONTENT_LENGTH,
      maxMediaCount: MAX_MEDIA_COUNT,
      supportedMediaTypes: ['image/jpeg', 'image/png'],
    };
  }
}
