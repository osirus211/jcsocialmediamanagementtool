/**
 * RetryableError - Error classification for retry decisions
 * 
 * Provides structured error classification to determine retry behavior:
 * - RETRYABLE: Transient errors that should be retried
 * - NON_RETRYABLE: Permanent errors that should not be retried
 * - RATE_LIMITED: Rate limit errors with special handling
 */

export enum ErrorType {
  RETRYABLE = 'RETRYABLE',
  NON_RETRYABLE = 'NON_RETRYABLE',
  RATE_LIMITED = 'RATE_LIMITED'
}

export class RetryableError extends Error {
  public readonly errorType: ErrorType;
  public readonly statusCode?: number;
  public readonly retryAfter?: number;
  public readonly originalError?: Error;

  constructor(
    message: string,
    errorType: ErrorType,
    statusCode?: number,
    retryAfter?: number,
    originalError?: Error
  ) {
    super(message);
    this.name = 'RetryableError';
    this.errorType = errorType;
    this.statusCode = statusCode;
    this.retryAfter = retryAfter;
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RetryableError);
    }
  }

  /**
   * Create a retryable error
   */
  static retryable(message: string, statusCode?: number, originalError?: Error): RetryableError {
    return new RetryableError(message, ErrorType.RETRYABLE, statusCode, undefined, originalError);
  }

  /**
   * Create a non-retryable error
   */
  static nonRetryable(message: string, statusCode?: number, originalError?: Error): RetryableError {
    return new RetryableError(message, ErrorType.NON_RETRYABLE, statusCode, undefined, originalError);
  }

  /**
   * Create a rate-limited error
   */
  static rateLimited(message: string, retryAfter?: number, statusCode?: number, originalError?: Error): RetryableError {
    return new RetryableError(message, ErrorType.RATE_LIMITED, statusCode, retryAfter, originalError);
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.errorType === ErrorType.RETRYABLE || this.errorType === ErrorType.RATE_LIMITED;
  }

  /**
   * Check if error is rate limited
   */
  isRateLimited(): boolean {
    return this.errorType === ErrorType.RATE_LIMITED;
  }

  /**
   * Get retry delay for rate limited errors
   */
  getRetryDelay(): number | undefined {
    return this.retryAfter;
  }

  /**
   * Convert to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errorType: this.errorType,
      statusCode: this.statusCode,
      retryAfter: this.retryAfter,
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : undefined
    };
  }
}

/**
 * Classify generic errors into retry categories
 */
export function classifyError(error: any): ErrorType {
  // Already classified
  if (error instanceof RetryableError) {
    return error.errorType;
  }

  // Network errors - retryable
  const networkErrorCodes = [
    'ECONNREFUSED',
    'ETIMEDOUT', 
    'ENOTFOUND',
    'ECONNRESET',
    'ECONNABORTED',
    'EPIPE',
    'EHOSTUNREACH',
    'ENETUNREACH'
  ];

  if (networkErrorCodes.includes(error.code)) {
    return ErrorType.RETRYABLE;
  }

  // HTTP status codes
  if (error.response?.status) {
    const status = error.response.status;
    
    // Rate limiting
    if (status === 429) {
      return ErrorType.RATE_LIMITED;
    }
    
    // Server errors - retryable
    if (status >= 500) {
      return ErrorType.RETRYABLE;
    }
    
    // Client errors - generally non-retryable
    if (status >= 400 && status < 500) {
      // Some 4xx errors might be retryable in specific contexts
      const retryable4xx = [408, 409, 423, 424, 425, 426, 428, 431];
      if (retryable4xx.includes(status)) {
        return ErrorType.RETRYABLE;
      }
      return ErrorType.NON_RETRYABLE;
    }
  }

  // Timeout errors
  if (error.message?.toLowerCase().includes('timeout')) {
    return ErrorType.RETRYABLE;
  }

  // DNS errors
  if (error.message?.toLowerCase().includes('dns')) {
    return ErrorType.RETRYABLE;
  }

  // Default to non-retryable for unknown errors
  return ErrorType.NON_RETRYABLE;
}

/**
 * Create RetryableError from generic error
 */
export function createRetryableError(error: any, context?: string): RetryableError {
  const errorType = classifyError(error);
  const message = context ? `${context}: ${error.message}` : error.message;
  
  let statusCode: number | undefined;
  let retryAfter: number | undefined;

  if (error.response?.status) {
    statusCode = error.response.status;
  }

  if (errorType === ErrorType.RATE_LIMITED && error.response?.headers) {
    // Try to extract retry-after header
    const retryAfterHeader = error.response.headers['retry-after'] || 
                           error.response.headers['Retry-After'] ||
                           error.response.headers['x-rate-limit-reset'];
    
    if (retryAfterHeader) {
      retryAfter = parseInt(retryAfterHeader, 10) * 1000; // Convert to milliseconds
    }
  }

  return new RetryableError(message, errorType, statusCode, retryAfter, error);
}

/**
 * Check if an error should be retried based on service configuration
 */
export function shouldRetryError(
  error: any, 
  serviceConfig: { retryableStatusCodes: number[], nonRetryableStatusCodes: number[] }
): boolean {
  const retryableError = error instanceof RetryableError ? error : createRetryableError(error);
  
  // Explicit non-retryable
  if (retryableError.errorType === ErrorType.NON_RETRYABLE) {
    return false;
  }

  // Check service-specific status codes
  if (retryableError.statusCode) {
    if (serviceConfig.nonRetryableStatusCodes.includes(retryableError.statusCode)) {
      return false;
    }
    if (serviceConfig.retryableStatusCodes.includes(retryableError.statusCode)) {
      return true;
    }
  }

  // Default to the classified error type
  return retryableError.isRetryable();
}

export default RetryableError;