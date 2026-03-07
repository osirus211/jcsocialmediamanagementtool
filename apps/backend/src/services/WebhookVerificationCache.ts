/**
 * Webhook Verification Cache
 * 
 * Caches signature verification results to prevent repeated expensive HMAC computation
 */

import { Redis } from 'ioredis';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export class WebhookVerificationCache {
  private readonly keyPrefix = 'webhook:verified';
  private readonly ttl = 300; // 5 minutes

  constructor(private redis: Redis) {}

  /**
   * Check if signature was already verified
   */
  async isVerified(provider: string, signature: string): Promise<boolean> {
    const hash = this.generateSignatureHash(signature);
    const key = this.getKey(provider, hash);
    
    const cached = await this.redis.get(key);
    
    if (cached) {
      logger.debug('Verification cache hit', {
        provider,
        signatureHash: hash,
      });
      return true;
    }
    
    return false;
  }

  /**
   * Cache successful verification
   */
  async cacheVerification(provider: string, signature: string): Promise<void> {
    const hash = this.generateSignatureHash(signature);
    const key = this.getKey(provider, hash);
    
    const value = JSON.stringify({
      verified: true,
      timestamp: new Date().toISOString(),
      provider,
    });
    
    await this.redis.setex(key, this.ttl, value);
    
    logger.debug('Verification cached', {
      provider,
      signatureHash: hash,
      ttl: this.ttl,
    });
  }

  /**
   * Generate signature hash for cache key
   */
  private generateSignatureHash(signature: string): string {
    return crypto
      .createHash('sha256')
      .update(signature)
      .digest('hex')
      .substring(0, 16); // First 16 chars for shorter key
  }

  /**
   * Get cache key
   */
  private getKey(provider: string, signatureHash: string): string {
    return `${this.keyPrefix}:${provider}:${signatureHash}`;
  }

  /**
   * Clear cache (for testing)
   */
  async clear(provider: string, signature: string): Promise<void> {
    const hash = this.generateSignatureHash(signature);
    const key = this.getKey(provider, hash);
    await this.redis.del(key);
  }
}
