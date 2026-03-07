import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Post, PostStatus } from '../../models/Post';
import { SocialAccount } from '../../models/SocialAccount';
import { postService } from '../../services/PostService';
import { schedulerService } from '../../services/SchedulerService';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testDb';
import { getRedisClient } from '../../config/redis';

/**
 * MONOTONIC SCHEDULER ORDERING TESTS
 * 
 * Verifies strict ordering guarantees:
 * 1. Posts processed in scheduledAt order (ascending)
 * 2. Same-timestamp posts processed in deterministic order (_id)
 * 3. Ordering maintained under delays and crashes
 * 4. No starvation (oldest posts always processed first)
 */

describe('Scheduler - Monotonic Ordering', () => {
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
    await disconnectTestDB();
  });

  describe('Strict Temporal Ordering', () => {
    it('should process posts in scheduledAt order (ascending)', async () => {
      const now = new Date();

      // Create posts with different scheduled times
      const post1 = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Post 1 - scheduled 5 min ago',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(now.getTime() - 5 * 60 * 1000),
        version: 1,
      });

      const post2 = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Post 2 - scheduled 10 min ago',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(now.getTime() - 10 * 60 * 1000),
        version: 1,
      });

      const post3 = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Post 3 - scheduled 2 min ago',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(now.getTime() - 2 * 60 * 1000),
        version: 1,
      });

      // Fetch eligible posts
      const eligiblePosts = await postService.getEligiblePostsForQueue(10);

      // Verify ordering: post2 (oldest) → post1 → post3 (newest)
      expect(eligiblePosts.length).toBe(3);
      expect(eligiblePosts[0]._id.toString()).toBe(post2._id.toString());
      expect(eligiblePosts[1]._id.toString()).toBe(post1._id.toString());
      expect(eligiblePosts[2]._id.toString()).toBe(post3._id.toString());

      // Verify timestamps are in ascending order
      for (let i = 1; i < eligiblePosts.length; i++) {
        const prevTime = eligiblePosts[i - 1].scheduledAt!.getTime();
        const currTime = eligiblePosts[i].scheduledAt!.getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });

    it('should maintain ordering under scheduler delays', async () => {
      const now = new Date();

      // Create posts scheduled in the past
      const posts = [];
      for (let i = 0; i < 10; i++) {
        const post = await Post.create({
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          content: `Post ${i}`,
          status: PostStatus.SCHEDULED,
          scheduledAt: new Date(now.getTime() - (10 - i) * 60 * 1000), // Reverse order
          version: 1,
        });
        posts.push(post);
      }

      // Simulate scheduler delay - fetch posts multiple times
      for (let run = 0; run < 3; run++) {
        const eligiblePosts = await postService.getEligiblePostsForQueue(10);

        // Verify ordering is consistent across runs
        expect(eligiblePosts.length).toBe(10);
        
        for (let i = 1; i < eligiblePosts.length; i++) {
          const prevTime = eligiblePosts[i - 1].scheduledAt!.getTime();
          const currTime = eligiblePosts[i].scheduledAt!.getTime();
          expect(currTime).toBeGreaterThanOrEqual(prevTime);
        }
      }
    });
  });

  describe('Same-Timestamp Determinism', () => {
    it('should process same-timestamp posts in deterministic order (_id)', async () => {
      const now = new Date();
      const sameTime = new Date(now.getTime() - 5 * 60 * 1000);

      // Create posts with identical scheduled time
      const posts = [];
      for (let i = 0; i < 5; i++) {
        const post = await Post.create({
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          content: `Post ${i}`,
          status: PostStatus.SCHEDULED,
          scheduledAt: sameTime,
          version: 1,
        });
        posts.push(post);
      }

      // Fetch eligible posts multiple times
      const run1 = await postService.getEligiblePostsForQueue(10);
      const run2 = await postService.getEligiblePostsForQueue(10);
      const run3 = await postService.getEligiblePostsForQueue(10);

      // Verify same order across runs
      expect(run1.length).toBe(5);
      expect(run2.length).toBe(5);
      expect(run3.length).toBe(5);

      for (let i = 0; i < 5; i++) {
        expect(run1[i]._id.toString()).toBe(run2[i]._id.toString());
        expect(run2[i]._id.toString()).toBe(run3[i]._id.toString());
      }

      // Verify _id ordering (ascending)
      for (let i = 1; i < run1.length; i++) {
        const prevId = run1[i - 1]._id.toString();
        const currId = run1[i]._id.toString();
        expect(currId > prevId).toBe(true);
      }
    });

    it('should maintain deterministic order under concurrent fetches', async () => {
      const now = new Date();
      const sameTime = new Date(now.getTime() - 5 * 60 * 1000);

      // Create posts with identical scheduled time
      for (let i = 0; i < 10; i++) {
        await Post.create({
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          content: `Post ${i}`,
          status: PostStatus.SCHEDULED,
          scheduledAt: sameTime,
          version: 1,
        });
      }

      // Fetch concurrently
      const [run1, run2, run3] = await Promise.all([
        postService.getEligiblePostsForQueue(10),
        postService.getEligiblePostsForQueue(10),
        postService.getEligiblePostsForQueue(10),
      ]);

      // Verify same order across concurrent runs
      expect(run1.length).toBe(10);
      expect(run2.length).toBe(10);
      expect(run3.length).toBe(10);

      for (let i = 0; i < 10; i++) {
        expect(run1[i]._id.toString()).toBe(run2[i]._id.toString());
        expect(run2[i]._id.toString()).toBe(run3[i]._id.toString());
      }
    });
  });

  describe('No Starvation', () => {
    it('should always process oldest posts first', async () => {
      const now = new Date();

      // Create old post
      const oldPost = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testAccountId,
        content: 'Old post - 1 hour ago',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(now.getTime() - 60 * 60 * 1000),
        version: 1,
      });

      // Create many newer posts
      for (let i = 0; i < 50; i++) {
        await Post.create({
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          content: `Newer post ${i}`,
          status: PostStatus.SCHEDULED,
          scheduledAt: new Date(now.getTime() - i * 1000), // Recent posts
          version: 1,
        });
      }

      // Fetch with limit
      const eligiblePosts = await postService.getEligiblePostsForQueue(10);

      // Verify old post is first
      expect(eligiblePosts[0]._id.toString()).toBe(oldPost._id.toString());
    });

    it('should not skip posts due to processing delays', async () => {
      const now = new Date();

      // Create posts scheduled at different times
      const posts = [];
      for (let i = 0; i < 20; i++) {
        const post = await Post.create({
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          content: `Post ${i}`,
          status: PostStatus.SCHEDULED,
          scheduledAt: new Date(now.getTime() - (20 - i) * 60 * 1000),
          version: 1,
        });
        posts.push(post);
      }

      // Process in batches (simulating scheduler polling)
      const batch1 = await postService.getEligiblePostsForQueue(5);
      expect(batch1.length).toBe(5);

      // Mark first batch as queued
      for (const post of batch1) {
        await Post.findByIdAndUpdate(post._id, { status: PostStatus.QUEUED });
      }

      // Fetch next batch
      const batch2 = await postService.getEligiblePostsForQueue(5);
      expect(batch2.length).toBe(5);

      // Verify batch2 contains next 5 oldest posts
      for (let i = 0; i < 5; i++) {
        expect(batch2[i]._id.toString()).toBe(posts[i + 5]._id.toString());
      }
    });
  });

  describe('Crash Recovery Ordering', () => {
    it('should maintain ordering after simulated crash', async () => {
      const now = new Date();

      // Create posts
      const posts = [];
      for (let i = 0; i < 10; i++) {
        const post = await Post.create({
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          content: `Post ${i}`,
          status: PostStatus.SCHEDULED,
          scheduledAt: new Date(now.getTime() - (10 - i) * 60 * 1000),
          version: 1,
        });
        posts.push(post);
      }

      // Fetch first batch
      const batch1 = await postService.getEligiblePostsForQueue(5);
      const batch1Ids = batch1.map(p => p._id.toString());

      // Simulate crash - don't mark as queued

      // Fetch again (simulating restart)
      const batch2 = await postService.getEligiblePostsForQueue(5);
      const batch2Ids = batch2.map(p => p._id.toString());

      // Verify same posts returned in same order
      expect(batch1Ids).toEqual(batch2Ids);
    });

    it('should resume from correct position after partial processing', async () => {
      const now = new Date();

      // Create posts
      const posts = [];
      for (let i = 0; i < 10; i++) {
        const post = await Post.create({
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          content: `Post ${i}`,
          status: PostStatus.SCHEDULED,
          scheduledAt: new Date(now.getTime() - (10 - i) * 60 * 1000),
          version: 1,
        });
        posts.push(post);
      }

      // Process first 3 posts
      const batch1 = await postService.getEligiblePostsForQueue(3);
      for (const post of batch1) {
        await Post.findByIdAndUpdate(post._id, { status: PostStatus.PUBLISHED });
      }

      // Simulate crash during 4th post (mark as PUBLISHING)
      const batch2 = await postService.getEligiblePostsForQueue(5);
      await Post.findByIdAndUpdate(batch2[0]._id, { status: PostStatus.PUBLISHING });

      // Fetch remaining posts
      const batch3 = await postService.getEligiblePostsForQueue(10);

      // Verify correct posts returned (excluding published and publishing)
      expect(batch3.length).toBe(6); // 10 total - 3 published - 1 publishing
      
      // Verify ordering maintained
      for (let i = 1; i < batch3.length; i++) {
        const prevTime = batch3[i - 1].scheduledAt!.getTime();
        const currTime = batch3[i].scheduledAt!.getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });
  });

  describe('Ordering Under Load', () => {
    it('should maintain ordering with 100 posts', async () => {
      const now = new Date();

      // Create 100 posts with random scheduled times
      const posts = [];
      for (let i = 0; i < 100; i++) {
        const randomMinutesAgo = Math.floor(Math.random() * 120); // 0-120 minutes ago
        const post = await Post.create({
          workspaceId: testWorkspaceId,
          socialAccountId: testAccountId,
          content: `Post ${i}`,
          status: PostStatus.SCHEDULED,
          scheduledAt: new Date(now.getTime() - randomMinutesAgo * 60 * 1000),
          version: 1,
        });
        posts.push(post);
      }

      // Fetch all eligible posts
      const eligiblePosts = await postService.getEligiblePostsForQueue(100);

      expect(eligiblePosts.length).toBe(100);

      // Verify strict ordering
      for (let i = 1; i < eligiblePosts.length; i++) {
        const prevTime = eligiblePosts[i - 1].scheduledAt!.getTime();
        const currTime = eligiblePosts[i].scheduledAt!.getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);

        // If same timestamp, verify _id ordering
        if (prevTime === currTime) {
          const prevId = eligiblePosts[i - 1]._id.toString();
          const currId = eligiblePosts[i]._id.toString();
          expect(currId > prevId).toBe(true);
        }
      }
    });
  });
});
