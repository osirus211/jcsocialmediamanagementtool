/**
 * RetryManager - Core retry logic with exponential backoff
 * 
 * Provides comprehensive retry functionality for external API calls with:
 * - Exponential backoff with jitter
 * - Configurable retry policies per service
 * - Detailed retry attempt logging
 * - Error classification for retry decisions
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs?: number;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
  retryLog: RetryAttempt[];
}

export interface RetryAttempt {
  attempt: number;
  timestamp: string;
  duration: number;
  error?: string;
  success: boolean;
  delayBeforeRetry?: number;
}

export enum ErrorType {
  RETRYABLE = 'RETRYABLE',
  NON_RETRYABLE = 'NON_RETRYABLE',
  RATE_LIMITED = 'RATE_LIMITED'
}

export class RetryableError extends Error {
  constructor(
    message: string,
    public errorType: ErrorType,
    public statusCode?: number,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class RetryManager {
  private logger: any;

  constructor(logger?: any) {
    this.logger = logger || console;
  }

  /**
   * Execute an operation with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    context: string
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const retryLog: RetryAttempt[] = [];
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      const attemptStart = Date.now();
      
      try {
        const result = await operation();
        const duration = Date.now() - attemptStart;
        
        const attemptLog: RetryAttempt = {
          attempt,
          timestamp: new Date().toISOString(),
          duration,
          success: true
        };
        
        retryLog.push(attemptLog);
        this.logAttempt(attemptLog, context);

        return {
          success: true,
          result,
          attempts: attempt,
          totalDuration: Date.now() - startTime,
          retryLog
        };
      } catch (error) {
        const duration = Date.now() - attemptStart;
        lastError = error as Error;
        
        const attemptLog: RetryAttempt = {
          attempt,
          timestamp: new Date().toISOString(),
          duration,
          error: lastError.message,
          success: false
        };

        // Check if we should retry
        const shouldRetry = this.shouldRetry(lastError, attempt, config);
        
        if (shouldRetry && attempt <= config.maxRetries) {
          const delay = this.calculateDelay(attempt, config);
          attemptLog.delayBeforeRetry = delay;
          
          retryLog.push(attemptLog);
          this.logAttempt(attemptLog, context);
          
          // Wait before retry
          await this.delay(delay);
        } else {
          retryLog.push(attemptLog);
          this.logAttempt(attemptLog, context);
          break;
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: retryLog.length,
      totalDuration: Date.now() - startTime,
      retryLog
    };
  }

  /**
   * Calculate delay for next retry attempt using exponential backoff with jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * (multiplier ^ (attempt - 1))
    const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Apply max delay cap
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
    
    // Add jitter to prevent thundering herd
    const jitter = config.jitterMs ? Math.random() * config.jitterMs : 0;
    
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetry(error: Error, attempt: number, config: RetryConfig): boolean {
    // Don't retry if we've exceeded max attempts
    if (attempt > config.maxRetries) {
      return false;
    }

    // Check if it's a RetryableError with explicit classification
    if (error instanceof RetryableError) {
      return error.errorType === ErrorType.RETRYABLE || error.errorType === ErrorType.RATE_LIMITED;
    }

    // Classify generic errors
    const errorType = this.classifyError(error);
    return errorType === ErrorType.RETRYABLE || errorType === ErrorType.RATE_LIMITED;
  }

  /**
   * Classify errors to determine retry behavior
   */
  private classifyError(error: any): ErrorType {
    // Network errors - retryable
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNRESET') {
      return ErrorType.RETRYABLE;
    }

    // HTTP status codes
    if (error.response?.status) {
      const status = error.response.status;
      if (status === 429) return ErrorType.RATE_LIMITED;
      if (status >= 500) return ErrorType.RETRYABLE;
      if (status >= 400 && status < 500) return ErrorType.NON_RETRYABLE;
    }

    // Axios specific errors
    if (error.code === 'ECONNABORTED') return ErrorType.RETRYABLE;

    // Default to non-retryable for unknown errors
    return ErrorType.NON_RETRYABLE;
  }

  /**
   * Log retry attempt with context
   */
  private logAttempt(attempt: RetryAttempt, context: string): void {
    const logLevel = attempt.success ? 'info' : 'warn';
    const message = attempt.success 
      ? `Retry attempt ${attempt.attempt} succeeded for ${context}`
      : `Retry attempt ${attempt.attempt} failed for ${context}: ${attempt.error}`;

    const logData = {
      context,
      attempt: attempt.attempt,
      timestamp: attempt.timestamp,
      duration: attempt.duration,
      success: attempt.success,
      error: attempt.error,
      delayBeforeRetry: attempt.delayBeforeRetry
    };

    if (this.logger[logLevel]) {
      this.logger[logLevel](message, logData);
    } else {
      console.log(`[${logLevel.toUpperCase()}] ${message}`, logData);
    }
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default RetryManager;