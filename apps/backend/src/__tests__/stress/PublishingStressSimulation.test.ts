import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Post, PostStatus } from '../../models/Post';
import { SocialAccount } from '../../models/SocialAccount';
import { PublishingWorker } from '../../workers/PublishingWorker';
import { retryStormProtectionService } from '../../services/RetryStormProtectionService';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testDb';
import { getRedisClient } from '../../config/redis';

/**
 * PUBLISHING STRESS SIMULATION TESTS
 * 
 * Simulates high-stress scenarios:
 * 1. Mass failures and retry storms
 * 2. Platform outages
 * 3. Network instability
 * 4. Concurrent worker overload
 * 5. Queue starvation
 */

describe('Publishing - Stress Simulation', () => {
  let workers: PublishingWorker[];
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

    // Create worker pool
    workers = [];
    for (let i = 0; i < 5; i++) {
      workers.push(new PublishingWorker());
    }
  });

  afterEach(async () => {
    for (const worker of workers) {
      await worker.stop();
    }
    await retryStormProtectionService.resetCounters();
    await disconnectTestDB();
  });

  describe('Retry Storm Protection', () => {
    it('should prevent retry storm with jitter', async () => {
      const delays: number[] = [];

      // Calculate retry delays with jitter
      for (let attempt = 0; attempt < 10; attempt++) {
        const delay = retryStormProtectionService.calculateRetryDelay(
          {
            component: 'publishing',
            baseDelay: 1000,
            maxDelay: 60000,
            jitterFactor: 0.3,
          },
          attempt
        );
        delays.push(delay);
      }

      // Verify exponential backoff
      for (let i = 1; i < delays.length - 1; i++) {
        // Each delay should be roughly 2x previous (with jitter)
        const ratio = delays[i] / delays[i - 1];
        expect(ratio).toBeGreaterThan(1.4); // 2x with -30% jitter
        expect(ratio).toBeLessThan(2.6); // 2x with +30% jitter
      }

      // Verify jitter (delays should not be identical)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(5); // At least some variation
    });

    it('should enforce global retry cap', async () => {
      // Record many retries
      for (let i = 0; i < 1100; i++) {
        await retryStormProtectionService.recordRetry('publishing');
      }

      // Check if retry allowed
      const result = await retryStormProtectionService.checkRetryAllowed('publishing');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Global retry cap');
    });

    it('should enforce component retry cap', async () => {
      // Record many retries for specific component
      for (let i = 0; i < 150; i++) {
        await retryStormProtectionService.recordRetry('analytics');
      }

      // Check if retry allowed
      const result = await retryStormProtectionService.checkRetryAllowed('analytics');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Component retry cap');
    });

    it('should allow retries under cap', async () => {
      // Record few retries
      for (let i = 0; i < 10; i++) {
        await retryStormProtectionService.recordRetry('publishing');
      }

      // Check if retry allowed
      const result = await retryStormProtectionService.checkRetryAllowed('publishing');

      expect(result.allowed).toBe(true);
    });
  });

  describe('Mass Failure Scenarios', () => {
    it('should handle 100 concurrent failures without duplicate publish', async () => {
      // Create 100 posts
      const posts = [];
      for (let i = 0; i < 100; i++) {
        const post = await Post.create({
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          content: `Post ${i}`,
          status: PostStatus.SCHEDULED,
          scheduledAt: new Date(Date.now() - 1000),
          version: 1,
        });
        posts.push(post);
      }

      // Mock platform to fail
      let publishAttempts = 0;
      vi.mock('../../providers/ProviderFactory', () => ({
        providerFactory: {
          getProvider: () => ({
            publishPost: vi.fn().mockImplementation(async () => {
              publishAttempts++;
              throw new Error('Platform unavailable');
            }),
          }),
        },
      }));

      // Process all posts concurrently
      const results = await Promise.allSettled(
        posts.map((post, i) =>
          workers[i % workers.length]['processJob']({
            id: `job${i}`,
            data: {
              postId: post._id.toString(),
              workspaceId: testWorkspaceId,
              socialAccountId: testAccountId,
              retryCount: 0,
            },
            attemptsMade: 0,
            opts: { attempts: 3 },
          } as any)
        )
      );

      // All should fail
      const failures = results.filter(r => r.status === 'rejected');
      expect(failures.length).toBe(100);

      // Verify no duplicate publish attempts (idempotency)
      expect(publishAttempts).toBeLessThanOrEqual(100);
    });

    it('should handle platform outage gracefully', async () => {
      // Create posts
      const posts = [];
      for (let i = 0; i < 20; i++) {
        const post = await Post.create({
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          content: `Post ${i}`,
          status: PostStatus.SCHEDULED,
          scheduledAt: new Date(Date.now() - 1000),
          version: 1,
        });
        posts.push(post);
      }

      // Mock platform outage (all requests fail)
      vi.mock('../../providers/ProviderFactory', () => ({
        providerFactory: {
          getProvider: () => ({
            publishPost: vi.fn().mockRejectedValue({
              message: 'Service unavailable',
              retryable: true,
            }),
          }),
        },
      }));

      // Process posts
      const results = await Promise.allSettled(
        posts.map((post, i) =>
          workers[i % workers.length]['processJob']({
            id: `job${i}`,
            data: {
              postId: post._id.toString(),
              workspaceId: testWorkspaceId,
              socialAccountId: testAccountId,
              retryCount: 0,
            },
            attemptsMade: 0,
            opts: { attempts: 3 },
          } as any)
        )
      );

      // All should fail
      expect(results.every(r => r.status === 'rejected')).toBe(true);

      // Verify posts reverted to SCHEDULED for retry
      for (const post of posts) {
        const updatedPost = await Post.findById(post._id);
        expect(updatedPost?.status).toBe(PostStatus.SCHEDULED);
      }
    });
  });

  describe('Network Instability', () => {
    it('should handle intermittent network failures', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Test post',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        version: 1,
      });

      // Mock intermittent failures (fail 2 times, succeed on 3rd)
      let attemptCount = 0;
      vi.mock('../../providers/ProviderFactory', () => ({
        providerFactory: {
          getProvider: () => ({
            publishPost: vi.fn().mockImplementation(async () => {
              attemptCount++;
              if (attemptCount < 3) {
                throw new Error('Network timeout');
              }
              return {
                success: true,
                platformPostId: 'platform_123',
              };
            }),
          }),
        },
      }));

      // Attempt 1 - fail
      await expect(
        workers[0]['processJob']({
          id: 'job1',
          data: {
            postId: post._id.toString(),
            workspaceId: testWorkspaceId,
            socialAccountId: testAccountId,
            retryCount: 0,
          },
          attemptsMade: 0,
          opts: { attempts: 3 },
        } as any)
      ).rejects.toThrow();

      // Attempt 2 - fail
      await expect(
        workers[0]['processJob']({
          id: 'job2',
          data: {
            postId: post._id.toString(),
            workspaceId: testWorkspaceId,
            socialAccountId: testAccountId,
            retryCount: 1,
          },
          attemptsMade: 1,
          opts: { attempts: 3 },
        } as any)
      ).rejects.toThrow();

      // Attempt 3 - succeed
      const result = await workers[0]['processJob']({
        id: 'job3',
        data: {
          postId: post._id.toString(),
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          retryCount: 2,
        },
        attemptsMade: 2,
        opts: { attempts: 3 },
      } as any);

      expect(result.success).toBe(true);

      // Verify post published
      const updatedPost = await Post.findById(post._id);
      expect(updatedPost?.status).toBe(PostStatus.PUBLISHED);
    });
  });

  describe('Queue Starvation Protection', () => {
    it('should not starve queue with long-running jobs', async () => {
      // Create mix of fast and slow posts
      const fastPosts = [];
      const slowPosts = [];

      for (let i = 0; i < 5; i++) {
        const post = await Post.create({
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          content: `Fast post ${i}`,
          status: PostStatus.SCHEDULED,
          scheduledAt: new Date(Date.now() - 1000),
          version: 1,
        });
        fastPosts.push(post);
      }

      for (let i = 0; i < 5; i++) {
        const post = await Post.create({
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          content: `Slow post ${i}`,
          status: PostStatus.SCHEDULED,
          scheduledAt: new Date(Date.now() - 2000),
          version: 1,
          metadata: { slow: true },
        });
        slowPosts.push(post);
      }

      // Mock platform with variable delays
      vi.mock('../../providers/ProviderFactory', () => ({
        providerFactory: {
          getProvider: () => ({
            publishPost: vi.fn().mockImplementation(async (data: any) => {
              // Slow posts take 5 seconds
              if (data.metadata?.slow) {
                await new Promise(resolve => setTimeout(resolve, 5000));
              }
              return {
                success: true,
                platformPostId: `platform_${Date.now()}`,
              };
            }),
          }),
        },
      }));

      // Process all posts concurrently
      const allPosts = [...slowPosts, ...fastPosts];
      const startTime = Date.now();

      await Promise.allSettled(
        allPosts.map((post, i) =>
          workers[i % workers.length]['processJob']({
            id: `job${i}`,
            data: {
              postId: post._id.toString(),
              workspaceId: testWorkspaceId,
              socialAccountId: testAccountId,
              retryCount: 0,
            },
            attemptsMade: 0,
            opts: { attempts: 3 },
          } as any)
        )
      );

      const duration = Date.now() - startTime;

      // Fast posts should complete quickly despite slow posts
      // With 5 workers and 5 slow posts (5s each), fast posts should complete in < 10s
      expect(duration).toBeLessThan(10000);

      // Verify all fast posts published
      for (const post of fastPosts) {
        const updatedPost = await Post.findById(post._id);
        expect(updatedPost?.status).toBe(PostStatus.PUBLISHED);
      }
    });
  });

  describe('Concurrent Worker Overload', () => {
    it('should handle 10 workers processing 100 posts', async () => {
      // Create 100 posts
      const posts = [];
      for (let i = 0; i < 100; i++) {
        const post = await Post.create({
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          content: `Post ${i}`,
          status: PostStatus.SCHEDULED,
          scheduledAt: new Date(Date.now() - 1000),
          version: 1,
        });
        posts.push(post);
      }

      // Create 10 workers
      const manyWorkers = [];
      for (let i = 0; i < 10; i++) {
        manyWorkers.push(new PublishingWorker());
      }

      // Mock platform
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

      // Process all posts
      const results = await Promise.allSettled(
        posts.map((post, i) =>
          manyWorkers[i % manyWorkers.length]['processJob']({
            id: `job${i}`,
            data: {
              postId: post._id.toString(),
              workspaceId: testWorkspaceId,
              socialAccountId: testAccountId,
              retryCount: 0,
            },
            attemptsMade: 0,
            opts: { attempts: 3 },
          } as any)
        )
      );

      // Count successes
      const successes = results.filter(r => r.status === 'fulfilled');

      // Most should succeed (some may be skipped due to idempotency)
      expect(successes.length).toBeGreaterThan(90);

      // Verify no duplicate publishes
      expect(publishCount).toBeLessThanOrEqual(100);

      // Cleanup
      for (const worker of manyWorkers) {
        await worker.stop();
      }
    });
  });
});
