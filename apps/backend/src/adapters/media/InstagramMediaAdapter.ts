/**
 * Instagram Media Adapter
 * 
 * Handles Instagram-specific media uploads
 * Instagram uses container-based publishing (create container → publish)
 */

import { IMediaAdapter, MediaUploadOptions, MediaUploadResult } from './IMediaAdapter';
import { ISocialAccount } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';
import axios from 'axios';

const INSTAGRAM_API_BASE = 'https://graph.facebook.com/v21.0';

export class InstagramMediaAdapter implements IMediaAdapter {
  readonly platform = 'instagram';

  requiresPreUpload(): boolean {
    return true;
  }

  async uploadMedia(account: ISocialAccount, options: MediaUploadOptions): Promise<MediaUploadResult> {
    const accessToken = account.getDecryptedAccessToken();
    const instagramAccountId = account.metadata?.instagramAccountId || account.providerUserId;

    try {
      // Instagram uses a two-step process:
      // 1. Create media container
      // 2. Publish container (done in publisher)
      
      const containerResponse = await axios.post(
        `${INSTAGRAM_API_BASE}/${instagramAccountId}/media`,
        {
          image_url: options.fileUrl,
          caption: options.caption || '',
          access_token: accessToken,
        }
      );

      const containerId = containerResponse.data.id;

      logger.info('Instagram media container created', {
        containerId,
        platform: this.platform,
      });

      return {
        platformMediaId: containerId,
        uploadedAt: new Date(),
        metadata: {
          containerId,
          status: 'container_created',
        },
      };
    } catch (error: any) {
      logger.error('Instagram media upload failed', {
        error: error.message,
        platform: this.platform,
        mediaType: options.mediaType,
      });
      throw error;
    }
  }
}
