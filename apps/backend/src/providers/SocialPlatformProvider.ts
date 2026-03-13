import mongoose from 'mongoose';
import { EventEmitter } from 'events';

/**
 * Social Platform Provider Interface
 * 
 * Unified interface for all social media platform integrations
 * 
 * Features:
 * - OAuth flow management
 * - Token lifecycle management
 * - Publishing with idempotency
 * - Event-driven architecture
 * - Rate limit awareness
 * - Error classification
 * 
 * Providers emit domain events for:
 * - publish.started
 * - publish.success
 * - publish.failed
 * - token.refreshed
 * - token.expired
 * - token.revoked
 * - rate_limit.hit
 * - rate_limit.reset
 */

// ============================================================================
// Domain Events
// ============================================================================

export interface PublishStartedEvent {
  postId: string;
  accountId: string;
  platform: string;
  timestamp: Date;
}

export interface PublishSuccessEvent {
  postId: string;
  accountId: string;
  platform: string;
  platformPostId: string;
  publishedAt: Date;
  duration: number;
  timestamp: Date;
}

export interface PublishFailedEvent {
  postId: string;
  accountId: string;
  platform: string;
  error: string;
  errorCategory: string;
  retryable: boolean;
  duration: number;
  timestamp: Date;
}

export interface TokenRefreshedEvent {
  accountId: string;
  platform: string;
  expiresAt: Date;
  timestamp: Date;
}

export interface TokenExpiredEvent {
  accountId: string;
  platform: string;
  timestamp: Date;
}

export interface TokenRevokedEvent {
  accountId: string;
  platform: string;
  reason: string;
  timestamp: Date;
}

export interface RateLimitHitEvent {
  accountId: string;
  platform: string;
  operation: string;
  resetAt: Date;
  timestamp: Date;
}

export interface RateLimitResetEvent {
  accountId: string;
  platform: string;
  operation: string;
  timestamp: Date;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface OAuthInitiateRequest {
  workspaceId: mongoose.Types.ObjectId | string;
  redirectUri: string;
}

export interface OAuthInitiateResponse {
  authorizationUrl: string;
  state: string;
  codeVerifier?: string; // For PKCE
}

export interface OAuthCallbackRequest {
  code: string;
  state: string;
  codeVerifier?: string; // For PKCE
  workspaceId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  ipAddress: string;
}

export interface OAuthCallbackResponse {
  accountId: mongoose.Types.ObjectId;
  platform: string;
  username: string;
  profileUrl?: string;
}

export interface TokenRefreshRequest {
  accountId: mongoose.Types.ObjectId | string;
}

export interface TokenRefreshResponse {
  success: boolean;
  expiresAt?: Date;
  error?: string;
  shouldReconnect?: boolean;
}

export interface PublishRequest {
  postId: mongoose.Types.ObjectId | string;
  accountId: mongoose.Types.ObjectId | string;
  content: string;
  mediaUrls?: string[];
  metadata?: Record<string, any>;
}

export interface PublishResponse {
  success: boolean;
  platformPostId?: string;
  publishedAt?: Date;
  url?: string;
  error?: string;
  errorCategory?: string;
  retryable?: boolean;
}

export interface RevokeRequest {
  accountId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  ipAddress: string;
}

export interface AccountValidationRequest {
  accountId: mongoose.Types.ObjectId | string;
}

export interface AccountValidationResponse {
  valid: boolean;
  reason?: string;
}

// ============================================================================
// Platform Capabilities
// ============================================================================

export interface PlatformCapabilities {
  maxTextLength: number;
  maxImages: number;
  maxVideos: number;
  maxImageSize: number; // bytes
  maxVideoSize: number; // bytes
  supportsScheduling: boolean;
  supportsThreads: boolean;
  supportsPolls: boolean;
  supportsHashtags: boolean;
  supportsMentions: boolean;
}

// ============================================================================
// Rate Limit Info
// ============================================================================

export interface RateLimitInfo {
  operation: string;
  limit: number;
  remaining: number;
  resetAt: Date;
}

// ============================================================================
// Provider Interface
// ============================================================================

export abstract class SocialPlatformProvider extends EventEmitter {
  protected readonly platform: string;

  constructor(platform: string) {
    super();
    this.platform = platform;
  }

  /**
   * Get platform name
   */
  getPlatform(): string {
    return this.platform;
  }

  /**
   * Get platform capabilities
   */
  abstract getCapabilities(): PlatformCapabilities;

  /**
   * Initiate OAuth flow
   * 
   * Generates authorization URL for user to grant permissions
   */
  abstract initiateOAuth(request: OAuthInitiateRequest): Promise<OAuthInitiateResponse>;

  /**
   * Handle OAuth callback
   * 
   * Exchanges authorization code for tokens and creates/updates account
   * Emits: oauth.connected
   */
  abstract handleOAuthCallback(request: OAuthCallbackRequest): Promise<OAuthCallbackResponse>;

  /**
   * Refresh access token
   * 
   * Uses refresh token to get new access token
   * Emits: token.refreshed, token.expired, token.revoked
   */
  abstract refreshToken(request: TokenRefreshRequest): Promise<TokenRefreshResponse>;

  /**
   * Publish post to platform
   * 
   * Publishes content with idempotency guarantees
   * Emits: publish.started, publish.success, publish.failed, rate_limit.hit
   */
  abstract publish(request: PublishRequest): Promise<PublishResponse>;

  /**
   * Revoke access
   * 
   * Revokes token on platform and marks account as revoked
   * Emits: token.revoked
   */
  abstract revokeAccess(request: RevokeRequest): Promise<void>;

  /**
   * Validate account
   * 
   * Checks if account is still valid and accessible
   */
  abstract validateAccount(request: AccountValidationRequest): Promise<AccountValidationResponse>;

  /**
   * Get current rate limit status
   * 
   * Returns rate limit information for various operations
   */
  abstract getRateLimitStatus(accountId: mongoose.Types.ObjectId | string): Promise<RateLimitInfo[]>;

  /**
   * Check if token needs refresh
   * 
   * Returns true if token expires within threshold (default 5 minutes)
   */
  abstract needsRefresh(
    accountId: mongoose.Types.ObjectId | string,
    thresholdMinutes?: number
  ): Promise<boolean>;

  /**
   * Lookup post by platform post ID
   * 
   * Retrieves post information from the platform
   */
  abstract lookupPost(request: {
    accountId: mongoose.Types.ObjectId | string;
    platformPostId: string;
  }): Promise<{
    found: boolean;
    post?: any;
    error?: string;
  }>;

  // ============================================================================
  // Event Emitters (protected helpers for subclasses)
  // ============================================================================

  protected emitPublishStarted(event: PublishStartedEvent): void {
    this.emit('publish.started', event);
  }

  protected emitPublishSuccess(event: PublishSuccessEvent): void {
    this.emit('publish.success', event);
  }

  protected emitPublishFailed(event: PublishFailedEvent): void {
    this.emit('publish.failed', event);
  }

  protected emitTokenRefreshed(event: TokenRefreshedEvent): void {
    this.emit('token.refreshed', event);
  }

  protected emitTokenExpired(event: TokenExpiredEvent): void {
    this.emit('token.expired', event);
  }

  protected emitTokenRevoked(event: TokenRevokedEvent): void {
    this.emit('token.revoked', event);
  }

  protected emitRateLimitHit(event: RateLimitHitEvent): void {
    this.emit('rate_limit.hit', event);
  }

  protected emitRateLimitReset(event: RateLimitResetEvent): void {
    this.emit('rate_limit.reset', event);
  }
}
