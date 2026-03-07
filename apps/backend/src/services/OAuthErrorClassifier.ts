import { logger } from '../utils/logger';
import { SocialPlatform } from '../models/SocialAccount';

/**
 * OAuth Error Classifier
 * 
 * FOUNDATION LAYER for unified OAuth error handling
 * 
 * Provides:
 * - Platform-agnostic error classification
 * - User-friendly error messages
 * - Actionable error categories
 * - Retry decision logic
 * 
 * Error Categories:
 * - TOKEN_EXPIRED: Token needs refresh
 * - TOKEN_REVOKED: User revoked access, needs reconnect
 * - PERMISSION_LOST: Scope downgrade, needs reconnect
 * - RATE_LIMITED: Temporary, retry with backoff
 * - INVALID_REQUEST: Permanent, don't retry
 * - SERVER_ERROR: Temporary, retry
 * - NETWORK_ERROR: Temporary, retry
 * - UNKNOWN: Log and alert
 */

export enum OAuthErrorCategory {
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_REVOKED = 'token_revoked',
  PERMISSION_LOST = 'permission_lost',
  RATE_LIMITED = 'rate_limited',
  INVALID_REQUEST = 'invalid_request',
  SERVER_ERROR = 'server_error',
  NETWORK_ERROR = 'network_error',
  UNKNOWN = 'unknown',
}

export interface ClassifiedError {
  category: OAuthErrorCategory;
  shouldRetry: boolean;
  shouldReconnect: boolean;
  userMessage: string;
  technicalMessage: string;
  retryAfterSeconds?: number;
}

export class OAuthErrorClassifier {
  /**
   * Classify Twitter/X API error
   */
  private classifyTwitterError(error: any): ClassifiedError {
    const statusCode = error.response?.status || error.statusCode;
    const errorCode = error.response?.data?.errors?.[0]?.code;
    const errorMessage = error.response?.data?.errors?.[0]?.message || error.message;

    // Token expired (401)
    if (statusCode === 401) {
      return {
        category: OAuthErrorCategory.TOKEN_EXPIRED,
        shouldRetry: false,
        shouldReconnect: true,
        userMessage: 'Your Twitter connection has expired. Please reconnect your account.',
        technicalMessage: `Twitter 401: ${errorMessage}`,
      };
    }

    // Token revoked (403 with specific codes)
    if (statusCode === 403 && [89, 326, 64].includes(errorCode)) {
      return {
        category: OAuthErrorCategory.TOKEN_REVOKED,
        shouldRetry: false,
        shouldReconnect: true,
        userMessage: 'Your Twitter access has been revoked. Please reconnect your account.',
        technicalMessage: `Twitter 403 (code ${errorCode}): ${errorMessage}`,
      };
    }

    // Rate limited (429)
    if (statusCode === 429) {
      const retryAfter = parseInt(error.response?.headers?.['x-rate-limit-reset']) || 900; // 15 min default
      return {
        category: OAuthErrorCategory.RATE_LIMITED,
        shouldRetry: true,
        shouldReconnect: false,
        userMessage: 'Twitter rate limit reached. Your post will be published automatically when the limit resets.',
        technicalMessage: `Twitter 429: Rate limit exceeded`,
        retryAfterSeconds: retryAfter,
      };
    }

    // Invalid request (400)
    if (statusCode === 400) {
      return {
        category: OAuthErrorCategory.INVALID_REQUEST,
        shouldRetry: false,
        shouldReconnect: false,
        userMessage: 'Your post could not be published due to invalid content. Please check your post and try again.',
        technicalMessage: `Twitter 400: ${errorMessage}`,
      };
    }

    // Server error (500, 502, 503, 504)
    if ([500, 502, 503, 504].includes(statusCode)) {
      return {
        category: OAuthErrorCategory.SERVER_ERROR,
        shouldRetry: true,
        shouldReconnect: false,
        userMessage: 'Twitter is experiencing issues. Your post will be retried automatically.',
        technicalMessage: `Twitter ${statusCode}: ${errorMessage}`,
        retryAfterSeconds: 300, // 5 minutes
      };
    }

    // Network error
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return {
        category: OAuthErrorCategory.NETWORK_ERROR,
        shouldRetry: true,
        shouldReconnect: false,
        userMessage: 'Network error connecting to Twitter. Your post will be retried automatically.',
        technicalMessage: `Network error: ${error.code}`,
        retryAfterSeconds: 60,
      };
    }

    // Unknown error
    return {
      category: OAuthErrorCategory.UNKNOWN,
      shouldRetry: false,
      shouldReconnect: false,
      userMessage: 'An unexpected error occurred. Please try again or contact support.',
      technicalMessage: `Twitter unknown error: ${errorMessage}`,
    };
  }

  /**
   * Classify LinkedIn API error
   */
  private classifyLinkedInError(error: any): ClassifiedError {
    const statusCode = error.response?.status || error.statusCode;
    const errorCode = error.response?.data?.serviceErrorCode;
    const errorMessage = error.response?.data?.message || error.message;

    // Token expired (401)
    if (statusCode === 401) {
      return {
        category: OAuthErrorCategory.TOKEN_EXPIRED,
        shouldRetry: false,
        shouldReconnect: true,
        userMessage: 'Your LinkedIn connection has expired. Please reconnect your account.',
        technicalMessage: `LinkedIn 401: ${errorMessage}`,
      };
    }

    // Token revoked or permission lost (403)
    if (statusCode === 403) {
      return {
        category: OAuthErrorCategory.TOKEN_REVOKED,
        shouldRetry: false,
        shouldReconnect: true,
        userMessage: 'Your LinkedIn access has been revoked. Please reconnect your account.',
        technicalMessage: `LinkedIn 403: ${errorMessage}`,
      };
    }

    // Rate limited (429)
    if (statusCode === 429) {
      const retryAfter = parseInt(error.response?.headers?.['retry-after']) || 3600; // 1 hour default
      return {
        category: OAuthErrorCategory.RATE_LIMITED,
        shouldRetry: true,
        shouldReconnect: false,
        userMessage: 'LinkedIn rate limit reached. Your post will be published automatically when the limit resets.',
        technicalMessage: `LinkedIn 429: Rate limit exceeded`,
        retryAfterSeconds: retryAfter,
      };
    }

    // Invalid request (400)
    if (statusCode === 400) {
      return {
        category: OAuthErrorCategory.INVALID_REQUEST,
        shouldRetry: false,
        shouldReconnect: false,
        userMessage: 'Your post could not be published due to invalid content. Please check your post and try again.',
        technicalMessage: `LinkedIn 400: ${errorMessage}`,
      };
    }

    // Server error (500, 502, 503, 504)
    if ([500, 502, 503, 504].includes(statusCode)) {
      return {
        category: OAuthErrorCategory.SERVER_ERROR,
        shouldRetry: true,
        shouldReconnect: false,
        userMessage: 'LinkedIn is experiencing issues. Your post will be retried automatically.',
        technicalMessage: `LinkedIn ${statusCode}: ${errorMessage}`,
        retryAfterSeconds: 300,
      };
    }

    // Network error
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return {
        category: OAuthErrorCategory.NETWORK_ERROR,
        shouldRetry: true,
        shouldReconnect: false,
        userMessage: 'Network error connecting to LinkedIn. Your post will be retried automatically.',
        technicalMessage: `Network error: ${error.code}`,
        retryAfterSeconds: 60,
      };
    }

    // Unknown error
    return {
      category: OAuthErrorCategory.UNKNOWN,
      shouldRetry: false,
      shouldReconnect: false,
      userMessage: 'An unexpected error occurred. Please try again or contact support.',
      technicalMessage: `LinkedIn unknown error: ${errorMessage}`,
    };
  }

  /**
   * Classify Facebook API error
   */
  private classifyFacebookError(error: any): ClassifiedError {
    const statusCode = error.response?.status || error.statusCode;
    const errorCode = error.response?.data?.error?.code;
    const errorSubcode = error.response?.data?.error?.error_subcode;
    const errorMessage = error.response?.data?.error?.message || error.message;

    // Token expired (190 with subcode 463)
    if (errorCode === 190 && errorSubcode === 463) {
      return {
        category: OAuthErrorCategory.TOKEN_EXPIRED,
        shouldRetry: false,
        shouldReconnect: true,
        userMessage: 'Your Facebook connection has expired. Please reconnect your account.',
        technicalMessage: `Facebook 190/463: Token expired`,
      };
    }

    // Token revoked (190 with other subcodes)
    if (errorCode === 190) {
      return {
        category: OAuthErrorCategory.TOKEN_REVOKED,
        shouldRetry: false,
        shouldReconnect: true,
        userMessage: 'Your Facebook access has been revoked. Please reconnect your account.',
        technicalMessage: `Facebook 190: ${errorMessage}`,
      };
    }

    // Permission lost (200, 10)
    if ([200, 10].includes(errorCode)) {
      return {
        category: OAuthErrorCategory.PERMISSION_LOST,
        shouldRetry: false,
        shouldReconnect: true,
        userMessage: 'Facebook permissions have changed. Please reconnect your account.',
        technicalMessage: `Facebook ${errorCode}: Permission error`,
      };
    }

    // Rate limited (4, 17, 32, 613)
    if ([4, 17, 32, 613].includes(errorCode)) {
      return {
        category: OAuthErrorCategory.RATE_LIMITED,
        shouldRetry: true,
        shouldReconnect: false,
        userMessage: 'Facebook rate limit reached. Your post will be published automatically when the limit resets.',
        technicalMessage: `Facebook ${errorCode}: Rate limit exceeded`,
        retryAfterSeconds: 3600, // 1 hour
      };
    }

    // Invalid request (100, 368)
    if ([100, 368].includes(errorCode)) {
      return {
        category: OAuthErrorCategory.INVALID_REQUEST,
        shouldRetry: false,
        shouldReconnect: false,
        userMessage: 'Your post could not be published due to invalid content. Please check your post and try again.',
        technicalMessage: `Facebook ${errorCode}: ${errorMessage}`,
      };
    }

    // Server error (1, 2)
    if ([1, 2].includes(errorCode) || [500, 502, 503, 504].includes(statusCode)) {
      return {
        category: OAuthErrorCategory.SERVER_ERROR,
        shouldRetry: true,
        shouldReconnect: false,
        userMessage: 'Facebook is experiencing issues. Your post will be retried automatically.',
        technicalMessage: `Facebook ${errorCode || statusCode}: Server error`,
        retryAfterSeconds: 300,
      };
    }

    // Network error
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return {
        category: OAuthErrorCategory.NETWORK_ERROR,
        shouldRetry: true,
        shouldReconnect: false,
        userMessage: 'Network error connecting to Facebook. Your post will be retried automatically.',
        technicalMessage: `Network error: ${error.code}`,
        retryAfterSeconds: 60,
      };
    }

    // Unknown error
    return {
      category: OAuthErrorCategory.UNKNOWN,
      shouldRetry: false,
      shouldReconnect: false,
      userMessage: 'An unexpected error occurred. Please try again or contact support.',
      technicalMessage: `Facebook unknown error: ${errorMessage}`,
    };
  }

  /**
   * Classify Instagram API error
   * 
   * Note: Instagram uses Facebook Graph API, so error codes are similar
   */
  private classifyInstagramError(error: any): ClassifiedError {
    // Instagram uses Facebook Graph API, so reuse Facebook classification
    const classified = this.classifyFacebookError(error);
    
    // Update user messages to mention Instagram instead of Facebook
    classified.userMessage = classified.userMessage.replace(/Facebook/g, 'Instagram');
    classified.technicalMessage = classified.technicalMessage.replace(/Facebook/g, 'Instagram');
    
    return classified;
  }

  /**
   * Classify OAuth error for any platform
   * 
   * Main entry point for error classification
   */
  classify(platform: SocialPlatform, error: any): ClassifiedError {
    try {
      let classified: ClassifiedError;

      switch (platform) {
        case SocialPlatform.TWITTER:
          classified = this.classifyTwitterError(error);
          break;
        case SocialPlatform.LINKEDIN:
          classified = this.classifyLinkedInError(error);
          break;
        case SocialPlatform.FACEBOOK:
          classified = this.classifyFacebookError(error);
          break;
        case SocialPlatform.INSTAGRAM:
          classified = this.classifyInstagramError(error);
          break;
        default:
          classified = {
            category: OAuthErrorCategory.UNKNOWN,
            shouldRetry: false,
            shouldReconnect: false,
            userMessage: 'An unexpected error occurred. Please try again or contact support.',
            technicalMessage: `Unknown platform: ${platform}`,
          };
      }

      logger.debug('OAuth error classified', {
        platform,
        category: classified.category,
        shouldRetry: classified.shouldRetry,
        shouldReconnect: classified.shouldReconnect,
      });

      return classified;
    } catch (classificationError: any) {
      logger.error('Error classification failed', {
        platform,
        error: classificationError.message,
      });

      // Fallback to unknown error
      return {
        category: OAuthErrorCategory.UNKNOWN,
        shouldRetry: false,
        shouldReconnect: false,
        userMessage: 'An unexpected error occurred. Please try again or contact support.',
        technicalMessage: `Classification failed: ${classificationError.message}`,
      };
    }
  }
}

export const oauthErrorClassifier = new OAuthErrorClassifier();
