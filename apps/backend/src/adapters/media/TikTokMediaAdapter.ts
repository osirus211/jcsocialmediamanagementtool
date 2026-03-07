/**
 * TikTok Media Adapter
 * 
 * Handles TikTok-specific media uploads
 * TikTok requires video upload before posting
 */

import { IMediaAdapter, MediaUploadOptions, MediaUploadResult } from './IMediaAdapter';
import { ISocialAccount } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';
import axios from 'axios';

const TIKTOK_API_BASE = 'https://open-api.tiktok.com';

export class TikTokMediaAdapter implements IMediaAdapter {
  readonly platform = 'tiktok';

  requiresPreUpload(): boolean {
    return true;
  }

  async uploadMedia(account: ISocialAccount, options: MediaUploadOptions): Promise<MediaUploadResult> {
    const accessToken = account.getDecryptedAccessToken();

    try {
      // TikTok only supports video uploads
      if (options.mediaType !== 'video') {
        throw new Error('TikTok only supports video uploads');
      }

      // Step 1: Initialize upload
      const initResponse = await axios.post(
        `${TIKTOK_API_BASE}/share/video/upload/`,
        {
          video_url: options.fileUrl,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const uploadId = initResponse.data.data.upload_id;

      logger.info('TikTok media upload initiated', {
        uploadId,
        platform: this.platform,
      });

      return {
        platformMediaId: uploadId,
        uploadedAt: new Date(),
        metadata: {
          uploadId,
          status: 'upload_initiated',
        },
      };
    } catch (error: any) {
      logger.error('TikTok media upload failed', {
        error: error.message,
        platform: this.platform,
        mediaType: options.mediaType,
      });
      throw error;
    }
  }
}
