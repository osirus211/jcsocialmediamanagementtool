/**
 * Publishing Error Types
 * 
 * Categorizes publishing failures for appropriate retry strategies
 */

export enum PublishingErrorCategory {
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  MEDIA_UPLOAD_FAILED = 'MEDIA_UPLOAD_FAILED',
  CONTENT_VIOLATION = 'CONTENT_VIOLATION',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  INVALID_MEDIA = 'INVALID_MEDIA',
  UNKNOWN = 'UNKNOWN',
}

export interface PublishingErrorInfo {
  category: PublishingErrorCategory;
  shouldRetry: boolean;
  retryDelay?: number; // milliseconds
  message: string;
}

/**
 * Classify error and determine retry strategy
 */
export function classifyPublishingError(error: any): PublishingErrorInfo {
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toUpperCase() || '';
  const statusCode = error.statusCode || error.status || 0;
  
  // Network errors - retry with exponential backoff
  if (
    errorCode === 'ECONNREFUSED' ||
    errorCode === 'ECONNRESET' ||
    errorCode === 'ETIMEDOUT' ||
    errorCode === 'ENOTFOUND' ||
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('connection')
  ) {
    return {
      category: PublishingErrorCategory.NETWORK_ERROR,
      shouldRetry: true,
      message: 'Network error occurred',
    };
  }
  
  // Rate limit errors - retry with platform-specific delay
  if (
    statusCode === 429 ||
    errorCode === 'RATE_LIMIT_EXCEEDED' ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests')
  ) {
    return {
      category: PublishingErrorCategory.RATE_LIMIT,
      shouldRetry: true,
      retryDelay: 60000, // 1 minute
      message: 'Rate limit exceeded',
    };
  }
  
  // Token expired - retry after token refresh
  if (
    statusCode === 401 ||
    errorCode === 'INVALID_TOKEN' ||
    errorCode === 'TOKEN_EXPIRED' ||
    errorMessage.includes('token') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('authentication')
  ) {
    return {
      category: PublishingErrorCategory.TOKEN_EXPIRED,
      shouldRetry: true,
      retryDelay: 5000, // 5 seconds (allow time for token refresh)
      message: 'Authentication token expired',
    };
  }
  
  // Media upload failed - retry
  if (
    errorMessage.includes('media') ||
    errorMessage.includes('upload') ||
    errorMessage.includes('file')
  ) {
    return {
      category: PublishingErrorCategory.MEDIA_UPLOAD_FAILED,
      shouldRetry: true,
      message: 'Media upload failed',
    };
  }
  
  // Content violation - do not retry
  if (
    statusCode === 403 ||
    errorMessage.includes('violation') ||
    errorMessage.includes('prohibited') ||
    errorMessage.includes('restricted')
  ) {
    return {
      category: PublishingErrorCategory.CONTENT_VIOLATION,
      shouldRetry: false,
      message: 'Content violates platform policies',
    };
  }
  
  // Account suspended - do not retry
  if (
    errorMessage.includes('suspended') ||
    errorMessage.includes('banned') ||
    errorMessage.includes('disabled')
  ) {
    return {
      category: PublishingErrorCategory.ACCOUNT_SUSPENDED,
      shouldRetry: false,
      message: 'Account is suspended or disabled',
    };
  }
  
  // Invalid media - do not retry
  if (
    errorMessage.includes('invalid media') ||
    errorMessage.includes('unsupported format') ||
    errorMessage.includes('media type')
  ) {
    return {
      category: PublishingErrorCategory.INVALID_MEDIA,
      shouldRetry: false,
      message: 'Invalid or unsupported media format',
    };
  }
  
  // Server errors (5xx) - retry
  if (statusCode >= 500 && statusCode < 600) {
    return {
      category: PublishingErrorCategory.NETWORK_ERROR,
      shouldRetry: true,
      message: 'Server error occurred',
    };
  }
  
  // Unknown error - retry with caution
  return {
    category: PublishingErrorCategory.UNKNOWN,
    shouldRetry: true,
    message: error.message || 'Unknown error occurred',
  };
}
