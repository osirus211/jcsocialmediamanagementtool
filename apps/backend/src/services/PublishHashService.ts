import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Publish Hash Service
 * 
 * Generates deterministic hashes for publish operations to ensure
 * external idempotency - prevents duplicate API calls to platforms
 * even across crashes and retries.
 * 
 * Hash includes:
 * - Post content
 * - Social account ID
 * - Media URLs (sorted for determinism)
 * - Scheduled time (for uniqueness across reschedules)
 * 
 * Use cases:
 * 1. Before platform API call: Generate and store hash
 * 2. After crash: Check if hash exists to detect partial publish
 * 3. On retry: Skip if hash already exists (already attempted)
 */

export interface PublishHashInput {
  postId: string;
  content: string;
  socialAccountId: string;
  platform?: string; // NEW: Platform identifier for multi-platform support
  mediaUrls?: string[];
  scheduledAt?: Date;
}

export class PublishHashService {
  /**
   * Generate deterministic publish hash
   * 
   * This hash uniquely identifies a publish attempt and is used to:
   * - Prevent duplicate external API calls
   * - Detect partial publishes after crash
   * - Enable crash-safe reconciliation
   */
  static generatePublishHash(input: PublishHashInput): string {
    // Sort media URLs for determinism
    const sortedMediaUrls = input.mediaUrls ? [...input.mediaUrls].sort() : [];
    
    // Create deterministic string representation
    // IMPORTANT: Include platform for multi-platform idempotency
    const hashInput = JSON.stringify({
      postId: input.postId,
      content: input.content,
      socialAccountId: input.socialAccountId,
      platform: input.platform || 'default', // Include platform in hash
      mediaUrls: sortedMediaUrls,
      scheduledAt: input.scheduledAt?.toISOString(),
    });
    
    // Generate SHA-256 hash
    const hash = crypto
      .createHash('sha256')
      .update(hashInput)
      .digest('hex');
    
    logger.debug('Generated publish hash', {
      postId: input.postId,
      platform: input.platform,
      hash: hash.substring(0, 16) + '...', // Log first 16 chars
      contentLength: input.content.length,
      mediaCount: sortedMediaUrls.length,
    });
    
    return hash;
  }
  
  /**
   * Verify if a publish hash matches the current post state
   * 
   * Used for reconciliation to detect if a post was published
   * but status update failed.
   */
  static verifyPublishHash(
    storedHash: string,
    input: PublishHashInput
  ): boolean {
    const currentHash = this.generatePublishHash(input);
    return storedHash === currentHash;
  }
  
  /**
   * Check if publish hash indicates a publish attempt was made
   * 
   * Returns true if:
   * - Hash exists
   * - Hash matches current post state
   * - Attempt timestamp is recent (within 24 hours)
   */
  static isPublishAttempted(
    storedHash: string | undefined,
    attemptedAt: Date | undefined,
    input: PublishHashInput
  ): boolean {
    if (!storedHash || !attemptedAt) {
      return false;
    }
    
    // Check if hash matches current state
    const hashMatches = this.verifyPublishHash(storedHash, input);
    if (!hashMatches) {
      logger.debug('Publish hash mismatch - content changed', {
        postId: input.postId,
      });
      return false;
    }
    
    // Check if attempt is recent (within 24 hours)
    const hoursSinceAttempt = (Date.now() - attemptedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceAttempt > 24) {
      logger.debug('Publish attempt too old', {
        postId: input.postId,
        hoursSinceAttempt: Math.floor(hoursSinceAttempt),
      });
      return false;
    }
    
    return true;
  }
}

export const publishHashService = PublishHashService;
