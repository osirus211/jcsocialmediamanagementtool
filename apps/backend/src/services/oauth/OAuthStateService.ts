/**
 * OAuth State Service - Redis-Based
 * 
 * Production-grade OAuth state management with distributed storage
 * 
 * Features:
 * - Redis-based distributed state storage (horizontal scaling support)
 * - Atomic GETDEL operations (one-time use semantics)
 * - Automatic TTL expiry (10 minutes)
 * - IP address binding for replay attack protection
 * - User-Agent fingerprinting
 * - Correlation ID tracking
 * - Comprehensive error handling
 * 
 * Security:
 * - 256-bit cryptographically secure state generation
 * - One-time use (state deleted after retrieval)
 * - IP binding validation
 * - Automatic expiry via Redis TTL
 * - No manual cleanup required
 */

import crypto from 'crypto';
import { redisClient } from '../../utils/redisClient';
import { logger } from '../../utils/logger';
import { SocialPlatform } from '../../models/SocialAccount';

/**
 * OAuth state data structure
 */
export interface OAuthStateData {
  state: string;
  platform: SocialPlatform;
  workspaceId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  codeVerifier?: string; // For PKCE
  providerType?: string; // For Instagram (INSTAGRAM_BUSINESS | INSTAGRAM_BASIC)
  correlationId: string;
  createdAt: string; // ISO timestamp
  // Mastodon-specific fields
  instanceUrl?: string;
  clientId?: string;
  clientSecret?: string;
}

/**
 * OAuth state creation options
 */
export interface CreateStateOptions {
  platform: SocialPlatform;
  workspaceId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  codeVerifier?: string;
  providerType?: string;
  correlationId?: string;
  // Mastodon-specific fields
  instanceUrl?: string;
  clientId?: string;
  clientSecret?: string;
}

/**
 * OAuth state validation result
 */
export interface StateValidationResult {
  valid: boolean;
  data?: OAuthStateData;
  error?: string;
}

export class OAuthStateService {
  private readonly STATE_PREFIX = 'oauth:state:';
  private readonly STATE_EXPIRY_SECONDS = 10 * 60; // 10 minutes
  private readonly STATE_ENTROPY_BYTES = 32; // 256 bits

  /**
   * Create and store OAuth state in Redis
   * 
   * @param options - State creation options
   * @returns Generated state parameter
   */
  async createState(options: CreateStateOptions): Promise<string> {
    try {
      // Generate cryptographically secure state parameter
      const state = this.generateState();

      // Generate correlation ID if not provided
      const correlationId = options.correlationId || crypto.randomUUID();

      // Prepare state data
      const stateData: OAuthStateData = {
        state,
        platform: options.platform,
        workspaceId: options.workspaceId,
        userId: options.userId,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        codeVerifier: options.codeVerifier,
        providerType: options.providerType,
        correlationId,
        createdAt: new Date().toISOString(),
        instanceUrl: options.instanceUrl,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
      };

      // Store in Redis with TTL
      const redis = redisClient.getClient();
      const key = this.getRedisKey(state);
      const value = JSON.stringify(stateData);

      await redis.setex(key, this.STATE_EXPIRY_SECONDS, value);

      logger.info('OAuth state created', {
        state,
        platform: options.platform,
        workspaceId: options.workspaceId,
        userId: options.userId,
        correlationId,
        expiresIn: this.STATE_EXPIRY_SECONDS,
      });

      return state;
    } catch (error: any) {
      logger.error('Failed to create OAuth state', {
        error: error.message,
        platform: options.platform,
        workspaceId: options.workspaceId,
      });
      throw new Error(`Failed to create OAuth state: ${error.message}`);
    }
  }

  /**
   * Consume OAuth state (retrieve and delete atomically)
   * 
   * Uses Redis GETDEL for atomic one-time use semantics
   * 
   * @param state - State parameter from OAuth callback
   * @param ipAddress - IP address from callback request
   * @param userAgent - User-Agent from callback request
   * @returns State validation result
   */
  async consumeState(
    state: string,
    ipAddress: string,
    userAgent: string
  ): Promise<StateValidationResult> {
    try {
      const redis = redisClient.getClient();
      const key = this.getRedisKey(state);

      // Atomic get-and-delete operation
      const value = await redis.getdel(key);

      if (!value) {
        logger.warn('OAuth state not found or already consumed', {
          state,
          ipAddress,
        });
        return {
          valid: false,
          error: 'INVALID_STATE',
        };
      }

      // Parse state data
      const stateData: OAuthStateData = JSON.parse(value);

      // Validate IP address binding
      if (stateData.ipAddress !== ipAddress) {
        logger.warn('OAuth state IP address mismatch', {
          state,
          expectedIp: stateData.ipAddress,
          actualIp: ipAddress,
          correlationId: stateData.correlationId,
        });
        return {
          valid: false,
          error: 'IP_MISMATCH',
        };
      }

      // Validate User-Agent (optional, log warning only)
      if (stateData.userAgent !== userAgent) {
        logger.warn('OAuth state User-Agent mismatch', {
          state,
          expectedUA: stateData.userAgent,
          actualUA: userAgent,
          correlationId: stateData.correlationId,
        });
        // Don't fail on UA mismatch (browsers can change UA)
      }

      // Check if state has expired (should not happen due to Redis TTL, but double-check)
      const age = Date.now() - new Date(stateData.createdAt).getTime();
      if (age > this.STATE_EXPIRY_SECONDS * 1000) {
        logger.warn('OAuth state expired', {
          state,
          age,
          correlationId: stateData.correlationId,
        });
        return {
          valid: false,
          error: 'STATE_EXPIRED',
        };
      }

      logger.info('OAuth state consumed successfully', {
        state,
        platform: stateData.platform,
        workspaceId: stateData.workspaceId,
        userId: stateData.userId,
        correlationId: stateData.correlationId,
        age,
      });

      return {
        valid: true,
        data: stateData,
      };
    } catch (error: any) {
      logger.error('Failed to consume OAuth state', {
        error: error.message,
        state,
        ipAddress,
      });
      return {
        valid: false,
        error: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Validate state without consuming (for debugging/testing)
   * 
   * @param state - State parameter to validate
   * @returns State data if valid, null otherwise
   */
  async validateState(state: string): Promise<OAuthStateData | null> {
    try {
      const redis = redisClient.getClient();
      const key = this.getRedisKey(state);

      const value = await redis.get(key);

      if (!value) {
        return null;
      }

      const stateData: OAuthStateData = JSON.parse(value);
      return stateData;
    } catch (error: any) {
      logger.error('Failed to validate OAuth state', {
        error: error.message,
        state,
      });
      return null;
    }
  }

  /**
   * Delete OAuth state manually (for cleanup/testing)
   * 
   * @param state - State parameter to delete
   * @returns True if deleted, false otherwise
   */
  async deleteState(state: string): Promise<boolean> {
    try {
      const redis = redisClient.getClient();
      const key = this.getRedisKey(state);

      const result = await redis.del(key);

      logger.info('OAuth state deleted', {
        state,
        deleted: result === 1,
      });

      return result === 1;
    } catch (error: any) {
      logger.error('Failed to delete OAuth state', {
        error: error.message,
        state,
      });
      return false;
    }
  }

  /**
   * Get count of active OAuth states (for monitoring)
   * 
   * @returns Number of active states
   */
  async getActiveStateCount(): Promise<number> {
    try {
      const redis = redisClient.getClient();
      const pattern = `${this.STATE_PREFIX}*`;

      const keys = await redis.keys(pattern);

      return keys.length;
    } catch (error: any) {
      logger.error('Failed to get active state count', {
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Generate cryptographically secure state parameter
   * 
   * @returns Base64url-encoded state (256-bit entropy)
   */
  private generateState(): string {
    return crypto.randomBytes(this.STATE_ENTROPY_BYTES).toString('base64url');
  }

  /**
   * Get Redis key for state
   * 
   * @param state - State parameter
   * @returns Redis key
   */
  private getRedisKey(state: string): string {
    return `${this.STATE_PREFIX}${state}`;
  }
}

// Export singleton instance
export const oauthStateService = new OAuthStateService();
