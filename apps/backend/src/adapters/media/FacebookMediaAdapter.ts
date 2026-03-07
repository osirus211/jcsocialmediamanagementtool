/**
 * Facebook Media Adapter
 * 
 * Handles Facebook-specific media uploads
 * Facebook requires media to be uploaded before posting
 */

import { IMediaAdapter, MediaUploadOptions, MediaUploadResult } from './IMediaAdapter';
import { ISocialAccount } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';
import axios from 'axios';

const FACEBOOK_API_BASE = 'https://graph.facebook.com/v18.0';

export class FacebookMediaAdapter implements IMediaAdapter {
  readonly platform = 'facebook';

  requiresPreUpload(): boolean {
    return true;
  }

  async uploadMedia(account: ISocialAccount, options: MediaUploadOptions): Promise<MediaUploadResult> {
    const accessToken = account.getDecryptedAccessToken();
    const pageId = account.metadata?.pageId || account.providerUserId;

    try {
      if (options.mediaType === 'image' || options.mediaType === 'gif') {
        return await this.uploadPhoto(pageId, accessToken, options.fileUrl);
      } else if (options.mediaType === 'video') {
        return await this.uploadVideo(pageId, accessToken, options.fileUrl);
      } else {
        throw new Error(`Unsupported media type: ${options.mediaType}`);
      }
    } catch (error: any) {
      logger.error('Facebook media upload failed', {
        error: error.message,
        platform: this.platform,
        mediaType: options.mediaType,
      });
      throw error;
    }
  }

  private async uploadPhoto(pageId: string, accessToken: string, fileUrl: string): Promise<MediaUploadResult> {
    const response = await axios.post(
      `${FACEBOOK_API_BASE}/${pageId}/photos`,
      {
        url: fileUrl,
        published: false,
        access_token: accessToken,
      }
    );

    const mediaId = response.data.id;

    logger.info('Facebook photo uploaded', {
      mediaId,
      platform: this.platform,
    });

    return {
      platformMediaId: mediaId,
      uploadedAt: new Date(),
      metadata: response.data,
    };
  }

  private async uploadVideo(pageId: string, accessToken: string, fileUrl: string): Promise<MediaUploadResult> {
    const response = await axios.post(
      `${FACEBOOK_API_BASE}/${pageId}/videos`,
      {
        file_url: fileUrl,
        published: false,
        access_token: accessToken,
      }
    );

    const mediaId = response.data.id;

    logger.info('Facebook video uploaded', {
      mediaId,
      platform: this.platform,
    });

    return {
      platformMediaId: mediaId,
      uploadedAt: new Date(),
      metadata: response.data,
    };
  }
}
