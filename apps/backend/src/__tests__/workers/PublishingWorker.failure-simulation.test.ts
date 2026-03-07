import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Post, PostStatus } from '../../models/Post';
import { SocialAccount } from '../../models/SocialAccount';
import { PublishingWorker } from '../../workers/PublishingWorker';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testDb';
import { getRedisClient } from '../../config/redis';

/**
 * FAILURE SIMULATION TESTS
 * 
 * Tests for various failure scenarios to ensure:
 * - No duplicate publishes on retry
 * - Proper error handling and recovery
 * - Idempotency under failure conditions
 * - Dead-letter queue replay safety
 */

describe('PublishingWorker - Failure Simulations', () => {
  let worker: PublishingWorker;
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

    worker = new PublishingWorker();
  });

  afterEach(async () => {
    await worker.stop();
    await disconnectTestDB();
  });

  describe('Network Failures', () => {
    it('should retry on network timeout', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test network timeout',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const postId = post._id.toString();

      // Mock platform publish to timeout on first attempt, succeed on second
      let attemptCount = 0;
      vi.mock('../../providers/ProviderFactory', () => ({
        providerFactory: {
          getProvider: () => ({
            publishPost: vi.fn().mockImplementation(async () => {
              attemptCount++;
              if (attemptCount === 1) {
                const error: any = new Error('Network timeout');
                error.retryable = true;
                throw error;
              }
              return {
                success: true,
                platformPostId: 'platform_123',
              };
            }),
          }),
        },
      }));

      // First attempt should fail
      await expect(
        worker['processJob']({
          id: 'job1',
          data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 0 },
          attemptsMade: 0,
          opts: { attempts: 3 },
        } as any)
      ).rejects.toThrow('Network timeout');

      // Verify post status reverted to SCHEDULED for retry
      let updatedPost = await Post.findById(postId);
      expect(updatedPost?.status).toBe(PostStatus.SCHEDULED);
      expect(updatedPost?.retryCount).toBe(1);

      // Second attempt should succeed
      const result = await worker['processJob']({
        id: 'job2',
        data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 1 },
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as any);

      expect(result.success).toBe(true);

      // Verify post is published
      updatedPost = await Post.findById(postId);
      expect(updatedPost?.status).toBe(PostStatus.PUBLISHED);
    });

    it('should not duplicate publish on retry after network failure', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test no duplicate on retry',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const postId = post._id.toString();

      let publishCount = 0;
      vi.mock('../../providers/ProviderFactory', () => ({
        providerFactory: {
          getProvider: () => ({
            publishPost: vi.fn().mockImplementation(async () => {
              publishCount++;
              return {
                success: true,
                platformPostId: `platform_${publishCount}`,
              };
            }),
          }),
        },
      }));

      // First attempt succeeds
      await worker['processJob']({
        id: 'job1',
        data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 0 },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any);

      // Retry attempt should be skipped (idempotency)
      const result = await worker['processJob']({
        id: 'job2',
        data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 0 },
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as any);

      expect(result.idempotent).toBe(true);
      expect(publishCount).toBe(1); // Only published once
    });
  });

  describe('Platform API Failures', () => {
    it('should handle rate limit errors', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test rate limit',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const postId = post._id.toString();

      vi.mock('../../providers/ProviderFactory', () => ({
        providerFactory: {
          getProvider: () => ({
            publishPost: vi.fn().mockRejectedValue({
              message: 'Rate limit exceeded',
              retryable: true,
            }),
          }),
        },
      }));

      await expect(
        worker['processJob']({
          id: 'job1',
          data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 0 },
          attemptsMade: 0,
          opts: { attempts: 3 },
        } as any)
      ).rejects.toThrow('Rate limit exceeded');

      // Verify post status reverted for retry
      const updatedPost = await Post.findById(postId);
      expect(updatedPost?.status).toBe(PostStatus.SCHEDULED);
    });

    it('should handle platform duplicate detection', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test duplicate detection',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const postId = post._id.toString();

      vi.mock('../../providers/ProviderFactory', () => ({
        providerFactory: {
          getProvider: () => ({
            publishPost: vi.fn().mockRejectedValue({
              message: 'Duplicate content detected',
              code: 187, // Twitter duplicate code
            }),
          }),
        },
      }));

      const result = await worker['processJob']({
        id: 'job1',
        data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 0 },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any);

      // Should mark as published (idempotent)
      expect(result.success).toBe(true);
      expect(result.idempotent).toBe(true);

      const updatedPost = await Post.findById(postId);
      expect(updatedPost?.status).toBe(PostStatus.PUBLISHED);
      expect(updatedPost?.metadata?.platformDuplicateDetected).toBe(true);
    });

    it('should handle invalid token errors', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test invalid token',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const postId = post._id.toString();

      vi.mock('../../providers/ProviderFactory', () => ({
        providerFactory: {
          getProvider: () => ({
            publishPost: vi.fn().mockRejectedValue({
              message: 'Invalid token',
              retryable: false,
            }),
          }),
        },
      }));

      await expect(
        worker['processJob']({
          id: 'job1',
          data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 0 },
          attemptsMade: 2, // Final attempt
          opts: { attempts: 3 },
        } as any)
      ).rejects.toThrow('Invalid token');

      // Verify post marked as failed
      const updatedPost = await Post.findById(postId);
      expect(updatedPost?.status).toBe(PostStatus.FAILED);
    });
  });

  describe('Worker Crash Scenarios', () => {
    it('should recover from worker crash during publishing', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test worker crash',
        status: PostStatus.PUBLISHING,
        scheduledAt: new Date(Date.now() - 1000),
        version: 2,
        updatedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      });

      const postId = post._id.toString();

      // Scheduler's auto-repair should mark this as failed
      const { schedulerService } = await import('../../services/SchedulerService');
      await schedulerService['autoRepairStuckPosts']();

      const updatedPost = await Post.findById(postId);
      expect(updatedPost?.status).toBe(PostStatus.FAILED);
      expect(updatedPost?.errorMessage).toContain('stuck publishing');
    });

    it('should handle lock expiry after worker crash', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test lock expiry',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const postId = post._id.toString();

      // Acquire lock and simulate crash (don't release)
      const { distributedLockService } = await import('../../services/DistributedLockService');
      const lock = await distributedLockService.acquireLock(`publish:${postId}`, {
        ttl: 1000, // 1 second TTL
        retryAttempts: 0,
      });

      expect(lock).not.toBeNull();

      // Wait for lock to expire
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Another worker should be able to acquire lock
      const lock2 = await distributedLockService.acquireLock(`publish:${postId}`, {
        ttl: 10000,
        retryAttempts: 0,
      });

      expect(lock2).not.toBeNull();

      if (lock2) await distributedLockService.releaseLock(lock2);
    });
  });

  describe('Dead-Letter Queue Replay', () => {
    it('should not duplicate publish when replaying from DLQ', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test DLQ replay',
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        scheduledAt: new Date(Date.now() - 1000),
        version: 3,
        metadata: {
          platformPostId: 'platform_123',
        },
      });

      const postId = post._id.toString();

      // Simulate DLQ replay
      const result = await worker['processJob']({
        id: 'dlq_replay_job',
        data: {
          postId,
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          retryCount: 0,
          isReplay: true, // Mark as DLQ replay
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any);

      // Should skip (idempotent)
      expect(result.success).toBe(true);
      expect(result.idempotent).toBe(true);

      // Verify post still published
      const updatedPost = await Post.findById(postId);
      expect(updatedPost?.status).toBe(PostStatus.PUBLISHED);
      expect(updatedPost?.metadata?.platformPostId).toBe('platform_123');
    });
  });

  describe('Database Failures', () => {
    it('should handle optimistic locking conflicts', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test optimistic locking',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const postId = post._id.toString();

      // Simulate version conflict by updating version
      await Post.findByIdAndUpdate(postId, { $inc: { version: 1 } });

      // Worker should fail to acquire atomic update
      const result = await worker['processJob']({
        id: 'job1',
        data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 0 },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any);

      expect(result.skipped).toBe(true);
    });
  });

  describe('Retry Exhaustion', () => {
    it('should mark post as failed after max retries', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test max retries',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      const postId = post._id.toString();

      vi.mock('../../providers/ProviderFactory', () => ({
        providerFactory: {
          getProvider: () => ({
            publishPost: vi.fn().mockRejectedValue({
              message: 'Persistent error',
              retryable: true,
            }),
          }),
        },
      }));

      // Final attempt (3rd)
      await expect(
        worker['processJob']({
          id: 'job3',
          data: { postId, workspaceId: testWorkspaceId, socialAccountId: testAccountId, retryCount: 2 },
          attemptsMade: 2,
          opts: { attempts: 3 },
        } as any)
      ).rejects.toThrow('Persistent error');

      // Verify post marked as failed
      const updatedPost = await Post.findById(postId);
      expect(updatedPost?.status).toBe(PostStatus.FAILED);
      expect(updatedPost?.retryCount).toBe(3);
    });
  });
});
