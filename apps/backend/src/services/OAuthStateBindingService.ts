/**
 * OAuth State Binding Service
 * 
 * Binds OAuth state to IP address and User-Agent to prevent replay attacks
 */

import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

const STATE_TTL_SECONDS = 600; // 10 minutes

interface OAuthStateData {
  ip: string;
  userAgent: string;
  createdAt: number;
  workspaceId?: string;
  provider: string;
}

export class OAuthStateBindingService {
  private readonly keyPrefix = 'oauth:state';

  constructor(private redis: Redis) {}

  /**
   * Store OAuth state with IP and User-Agent binding
   * 
   * @param state - OAuth state token
   * @param ip - Client IP address
   * @param userAgent - Client User-Agent
   * @param provider - OAuth provider
   * @param workspaceId - Optional workspace ID
   */
  async bindState(
    state: string,
    ip: string,
    userAgent: string,
    provider: string,
    workspaceId?: string
  ): Promise<void> {
    const key = this.getKey(state);
    const data: OAuthStateData = {
      ip,
      userAgent,
      createdAt: Date.now(),
      provider,
      workspaceId,
    };

    try {
      await this.redis.setex(key, STATE_TTL_SECONDS, JSON.stringify(data));

      logger.debug('OAuth state bound', {
        state,
        provider,
        ip,
        workspaceId,
      });
    } catch (error: any) {
      logger.error('Failed to bind OAuth state', {
        state,
        provider,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Verify OAuth state matches IP and User-Agent
   * 
   * @param state - OAuth state token
   * @param ip - Client IP address
   * @param userAgent - Client User-Agent
   * @returns true if valid, false if mismatch or not found
   */
  async verifyState(
    state: string,
    ip: string,
    userAgent: string
  ): Promise<{ valid: boolean; data?: OAuthStateData; reason?: string }> {
    const key = this.getKey(state);

    try {
      const dataStr = await this.redis.get(key);

      if (!dataStr) {
        logger.warn('OAuth state not found or expired', {
          state,
          ip,
          alert: 'OAUTH_STATE_NOT_FOUND',
        });
        return { valid: false, reason: 'state_not_found' };
      }

      const data: OAuthStateData = JSON.parse(dataStr);

      // Verify IP match
      if (data.ip !== ip) {
        logger.warn('OAuth state IP mismatch', {
          state,
          expectedIp: data.ip,
          actualIp: ip,
          provider: data.provider,
          alert: 'OAUTH_IP_MISMATCH',
        });
        return { valid: false, data, reason: 'ip_mismatch' };
      }

      // Verify User-Agent match
      if (data.userAgent !== userAgent) {
        logger.warn('OAuth state User-Agent mismatch', {
          state,
          expectedUserAgent: data.userAgent,
          actualUserAgent: userAgent,
          provider: data.provider,
          alert: 'OAUTH_USER_AGENT_MISMATCH',
        });
        return { valid: false, data, reason: 'user_agent_mismatch' };
      }

      logger.debug('OAuth state verified', {
        state,
        provider: data.provider,
        ip,
      });

      return { valid: true, data };
    } catch (error: any) {
      logger.error('Failed to verify OAuth state', {
        state,
        error: error.message,
      });
      return { valid: false, reason: 'verification_error' };
    }
  }

  /**
   * Consume OAuth state (delete after use)
   * 
   * @param state - OAuth state token
   */
  async consumeState(state: string): Promise<void> {
    const key = this.getKey(state);

    try {
      await this.redis.del(key);

      logger.debug('OAuth state consumed', { state });
    } catch (error: any) {
      logger.error('Failed to consume OAuth state', {
        state,
        error: error.message,
      });
    }
  }

  /**
   * Get Redis key for OAuth state
   */
  private getKey(state: string): string {
    return `${this.keyPrefix}:${state}`;
  }

  /**
   * Clear all OAuth states (for testing)
   */
  async clearAll(): Promise<void> {
    const pattern = `${this.keyPrefix}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
