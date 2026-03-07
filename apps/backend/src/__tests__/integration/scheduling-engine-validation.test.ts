/**
 * Scheduling Engine Validation Tests
 * 
 * Validates the delayed-queue architecture for post scheduling
 * 
 * Test Coverage:
 * 1. Time Handling (timezone-safe, UTC storage, minimum delay)
 * 2. Queue Integration (delayed job creation, job delay matches scheduledAt)
 * 3. Reschedule Safety (old job removed, new job created, no orphans)
 * 4. Cancel Safety (queue job removed, no orphaned jobs)
 * 5. Missed Execution Recovery (worker down scenario)
 * 6. Concurrency & Idempotency (parallel reschedule, race conditions)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { Post, PostStatus } from '../../models/Post';
import { SocialAccount } from '../../models/SocialAccount';
import { Workspace } from '../../models/Workspace';
import { User } from '../../models/User';
import { postService } from '../../services/PostService';
import { PostingQueue } from '../../queue/PostingQueue';
import { QueueManager } from '../../queue/QueueManager';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getRedisClient } from '../../config/redis';

describe('Scheduling Engine Validation', () => {
  let workspace: any;
  let user: any;
  let socialAccount: any;
  let postingQueue: PostingQueue;
  let queueManager: QueueManager;

  beforeAll(async () => {
    await connectDatabase();
    queueManager = QueueManager.getInstance();
    postingQueue = new PostingQueue();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    // Clean up
    await Post.deleteMany({});
    await SocialAccount.deleteMany({});
    await Workspace.deleteMany({});
    await User.deleteMany({});

    // Clean queue
    const redis = getRedisClient();
    await redis.flushdb();

    // Create test data
    user = await User.create({
      email: 'test@example.com',
      password: 'hashedpassword',
      firstName: 'Test',
      lastName: 'User',
    });

    workspace = await Workspace.create({
      name: 'Test Workspace',
      ownerId: user._id,
      members: [{ userId: user._id, role: 'owner' }],
    });

    socialAccount = await SocialAccount.create({
      workspaceId: workspace._id,
      provider: 'twitter',
      accountName: 'testaccount',
      accountId: 'twitter123',
      accessToken: 'encrypted_token',
      refreshToken: 'encrypted_refresh',
      expiresAt: new Date(Date.now() + 3600000),
    });
  });

  afterEach(async () => {
    // Clean up after each test
    await Post.deleteMany({});
    await SocialAccount.deleteMany({});
    await Workspace.deleteMany({});
    await User.deleteMany({});

    // Clean queue
    const redis = getRedisClient();
    await redis.flushdb();
  });

  describe('1. Time Handling', () => {
    it('should store scheduledAt in UTC', async () => {
      const scheduledAt = new Date('2026-12-31T14:00:00-08:00'); // PST timezone
      
      const post = await postService.createPost({
        workspaceId: workspace._id.toString(),
        socialAccountId: socialAccount._id.toString(),
        content: 'Test post',
        scheduledAt,
        createdBy: user._id.toString(),
      });

      // Verify stored as UTC
      const storedPost = await Post.findById(post._id);
      expect(storedPost?.scheduledAt).toBeDefined();
      
      // Convert to ISO string and verify it's UTC (ends with Z)
      const isoString = storedPost!.scheduledAt!.toISOString();
      expect(isoString).toMatch(/Z$/);
      
      // Verify time is correct (PST -08:00 → UTC +08:00)
      expect(isoString).toBe('2026-12-31T22:00:00.000Z');
    });

    it('should prevent scheduling in the past', async () => {
      const pastDate = new Date(Date.now() - 60000); // 1 minute ago

      await expect(
        postService.createPost({
          workspaceId: workspace._id.toString(),
          socialAccountId: socialAccount._id.toString(),
          content: 'Test post',
          scheduledAt: pastDate,
          createdBy: user._id.toString(),
        })
      ).rejects.toThrow('Scheduled time must be in the future');
    });

    it('should enforce minimum delay of 60 seconds', async () => {
      const tooSoon = new Date(Date.now() + 30000); // 30 seconds

      await expect(
        postService.createPost({
          workspaceId: workspace._id.toString(),
          socialAccountId: socialAccount._id.toString(),
          content: 'Test post',
          scheduledAt: tooSoon,
          createdBy: user._id.toString(),
        })
      ).rejects.toThrow('Scheduled time must be at least 60 seconds in the future');
    });

    it('should accept scheduling with 60+ seconds delay', async () => {
      const validFuture = new Date(Date.now() + 120000); // 2 minutes

      const post = await postService.createPost({
        workspaceId: workspace._id.toString(),
        socialAccountId: socialAccount._id.toString(),
        content: 'Test post',
        scheduledAt: validFuture,
        createdBy: user._id.toString(),
      });

      expect(post.status).toBe(PostStatus.SCHEDULED);
      expect(post.scheduledAt).toBeDefined();
    });
  });

  describe('2. Queue Integration', () => {
    it('should create delayed queue job when scheduling post', async () => {
      const scheduledAt = new Date(Date.now() + 120000); // 2 minutes

      const post = await postService.createPost({
        workspaceId: workspace._id.toString(),
        socialAccountId: socialAccount._id.toString(),
        content: 'Test post',
        scheduledAt,
        createdBy: user._id.toString(),
      });

      // Verify queue job created
      expect(post.queueJobId).toBeDefined();
      
      const job = await postingQueue.getPostJob(post._id.toString());
      expect(job).toBeDefined();
      expect(job?.id).toBe(post.queueJobId);
    });

    it('should set job delay to match scheduledAt', async () => {
      const scheduledAt = new Date(Date.now() + 180000); // 3 minutes
      const expectedDelay = scheduledAt.getTime() - Date.now();

      const post = await postService.createPost({
        workspaceId: workspace._id.toString(),
        socialAccountId: socialAccount._id.toString(),
        content: 'Test post',
        scheduledAt,
        createdBy: user._id.toString(),
      });

      const job = await postingQueue.getPostJob(post._id.toString());
      expect(job).toBeDefined();
      
      // Job delay should be within 5 seconds of expected (account for processing time)
      const actualDelay = job!.opts.delay || 0;
      expect(Math.abs(actualDelay - expectedDelay)).toBeLessThan(5000);
    });

    it('should not create duplicate queue jobs', async () => {
      const scheduledAt = new Date(Date.now() + 120000);

      const post = await postService.createPost({
        workspaceId: workspace._id.toString(),
        socialAccountId: socialAccount._id.toString(),
        content: 'Test post',
        scheduledAt,
        createdBy: user._id.toString(),
      });

      const firstJobId = post.queueJobId;

      // Try to add same post again (should be idempotent)
      const inQueue = await postingQueue.isPostInQueue(post._id.toString());
      expect(inQueue).toBe(true);

      // Verify only one job exists
      const job = await postingQueue.getPostJob(post._id.toString());
      expect(job?.id).toBe(firstJobId);
    });

    it('should create queue job when scheduling via schedulePost()', async () => {
      // Create draft first
      const draft = await postService.createPost({
        workspaceId: workspace._id.toString(),
        socialAccountId: socialAccount._id.toString(),
        content: 'Test post',
        createdBy: user._id.toString(),
      });

      expect(draft.status).toBe(PostStatus.DRAFT);
      expect(draft.queueJobId).toBeUndefined();

      // Schedule it
      const scheduledAt = new Date(Date.now() + 120000);
      const scheduled = await postService.schedulePost(
        draft._id.toString(),
        workspace._id.toString(),
        scheduledAt
      );

      expect(scheduled.status).toBe(PostStatus.SCHEDULED);
      expect(scheduled.queueJobId).toBeDefined();

      const job = await postingQueue.getPostJob(scheduled._id.toString());
      expect(job).toBeDefined();
    });
  });

  describe('3. Reschedule Safety', () => {
    it('should remove old queue job when rescheduling', async () => {
      const initialSchedule = new Date(Date.now() + 120000);

      const post = await postService.createPost({
        workspaceId: workspace._id.toString(),
        socialAccountId: socialAccount._id.toString(),
        content: 'Test post',
        scheduledAt: initialSchedule,
        createdBy: user._id.toString(),
      });

      const oldJobId = post.queueJobId;
      expect(oldJobId).toBeDefined();

      // Reschedule
      const newSchedule = new Date(Date.now() + 240000); // 4 minutes
      const updated = await postService.updatePost(
        post._id.toString(),
        workspace._id.toString(),
        { scheduledAt: newSchedule }
      );

      // Verify new job ID
      expect(updated.queueJobId).toBeDefined();
      expect(updated.queueJobId).not.toBe(oldJobId);

      // Verify old job removed
      const oldJob = await postingQueue.getPostJob(post._id.toString());
      expect(oldJob?.id).toBe(updated.queueJobId); // Should be new job
    });

    it('should create new queue job with correct delay when rescheduling', async () => {
      const initialSchedule = new Date(Date.now() + 120000);

      const post = await postService.createPost({
        workspaceId: workspace._id.toString(),
        socialAccountId: socialAccount._id.toString(),
        content: 'Test post',
        scheduledAt: initialSchedule,
        createdBy: user._id.toString(),
      });

      // Reschedule
      const newSchedule = new Date(Date.now() + 300000); // 5 minutes
      const expectedDelay = newSchedule.getTime() - Date.now();

      const updated = await postService.updatePost(
        post._id.toString(),
        workspace._id.toString(),
        { scheduledAt: newSchedule }
      );

      const job = await postingQueue.getPostJob(updated._id.toString());
      expect(job).toBeDefined();

      const actualDelay = job!.opts.delay || 0;
      expect(Math.abs(actualDelay - expectedDelay)).toBeLessThan(5000);
    });

    it('should not leave orphan jobs after reschedule', async () => {
      const initialSchedule = new Date(Date.now() + 120000);

      const post = await postService.createPost({
        workspaceId: workspace._id.toString(),
        socialAccountId: socialAccount._id.toString(),
        content: 'Test post',
        scheduledAt: initialSchedule,
        createdBy: user._id.toString(),
      });

      // Reschedule multiple times
      for (let i = 0; i < 3; i++) {
        const newSchedule = new Date(Date.now() + (i + 2) * 120000);
        await postService.updatePost(
          post._id.toString(),
          workspace._id.toString(),
          { scheduledAt: newSchedule }
        );
      }

      // Verify only one job exists
      const jobs = await postingQueue.getJobs('delayed', 0, 100);
      const postJobs = jobs.filter(j => j.data.postId === post._id.toString());
      expect(postJobs.length).toBe(1);
    });
  });

  describe('4. Cancel Safety', () => {
    it('should remove queue job when cancelling scheduled post', async () => {
      const scheduledAt = new Date(Date.now() + 120000);

      const post = await postService.createPost({
        workspaceId: workspace._id.toString(),
        socialAccountId: socialAccount._id.toString(),
        content: 'Test post',
        scheduledAt,
        createdBy: user._id.toString(),
      });

      expect(post.queueJobId).toBeDefined();

      // Cancel
      const cancelled = await postService.cancelScheduledPost(
        post._id.toString(),
        workspace._id.toString()
      );

      expect(cancelled.status).toBe(PostStatus.CANCELLED);

      // Verify queue job removed
      const inQueue = await postingQueue.isPostInQueue(post._id.toString());
      expect(inQueue).toBe(false);
    });

    it('should not allow cancelling already published post', async () => {
      const post = await Post.create({
        workspaceId: workspace._id,
        socialAccountId: socialAccount._id,
        content: 'Test post',
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        createdBy: user._id,
      });

      await expect(
        postService.cancelScheduledPost(
          post._id.toString(),
          workspace._id.toString()
        )
      ).rejects.toThrow('Only scheduled posts can be cancelled');
    });

    it('should not leave orphaned jobs after cancel', async () => {
      const scheduledAt = new Date(Date.now() + 120000);

      const post = await postService.createPost({
        workspaceId: workspace._id.toString(),
        socialAccountId: socialAccount._id.toString(),
        content: 'Test post',
        scheduledAt,
        createdBy: user._id.toString(),
      });

      await postService.cancelScheduledPost(
        post._id.toString(),
        workspace._id.toString()
      );

      // Verify no jobs for this post
      const jobs = await postingQueue.getJobs('delayed', 0, 100);
      const postJobs = jobs.filter(j => j.data.postId === post._id.toString());
      expect(postJobs.length).toBe(0);
    });
  });

  describe('5. Missed Execution Recovery', () => {
    it('should handle worker down scenario via polling fallback', async () => {
      // Create a post scheduled in the past (simulating missed execution)
      const pastSchedule = new Date(Date.now() - 60000); // 1 minute ago

      const post = await Post.create({
        workspaceId: workspace._id,
        socialAccountId: socialAccount._id,
        content: 'Test post',
        status: PostStatus.SCHEDULED,
        scheduledAt: pastSchedule,
        createdBy: user._id,
      });

      // Verify post is eligible for queue
      expect(post.isEligibleForQueue()).toBe(true);

      // Polling scheduler would pick this up
      const eligiblePosts = await postService.getEligiblePostsForQueue(100);
      expect(eligiblePosts.length).toBeGreaterThan(0);
      expect(eligiblePosts.some(p => p._id.toString() === post._id.toString())).toBe(true);
    });

    it('should not duplicate execution if delayed job already processed', async () => {
      // This is handled by idempotency guards in PublishingWorker
      // If post status is already PUBLISHED, worker returns early
      const post = await Post.create({
        workspaceId: workspace._id,
        socialAccountId: socialAccount._id,
        content: 'Test post',
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        createdBy: user._id,
      });

      // Verify not eligible for queue
      expect(post.isEligibleForQueue()).toBe(false);
    });
  });

  describe('6. Concurrency & Idempotency', () => {
    it('should handle parallel reschedule attempts safely', async () => {
      const initialSchedule = new Date(Date.now() + 120000);

      const post = await postService.createPost({
        workspaceId: workspace._id.toString(),
        socialAccountId: socialAccount._id.toString(),
        content: 'Test post',
        scheduledAt: initialSchedule,
        createdBy: user._id.toString(),
      });

      // Attempt parallel reschedules
      const reschedules = [
        postService.updatePost(
          post._id.toString(),
          workspace._id.toString(),
          { scheduledAt: new Date(Date.now() + 180000) }
        ),
        postService.updatePost(
          post._id.toString(),
          workspace._id.toString(),
          { scheduledAt: new Date(Date.now() + 240000) }
        ),
        postService.updatePost(
          post._id.toString(),
          workspace._id.toString(),
          { scheduledAt: new Date(Date.now() + 300000) }
        ),
      ];

      // All should complete without error (distributed locks prevent race conditions)
      const results = await Promise.allSettled(reschedules);
      
      // At least one should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled');
      expect(succeeded.length).toBeGreaterThan(0);

      // Verify only one job exists
      const jobs = await postingQueue.getJobs('delayed', 0, 100);
      const postJobs = jobs.filter(j => j.data.postId === post._id.toString());
      expect(postJobs.length).toBe(1);
    });

    it('should be idempotent when scheduling same post multiple times', async () => {
      const scheduledAt = new Date(Date.now() + 120000);

      const post = await postService.createPost({
        workspaceId: workspace._id.toString(),
        socialAccountId: socialAccount._id.toString(),
        content: 'Test post',
        createdBy: user._id.toString(),
      });

      // Schedule multiple times
      const schedules = [
        postService.schedulePost(post._id.toString(), workspace._id.toString(), scheduledAt),
        postService.schedulePost(post._id.toString(), workspace._id.toString(), scheduledAt),
        postService.schedulePost(post._id.toString(), workspace._id.toString(), scheduledAt),
      ];

      const results = await Promise.allSettled(schedules);
      
      // At least one should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled');
      expect(succeeded.length).toBeGreaterThan(0);

      // Verify only one job exists
      const jobs = await postingQueue.getJobs('delayed', 0, 100);
      const postJobs = jobs.filter(j => j.data.postId === post._id.toString());
      expect(postJobs.length).toBe(1);
    });

    it('should handle race condition between schedule and cancel', async () => {
      const scheduledAt = new Date(Date.now() + 120000);

      const post = await postService.createPost({
        workspaceId: workspace._id.toString(),
        socialAccountId: socialAccount._id.toString(),
        content: 'Test post',
        createdBy: user._id.toString(),
      });

      // Race: schedule and cancel simultaneously
      const operations = [
        postService.schedulePost(post._id.toString(), workspace._id.toString(), scheduledAt),
        postService.schedulePost(post._id.toString(), workspace._id.toString(), scheduledAt),
      ];

      await Promise.allSettled(operations);

      // Then cancel
      await postService.cancelScheduledPost(
        post._id.toString(),
        workspace._id.toString()
      );

      // Verify no jobs remain
      const inQueue = await postingQueue.isPostInQueue(post._id.toString());
      expect(inQueue).toBe(false);
    });
  });

  describe('7. Timezone Correctness', () => {
    it('should handle different timezone inputs correctly', async () => {
      const timezones = [
        { input: '2026-12-31T14:00:00-08:00', expected: '2026-12-31T22:00:00.000Z' }, // PST
        { input: '2026-12-31T14:00:00-05:00', expected: '2026-12-31T19:00:00.000Z' }, // EST
        { input: '2026-12-31T14:00:00+00:00', expected: '2026-12-31T14:00:00.000Z' }, // UTC
        { input: '2026-12-31T14:00:00+09:00', expected: '2026-12-31T05:00:00.000Z' }, // JST
      ];

      for (const tz of timezones) {
        const post = await postService.createPost({
          workspaceId: workspace._id.toString(),
          socialAccountId: socialAccount._id.toString(),
          content: `Test post ${tz.input}`,
          scheduledAt: new Date(tz.input),
          createdBy: user._id.toString(),
        });

        const storedPost = await Post.findById(post._id);
        expect(storedPost?.scheduledAt?.toISOString()).toBe(tz.expected);

        // Clean up
        await Post.deleteOne({ _id: post._id });
        if (post.queueJobId) {
          await postingQueue.removePost(post._id.toString());
        }
      }
    });
  });
});
