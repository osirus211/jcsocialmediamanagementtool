/**
 * OAuth Idempotency Service
 * 
 * Provides distributed idempotency guard for OAuth callback handling
 * Prevents duplicate processing from:
 * - Browser retries
 * - Reverse proxy retries
 * - Network flaps
 * - Double-clicks
 * - Race conditions
 * 
 * Implementation:
 * - Redis SETNX for atomic check-and-set
 * - 5-minute TTL for idempotency keys
 * - Fail-closed if Redis unavailable
 * - Multi-instance safe
 */

import { getRedisClientSafe } from '../config/redis';
import { logger } from '../utils/logger';

export class OAuthIdempotencyService {
  private static instance: OAuthIdempotencyService;
  private readonly KEY_PREFIX = 'oauth:idempotency:';
  private readonly TTL_SECONDS = 300; // 5 minutes

  static getInstance(): OAuthIdempotencyService {
    if (!OAuthIdempotencyService.instance) {
      OAuthIdempotencyService.instance = new OAuthIdempotencyService();
    }
    return OAuthIdempotencyService.instance;
  }

  /**
   * Check and set idempotency key atomically
   * 
   * @param state - OAuth state parameter (unique per flow)
   * @param correlationId - Request correlation ID for logging
   * @returns true if this is the first processing attempt, false if already processed
   * @throws Error if Redis unavailable (fail-closed)
   */
  async checkAndSet(state: string, correlationId?: string): Promise<boolean> {
    const redis = getRedisClientSafe();

    // Fail-closed: If Redis unavailable, throw error
    if (!redis) {
      logger.error('[OAuth Idempotency] Redis unavailable - failing closed', {
        correlationId,
        state: state.substring(0, 10) + '...',
      });
      throw new Error('OAuth idempotency check failed: Redis unavailable');
    }

    const key = this.KEY_PREFIX + state;

    try {
      // SETNX with expiration (atomic operation)
      // Returns 'OK' if key was set (first attempt)
      // Returns null if key already exists (duplicate attempt)
      const result = await redis.set(key, '1', 'EX', this.TTL_SECONDS, 'NX');

      const isFirstAttempt = result === 'OK';

      if (isFirstAttempt) {
        logger.info('[OAuth Idempotency] First processing attempt', {
          correlationId,
          state: state.substring(0, 10) + '...',
          ttl: this.TTL_SECONDS,
        });
      } else {
        logger.warn('[OAuth Idempotency] Duplicate processing attempt detected', {
          correlationId,
          state: state.substring(0, 10) + '...',
          action: 'rejected',
        });
      }

      return isFirstAttempt;
    } catch (error: any) {
      // Fail-closed: If Redis operation fails, throw error
      logger.error('[OAuth Idempotency] Redis operation failed - failing closed', {
        correlationId,
        state: state.substring(0, 10) + '...',
        error: error.message,
      });
      throw new Error('OAuth idempotency check failed: Redis error');
    }
  }

  /**
   * Remove idempotency key (for testing/cleanup only)
   * 
   * @param state - OAuth state parameter
   */
  async remove(state: string): Promise<void> {
    const redis = getRedisClientSafe();

    if (!redis) {
      logger.warn('[OAuth Idempotency] Redis unavailable - cannot remove key');
      return;
    }

    const key = this.KEY_PREFIX + state;

    try {
      await redis.del(key);
      logger.debug('[OAuth Idempotency] Key removed', {
        state: state.substring(0, 10) + '...',
      });
    } catch (error: any) {
      logger.error('[OAuth Idempotency] Failed to remove key', {
        state: state.substring(0, 10) + '...',
        error: error.message,
      });
    }
  }

  /**
   * Check if state has been processed (without setting)
   * 
   * @param state - OAuth state parameter
   * @returns true if already processed, false otherwise
   */
  async isProcessed(state: string): Promise<boolean> {
    const redis = getRedisClientSafe();

    if (!redis) {
      return false;
    }

    const key = this.KEY_PREFIX + state;

    try {
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error: any) {
      logger.error('[OAuth Idempotency] Failed to check key existence', {
        state: state.substring(0, 10) + '...',
        error: error.message,
      });
      return false;
    }
  }
}

// Export singleton instance
export const oauthIdempotencyService = OAuthIdempotencyService.getInstance();
