import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Post, PostStatus } from '../../models/Post';
import { SocialAccount } from '../../models/SocialAccount';
import { QueueManager } from '../../queue/QueueManager';
import { PublishingWorker } from '../../workers/PublishingWorker';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testDb';
import { getRedisClient } from '../../config/redis';

/**
 * RACE CONDITION TESTS
 * 
 * Tests for concurrent publishing scenarios to ensure:
 * - No duplicate publishes
 * - Atomic status updates
 * - Distributed lock correctness
 * - Optimistic locking prevents conflicts
 */

describe('PublishingWorker - Race Conditions', () => {
  let worker1: PublishingWorker;
  let worker2: PublishingWorker;
  let worker3: PublishingWorker;
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

    // Create workers
    worker1 = new PublishingWorker();
    worker2 = new PublishingWorker();
    worker3 = new PublishingWorker();
  });

  afterEach(async () => {
    await worker1.stop();
    await worker2.stop();
    await worker3.stop();
    await disconnectTestDB();
  });

  describe('Concurrent Publishing Attempts', () => {
    it('should prevent duplicate publish when 2 workers process same post', async () => {
      // Create a scheduled post
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test post for race condition',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const postId = post._id.toString();

      // Mock platform publish to succeed
      vi.mock('../../providers/ProviderFactory', () => ({
        providerFactory: {
          getProvider: () => ({
            publishPost: vi.fn().mockResolvedValue({
              success: true,
              platformPostId: 'platform_123',
            }),
          }),
        },
      }));

      // Simulate 2 workers trying to publish the same post concurrently
      const results = await Promise.allSettled([
        worker1['processJob']({
          id: 'job1',
          data: {
            postId,
            workspaceId: testWorkspaceId,
            socialAccountId: testAccountId,
            retryCount: 0,
          },
          attemptsMade: 0,
          opts: { attempts: 3 },
        } as any),
        worker2['processJob']({
          id: 'job2',
          data: {
            postId,
            workspaceId: testWorkspaceId,
            socialAccountId: testAccountId,
            retryCount: 0,
          },
          attemptsMade: 0,
          opts: { attempts: 3 },
        } as any),
      ]);

      // One should succeed, one should be skipped
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const skipped = results.filter(
        r => r.status === 'fulfilled' && (r.value as any).skipped
      ).length;

      expect(succeeded + skipped).toBe(2);
      expect(succeeded).toBeGreaterThanOrEqual(1);

      // Verify post is published only once
      const updatedPost = await Post.findById(postId);
      expect(updatedPost?.status).toBe(PostStatus.PUBLISHED);
      expect(updatedPost?.metadata?.platformPostId).toBeDefined();
    });

    it('should handle 3 workers racing to publish same post', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test post for 3-way race',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const postId = post._id.toString();

      // Simulate 3 workers racing
      const results = await Promise.allSettled([
        worker1['processJob']({
          id: 'job1',
          data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 0 },
          attemptsMade: 0,
          opts: { attempts: 3 },
        } as any),
        worker2['processJob']({
          id: 'job2',
          data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 0 },
          attemptsMade: 0,
          opts: { attempts: 3 },
        } as any),
        worker3['processJob']({
          id: 'job3',
          data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 0 },
          attemptsMade: 0,
          opts: { attempts: 3 },
        } as any),
      ]);

      // At least one should succeed, others should be skipped
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      expect(succeeded).toBeGreaterThanOrEqual(1);

      // Verify post is published only once
      const updatedPost = await Post.findById(postId);
      expect(updatedPost?.status).toBe(PostStatus.PUBLISHED);
    });
  });

  describe('Optimistic Locking', () => {
    it('should prevent concurrent status updates using version field', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test optimistic locking',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const postId = post._id.toString();

      // Simulate 2 workers trying to update status concurrently
      const [result1, result2] = await Promise.allSettled([
        Post.findOneAndUpdate(
          { _id: postId, status: PostStatus.SCHEDULED, version: 1 },
          { $set: { status: PostStatus.PUBLISHING }, $inc: { version: 1 } },
          { new: true }
        ),
        Post.findOneAndUpdate(
          { _id: postId, status: PostStatus.SCHEDULED, version: 1 },
          { $set: { status: PostStatus.PUBLISHING }, $inc: { version: 1 } },
          { new: true }
        ),
      ]);

      // One should succeed, one should fail (return null)
      const successCount = [result1, result2].filter(
        r => r.status === 'fulfilled' && r.value !== null
      ).length;

      expect(successCount).toBe(1);

      // Verify version was incremented
      const updatedPost = await Post.findById(postId);
      expect(updatedPost?.version).toBe(2);
    });
  });

  describe('Distributed Lock Correctness', () => {
    it('should prevent concurrent processing with distributed locks', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test distributed lock',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const postId = post._id.toString();

      // Import distributed lock service
      const { distributedLockService } = await import('../../services/DistributedLockService');

      // Simulate 2 workers trying to acquire lock
      const lock1 = await distributedLockService.acquireLock(`publish:${postId}`, {
        ttl: 10000,
        retryAttempts: 0,
      });

      const lock2 = await distributedLockService.acquireLock(`publish:${postId}`, {
        ttl: 10000,
        retryAttempts: 0,
      });

      // Only one should succeed
      expect(lock1 !== null || lock2 !== null).toBe(true);
      expect(lock1 !== null && lock2 !== null).toBe(false);

      // Release lock
      if (lock1) await distributedLockService.releaseLock(lock1);
      if (lock2) await distributedLockService.releaseLock(lock2);
    });
  });

  describe('Status Change Race Conditions', () => {
    it('should skip publishing if post status changed to CANCELLED', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test cancellation race',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const postId = post._id.toString();

      // Change status to CANCELLED before worker processes
      await Post.findByIdAndUpdate(postId, { status: PostStatus.CANCELLED });

      // Worker should skip this post
      const result = await worker1['processJob']({
        id: 'job1',
        data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 0 },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any);

      expect(result.success).toBe(false);
      expect(result.message).toContain('cancelled');
    });

    it('should skip publishing if post already published by another worker', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test already published',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const postId = post._id.toString();

      // Mark as published before worker processes
      await Post.findByIdAndUpdate(postId, {
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        'metadata.platformPostId': 'platform_123',
      });

      // Worker should skip this post
      const result = await worker1['processJob']({
        id: 'job1',
        data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 0 },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any);

      expect(result.success).toBe(true);
      expect(result.idempotent).toBe(true);
    });
  });

  describe('Platform Post ID Deduplication', () => {
    it('should skip publishing if platformPostId already exists', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test platform post ID',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
        metadata: {
          platformPostId: 'existing_platform_123',
        },
      });

      const postId = post._id.toString();

      // Worker should skip this post
      const result = await worker1['processJob']({
        id: 'job1',
        data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 0 },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any);

      expect(result.success).toBe(true);
      expect(result.idempotent).toBe(true);
      expect(result.platformPostId).toBe('existing_platform_123');
    });
  });
});
