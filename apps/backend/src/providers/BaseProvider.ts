import { SocialProvider, PublishPostParams, PublishResult, ProviderErrorCode, PLATFORM_LIMITS } from './SocialProvider';
import { tokenService } from '../services/TokenService';
import { SocialAccount } from '../models/SocialAccount';
import { logger } from '../utils/logger';

/**
 * Base Provider Class
 * 
 * Provides common functionality for all social media providers:
 * - Token management via TokenService
 * - Error classification (retryable vs permanent)
 * - Result normalization
 * - Logging helpers
 */

export abstract class BaseProvider implements SocialProvider {
  protected abstract providerName: string;

  /**
   * Get provider name
   */
  getProviderName(): string {
    return this.providerName;
  }

  /**
   * Abstract method - must be implemented by each provider
   */
  abstract publishPost(params: PublishPostParams): Promise<PublishResult>;

  /**
   * Get valid access token for account
   * Uses TokenService to handle expiration and refresh
   */
  protected async getValidToken(accountId: string): Promise<string> {
    try {
      const token = await tokenService.getValidAccessToken(accountId);
      
      logger.debug('Retrieved valid access token', {
        accountId,
        provider: this.providerName,
      });
      
      return token;
    } catch (error: any) {
      logger.error('Failed to get valid token', {
        accountId,
        provider: this.providerName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get account details
   */
  protected async getAccount(accountId: string): Promise<any> {
    const account = await SocialAccount.findById(accountId);
    if (!account) {
      throw new Error('Social account not found');
    }
    return account;
  }

  /**
   * Classify API error as retryable or permanent
   */
  protected classifyError(error: any): {
    retryable: boolean;
    errorCode: ProviderErrorCode;
    errorMessage: string;
  } {
    const errorMessage = error.message?.toLowerCase() || '';
    const statusCode = error.statusCode || error.status || 0;

    // Network and timeout errors - RETRYABLE
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('socket hang up')
    ) {
      return {
        retryable: true,
        errorCode: ProviderErrorCode.NETWORK_ERROR,
        errorMessage: error.message,
      };
    }

    // Rate limiting - RETRYABLE
    if (
      statusCode === 429 ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests')
    ) {
      return {
        retryable: true,
        errorCode: ProviderErrorCode.RATE_LIMIT,
        errorMessage: error.message,
      };
    }

    // Service unavailable - RETRYABLE
    if (
      statusCode === 503 ||
      statusCode === 502 ||
      statusCode === 504 ||
      errorMessage.includes('service unavailable') ||
      errorMessage.includes('bad gateway') ||
      errorMessage.includes('gateway timeout')
    ) {
      return {
        retryable: true,
        errorCode: ProviderErrorCode.SERVICE_UNAVAILABLE,
        errorMessage: error.message,
      };
    }

    // Internal server errors - RETRYABLE
    if (statusCode === 500 || errorMessage.includes('internal server error')) {
      return {
        retryable: true,
        errorCode: ProviderErrorCode.INTERNAL_ERROR,
        errorMessage: error.message,
      };
    }

    // Authentication errors - PERMANENT
    if (
      statusCode === 401 ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('invalid token') ||
      errorMessage.includes('token expired')
    ) {
      return {
        retryable: false,
        errorCode: ProviderErrorCode.INVALID_TOKEN,
        errorMessage: error.message,
      };
    }

    // Permission errors - PERMANENT
    if (statusCode === 403 || errorMessage.includes('forbidden')) {
      return {
        retryable: false,
        errorCode: ProviderErrorCode.FORBIDDEN,
        errorMessage: error.message,
      };
    }

    // Content errors - PERMANENT
    if (
      errorMessage.includes('content rejected') ||
      errorMessage.includes('content blocked') ||
      errorMessage.includes('duplicate')
    ) {
      return {
        retryable: false,
        errorCode: ProviderErrorCode.CONTENT_REJECTED,
        errorMessage: error.message,
      };
    }

    // Bad request - PERMANENT
    if (statusCode === 400 || errorMessage.includes('bad request')) {
      return {
        retryable: false,
        errorCode: ProviderErrorCode.INVALID_REQUEST,
        errorMessage: error.message,
      };
    }

    // Not found - PERMANENT
    if (statusCode === 404 || errorMessage.includes('not found')) {
      return {
        retryable: false,
        errorCode: ProviderErrorCode.NOT_FOUND,
        errorMessage: error.message,
      };
    }

    // Default to retryable for unknown errors (safer)
    return {
      retryable: true,
      errorCode: ProviderErrorCode.INTERNAL_ERROR,
      errorMessage: error.message || 'Unknown error',
    };
  }

  /**
   * Create success result
   */
  protected createSuccessResult(platformPostId: string, metadata?: any): PublishResult {
    return {
      success: true,
      platformPostId,
      metadata: {
        publishedAt: new Date(),
        ...metadata,
      },
    };
  }

  /**
   * Create error result
   */
  protected createErrorResult(error: any): PublishResult {
    const classification = this.classifyError(error);
    
    return {
      success: false,
      retryable: classification.retryable,
      errorCode: classification.errorCode,
      errorMessage: classification.errorMessage,
    };
  }

  /**
   * Validate post content against platform limits
   */
  validatePost(params: PublishPostParams): { valid: boolean; error?: string } {
    const limits = PLATFORM_LIMITS[this.providerName as keyof typeof PLATFORM_LIMITS];
    
    if (!limits) {
      return { valid: true };
    }

    // Check content length
    if (params.content.length > limits.maxContentLength) {
      return {
        valid: false,
        error: `Content exceeds ${this.providerName} limit of ${limits.maxContentLength} characters`,
      };
    }

    // Check media count
    if (params.mediaUrls && params.mediaUrls.length > limits.maxMediaCount) {
      return {
        valid: false,
        error: `Media count exceeds ${this.providerName} limit of ${limits.maxMediaCount} files`,
      };
    }

    return { valid: true };
  }

  /**
   * Log publish attempt
   */
  protected logPublishAttempt(params: PublishPostParams): void {
    logger.info('Publishing post to platform', {
      provider: this.providerName,
      accountId: params.accountId,
      contentLength: params.content.length,
      mediaCount: params.mediaUrls?.length || 0,
    });
  }

  /**
   * Log publish success
   */
  protected logPublishSuccess(platformPostId: string, params: PublishPostParams): void {
    logger.info('Post published successfully', {
      provider: this.providerName,
      accountId: params.accountId,
      platformPostId,
    });
  }

  /**
   * Log publish error
   */
  protected logPublishError(error: any, params: PublishPostParams): void {
    const classification = this.classifyError(error);
    
    logger.error('Post publish failed', {
      provider: this.providerName,
      accountId: params.accountId,
      error: error.message,
      errorCode: classification.errorCode,
      retryable: classification.retryable,
    });
  }
}