/**
 * TikTok Publisher
 * 
 * Publishes videos to TikTok
 */

import { BasePublisher } from './BasePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { PublishPostOptions, PublishPostResult } from './IPublisher';
import { logger } from '../../utils/logger';

const MAX_CONTENT_LENGTH = 2200;
const MAX_MEDIA_COUNT = 1; // TikTok only supports single video

export class TikTokPublisher extends BasePublisher {
  readonly platform = 'tiktok';

  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [] } = options;

    this.validateContentLength(content, MAX_CONTENT_LENGTH);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    // Placeholder: TikTok API implementation
    logger.warn('TikTok publishing not fully implemented');

    throw new Error('TikTok publishing not yet implemented');
  }

  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    // Placeholder: TikTok media upload
    logger.warn('TikTok media upload not fully implemented');
    return [];
  }

  getLimits() {
    return {
      maxContentLength: MAX_CONTENT_LENGTH,
      maxMediaCount: MAX_MEDIA_COUNT,
      supportedMediaTypes: ['video/mp4'],
    };
  }
}
