/**
 * LinkedIn Publisher
 * 
 * Publishes posts to LinkedIn using LinkedIn API
 */

import { BasePublisher } from './BasePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { PublishPostOptions, PublishPostResult } from './IPublisher';
import { logger } from '../../utils/logger';

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';
const MAX_CONTENT_LENGTH = 3000;
const MAX_MEDIA_COUNT = 9;

export class LinkedInPublisher extends BasePublisher {
  readonly platform = 'linkedin';

  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [] } = options;

    this.validateContentLength(content, MAX_CONTENT_LENGTH);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    const accessToken = this.getAccessToken(account);
    const personUrn = `urn:li:person:${account.providerUserId}`;

    try {
      const payload: any = {
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: mediaIds.length > 0 ? 'IMAGE' : 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      if (mediaIds.length > 0) {
        payload.specificContent['com.linkedin.ugc.ShareContent'].media = mediaIds.map((id) => ({
          status: 'READY',
          media: id,
        }));
      }

      const response = await this.httpClient.post(`${LINKEDIN_API_BASE}/ugcPosts`, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      const postId = response.data.id;

      logger.info('LinkedIn post published successfully', {
        postId,
        accountId: account._id.toString(),
      });

      return {
        platformPostId: postId,
        metadata: response.data,
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishPost');
    }
  }

  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    // Placeholder: LinkedIn media upload requires multi-step process
    logger.warn('LinkedIn media upload not fully implemented');
    return [];
  }

  getLimits() {
    return {
      maxContentLength: MAX_CONTENT_LENGTH,
      maxMediaCount: MAX_MEDIA_COUNT,
      supportedMediaTypes: ['image/jpeg', 'image/png'],
    };
  }
}
