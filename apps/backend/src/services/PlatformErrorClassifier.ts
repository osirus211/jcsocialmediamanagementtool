/**
 * Platform Error Classifier
 * 
 * Classifies platform API errors into categories for appropriate handling
 * Supports error classification for all 5 platforms
 */

import { AxiosError } from 'axios';
import { SocialPlatform } from '../adapters/platforms/PlatformAdapter';
import { logger } from '../utils/logger';

export type ErrorType = 'permanent' | 'transient' | 'rate_limit';
export type ErrorAction = 'reauth_required' | 'retry' | 'retry_after' | 'fail';

export interface ErrorClassification {
  type: ErrorType;
  action: ErrorAction;
  message: string;
  retryAfter?: Date;
  originalError?: any;
}

export interface PlatformErrorHandler {
  classify(error: any): ErrorClassification;
}

/**
 * Base Platform Error Classifier
 */
export class PlatformErrorClassifier {
  private handlers: Map<SocialPlatform, PlatformErrorHandler>;

  constructor() {
    this.handlers = new Map();
  }

  /**
   * Register a platform-specific error handler
   */
  registerHandler(platform: SocialPlatform, handler: PlatformErrorHandler): void {
    this.handlers.set(platform, handler);
  }

  /**
   * Get platform-specific error handler
   */
  getHandler(platform: SocialPlatform): PlatformErrorHandler | undefined {
    return this.handlers.get(platform);
  }

  /**
   * Classify an error for a specific platform
   */
  classify(platform: SocialPlatform, error: any): ErrorClassification {
    const handler = this.handlers.get(platform);
    
    if (handler) {
      return handler.classify(error);
    }

    // Fallback to generic classification
    return this.classifyGeneric(error);
  }

  /**
   * Generic error classification (fallback)
   */
  private classifyGeneric(error: any): ErrorClassification {
    // Network errors (no response)
    if (this.isNetworkError(error)) {
      return {
        type: 'transient',
        action: 'retry',
        message: 'Network error or timeout',
        originalError: error
      };
    }

    // HTTP status code classification
    if (this.isAxiosError(error) && error.response) {
      const status = error.response.status;

      // 401 Unauthorized - permanent auth error
      if (status === 401) {
        return {
          type: 'permanent',
          action: 'reauth_required',
          message: 'Authentication failed - reauthorization required',
          originalError: error
        };
      }

      // 403 Forbidden - permanent permission error
      if (status === 403) {
        return {
          type: 'permanent',
          action: 'reauth_required',
          message: 'Insufficient permissions',
          originalError: error
        };
      }

      // 429 Too Many Requests - rate limit
      if (status === 429) {
        const retryAfter = this.extractRetryAfter(error);
        return {
          type: 'rate_limit',
          action: 'retry_after',
          message: 'Rate limit exceeded',
          retryAfter,
          originalError: error
        };
      }

      // 5xx Server errors - transient
      if (status >= 500) {
        return {
          type: 'transient',
          action: 'retry',
          message: `Server error (${status})`,
          originalError: error
        };
      }

      // 4xx Client errors (except 401, 403, 429) - permanent
      if (status >= 400 && status < 500) {
        return {
          type: 'permanent',
          action: 'fail',
          message: `Client error (${status})`,
          originalError: error
        };
      }
    }

    // Unknown error - treat as transient
    return {
      type: 'transient',
      action: 'retry',
      message: 'Unknown error',
      originalError: error
    };
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: any): boolean {
    if (!this.isAxiosError(error)) {
      return false;
    }

    // No response means network error
    if (!error.response) {
      return true;
    }

    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }

  /**
   * Check if error is an Axios error
   */
  private isAxiosError(error: any): error is AxiosError {
    return error && error.isAxiosError === true;
  }

  /**
   * Extract retry-after time from error response
   */
  private extractRetryAfter(error: AxiosError): Date | undefined {
    if (!error.response) {
      return undefined;
    }

    const headers = error.response.headers;

    // Check Retry-After header (seconds or HTTP date)
    const retryAfter = headers['retry-after'] || headers['Retry-After'];
    if (retryAfter) {
      // If numeric, it's seconds
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return new Date(Date.now() + seconds * 1000);
      }

      // If not numeric, try parsing as HTTP date
      const date = new Date(retryAfter);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Default to 15 minutes if no header
    return new Date(Date.now() + 15 * 60 * 1000);
  }

  /**
   * Check if error is permanent (requires reauth)
   */
  isPermanentError(classification: ErrorClassification): boolean {
    return classification.type === 'permanent';
  }

  /**
   * Check if error is transient (can retry)
   */
  isTransientError(classification: ErrorClassification): boolean {
    return classification.type === 'transient';
  }

  /**
   * Check if error is rate limit
   */
  isRateLimitError(classification: ErrorClassification): boolean {
    return classification.type === 'rate_limit';
  }

  /**
   * Log error classification
   */
  logClassification(platform: SocialPlatform, classification: ErrorClassification): void {
    logger.info('Error classified', {
      platform,
      type: classification.type,
      action: classification.action,
      message: classification.message,
      retryAfter: classification.retryAfter
    });
  }
}

/**
 * Create error classification from error object
 */
export function createErrorClassification(
  type: ErrorType,
  action: ErrorAction,
  message: string,
  retryAfter?: Date,
  originalError?: any
): ErrorClassification {
  return {
    type,
    action,
    message,
    retryAfter,
    originalError
  };
}

/**
 * Check if error requires reauthorization
 */
export function requiresReauth(classification: ErrorClassification): boolean {
  return classification.action === 'reauth_required';
}

/**
 * Check if error should be retried
 */
export function shouldRetry(classification: ErrorClassification): boolean {
  return classification.action === 'retry' || classification.action === 'retry_after';
}

/**
 * Get retry delay from classification
 */
export function getRetryDelay(classification: ErrorClassification): number {
  if (classification.action === 'retry_after' && classification.retryAfter) {
    const delay = classification.retryAfter.getTime() - Date.now();
    return Math.max(0, delay);
  }
  return 0;
}

// Export singleton instance
export const platformErrorClassifier = new PlatformErrorClassifier();
