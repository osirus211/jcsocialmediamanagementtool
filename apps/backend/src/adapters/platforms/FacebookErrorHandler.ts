/**
 * Facebook Error Handler
 * 
 * Classifies Facebook Graph API errors into permanent, transient, or rate_limit types
 * 
 * Facebook Error Codes:
 * - 190: Invalid OAuth access token (permanent)
 * - 4: Rate limit exceeded (rate_limit)
 * - 2: Temporary API service issue (transient)
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

export class FacebookErrorHandler {
  /**
   * Classify Facebook API error
   * @param error - Axios error object
   * @returns Error classification with recommended action
   */
  classify(error: any): ErrorClassification {
    const errorCode = error.response?.data?.error?.code;
    const errorMessage = error.response?.data?.error?.message || error.message;
    const statusCode = error.response?.status;

    logger.debug('Classifying Facebook error', {
      errorCode,
      statusCode,
      errorMessage,
    });

    // Error code 190: Invalid OAuth access token
    if (errorCode === 190) {
      return {
        type: 'permanent',
        action: 'reauth_required',
        message: 'OAuth access token is invalid or expired. User must reconnect.',
      };
    }

    // Error code 4: Rate limit exceeded
    if (errorCode === 4) {
      const retryAfter = this.extractRateLimitResetTime(error);
      return {
        type: 'rate_limit',
        action: 'wait',
        message: 'Facebook API rate limit exceeded. Retry after reset time.',
        retryAfter,
      };
    }

    // Error code 2: Temporary API service issue
    if (errorCode === 2) {
      return {
        type: 'transient',
        action: 'retry',
        message: 'Temporary Facebook API service issue. Retry with backoff.',
      };
    }

    // 5xx server errors
    if (statusCode && statusCode >= 500) {
      return {
        type: 'transient',
        action: 'retry',
        message: 'Facebook API server error. Retry with backoff.',
      };
    }

    // Network errors (no response)
    if (!error.response) {
      return {
        type: 'transient',
        action: 'retry',
        message: 'Network error connecting to Facebook API. Retry with backoff.',
      };
    }

    // Default to permanent error for unknown cases
    return {
      type: 'permanent',
      action: 'reauth_required',
      message: `Facebook API error: ${errorMessage}`,
    };
  }

  /**
   * Extract rate limit reset time from Facebook error response
   * Facebook provides rate limit info in X-App-Usage and X-Business-Use-Case-Usage headers
   * 
   * @param error - Axios error object
   * @returns Seconds until rate limit reset (default: 3600 = 1 hour)
   */
  private extractRateLimitResetTime(error: any): number {
    try {
      // Check X-Business-Use-Case-Usage header
      const businessUsage = error.response?.headers?.['x-business-use-case-usage'];
      if (businessUsage) {
        const usage = JSON.parse(businessUsage);
        // Facebook rate limits reset every hour
        // If we're rate limited, wait 1 hour
        return 3600; // 1 hour
      }

      // Check X-App-Usage header
      const appUsage = error.response?.headers?.['x-app-usage'];
      if (appUsage) {
        const usage = JSON.parse(appUsage);
        // Facebook rate limits reset every hour
        return 3600; // 1 hour
      }
    } catch (parseError) {
      logger.warn('Failed to parse Facebook rate limit headers', {
        error: parseError,
      });
    }

    // Default to 1 hour if no header info available
    return 3600;
  }
}
