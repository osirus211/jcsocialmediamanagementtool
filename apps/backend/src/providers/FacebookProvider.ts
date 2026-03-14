import { BaseProvider } from './BaseProvider';
import { PublishPostParams, PublishResult } from './SocialProvider';
import { logger } from '../utils/logger';

/**
 * Facebook Provider
 * 
 * Handles publishing posts to Facebook Pages using Meta Graph API
 * Uses OAuth 2.0 Bearer Token (Page Access Token)
 */

export class FacebookProvider extends BaseProvider {
  protected providerName = 'facebook';
  private readonly apiVersion = 'v21.0';
  private readonly apiBaseUrl = `https://graph.facebook.com/${this.apiVersion}`;

  async publishPost(params: PublishPostParams): Promise<PublishResult> {
    try {
      this.logPublishAttempt(params);

      // Validate post content
      const validation = this.validatePost(params);
      if (!validation.valid) {
        const error: any = new Error(validation.error);
        error.statusCode = 400; // Permanent error
        throw error;
      }

      // Get valid access token (Page Access Token)
      const accessToken = await this.getValidToken(params.accountId);

      // Get account details for Facebook page ID
      const account = await this.getAccount(params.accountId);
      const pageId = account.providerUserId;

      if (!pageId) {
        throw new Error('Facebook page ID not found in account');
      }

      // Publish post (with or without media)
      const postId = await this.publishToFacebook(accessToken, pageId, params);

      this.logPublishSuccess(postId, params);
      
      return this.createSuccessResult(postId, {
        url: `https://www.facebook.com/${postId}`,
      });

    } catch (error: any) {
      this.logPublishError(error, params);
      return this.createErrorResult(error);
    }
  }

  /**
   * Publish post to Facebook (text or with images)
   */
  private async publishToFacebook(
    accessToken: string,
    pageId: string,
    params: PublishPostParams
  ): Promise<string> {
    // If media present, publish as photo post
    if (params.mediaUrls && params.mediaUrls.length > 0) {
      return await this.publishPhotoPost(accessToken, pageId, params);
    }

    // Otherwise, publish as text post
    return await this.publishTextPost(accessToken, pageId, params);
  }

  /**
   * Publish text-only post to Facebook Page feed
   */
  private async publishTextPost(
    accessToken: string,
    pageId: string,
    params: PublishPostParams
  ): Promise<string> {
    const url = `${this.apiBaseUrl}/${pageId}/feed`;

    const requestBody = {
      message: params.content,
      access_token: accessToken,
    };

    logger.debug('Calling Facebook Graph API (text post)', {
      url,
      pageId,
      contentLength: params.content.length,
      accountId: params.accountId,
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json() as any;
        const postId = data.id;

        if (!postId) {
          throw new Error('Facebook API returned success but no post ID');
        }

        logger.info('Facebook API success', {
          postId,
          accountId: params.accountId,
        });

        return postId;
      }

      // Handle errors
      await this.handleFacebookError(response, params.accountId);
      
      // Should never reach here
      throw new Error('Unexpected error handling Facebook API response');

    } catch (error: any) {
      // Network/timeout errors
      if (error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        const networkError: any = new Error('Network timeout connecting to Facebook API');
        networkError.statusCode = 0;
        throw networkError;
      }

      // Re-throw if already processed
      if (error.statusCode !== undefined) {
        throw error;
      }

      // Unknown error
      logger.error('Unknown Facebook API error', {
        error: error.message,
        accountId: params.accountId,
      });
      throw error;
    }
  }

  /**
   * Publish photo post to Facebook Page
   */
  private async publishPhotoPost(
    accessToken: string,
    pageId: string,
    params: PublishPostParams
  ): Promise<string> {
    const url = `${this.apiBaseUrl}/${pageId}/photos`;

    // Use first image URL (Facebook photos endpoint handles one image)
    const imageUrl = params.mediaUrls![0];

    const requestBody = {
      url: imageUrl,
      caption: params.content,
      published: true,
      access_token: accessToken,
    };

    logger.debug('Calling Facebook Graph API (photo post)', {
      url,
      pageId,
      imageUrl,
      contentLength: params.content.length,
      accountId: params.accountId,
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json() as any;
        const postId = data.post_id || data.id;

        if (!postId) {
          throw new Error('Facebook API returned success but no post ID');
        }

        logger.info('Facebook photo API success', {
          postId,
          accountId: params.accountId,
        });

        return postId;
      }

      // Handle errors
      await this.handleFacebookError(response, params.accountId);
      
      // Should never reach here
      throw new Error('Unexpected error handling Facebook photo API response');

    } catch (error: any) {
      // Network/timeout errors
      if (error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        const networkError: any = new Error('Network timeout connecting to Facebook API');
        networkError.statusCode = 0;
        throw networkError;
      }

      // Re-throw if already processed
      if (error.statusCode !== undefined) {
        throw error;
      }

      // Unknown error
      logger.error('Unknown Facebook photo API error', {
        error: error.message,
        accountId: params.accountId,
      });
      throw error;
    }
  }

  /**
   * Handle Facebook Graph API error responses
   */
  private async handleFacebookError(response: Response, accountId: string): Promise<never> {
    const statusCode = response.status;
    let errorMessage = `Facebook API error: ${statusCode}`;

    try {
      const errorData = await response.json() as any;
      
      // Extract error details from Facebook API response
      if (errorData.error) {
        errorMessage = errorData.error.message || errorMessage;
        
        // Include error code if available
        if (errorData.error.code) {
          errorMessage = `${errorMessage} (code: ${errorData.error.code})`;
        }
      }
    } catch {
      // If JSON parsing fails, use status text
      errorMessage = response.statusText || errorMessage;
    }

    // Create error with proper classification
    const error: any = new Error(errorMessage);
    error.statusCode = statusCode;

    // Log error with classification
    logger.error('Facebook API error', {
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
    if (statusCode === 429 || statusCode >= 500) {
      return 'retryable';
    }
    
    // Permanent errors (400, 401, 403, 404)
    if (statusCode >= 400 && statusCode < 500) {
      return 'permanent';
    }
    
    // Default to retryable for unknown status codes
    return 'retryable';
  }
}