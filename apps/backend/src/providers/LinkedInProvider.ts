import { BaseProvider } from './BaseProvider';
import { PublishPostParams, PublishResult } from './SocialProvider';
import { logger } from '../utils/logger';

/**
 * LinkedIn Provider
 * 
 * Handles publishing posts to LinkedIn using UGC Posts API
 * Uses OAuth 2.0 Bearer Token
 */

export class LinkedInProvider extends BaseProvider {
  protected providerName = 'linkedin';
  private readonly apiBaseUrl = 'https://api.linkedin.com/v2';
  
  // LinkedIn limits
  private readonly MAX_IMAGES_PER_POST = 9;
  private readonly MAX_IMAGE_SIZE_MB = 5;
  private readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

  async publishPost(params: PublishPostParams): Promise<PublishResult> {
    try {
      this.logPublishAttempt(params);

      // Validate post content and media limits
      const validation = this.validatePostLimits(params);
      if (!validation.valid) {
        const error: any = new Error(validation.error);
        error.statusCode = 400; // Permanent error
        throw error;
      }

      // Get valid access token (auto-refreshes if expired)
      const accessToken = await this.getValidToken(params.accountId);

      // Get account details for LinkedIn person URN
      const account = await this.getAccount(params.accountId);

      // Upload media if present
      let assetUrns: string[] | undefined;
      if (params.mediaUrls && params.mediaUrls.length > 0) {
        assetUrns = await this.uploadAllMedia(accessToken, params.mediaUrls, account, params.accountId);
      }

      // Call LinkedIn UGC API
      const postUrn = await this.callLinkedInAPI(accessToken, params, account, assetUrns);

      this.logPublishSuccess(postUrn, params);
      
      return this.createSuccessResult(postUrn, {
        url: `https://www.linkedin.com/feed/update/${postUrn}`,
      });

    } catch (error: any) {
      this.logPublishError(error, params);
      return this.createErrorResult(error);
    }
  }

  /**
   * Validate post limits (media count, image size, image type)
   */
  private validatePostLimits(params: PublishPostParams): { valid: boolean; error?: string } {
    // Validate base content length
    const baseValidation = this.validatePost(params);
    if (!baseValidation.valid) {
      return baseValidation;
    }

    // Validate media count
    if (params.mediaUrls && params.mediaUrls.length > this.MAX_IMAGES_PER_POST) {
      return {
        valid: false,
        error: `LinkedIn allows maximum ${this.MAX_IMAGES_PER_POST} images per post`,
      };
    }

    return { valid: true };
  }

  /**
   * Upload all media files and return asset URNs
   */
  private async uploadAllMedia(
    accessToken: string,
    mediaUrls: string[],
    account: any,
    accountId: string
  ): Promise<string[]> {
    logger.info('Uploading media to LinkedIn', {
      accountId,
      mediaCount: mediaUrls.length,
    });

    const assetUrns: string[] = [];

    for (let i = 0; i < mediaUrls.length; i++) {
      const mediaUrl = mediaUrls[i];
      try {
        const assetUrn = await this.uploadImage(mediaUrl, accessToken, account, accountId);
        assetUrns.push(assetUrn);
        
        logger.debug('Media uploaded successfully', {
          accountId,
          mediaUrl,
          assetUrn,
          position: i + 1,
        });
      } catch (error: any) {
        logger.error('Media upload failed', {
          accountId,
          mediaUrl,
          position: i + 1,
          error: error.message,
        });
        throw error;
      }
    }

    logger.info('All media uploaded successfully', {
      accountId,
      mediaCount: assetUrns.length,
    });

    return assetUrns;
  }

  /**
   * Upload a single image to LinkedIn
   * 
   * Step 1: Register asset upload
   * Step 2: Upload binary to returned URL
   * 
   * @param mediaUrl - URL of image to upload
   * @param accessToken - OAuth 2.0 Bearer token
   * @param account - Social account with providerUserId
   * @param accountId - Account ID for logging
   * @returns Asset URN
   * @throws Error with statusCode for proper error classification
   */
  private async uploadImage(
    mediaUrl: string,
    accessToken: string,
    account: any,
    accountId: string
  ): Promise<string> {
    try {
      // Step 1: Register asset upload
      const { uploadUrl, assetUrn } = await this.registerAsset(accessToken, account, accountId);

      // Step 2: Download image from URL
      logger.debug('Downloading image', { mediaUrl, accountId });
      
      const mediaResponse = await fetch(mediaUrl);
      if (!mediaResponse.ok) {
        throw new Error(`Failed to download image: ${mediaResponse.statusText}`);
      }

      const mediaBuffer = await mediaResponse.arrayBuffer();
      const mediaSizeMB = mediaBuffer.byteLength / (1024 * 1024);

      // Validate size
      if (mediaSizeMB > this.MAX_IMAGE_SIZE_MB) {
        const error: any = new Error(
          `Image size ${mediaSizeMB.toFixed(2)}MB exceeds ${this.MAX_IMAGE_SIZE_MB}MB limit`
        );
        error.statusCode = 400; // Permanent error
        throw error;
      }

      // Detect content type
      const contentType = mediaResponse.headers.get('content-type') || 'image/jpeg';
      
      // Validate image type
      if (!this.ALLOWED_IMAGE_TYPES.includes(contentType)) {
        const error: any = new Error(
          `Image type ${contentType} not allowed. Allowed types: ${this.ALLOWED_IMAGE_TYPES.join(', ')}`
        );
        error.statusCode = 400; // Permanent error
        throw error;
      }

      logger.debug('Image downloaded', {
        accountId,
        sizeMB: mediaSizeMB.toFixed(2),
        contentType,
      });

      // Step 3: Upload binary to LinkedIn
      await this.uploadBinary(uploadUrl, mediaBuffer, contentType, accountId);

      return assetUrn;

    } catch (error: any) {
      // Network/timeout errors - RETRYABLE
      if (
        error.name === 'AbortError' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('Failed to download image')
      ) {
        const networkError: any = new Error('Network error during image upload');
        networkError.statusCode = 0; // Will be classified as retryable
        throw networkError;
      }

      // Re-throw if already processed
      if (error.statusCode !== undefined) {
        throw error;
      }

      // Unknown error
      logger.error('Unknown image upload error', {
        error: error.message,
        accountId,
      });
      throw error;
    }
  }

  /**
   * Register asset upload with LinkedIn
   * 
   * @param accessToken - OAuth 2.0 Bearer token
   * @param account - Social account with providerUserId
   * @param accountId - Account ID for logging
   * @returns Upload URL and asset URN
   * @throws Error with statusCode for proper error classification
   */
  private async registerAsset(
    accessToken: string,
    account: any,
    accountId: string
  ): Promise<{ uploadUrl: string; assetUrn: string }> {
    const url = `${this.apiBaseUrl}/assets?action=registerUpload`;
    
    const requestBody = {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: `urn:li:person:${account.providerUserId}`,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    };

    logger.debug('Registering LinkedIn asset', {
      url,
      owner: requestBody.registerUploadRequest.owner,
      accountId,
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json() as any;
        const uploadUrl = data.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
        const assetUrn = data.value?.asset;

        if (!uploadUrl || !assetUrn) {
          throw new Error('LinkedIn asset registration returned success but missing uploadUrl or asset URN');
        }

        logger.debug('Asset registered successfully', {
          accountId,
          assetUrn,
        });

        return { uploadUrl, assetUrn };
      }

      // Handle errors
      await this.handleLinkedInError(response, accountId);
      
      // Should never reach here
      throw new Error('Unexpected error handling LinkedIn asset registration');

    } catch (error: any) {
      // Network/timeout errors
      if (error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        const networkError: any = new Error('Network timeout during asset registration');
        networkError.statusCode = 0;
        throw networkError;
      }

      // Re-throw if already processed
      if (error.statusCode !== undefined) {
        throw error;
      }

      // Unknown error
      logger.error('Unknown asset registration error', {
        error: error.message,
        accountId,
      });
      throw error;
    }
  }

  /**
   * Upload binary image data to LinkedIn upload URL
   * 
   * @param uploadUrl - Upload URL from asset registration
   * @param imageBuffer - Image binary data
   * @param contentType - Image MIME type
   * @param accountId - Account ID for logging
   * @throws Error with statusCode for proper error classification
   */
  private async uploadBinary(
    uploadUrl: string,
    imageBuffer: ArrayBuffer,
    contentType: string,
    accountId: string
  ): Promise<void> {
    logger.debug('Uploading binary to LinkedIn', {
      uploadUrl: uploadUrl.substring(0, 50) + '...',
      contentType,
      sizeMB: (imageBuffer.byteLength / (1024 * 1024)).toFixed(2),
      accountId,
    });

    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        body: imageBuffer,
      });

      if (response.ok || response.status === 201) {
        logger.debug('Binary uploaded successfully', { accountId });
        return;
      }

      // Handle errors
      const statusCode = response.status;
      let errorMessage = `Binary upload failed: ${statusCode}`;

      try {
        const errorText = await response.text();
        if (errorText) {
          errorMessage = errorText;
        }
      } catch {
        errorMessage = response.statusText || errorMessage;
      }

      const error: any = new Error(errorMessage);
      error.statusCode = statusCode;

      logger.error('Binary upload error', {
        statusCode,
        errorMessage,
        accountId,
        classification: this.classifyHttpStatus(statusCode),
      });

      throw error;

    } catch (error: any) {
      // Network/timeout errors
      if (error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        const networkError: any = new Error('Network timeout during binary upload');
        networkError.statusCode = 0;
        throw networkError;
      }

      // Re-throw if already processed
      if (error.statusCode !== undefined) {
        throw error;
      }

      // Unknown error
      logger.error('Unknown binary upload error', {
        error: error.message,
        accountId,
      });
      throw error;
    }
  }

  /**
   * Call LinkedIn UGC Posts API to create a post
   * 
   * @param accessToken - OAuth 2.0 Bearer token
   * @param params - Post parameters
   * @param account - Social account with providerUserId
   * @param assetUrns - Optional asset URNs for images
   * @returns Post URN
   * @throws Error with statusCode for proper error classification
   */
  private async callLinkedInAPI(
    accessToken: string,
    params: PublishPostParams,
    account: any,
    assetUrns?: string[]
  ): Promise<string> {
    const url = `${this.apiBaseUrl}/ugcPosts`;
    
    // Build share content
    const shareContent: any = {
      shareCommentary: {
        text: params.content,
      },
      shareMediaCategory: assetUrns && assetUrns.length > 0 ? 'IMAGE' : 'NONE',
    };

    // Add media if present
    if (assetUrns && assetUrns.length > 0) {
      shareContent.media = assetUrns.map(assetUrn => ({
        status: 'READY',
        media: assetUrn,
      }));
    }

    // Build LinkedIn UGC Post request body
    const requestBody = {
      author: `urn:li:person:${account.providerUserId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': shareContent,
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    logger.debug('Calling LinkedIn UGC API', {
      url,
      author: requestBody.author,
      contentLength: params.content.length,
      hasMedia: !!assetUrns?.length,
      mediaCount: assetUrns?.length || 0,
      accountId: params.accountId,
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(requestBody),
      });

      // Handle success (LinkedIn returns 201 Created)
      if (response.status === 201) {
        const data = await response.json() as any;
        const postUrn = data.id;
        
        if (!postUrn) {
          throw new Error('LinkedIn API returned success but no post URN');
        }

        logger.info('LinkedIn API success', {
          postUrn,
          accountId: params.accountId,
        });

        return postUrn;
      }

      // Handle errors
      await this.handleLinkedInError(response, params.accountId);
      
      // Should never reach here (handleLinkedInError always throws)
      throw new Error('Unexpected error handling LinkedIn API response');

    } catch (error: any) {
      // Network/timeout errors
      if (error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        const networkError: any = new Error('Network timeout connecting to LinkedIn API');
        networkError.statusCode = 0;
        throw networkError;
      }

      // Re-throw if already processed
      if (error.statusCode !== undefined) {
        throw error;
      }

      // Unknown error
      logger.error('Unknown LinkedIn API error', {
        error: error.message,
        accountId: params.accountId,
      });
      throw error;
    }
  }

  /**
   * Handle LinkedIn API error responses
   * Maps HTTP status codes to proper error types with retryable flag
   */
  private async handleLinkedInError(response: Response, accountId: string): Promise<never> {
    const statusCode = response.status;
    let errorMessage = `LinkedIn API error: ${statusCode}`;

    try {
      const errorData = await response.json() as any;
      
      // Extract error details from LinkedIn API response
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.serviceErrorCode) {
        errorMessage = `LinkedIn error code: ${errorData.serviceErrorCode}`;
      }
    } catch {
      // If JSON parsing fails, use status text
      errorMessage = response.statusText || errorMessage;
    }

    // Create error with proper classification
    const error: any = new Error(errorMessage);
    error.statusCode = statusCode;

    // Log error with classification
    logger.error('LinkedIn API error', {
      statusCode,
      errorMessage,
      accountId,
      classification: this.classifyHttpStatus(statusCode),
    });

    throw error;
  }

  /**
   * Classify HTTP status code for logging
   */
  private classifyHttpStatus(statusCode: number): 'retryable' | 'permanent' {
    // Retryable errors
    if (statusCode === 429 || statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504) {
      return 'retryable';
    }
    
    // Permanent errors (401, 403, 422 validation, 400 bad request)
    if (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404 || statusCode === 422) {
      return 'permanent';
    }
    
    // Default to retryable for unknown status codes
    return 'retryable';
  }
}