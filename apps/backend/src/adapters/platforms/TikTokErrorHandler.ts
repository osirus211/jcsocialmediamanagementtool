/**
 * TikTok Error Handler
 * 
 * Classifies TikTok API errors into permanent, transient, or rate_limit types
 * 
 * TikTok Error Codes:
 * - invalid_grant: Invalid or expired token (permanent)
 * - Rate limit errors: Too many requests (rate_limit)
 * - 5xx: Server errors (transient)
 */

import { logger } from '../../utils/logger';

export type ErrorType = 'permanent' | 'transient' | 'rate_limit';

export interface ErrorClassification {
  type: ErrorType;
  action: 'reauth_required' | 'retry' | 'wait';
  message: string;
  retryAfter?: number; // seconds
}

export class TikTokErrorHandler {
  /**
   * Classify TikTok API error
   * @param error - Axios error object
   * @returns Error classification with recommended action
   */
  classify(error: any): ErrorClassification {
    const statusCode = error.response?.status;
    const errorCode = error.response?.data?.error?.code;
    const errorMessage = error.response?.data?.error?.message || error.response?.data?.message;

    logger.debug('Classifying TikTok error', {
      statusCode,
      errorCode,
      errorMessage,
    });

    // invalid_grant: Invalid or expired token
    if (errorCode === 'invalid_grant' || errorMessage?.includes('invalid_grant')) {
      return {
        type: 'permanent',
        action: 'reauth_required',
        message: 'TikTok OAuth token is invalid or expired. User must reconnect.',
      };
    }

    // 429: Rate limit exceeded
    if (statusCode === 429) {
      const retryAfter = this.extractRateLimitResetTime(error);
      return {
        type: 'rate_limit',
        action: 'wait',
        message: 'TikTok API rate limit exceeded. Retry after reset time.',
        retryAfter,
      };
    }

    // 401: Unauthorized
    if (statusCode === 401) {
      return {
        type: 'permanent',
        action: 'reauth_required',
        message: 'TikTok OAuth token is invalid or expired. User must reconnect.',
      };
    }

    // 5xx server errors
    if (statusCode && statusCode >= 500) {
      return {
        type: 'transient',
        action: 'retry',
        message: 'TikTok API server error. Retry with backoff.',
      };
    }

    // Network errors (no response)
    if (!error.response) {
      return {
        type: 'transient',
        action: 'retry',
        message: 'Network error connecting to TikTok API. Retry with backoff.',
      };
    }

    // Default to permanent error for unknown cases
    return {
      type: 'permanent',
      action: 'reauth_required',
      message: `TikTok API error: ${errorMessage || error.message}`,
    };
  }

  /**
   * Extract rate limit reset time from TikTok error response
   * TikTok provides X-RateLimit-Reset header with Unix timestamp
   * 
   * @param error - Axios error object
   * @returns Seconds until rate limit reset (default: 3600 = 1 hour)
   */
  private extractRateLimitResetTime(error: any): number {
    try {
      const resetHeader = error.response?.headers?.['x-ratelimit-reset'];
      if (resetHeader) {
        const resetTimestamp = parseInt(resetHeader, 10);
        const now = Math.floor(Date.now() / 1000);
        const secondsUntilReset = resetTimestamp - now;
        
        // Ensure positive value, default to 1 hour if negative
        return secondsUntilReset > 0 ? secondsUntilReset : 3600;
      }
    } catch (parseError) {
      logger.warn('Failed to parse TikTok rate limit reset header', {
        error: parseError,
      });
    }

    // Default to 1 hour if no header info available
    return 3600;
  }
}
