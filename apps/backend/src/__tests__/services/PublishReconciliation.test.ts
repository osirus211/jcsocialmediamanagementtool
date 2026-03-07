import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Post, PostStatus } from '../../models/Post';
import { SocialAccount } from '../../models/SocialAccount';
import { publishReconciliationService } from '../../services/PublishReconciliationService';
import { publishHashService } from '../../services/PublishHashService';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testDb';
import { getRedisClient } from '../../config/redis';

/**
 * PUBLISH RECONCILIATION TESTS
 * 
 * Tests crash-safe reconciliation:
 * 1. Detect publish success without status update
 * 2. Use publish hash to avoid re-publish
 * 3. Query platform API for confirmation
 * 4. Handle various crash scenarios
 */

describe('PublishReconciliationService', () => {
  let testWorkspaceId: string;
  let testAccountId: string;
  let redis: any;

  beforeEach(async () => {
    await connectTestDB();
    await clearTestDB();
    
    redis = getRedisClient();
    await redis.flushall();

    // Create test workspace and social account
    const { Workspace } = await import('../../models/Workspace');
    const workspace = await Workspace.create({
      name: 'Test Workspace',
      ownerId: '507f1f77bcf86cd799439011',
    });
    testWorkspaceId = workspace._id.toString();

    const account = await SocialAccount.create({
      workspaceId: testWorkspaceId,
      provider: 'twitter',
      providerAccountId: 'test123',
      username: 'testuser',
      accessToken: 'encrypted_token',
      refreshToken: 'encrypted_refresh',
      tokenExpiresAt: new Date(Date.now() + 3600000),
      status: 'active',
    });
    testAccountId = account._id.toString();
  });

  afterEach(async () => {
    publishReconciliationService.stop();
    await disconnectTestDB();
  });

  describe('Publish Hash Detection', () => {
    it('should detect post with platformPostId but wrong status', async () => {
      // Create post with platformPostId but status = PUBLISHING
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test post',
        status: PostStatus.PUBLISHING,
        scheduledAt: new Date(Date.now() - 1000),
        version: 2,
        metadata: {
          platformPostId: 'platform_123',
        },
      });

      // Run reconciliation
      await publishReconciliationService.forceRun();

      // Verify post marked as published
      const updatedPost = await Post.findById(post._id);
      expect(updatedPost?.status).toBe(PostStatus.PUBLISHED);
      expect(updatedPost?.publishedAt).toBeDefined();
    });

    it('should detect post with publish hash and recent attempt', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test post',
        status: PostStatus.PUBLISHING,
        scheduledAt: new Date(Date.now() - 1000),
        version: 2,
      });

      // Generate and store publish hash
      const publishHash = publishHashService.generatePublishHash({
        postId: post._id.toString(),
        content: post.content,
        socialAccountId: testAccountId,
        mediaUrls: post.mediaUrls,
        scheduledAt: post.scheduledAt,
      });

      await Post.findByIdAndUpdate(post._id, {
        'metadata.publishHash': publishHash,
        'metadata.publishAttemptedAt': new Date(),
      });

      // Mock platform lookup to return post exists
      vi.mock('../../providers/ProviderFactory', () => ({
        providerFactory: {
          getProvider: () => ({
            lookupPost: vi.fn().mockResolvedValue({
              exists: true,
              platformPostId: 'platform_456',
            }),
          }),
        },
      }));

      // Run reconciliation
      await publishReconciliationService.forceRun();

      // Verify post marked as published
      const updatedPost = await Post.findById(post._id);
      expect(updatedPost?.status).toBe(PostStatus.PUBLISHED);
      expect(updatedPost?.metadata?.platformPostId).toBe('platform_456');
    });

    it('should mark post as failed if not found on platform', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test post',
        status: PostStatus.PUBLISHING,
        scheduledAt: new Date(Date.now() - 1000),
        version: 2,
      });

      // Generate and store publish hash
      const publishHash = publishHashService.generatePublishHash({
        postId: post._id.toString(),
        content: post.content,
        socialAccountId: testAccountId,
        mediaUrls: post.mediaUrls,
        scheduledAt: post.scheduledAt,
      });

      await Post.findByIdAndUpdate(post._id, {
        'metadata.publishHash': publishHash,
        'metadata.publishAttemptedAt': new Date(),
      });

      // Mock platform lookup to return post not found
      vi.mock('../../providers/ProviderFactory', () => ({
        providerFactory: {
          getProvider: () => ({
            lookupPost: vi.fn().mockResolvedValue({
              exists: false,
            }),
          }),
        },
      }));

      // Run reconciliation
      await publishReconciliationService.forceRun();

      // Verify post marked as failed
      const updatedPost = await Post.findById(post._id);
      expect(updatedPost?.status).toBe(PostStatus.FAILED);
      expect(updatedPost?.errorMessage).toContain('not found on platform');
    });
  });

  describe('Crash Scenarios', () => {
    it('should reconcile post after crash during status update', async () => {
      // Simulate: Post published to platform, but crash before status update
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test post',
        status: PostStatus.PUBLISHING,
        scheduledAt: new Date(Date.now() - 1000),
        version: 2,
        updatedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        metadata: {
          platformPostId: 'platform_789', // Platform ID exists
        },
      });

      // Run reconciliation
      await publishReconciliationService.forceRun();

      // Verify post reconciled
      const updatedPost = await Post.findById(post._id);
      expect(updatedPost?.status).toBe(PostStatus.PUBLISHED);
    });

    it('should handle post stuck in PUBLISHING state', async () => {
      // Post stuck in PUBLISHING for > 10 minutes
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test post',
        status: PostStatus.PUBLISHING,
        scheduledAt: new Date(Date.now() - 1000),
        version: 2,
        updatedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      });

      // Run reconciliation
      await publishReconciliationService.forceRun();

      // Verify post marked as failed
      const updatedPost = await Post.findById(post._id);
      expect(updatedPost?.status).toBe(PostStatus.FAILED);
      expect(updatedPost?.errorMessage).toContain('Stuck in publishing');
    });
  });

  describe('Publish Hash Verification', () => {
    it('should verify publish hash matches current post state', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test post',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const hashInput = {
        postId: post._id.toString(),
        content: post.content,
        socialAccountId: testAccountId,
        mediaUrls: post.mediaUrls,
        scheduledAt: post.scheduledAt,
      };

      const hash1 = publishHashService.generatePublishHash(hashInput);
      const hash2 = publishHashService.generatePublishHash(hashInput);

      // Verify deterministic
      expect(hash1).toBe(hash2);

      // Verify verification
      expect(publishHashService.verifyPublishHash(hash1, hashInput)).toBe(true);
    });

    it('should detect hash mismatch when content changes', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Original content',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const originalHash = publishHashService.generatePublishHash({
        postId: post._id.toString(),
        content: 'Original content',
        socialAccountId: testAccountId,
        mediaUrls: post.mediaUrls,
        scheduledAt: post.scheduledAt,
      });

      const modifiedHash = publishHashService.generatePublishHash({
        postId: post._id.toString(),
        content: 'Modified content',
        socialAccountId: testAccountId,
        mediaUrls: post.mediaUrls,
        scheduledAt: post.scheduledAt,
      });

      // Verify hashes are different
      expect(originalHash).not.toBe(modifiedHash);
    });

    it('should handle media URL ordering deterministically', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test post',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
        mediaUrls: ['url3', 'url1', 'url2'],
      });

      const hash1 = publishHashService.generatePublishHash({
        postId: post._id.toString(),
        content: post.content,
        socialAccountId: testAccountId,
        mediaUrls: ['url3', 'url1', 'url2'],
        scheduledAt: post.scheduledAt,
      });

      const hash2 = publishHashService.generatePublishHash({
        postId: post._id.toString(),
        content: post.content,
        socialAccountId: testAccountId,
        mediaUrls: ['url1', 'url2', 'url3'], // Different order
        scheduledAt: post.scheduledAt,
      });

      // Verify same hash (sorted internally)
      expect(hash1).toBe(hash2);
    });
  });

  describe('Reconciliation Metrics', () => {
    it('should track reconciliation metrics', async () => {
      // Create posts needing reconciliation
      await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Post 1',
        status: PostStatus.PUBLISHING,
        scheduledAt: new Date(Date.now() - 1000),
        version: 2,
        updatedAt: new Date(Date.now() - 15 * 60 * 1000),
        metadata: { platformPostId: 'platform_1' },
      });

      await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Post 2',
        status: PostStatus.PUBLISHING,
        scheduledAt: new Date(Date.now() - 1000),
        version: 2,
        updatedAt: new Date(Date.now() - 15 * 60 * 1000),
      });

      // Run reconciliation
      await publishReconciliationService.forceRun();

      // Check metrics
      const metrics = publishReconciliationService.getMetrics();
      expect(metrics.reconciliation_runs_total).toBeGreaterThan(0);
      expect(metrics.posts_reconciled_total + metrics.posts_marked_failed_total).toBeGreaterThan(0);
    });
  });
});
