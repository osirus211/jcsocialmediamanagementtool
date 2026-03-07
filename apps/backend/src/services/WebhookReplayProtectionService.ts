/**
 * Webhook Replay Protection Service
 * 
 * Prevents replay attacks by rejecting:
 * - Events older than 5 minutes
 * - Events with duplicate signatures
 */

import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const REPLAY_TTL_SECONDS = 300; // 5 minutes

export class WebhookReplayProtectionService {
  private readonly keyPrefix = 'webhook:replay';

  constructor(private redis: Redis) {}

  /**
   * Check if webhook event is a replay attack
   * 
   * @param provider - Provider name
   * @param signature - Webhook signature
   * @param timestamp - Event timestamp (from provider header or received time)
   * @returns true if replay detected, false if valid
   */
  async isReplay(
    provider: string,
    signature: string,
    timestamp: Date
  ): Promise<boolean> {
    const now = Date.now();
    const eventTime = timestamp.getTime();

    // Check 1: Reject events older than 5 minutes
    if (now - eventTime > REPLAY_WINDOW_MS) {
      logger.warn('Webhook event too old (replay protection)', {
        provider,
        eventAge: now - eventTime,
        maxAge: REPLAY_WINDOW_MS,
        alert: 'WEBHOOK_REPLAY_OLD_EVENT',
      });
      return true;
    }

    // Check 2: Check if signature already seen
    const signatureHash = this.hashSignature(signature);
    const key = this.getKey(provider, signatureHash);

    try {
      const exists = await this.redis.exists(key);

      if (exists) {
        logger.warn('Webhook signature already seen (replay protection)', {
          provider,
          signatureHash,
          alert: 'WEBHOOK_REPLAY_DUPLICATE',
        });
        return true;
      }

      // Mark signature as seen
      await this.redis.setex(key, REPLAY_TTL_SECONDS, eventTime.toString());

      logger.debug('Webhook replay check passed', {
        provider,
        signatureHash,
      });

      return false;
    } catch (error: any) {
      logger.error('Replay protection check failed', {
        provider,
        error: error.message,
      });
      // Fail open - allow request if Redis fails
      return false;
    }
  }

  /**
   * Extract timestamp from provider headers
   * 
   * @param provider - Provider name
   * @param headers - Request headers
   * @returns Timestamp or null if not found
   */
  extractTimestamp(provider: string, headers: any): Date | null {
    try {
      switch (provider) {
        case 'facebook':
        case 'instagram':
        case 'threads':
          // Facebook doesn't provide timestamp header
          return null;

        case 'twitter':
          // Twitter provides timestamp in signature
          // Format: sha256=timestamp:signature
          const twitterSig = headers['x-twitter-webhooks-signature'];
          if (twitterSig) {
            const match = twitterSig.match(/sha256=(\d+):/);
            if (match) {
              return new Date(parseInt(match[1]) * 1000);
            }
          }
          return null;

        case 'linkedin':
          // LinkedIn may provide timestamp
          const linkedinTimestamp = headers['x-li-timestamp'];
          if (linkedinTimestamp) {
            return new Date(parseInt(linkedinTimestamp) * 1000);
          }
          return null;

        default:
          return null;
      }
    } catch (error: any) {
      logger.warn('Failed to extract timestamp from headers', {
        provider,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Hash signature for storage
   */
  private hashSignature(signature: string): string {
    return crypto.createHash('sha256').update(signature).digest('hex');
  }

  /**
   * Get Redis key for replay protection
   */
  private getKey(provider: string, signatureHash: string): string {
    return `${this.keyPrefix}:${provider}:${signatureHash}`;
  }

  /**
   * Clear replay protection for provider (for testing)
   */
  async clear(provider: string): Promise<void> {
    const pattern = `${this.keyPrefix}:${provider}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
