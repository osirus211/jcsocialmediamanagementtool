import { MongoClient, Db } from 'mongodb';
import { logger, logEvent } from './utils/logger';
import { addToSet, isMemberOfSet, getSetSize } from './utils/redisClient';
import { config } from './config';

/**
 * Duplicate Publish Detection Engine
 * 
 * Tracks all publish attempts and detects duplicates using:
 * 1. PublishHash validation
 * 2. PlatformPostId tracking
 * 3. Post status tracking
 */

export class DuplicateDetector {
  private db: Db | null = null;
  private duplicatesDetected: number = 0;
  private publishAttempts: Map<string, number> = new Map();

  async connect(): Promise<void> {
    const client = await MongoClient.connect(config.mongodbUri);
    this.db = client.db();
    logger.info('DuplicateDetector connected to MongoDB');
  }

  /**
   * Track publish attempt
   */
  async trackPublishAttempt(postId: string, platformPostId?: string): Promise<void> {
    // Increment attempt counter
    const attempts = (this.publishAttempts.get(postId) || 0) + 1;
    this.publishAttempts.set(postId, attempts);

    // Track in Redis for distributed detection
    const key = `chaos:publish:attempt:${postId}`;
    await addToSet(key, Date.now().toString());

    // If platformPostId exists, check for duplicate
    if (platformPostId) {
      await this.checkDuplicate(postId, platformPostId);
    }
  }

  /**
   * Check for duplicate publish
   */
  private async checkDuplicate(postId: string, platformPostId: string): Promise<void> {
    // Check if this platformPostId was already recorded
    const key = `chaos:platform:post:${platformPostId}`;
    const exists = await isMemberOfSet(key, postId);

    if (exists) {
      // DUPLICATE DETECTED!
      this.duplicatesDetected++;

      logger.error('DUPLICATE PUBLISH DETECTED', {
        postId,
        platformPostId,
        attempts: this.publishAttempts.get(postId),
        duplicateCount: this.duplicatesDetected,
      });

      logEvent('duplicate_publish_detected', {
        postId,
        platformPostId,
        attempts: this.publishAttempts.get(postId),
      });

      // Store duplicate evidence
      await this.storeDuplicateEvidence(postId, platformPostId);
    } else {
      // Record this platformPostId
      await addToSet(key, postId);
    }
  }

  /**
   * Store duplicate evidence for reporting
   */
  private async storeDuplicateEvidence(postId: string, platformPostId: string): Promise<void> {
    const evidence = {
      postId,
      platformPostId,
      detectedAt: new Date(),
      attempts: this.publishAttempts.get(postId),
    };

    await addToSet('chaos:duplicates', JSON.stringify(evidence));
  }

  /**
   * Validate publish hash integrity
   */
  async validatePublishHash(postId: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('DuplicateDetector not connected');
    }

    const post = await this.db.collection('posts').findOne({ _id: postId });

    if (!post) {
      logger.warn('Post not found for hash validation', { postId });
      return false;
    }

    // Check if publishHash exists
    if (!post.metadata?.publishHash) {
      logger.warn('PublishHash missing', { postId });
      return false;
    }

    // Check if publishHash was stored before API call
    if (!post.metadata?.publishAttemptedAt) {
      logger.warn('PublishAttemptedAt missing', { postId });
      return false;
    }

    return true;
  }

  /**
   * Check for duplicate platformPostId in database
   */
  async checkDatabaseDuplicates(): Promise<number> {
    if (!this.db) {
      throw new Error('DuplicateDetector not connected');
    }

    const pipeline = [
      {
        $match: {
          'metadata.platformPostId': { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$metadata.platformPostId',
          count: { $sum: 1 },
          posts: { $push: '$_id' },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
    ];

    const duplicates = await this.db.collection('posts').aggregate(pipeline).toArray();

    if (duplicates.length > 0) {
      logger.error('Database duplicates found', {
        count: duplicates.length,
        duplicates: duplicates.map(d => ({
          platformPostId: d._id,
          count: d.count,
          posts: d.posts,
        })),
      });

      this.duplicatesDetected += duplicates.length;
    }

    return duplicates.length;
  }

  /**
   * Get duplicate count
   */
  getDuplicateCount(): number {
    return this.duplicatesDetected;
  }

  /**
   * Get publish attempts for post
   */
  getPublishAttempts(postId: string): number {
    return this.publishAttempts.get(postId) || 0;
  }

  /**
   * Get total tracked posts
   */
  getTotalTrackedPosts(): number {
    return this.publishAttempts.size;
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<any> {
    const totalAttempts = Array.from(this.publishAttempts.values()).reduce((sum, count) => sum + count, 0);
    const avgAttemptsPerPost = this.publishAttempts.size > 0 ? totalAttempts / this.publishAttempts.size : 0;

    // Get Redis stats
    const platformPostCount = await getSetSize('chaos:platform:post:*');

    return {
      duplicatesDetected: this.duplicatesDetected,
      totalTrackedPosts: this.publishAttempts.size,
      totalPublishAttempts: totalAttempts,
      avgAttemptsPerPost: avgAttemptsPerPost.toFixed(2),
      platformPostCount,
    };
  }

  /**
   * Reset counters
   */
  reset(): void {
    this.duplicatesDetected = 0;
    this.publishAttempts.clear();
  }
}

// Singleton instance
export const duplicateDetector = new DuplicateDetector();
