/**
 * Twitter Media Adapter
 * 
 * Handles Twitter-specific media uploads
 * Twitter requires chunked upload for media
 */

import { IMediaAdapter, MediaUploadOptions, MediaUploadResult } from './IMediaAdapter';
import { ISocialAccount } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';
import axios from 'axios';
import FormData from 'form-data';

const TWITTER_UPLOAD_BASE = 'https://upload.twitter.com/1.1';

export class TwitterMediaAdapter implements IMediaAdapter {
  readonly platform = 'twitter';

  requiresPreUpload(): boolean {
    return true;
  }

  async uploadMedia(account: ISocialAccount, options: MediaUploadOptions): Promise<MediaUploadResult> {
    const accessToken = account.getDecryptedAccessToken();

    try {
      // Download media file
      const mediaResponse = await axios.get(options.fileUrl, {
        responseType: 'arraybuffer',
      });
      const mediaBuffer = Buffer.from(mediaResponse.data);

      // Determine media type
      const mediaType = options.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

      // INIT
      const initResponse = await axios.post(
        `${TWITTER_UPLOAD_BASE}/media/upload.json`,
        {
          command: 'INIT',
          total_bytes: mediaBuffer.length,
          media_type: mediaType,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const mediaId = initResponse.data.media_id_string;

      // APPEND
      const formData = new FormData();
      formData.append('command', 'APPEND');
      formData.append('media_id', mediaId);
      formData.append('media', mediaBuffer);
      formData.append('segment_index', '0');

      await axios.post(
        `${TWITTER_UPLOAD_BASE}/media/upload.json`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...formData.getHeaders(),
          },
        }
      );

      // FINALIZE
      await axios.post(
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

      logger.info('Twitter media uploaded', {
        mediaId,
        platform: this.platform,
      });

      return {
        platformMediaId: mediaId,
        uploadedAt: new Date(),
        metadata: {
          mediaId,
          mediaType,
        },
      };
    } catch (error: any) {
      logger.error('Twitter media upload failed', {
        error: error.message,
        platform: this.platform,
        mediaType: options.mediaType,
      });
      throw error;
    }
  }
}
