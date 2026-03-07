import { Post, PostStatus } from '../models/Post';
import { SocialAccount } from '../models/SocialAccount';
import { logger } from '../utils/logger';
import { publishHashService } from './PublishHashService';
import { getRedisClient } from '../config/redis';

/**
 * Publish Reconciliation Service
 * 
 * CRASH-SAFE RECONCILIATION
 * 
 * Detects posts that were successfully published to platform
 * but status update failed due to crash/network failure.
 * 
 * Detection methods:
 * 1. Publish hash exists + platformPostId exists → Published
 * 2. Publish hash exists + recent attempt → Query platform API
 * 3. Status = PUBLISHING + old timestamp → Likely crashed
 * 
 * Runs periodically to reconcile orphaned posts.
 */

export class PublishReconciliationService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly RUN_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly LOCK_KEY = 'publish-reconciliation:lock';
  private readonly LOCK_TTL = 60; // 60 seconds
  
  // Metrics
  private metrics = {
    reconciliation_runs_total: 0,
    posts_reconciled_total: 0,
    posts_marked_failed_total: 0,
    reconciliation_errors_total: 0,
  };

  /**
   * Start reconciliation service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('PublishReconciliationService already running');
      return;
    }

    this.isRunning = true;
    logger.info('PublishReconciliationService started');

    // Run immediately
    this.run();

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.run();
    }, this.RUN_INTERVAL);
  }

  /**
   * Stop reconciliation service
   */
  stop(): void {
    if (!this.isRunning) return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('PublishReconciliationService stopped');
  }

  /**
   * Run reconciliation
   */
  private async run(): Promise<void> {
    this.metrics.reconciliation_runs_total++;

    logger.info('PublishReconciliationService run started', {
      runNumber: this.metrics.reconciliation_runs_total,
    });

    // Acquire lock
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      logger.debug('Could not acquire reconciliation lock, skipping');
      return;
    }

    try {
      // Find posts that may need reconciliation
      const candidates = await this.findReconciliationCandidates();

      logger.info('Found reconciliation candidates', {
        count: candidates.length,
      });

      for (const post of candidates) {
        try {
          await this.reconcilePost(post);
        } catch (error: any) {
          this.metrics.reconciliation_errors_total++;
          logger.error('Failed to reconcile post', {
            postId: post._id,
            error: error.message,
          });
        }
      }

      logger.info('PublishReconciliationService run completed', {
        reconciled: this.metrics.posts_reconciled_total,
        failed: this.metrics.posts_marked_failed_total,
      });
    } catch (error: any) {
      this.metrics.reconciliation_errors_total++;
      logger.error('PublishReconciliationService run error', {
        error: error.message,
      });
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Find posts that may need reconciliation
   * 
   * Candidates:
   * 1. Status = PUBLISHING for > 10 minutes
   * 2. Has publish hash but status != PUBLISHED
   */
  private async findReconciliationCandidates(): Promise<any[]> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const candidates = await Post.find({
      $or: [
        // Posts stuck in PUBLISHING state
        {
          status: PostStatus.PUBLISHING,
          updatedAt: { $lt: tenMinutesAgo },
        },
        // Posts with publish hash but not published
        {
          'metadata.publishHash': { $exists: true },
          status: { $ne: PostStatus.PUBLISHED },
        },
      ],
    })
      .select('_id workspaceId socialAccountId content mediaUrls scheduledAt status metadata')
      .limit(100)
      .lean();

    return candidates;
  }

  /**
   * Reconcile a single post
   * 
   * Strategy:
   * 1. Check if platformPostId exists → Mark as published
   * 2. Check if publish hash exists → Query platform API
   * 3. If platform confirms published → Mark as published
   * 4. If platform confirms not published → Mark as failed
   */
  private async reconcilePost(post: any): Promise<void> {
    const postId = post._id.toString();

    logger.info('Reconciling post', {
      postId,
      status: post.status,
      hasPublishHash: !!post.metadata?.publishHash,
      hasPlatformPostId: !!post.metadata?.platformPostId,
    });

    // CASE 1: Has platformPostId but status not updated
    if (post.metadata?.platformPostId && post.status !== PostStatus.PUBLISHED) {
      logger.info('Post has platformPostId but not marked published - reconciling', {
        postId,
        platformPostId: post.metadata.platformPostId,
      });

      await Post.findByIdAndUpdate(postId, {
        status: PostStatus.PUBLISHED,
        publishedAt: post.publishedAt || new Date(),
      });

      this.metrics.posts_reconciled_total++;
      logger.info('Post reconciled - marked as published', { postId });
      return;
    }

    // CASE 2: Has publish hash - check if publish was attempted
    if (post.metadata?.publishHash) {
      const hashInput = {
        postId,
        content: post.content,
        socialAccountId: post.socialAccountId.toString(),
        mediaUrls: post.mediaUrls,
        scheduledAt: post.scheduledAt,
      };

      const isAttempted = publishHashService.isPublishAttempted(
        post.metadata.publishHash,
        post.metadata.publishAttemptedAt,
        hashInput
      );

      if (isAttempted) {
        logger.info('Post has recent publish attempt - querying platform', {
          postId,
          publishHash: post.metadata.publishHash.substring(0, 16) + '...',
        });

        // Query platform to check if post exists
        const platformResult = await this.queryPlatformForPost(post);

        if (platformResult.exists) {
          // Post exists on platform - mark as published
          await Post.findByIdAndUpdate(postId, {
            status: PostStatus.PUBLISHED,
            publishedAt: new Date(),
            'metadata.platformPostId': platformResult.platformPostId,
          });

          this.metrics.posts_reconciled_total++;
          logger.info('Post reconciled - found on platform', {
            postId,
            platformPostId: platformResult.platformPostId,
          });
          return;
        } else {
          // Post not found on platform - mark as failed
          await Post.findByIdAndUpdate(postId, {
            status: PostStatus.FAILED,
            errorMessage: 'Reconciliation: Post not found on platform after publish attempt',
          });

          this.metrics.posts_marked_failed_total++;
          logger.warn('Post marked as failed - not found on platform', { postId });
          return;
        }
      }
    }

    // CASE 3: Stuck in PUBLISHING state - mark as failed
    if (post.status === PostStatus.PUBLISHING) {
      logger.warn('Post stuck in PUBLISHING state - marking as failed', {
        postId,
        updatedAt: post.updatedAt,
      });

      await Post.findByIdAndUpdate(postId, {
        status: PostStatus.FAILED,
        errorMessage: 'Reconciliation: Stuck in publishing state',
      });

      this.metrics.posts_marked_failed_total++;
    }
  }

  /**
   * Query platform API to check if post exists
   * 
   * This is a fallback for when we have a publish hash but no platformPostId.
   * We query the platform to see if the post was actually published.
   * 
   * NOTE: This requires platform-specific implementation
   */
  private async queryPlatformForPost(post: any): Promise<{
    exists: boolean;
    platformPostId?: string;
  }> {
    try {
      // Get social account
      const account = await SocialAccount.findById(post.socialAccountId);
      if (!account) {
        logger.error('Social account not found for reconciliation', {
          postId: post._id,
          socialAccountId: post.socialAccountId,
        });
        return { exists: false };
      }

      // Import provider factory
      const { providerFactory } = await import('../providers/ProviderFactory');
      const provider = providerFactory.getProvider(account.provider);

      // Check if provider supports post lookup
      if (typeof provider.lookupPost !== 'function') {
        logger.debug('Provider does not support post lookup', {
          provider: account.provider,
        });
        return { exists: false };
      }

      // Query platform for post
      const result = await provider.lookupPost({
        accountId: account._id.toString(),
        content: post.content,
        publishedAfter: post.metadata?.publishAttemptedAt,
      });

      return {
        exists: result.exists,
        platformPostId: result.platformPostId,
      };
    } catch (error: any) {
      logger.error('Error querying platform for post', {
        postId: post._id,
        error: error.message,
      });
      return { exists: false };
    }
  }

  /**
   * Acquire distributed lock
   */
  private async acquireLock(): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const result = await redis.set(
        this.LOCK_KEY,
        Date.now().toString(),
        'EX',
        this.LOCK_TTL,
        'NX'
      );
      return result === 'OK';
    } catch (error: any) {
      logger.error('Failed to acquire reconciliation lock', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(this.LOCK_KEY);
    } catch (error: any) {
      logger.error('Failed to release reconciliation lock', {
        error: error.message,
      });
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Force immediate reconciliation run (for testing)
   */
  async forceRun(): Promise<void> {
    await this.run();
  }
}

export const publishReconciliationService = new PublishReconciliationService();
