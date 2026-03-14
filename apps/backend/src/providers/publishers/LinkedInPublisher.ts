/**
 * LinkedIn Publisher
 * 
 * Complete LinkedIn publishing implementation using LinkedIn API v2
 * Supports text, image, video, document, and poll posts
 * Works with both personal profiles and company pages
 */

import { BasePublisher } from './BasePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { PublishPostOptions, PublishPostResult } from './IPublisher';
import { logger } from '../../utils/logger';
import axios from 'axios';
import FormData from 'form-data';

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';
const MAX_CONTENT_LENGTH = 3000;
const MAX_MEDIA_COUNT = 9;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DOCUMENT_SIZE = 100 * 1024 * 1024; // 100MB

interface LinkedInMediaAsset {
  asset: string;
  status: string;
  media?: string;
  altText?: string;
}

interface LinkedInUploadResponse {
  value: {
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        uploadUrl: string;
        headers: Record<string, string>;
      };
    };
    asset: string;
  };
}

export class LinkedInPublisher extends BasePublisher {
  readonly platform = 'linkedin';

  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [], metadata } = options;

    this.validateContentLength(content, MAX_CONTENT_LENGTH);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    const accessToken = this.getAccessToken(account);
    const authorUrn = this.getAuthorUrn(account);

    try {
      // Upload media with alt text if provided
      const mediaAssets: LinkedInMediaAsset[] = [];
      if (mediaIds.length > 0) {
        const altTexts = (metadata?.altTexts as string[]) || [];
        
        for (let i = 0; i < mediaIds.length; i++) {
          const mediaUrl = mediaIds[i];
          const altText = altTexts[i];
          
          const asset = await this.uploadMediaFromUrl(accessToken, authorUrn, mediaUrl);
          if (altText) {
            asset.altText = altText;
          }
          mediaAssets.push(asset);
        }
      }

      // Build UGC post payload
      const payload = this.buildUGCPost(authorUrn, content, mediaAssets);

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
        hasMedia: mediaAssets.length > 0,
        hasAltText: mediaAssets.some(asset => !!asset.altText),
      });

      return {
        platformPostId: postId,
        metadata: response.data,
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishPost');
    }
  }

  /**
   * Upload media to LinkedIn (required by BasePublisher)
   */
  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    const accessToken = this.getAccessToken(account);
    const authorUrn = this.getAuthorUrn(account);
    const mediaAssets = await this.uploadMediaFromUrls(accessToken, authorUrn, mediaUrls);
    return mediaAssets.map(asset => asset.asset);
  }

  /**
   * Publish text-only post
   */
  async publishTextPost(account: ISocialAccount, post: { content: string }): Promise<PublishPostResult> {
    return this.publishPost(account, { content: post.content });
  }

  /**
   * Publish image post
   */
  async publishImagePost(account: ISocialAccount, post: { content: string; imageUrls: string[] }): Promise<PublishPostResult> {
    const accessToken = this.getAccessToken(account);
    const authorUrn = this.getAuthorUrn(account);
    
    // Upload images first
    const uploadedMediaAssets = await this.uploadMediaFromUrls(accessToken, authorUrn, post.imageUrls);
    
    // Build UGC post with media
    const payload = this.buildUGCPost(authorUrn, post.content, uploadedMediaAssets);

    const response = await this.httpClient.post(`${LINKEDIN_API_BASE}/ugcPosts`, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    return {
      platformPostId: response.data.id,
      metadata: response.data,
    };
  }

  /**
   * Publish video post
   */
  async publishVideoPost(account: ISocialAccount, post: { content: string; videoUrl: string }): Promise<PublishPostResult> {
    const accessToken = this.getAccessToken(account);
    const authorUrn = this.getAuthorUrn(account);
    
    // Upload video first
    const uploadedMediaAssets = await this.uploadMediaFromUrls(accessToken, authorUrn, [post.videoUrl]);
    
    // Build UGC post with media
    const payload = this.buildUGCPost(authorUrn, post.content, uploadedMediaAssets);

    const response = await this.httpClient.post(`${LINKEDIN_API_BASE}/ugcPosts`, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    return {
      platformPostId: response.data.id,
      metadata: response.data,
    };
  }

  /**
   * Publish document post (PDF, etc.)
   */
  async publishDocumentPost(account: ISocialAccount, post: { content: string; documentUrl: string }): Promise<PublishPostResult> {
    const accessToken = this.getAccessToken(account);
    const authorUrn = this.getAuthorUrn(account);

    try {
      // Upload document
      const documentAsset = await this.uploadDocument(accessToken, authorUrn, post.documentUrl);

      // Build UGC post with document
      const payload = this.buildUGCPost(authorUrn, post.content, [documentAsset]);

      const response = await this.httpClient.post(`${LINKEDIN_API_BASE}/ugcPosts`, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      const postId = response.data.id;

      logger.info('LinkedIn document post published successfully', {
        postId,
        accountId: account._id.toString(),
      });

      return {
        platformPostId: postId,
        metadata: response.data,
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishDocumentPost');
    }
  }

  /**
   * Publish poll post
   * Note: LinkedIn API doesn't support poll creation via API
   * This creates a text post with poll-like content
   */
  async publishPollPost(account: ISocialAccount, post: { content: string; question: string; options: string[] }): Promise<PublishPostResult> {
    // Format poll as text since LinkedIn API doesn't support polls
    const pollContent = `${post.content}\n\n${post.question}\n\n${post.options.map((option, index) => `${index + 1}. ${option}`).join('\n')}\n\nComment with your choice!`;
    
    return this.publishTextPost(account, { content: pollContent });
  }

  /**
   * Publish multi-image post (carousel)
   */
  async publishMultiImagePost(account: ISocialAccount, post: { content: string; imageUrls: string[] }): Promise<PublishPostResult> {
    return this.publishImagePost(account, { 
      content: post.content, 
      imageUrls: post.imageUrls 
    });
  }

  /**
   * Upload media from URLs
   */
  private async uploadMediaFromUrls(accessToken: string, ownerUrn: string, mediaUrls: string[]): Promise<LinkedInMediaAsset[]> {
    const assets: LinkedInMediaAsset[] = [];

    for (const mediaUrl of mediaUrls) {
      try {
        const asset = await this.uploadMediaFromUrl(accessToken, ownerUrn, mediaUrl);
        assets.push(asset);
      } catch (error: any) {
        logger.error('Failed to upload media to LinkedIn', {
          mediaUrl,
          error: error.message,
        });
        throw error;
      }
    }

    return assets;
  }

  /**
   * Upload single media file from URL
   */
  private async uploadMediaFromUrl(accessToken: string, ownerUrn: string, mediaUrl: string): Promise<LinkedInMediaAsset> {
    // Determine media type
    const isVideo = this.isVideoUrl(mediaUrl);
    const isImage = this.isImageUrl(mediaUrl);
    const isDocument = this.isDocumentUrl(mediaUrl);

    if (isVideo) {
      return this.uploadVideo(accessToken, ownerUrn, mediaUrl);
    } else if (isImage) {
      return this.uploadImage(accessToken, ownerUrn, mediaUrl);
    } else if (isDocument) {
      return this.uploadDocument(accessToken, ownerUrn, mediaUrl);
    } else {
      throw new Error(`Unsupported media type for URL: ${mediaUrl}`);
    }
  }

  /**
   * Upload image to LinkedIn
   */
  async uploadImage(accessToken: string, ownerUrn: string, imageUrl: string): Promise<LinkedInMediaAsset> {
    try {
      // Step 1: Register upload
      const registerResponse = await this.httpClient.post(
        `${LINKEDIN_API_BASE}/assets?action=registerUpload`,
        {
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: ownerUrn,
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
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      const uploadData = registerResponse.data as LinkedInUploadResponse;
      const uploadUrl = uploadData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const assetId = uploadData.value.asset;

      // Step 2: Download image
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);

      // Validate image size
      if (imageBuffer.length > MAX_IMAGE_SIZE) {
        throw new Error(`Image size ${imageBuffer.length} exceeds maximum ${MAX_IMAGE_SIZE}`);
      }

      // Step 3: Upload binary data
      await axios.put(uploadUrl, imageBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      logger.info('LinkedIn image uploaded successfully', {
        assetId,
        imageUrl,
        size: imageBuffer.length,
      });

      return {
        asset: assetId,
        status: 'READY',
      };
    } catch (error: any) {
      logger.error('LinkedIn image upload failed', {
        imageUrl,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  /**
   * Upload video to LinkedIn
   */
  async uploadVideo(accessToken: string, ownerUrn: string, videoUrl: string): Promise<LinkedInMediaAsset> {
    try {
      // Step 1: Register upload
      const registerResponse = await this.httpClient.post(
        `${LINKEDIN_API_BASE}/assets?action=registerUpload`,
        {
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
            owner: ownerUrn,
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
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      const uploadData = registerResponse.data as LinkedInUploadResponse;
      const uploadUrl = uploadData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const assetId = uploadData.value.asset;

      // Step 2: Download video
      const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
      const videoBuffer = Buffer.from(videoResponse.data);

      // Validate video size
      if (videoBuffer.length > MAX_VIDEO_SIZE) {
        throw new Error(`Video size ${videoBuffer.length} exceeds maximum ${MAX_VIDEO_SIZE}`);
      }

      // Step 3: Upload binary data
      await axios.put(uploadUrl, videoBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      // Step 4: Wait for processing (videos need processing time)
      await this.waitForVideoProcessing(accessToken, assetId);

      logger.info('LinkedIn video uploaded successfully', {
        assetId,
        videoUrl,
        size: videoBuffer.length,
      });

      return {
        asset: assetId,
        status: 'READY',
      };
    } catch (error: any) {
      logger.error('LinkedIn video upload failed', {
        videoUrl,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  /**
   * Upload document to LinkedIn
   */
  async uploadDocument(accessToken: string, ownerUrn: string, documentUrl: string): Promise<LinkedInMediaAsset> {
    try {
      // Step 1: Register upload
      const registerResponse = await this.httpClient.post(
        `${LINKEDIN_API_BASE}/assets?action=registerUpload`,
        {
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-document'],
            owner: ownerUrn,
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
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      const uploadData = registerResponse.data as LinkedInUploadResponse;
      const uploadUrl = uploadData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const assetId = uploadData.value.asset;

      // Step 2: Download document
      const docResponse = await axios.get(documentUrl, { responseType: 'arraybuffer' });
      const docBuffer = Buffer.from(docResponse.data);

      // Validate document size
      if (docBuffer.length > MAX_DOCUMENT_SIZE) {
        throw new Error(`Document size ${docBuffer.length} exceeds maximum ${MAX_DOCUMENT_SIZE}`);
      }

      // Step 3: Upload binary data
      await axios.put(uploadUrl, docBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      logger.info('LinkedIn document uploaded successfully', {
        assetId,
        documentUrl,
        size: docBuffer.length,
      });

      return {
        asset: assetId,
        status: 'READY',
      };
    } catch (error: any) {
      logger.error('LinkedIn document upload failed', {
        documentUrl,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  getLimits() {
    return {
      maxContentLength: MAX_CONTENT_LENGTH,
      maxMediaCount: MAX_MEDIA_COUNT,
      maxVideoSize: MAX_VIDEO_SIZE,
      maxImageSize: MAX_IMAGE_SIZE,
      maxDocumentSize: MAX_DOCUMENT_SIZE,
      supportedMediaTypes: [
        'image/jpeg', 
        'image/png', 
        'image/gif',
        'video/mp4',
        'video/quicktime',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
    };
  }

  /**
   * Build UGC post payload
   */
  private buildUGCPost(authorUrn: string, content: string, mediaAssets: LinkedInMediaAsset[]): any {
    const payload: any = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content,
          },
          shareMediaCategory: mediaAssets.length > 0 ? 'IMAGE' : 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    // Add media if present
    if (mediaAssets.length > 0) {
      // Determine media category based on first asset
      const firstAsset = mediaAssets[0];
      if (firstAsset.asset.includes('video')) {
        payload.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'VIDEO';
      } else if (firstAsset.asset.includes('document')) {
        payload.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
      } else {
        payload.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
      }

      payload.specificContent['com.linkedin.ugc.ShareContent'].media = mediaAssets.map((asset) => {
        const mediaItem: any = {
          status: 'READY',
          media: asset.asset,
        };

        // Add alt text if available (LinkedIn uses description field)
        if (asset.altText) {
          mediaItem.description = {
            localized: {
              en_US: asset.altText,
            },
          };
        }

        return mediaItem;
      });
    }

    return payload;
  }

  /**
   * Get author URN (personal or organization)
   */
  private getAuthorUrn(account: ISocialAccount): string {
    const accountType = account.metadata?.accountType;
    
    if (accountType === 'organization') {
      return `urn:li:organization:${account.providerUserId}`;
    } else {
      return `urn:li:person:${account.providerUserId}`;
    }
  }

  /**
   * Wait for video processing to complete
   */
  private async waitForVideoProcessing(accessToken: string, assetId: string, maxWaitTime = 300000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await this.httpClient.get(`${LINKEDIN_API_BASE}/assets/${assetId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        });

        const status = response.data.recipes?.[0]?.status;
        
        if (status === 'AVAILABLE') {
          logger.info('LinkedIn video processing completed', { assetId });
          return;
        } else if (status === 'FAILED') {
          throw new Error('Video processing failed');
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error: any) {
        logger.error('Error checking video processing status', {
          assetId,
          error: error.message,
        });
        throw error;
      }
    }

    throw new Error('Video processing timeout');
  }

  /**
   * Delete LinkedIn post
   */
  async deletePost(account: ISocialAccount, platformPostId: string): Promise<void> {
    const accessToken = this.getAccessToken(account);

    try {
      await this.httpClient.delete(`${LINKEDIN_API_BASE}/ugcPosts/${platformPostId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      logger.info('LinkedIn post deleted successfully', {
        platformPostId,
        accountId: account._id.toString(),
      });
    } catch (error: any) {
      this.handleApiError(error, 'deletePost');
    }
  }

  /**
   * Helper methods for media type detection
   */
  private isVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  private isImageUrl(url: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  private isDocumentUrl(url: string): boolean {
    const docExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
    return docExtensions.some(ext => url.toLowerCase().includes(ext));
  }
}