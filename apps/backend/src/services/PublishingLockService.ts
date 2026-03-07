/**
 * Publishing Lock Service
 * 
 * Redis-based lock protection to prevent duplicate publishing
 * Ensures idempotency for post publishing operations
 */

import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

const LOCK_PREFIX = 'publish:lock';
const LOCK_TTL = 300; // 5 minutes in seconds

export class PublishingLockService {
  /**
   * Acquire lock for publishing a post
   * 
   * @param postId - Post ID
   * @param platform - Platform name
   * @returns true if lock acquired, false if already locked
   */
  async acquireLock(postId: string, platform: string): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const lockKey = this.getLockKey(postId, platform);
      
      // Use SET with NX and EX options
      const result = await redis.set(lockKey, Date.now().toString(), 'EX', LOCK_TTL, 'NX');
      
      const acquired = result === 'OK';
      
      if (acquired) {
        logger.debug('Publishing lock acquired', {
          postId,
          platform,
          lockKey,
          ttl: LOCK_TTL,
        });
      } else {
        logger.warn('Publishing lock already held', {
          postId,
          platform,
          lockKey,
        });
      }
      
      return acquired;
    } catch (error: any) {
      logger.error('Failed to acquire publishing lock', {
        postId,
        platform,
        error: error.message,
      });
      
      // Fail open - allow publishing if Redis is unavailable
      return true;
    }
  }
  
  /**
   * Release lock for publishing a post
   * 
   * @param postId - Post ID
   * @param platform - Platform name
   */
  async releaseLock(postId: string, platform: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const lockKey = this.getLockKey(postId, platform);
      
      await redis.del(lockKey);
      
      logger.debug('Publishing lock released', {
        postId,
        platform,
        lockKey,
      });
    } catch (error: any) {
      logger.error('Failed to release publishing lock', {
        postId,
        platform,
        error: error.message,
      });
    }
  }
  
  /**
   * Check if lock exists for a post
   * 
   * @param postId - Post ID
   * @param platform - Platform name
   * @returns true if locked, false otherwise
   */
  async isLocked(postId: string, platform: string): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const lockKey = this.getLockKey(postId, platform);
      
      const exists = await redis.exists(lockKey);
      return exists === 1;
    } catch (error: any) {
      logger.error('Failed to check publishing lock', {
        postId,
        platform,
        error: error.message,
      });
      
      // Fail open - assume not locked if Redis is unavailable
      return false;
    }
  }
  
  /**
   * Get remaining TTL for a lock
   * 
   * @param postId - Post ID
   * @param platform - Platform name
   * @returns TTL in seconds, -1 if no expiration, -2 if key doesn't exist
   */
  async getLockTTL(postId: string, platform: string): Promise<number> {
    try {
      const redis = getRedisClient();
      const lockKey = this.getLockKey(postId, platform);
      
      return await redis.ttl(lockKey);
    } catch (error: any) {
      logger.error('Failed to get lock TTL', {
        postId,
        platform,
        error: error.message,
      });
      
      return -2; // Key doesn't exist
    }
  }
  
  /**
   * Generate lock key
   */
  private getLockKey(postId: string, platform: string): string {
    return `${LOCK_PREFIX}:${postId}:${platform}`;
  }
}

// Export singleton instance
export const publishingLockService = new PublishingLockService();
