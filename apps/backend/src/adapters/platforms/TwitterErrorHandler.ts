/**
 * Twitter Error Handler
 * 
 * Classifies Twitter API v2 errors into permanent, transient, or rate_limit types
 * 
 * Twitter Error Codes:
 * - 429: Rate limit exceeded (rate_limit)
 * - Unauthorized: Invalid or expired token (permanent)
 * - Account suspended: Suspended account (permanent)
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

export class TwitterErrorHandler {
  /**
   * Classify Twitter API error
   * @param error - Axios error object
   * @returns Error classification with recommended action
   */
  classify(error: any): ErrorClassification {
    const statusCode = error.response?.status;
    const errorTitle = error.response?.data?.title;
    const errorDetail = error.response?.data?.detail;
    const errorType = error.response?.data?.type;

    logger.debug('Classifying Twitter error', {
      statusCode,
      errorTitle,
      errorDetail,
      errorType,
    });

    // 429: Rate limit exceeded
    if (statusCode === 429) {
      const retryAfter = this.extractRateLimitResetTime(error);
      return {
        type: 'rate_limit',
        action: 'wait',
        message: 'Twitter API rate limit exceeded. Retry after reset time.',
        retryAfter,
      };
    }

    // Unauthorized errors
    if (statusCode === 401 || errorTitle === 'Unauthorized') {
      return {
        type: 'permanent',
        action: 'reauth_required',
        message: 'Twitter OAuth token is invalid or expired. User must reconnect.',
      };
    }

    // Account suspended
    if (errorDetail?.includes('suspended') || errorDetail?.includes('locked')) {
      return {
        type: 'permanent',
        action: 'reauth_required',
        message: 'Twitter account is suspended or locked.',
      };
    }

    // 5xx server errors
    if (statusCode && statusCode >= 500) {
      return {
        type: 'transient',
        action: 'retry',
        message: 'Twitter API server error. Retry with backoff.',
      };
    }

    // Network errors (no response)
    if (!error.response) {
      return {
        type: 'transient',
        action: 'retry',
        message: 'Network error connecting to Twitter API. Retry with backoff.',
      };
    }

    // Default to permanent error for unknown cases
    return {
      type: 'permanent',
      action: 'reauth_required',
      message: `Twitter API error: ${errorDetail || errorTitle || error.message}`,
    };
  }

  /**
   * Extract rate limit reset time from Twitter error response
   * Twitter provides x-rate-limit-reset header with Unix timestamp
   * 
   * @param error - Axios error object
   * @returns Seconds until rate limit reset (default: 900 = 15 minutes)
   */
  private extractRateLimitResetTime(error: any): number {
    try {
      const resetHeader = error.response?.headers?.['x-rate-limit-reset'];
      if (resetHeader) {
        const resetTimestamp = parseInt(resetHeader, 10);
        const now = Math.floor(Date.now() / 1000);
        const secondsUntilReset = resetTimestamp - now;
        
        // Ensure positive value, default to 15 minutes if negative
        return secondsUntilReset > 0 ? secondsUntilReset : 900;
      }
    } catch (parseError) {
      logger.warn('Failed to parse Twitter rate limit reset header', {
        error: parseError,
      });
    }

    // Default to 15 minutes if no header info available
    return 900;
  }
}
