/**
 * Base Platform Adapter
 * 
 * Abstract base class providing common functionality for all platform adapters
 * Implements shared error handling, rate limiting, and validation logic
 */

import { logger } from '../utils/logger';
import {
  PlatformAdapter,
  PlatformToken,
  PlatformAccount,
  AuthUrlResult,
  PermissionValidationResult,
  PlatformCapabilities,
  SocialPlatform,
} from './platforms/PlatformAdapter';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

export abstract class BasePlatformAdapter implements PlatformAdapter {
  protected platform: SocialPlatform;
  protected clientId: string;
  protected clientSecret: string;

  constructor(platform: SocialPlatform, clientId: string, clientSecret: string) {
    this.platform = platform;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Generate OAuth authorization URL
   * Must be implemented by each platform adapter
   */
  abstract generateAuthUrl(
    redirectUri: string,
    state: string,
    scopes: string[]
  ): Promise<AuthUrlResult>;

  /**
   * Exchange authorization code for access tokens
   * Must be implemented by each platform adapter
   */
  abstract exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<PlatformToken>;

  /**
   * Refresh access token using refresh token
   * Must be implemented by each platform adapter
   */
  abstract refreshAccessToken(refreshToken: string): Promise<PlatformToken>;

  /**
   * Discover available accounts for connection
   * Must be implemented by each platform adapter
   */
  abstract discoverAccounts(accessToken: string): Promise<PlatformAccount[]>;

  /**
   * Validate granted permissions
   * Must be implemented by each platform adapter
   */
  abstract validatePermissions(accessToken: string): Promise<PermissionValidationResult>;

  /**
   * Get platform capabilities
   * Must be implemented by each platform adapter
   */
  abstract getCapabilities(accountType?: string): PlatformCapabilities;

  /**
   * Validate account credentials
   * Common validation logic for all platforms
   */
  protected async validateAccount(accessToken: string): Promise<boolean> {
    try {
      const validation = await this.validatePermissions(accessToken);
      return validation.valid;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to validate ${this.platform} account`, {
        platform: this.platform,
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * Handle rate limit errors
   * Common rate limit handling for all platforms
   */
  protected handleRateLimit(error: unknown): never {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`Rate limit hit for ${this.platform}`, {
      platform: this.platform,
      error: errorMessage,
    });
    throw new BadRequestError(`Rate limit exceeded for ${this.platform}. Please try again later.`);
  }

  /**
   * Format error for consistent error responses
   * Common error formatting for all platforms
   */
  protected formatError(error: unknown, context: string): Error {
    if (error instanceof Error) {
      logger.error(`${this.platform} adapter error: ${context}`, {
        platform: this.platform,
        error: error.message,
        stack: error.stack,
      });
      return error;
    }

    const errorMessage = typeof error === 'string' ? error : 'Unknown error';
    logger.error(`${this.platform} adapter error: ${context}`, {
      platform: this.platform,
      error: errorMessage,
    });
    return new Error(errorMessage);
  }

  /**
   * Validate media type for platform
   * Common media validation for all platforms
   */
  protected validateMediaType(mediaType: string, capabilities: PlatformCapabilities): boolean {
    const supportedFormats = capabilities.supportedFormats || [];
    return supportedFormats.includes(mediaType);
  }

  /**
   * Get account info from access token
   * Common account info retrieval for all platforms
   */
  protected async getAccountInfo(accessToken: string): Promise<PlatformAccount | null> {
    try {
      const accounts = await this.discoverAccounts(accessToken);
      return accounts.length > 0 ? accounts[0] : null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get ${this.platform} account info`, {
        platform: this.platform,
        error: errorMessage,
      });
      return null;
    }
  }
}
