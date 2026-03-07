/**
 * LinkedIn Error Handler
 * 
 * Classifies LinkedIn API errors into permanent, transient, or rate_limit types
 * 
 * LinkedIn Error Codes:
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

export class LinkedInErrorHandler {
  /**
   * Classify LinkedIn API error
   * @param error - Axios error object
   * @returns Error classification with recommended action
   */
  classify(error: any): ErrorClassification {
    const statusCode = error.response?.status;
    const errorCode = error.response?.data?.error;
    const errorDescription = error.response?.data?.error_description;

    logger.debug('Classifying LinkedIn error', {
      statusCode,
      errorCode,
      errorDescription,
    });

    // invalid_grant: Invalid or expired token
    if (errorCode === 'invalid_grant') {
      return {
        type: 'permanent',
        action: 'reauth_required',
        message: 'LinkedIn OAuth token is invalid or expired. User must reconnect.',
      };
    }

    // 429: Rate limit exceeded
    if (statusCode === 429) {
      const retryAfter = this.extractRateLimitResetTime(error);
      return {
        type: 'rate_limit',
        action: 'wait',
        message: 'LinkedIn API rate limit exceeded. Retry after reset time.',
        retryAfter,
      };
    }

    // 401: Unauthorized
    if (statusCode === 401) {
      return {
        type: 'permanent',
        action: 'reauth_required',
        message: 'LinkedIn OAuth token is invalid or expired. User must reconnect.',
      };
    }

    // 5xx server errors
    if (statusCode && statusCode >= 500) {
      return {
        type: 'transient',
        action: 'retry',
        message: 'LinkedIn API server error. Retry with backoff.',
      };
    }

    // Network errors (no response)
    if (!error.response) {
      return {
        type: 'transient',
        action: 'retry',
        message: 'Network error connecting to LinkedIn API. Retry with backoff.',
      };
    }

    // Default to permanent error for unknown cases
    return {
      type: 'permanent',
      action: 'reauth_required',
      message: `LinkedIn API error: ${errorDescription || errorCode || error.message}`,
    };
  }

  /**
   * Extract rate limit reset time from LinkedIn error response
   * LinkedIn provides X-RateLimit-Reset header with Unix timestamp
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
      logger.warn('Failed to parse LinkedIn rate limit reset header', {
        error: parseError,
      });
    }

    // Default to 1 hour if no header info available
    return 3600;
  }
}
