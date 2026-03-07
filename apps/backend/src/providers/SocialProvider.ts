/**
 * Social Provider Interface
 * 
 * Defines the contract for all social media platform providers
 * Enables clean abstraction and easy swapping between mock and real implementations
 */

export interface PublishPostParams {
  accountId: string;
  content: string;
  mediaUrls?: string[];
  metadata?: {
    [key: string]: any;
  };
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  retryable?: boolean;
  errorCode?: string;
  errorMessage?: string;
  metadata?: {
    url?: string;
    publishedAt?: Date;
    [key: string]: any;
  };
}

export interface SocialProvider {
  /**
   * Publish a post to the social platform
   */
  publishPost(params: PublishPostParams): Promise<PublishResult>;

  /**
   * Get provider name
   */
  getProviderName(): string;

  /**
   * Validate post content for platform-specific requirements
   */
  validatePost(params: PublishPostParams): { valid: boolean; error?: string };
}

/**
 * Error codes for standardized error handling
 */
export enum ProviderErrorCode {
  // Retryable errors
  RATE_LIMIT = 'RATE_LIMIT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  
  // Permanent errors
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONTENT_REJECTED = 'CONTENT_REJECTED',
  DUPLICATE_CONTENT = 'DUPLICATE_CONTENT',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
}

/**
 * Platform-specific content limits
 */
export const PLATFORM_LIMITS = {
  twitter: {
    maxContentLength: 280,
    maxMediaCount: 4,
    supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
  },
  linkedin: {
    maxContentLength: 3000,
    maxMediaCount: 9,
    supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif'],
  },
  facebook: {
    maxContentLength: 63206,
    maxMediaCount: 10,
    supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
  },
  instagram: {
    maxContentLength: 2200,
    maxMediaCount: 10,
    supportedMediaTypes: ['image/jpeg', 'image/png'],
  },
} as const;