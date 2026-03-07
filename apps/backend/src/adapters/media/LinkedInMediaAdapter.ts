/**
 * LinkedIn Media Adapter
 * 
 * Handles LinkedIn-specific media uploads
 * LinkedIn uses asset registration and upload
 */

import { IMediaAdapter, MediaUploadOptions, MediaUploadResult } from './IMediaAdapter';
import { ISocialAccount } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';
import axios from 'axios';

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';

export class LinkedInMediaAdapter implements IMediaAdapter {
  readonly platform = 'linkedin';

  requiresPreUpload(): boolean {
    return true;
  }

  async uploadMedia(account: ISocialAccount, options: MediaUploadOptions): Promise<MediaUploadResult> {
    const accessToken = account.getDecryptedAccessToken();
    const personUrn = account.metadata?.personUrn || `urn:li:person:${account.providerUserId}`;

    try {
      // Step 1: Register upload
      const registerResponse = await axios.post(
        `${LINKEDIN_API_BASE}/assets?action=registerUpload`,
        {
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: personUrn,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const uploadUrl = registerResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const asset = registerResponse.data.value.asset;

      // Step 2: Upload media to the provided URL
      const mediaResponse = await axios.get(options.fileUrl, {
        responseType: 'arraybuffer',
      });
      const mediaBuffer = Buffer.from(mediaResponse.data);

      await axios.put(uploadUrl, mediaBuffer, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      logger.info('LinkedIn media uploaded', {
        asset,
        platform: this.platform,
      });

      return {
        platformMediaId: asset,
        uploadedAt: new Date(),
        metadata: {
          asset,
          uploadUrl,
        },
      };
    } catch (error: any) {
      logger.error('LinkedIn media upload failed', {
        error: error.message,
        platform: this.platform,
        mediaType: options.mediaType,
      });
      throw error;
    }
  }
}
