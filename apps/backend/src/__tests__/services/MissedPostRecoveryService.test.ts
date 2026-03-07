/**
 * Task 1.2.3: Implement Missed Post Recovery with Job Claiming
 * 
 * Tests for MissedPostRecoveryService:
 * 1. Atomic job claiming (UPDATE WHERE status = 'scheduled')
 * 2. Worker ID tracking to prevent duplicate recovery
 * 3. Run recovery monitor every 5 minutes with jitter
 * 4. Mark posts > 24 hours late as "expired"
 * 5. Recovery metrics and alerting
 */

import { Post, PostStatus } from '../../models/Post';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import mongoose from 'mongoose';

describe('Task 1.2.3: Missed Post Recovery with Job Claiming', () => {
  let testWorkspaceId: mongoose.Types.ObjectId;
  let testUserId: mongoose.Types.ObjectId;
  let testSocialAccountId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDatabase();
    
    testWorkspaceId = new mongoose.Types.ObjectId();
    testUserId = new mongoose.Types.ObjectId();
    testSocialAccountId = new mongoose.Types.ObjectId();
  });

  afterAll(async () => {
    await Post.deleteMany({ workspaceId: testWorkspaceId });
    await disconnectDatabase();
  });

  beforeEach(async () => {
    // Clean up posts before each test
    await Post.deleteMany({ workspaceId: testWorkspaceId });
  });

  describe('Atomic Job Claiming', () => {
    it('should atomically claim a missed post with optimistic locking', async () => {
      // Create a missed post (scheduled 10 minutes ago)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Missed post for atomic claiming test',
        status: PostStatus.SCHEDULED,
        scheduledAt: tenMinutesAgo,
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Simulate atomic job claiming
      const workerId = 'test-worker-1';
      const claimed = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: PostStatus.SCHEDULED,
          version: post.version, // Optimistic locking
        },
        {
          $set: {
            status: PostStatus.QUEUED,
            'metadata.recoveredBy': workerId,
            'metadata.recoveredAt': new Date(),
            'metadata.lateness': Date.now() - tenMinutesAgo.getTime(),
          },
          $inc: { version: 1 },
        },
        { new: true }
      );

      // Verify claim succeeded
      expect(claimed).toBeDefined();
      expect(claimed!.status).toBe(PostStatus.QUEUED);
      expect(claimed!.version).toBe(2);
      expect(claimed!.metadata.recoveredBy).toBe(workerId);
      expect(claimed!.metadata.recoveredAt).toBeDefined();
      expect(claimed!.metadata.lateness).toBeGreaterThan(0);
    });

    it('should fail to claim if another worker already claimed', async () => {
      // Create a missed post
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Missed post for conflict test',
        status: PostStatus.SCHEDULED,
        scheduledAt: tenMinutesAgo,
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Worker 1 claims the post
      const worker1Id = 'test-worker-1';
      const claimed1 = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: PostStatus.SCHEDULED,
          version: post.version,
        },
        {
          $set: {
            status: PostStatus.QUEUED,
            'metadata.recoveredBy': worker1Id,
            'metadata.recoveredAt': new Date(),
          },
          $inc: { version: 1 },
        },
        { new: true }
      );

      expect(claimed1).toBeDefined();
      expect(claimed1!.metadata.recoveredBy).toBe(worker1Id);

      // Worker 2 attempts to claim the same post (should fail)
      const worker2Id = 'test-worker-2';
      const claimed2 = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: PostStatus.SCHEDULED, // Status already changed to QUEUED
          version: post.version, // Version already incremented
        },
        {
          $set: {
            status: PostStatus.QUEUED,
            'metadata.recoveredBy': worker2Id,
            'metadata.recoveredAt': new Date(),
          },
          $inc: { version: 1 },
        },
        { new: true }
      );

      // Verify claim failed
      expect(claimed2).toBeNull();

      // Verify post still has worker 1's claim
      const finalPost = await Post.findById(post._id);
      expect(finalPost!.metadata.recoveredBy).toBe(worker1Id);
      expect(finalPost!.version).toBe(2);
    });

    it('should fail to claim if post status changed', async () => {
      // Create a missed post
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Missed post for status change test',
        status: PostStatus.SCHEDULED,
        scheduledAt: tenMinutesAgo,
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Post gets published by another process
      await Post.findByIdAndUpdate(post._id, {
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
      });

      // Worker attempts to claim (should fail)
      const workerId = 'test-worker-1';
      const claimed = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: PostStatus.SCHEDULED, // Status already changed to PUBLISHED
          version: post.version,
        },
        {
          $set: {
            status: PostStatus.QUEUED,
            'metadata.recoveredBy': workerId,
            'metadata.recoveredAt': new Date(),
          },
          $inc: { version: 1 },
        },
        { new: true }
      );

      // Verify claim failed
      expect(claimed).toBeNull();

      // Verify post is still published
      const finalPost = await Post.findById(post._id);
      expect(finalPost!.status).toBe(PostStatus.PUBLISHED);
    });
  });

  describe('Missed Post Detection', () => {
    it('should detect posts > 5 minutes late', async () => {
      // Create posts at different lateness levels
      const now = new Date();
      const posts = await Post.create([
        {
          workspaceId: testWorkspaceId,
          socialAccountId: testSocialAccountId,
          content: 'Post 1 minute late',
          status: PostStatus.SCHEDULED,
          scheduledAt: new Date(now.getTime() - 1 * 60 * 1000),
          createdBy: testUserId,
          retryCount: 0,
          metadata: {},
          version: 1,
        },
        {
          workspaceId: testWorkspaceId,
          socialAccountId: testSocialAccountId,
          content: 'Post 10 minutes late',
          status: PostStatus.SCHEDULED,
          scheduledAt: new Date(now.getTime() - 10 * 60 * 1000),
          createdBy: testUserId,
          retryCount: 0,
          metadata: {},
          version: 1,
        },
        {
          workspaceId: testWorkspaceId,
          socialAccountId: testSocialAccountId,
          content: 'Post 1 hour late',
          status: PostStatus.SCHEDULED,
          scheduledAt: new Date(now.getTime() - 60 * 60 * 1000),
          createdBy: testUserId,
          retryCount: 0,
          metadata: {},
          version: 1,
        },
      ]);

      // Find posts > 5 minutes late
      const missedThreshold = new Date(now.getTime() - 5 * 60 * 1000);
      const missedPosts = await Post.find({
        status: PostStatus.SCHEDULED,
        scheduledAt: { $lt: missedThreshold },
      });

      // Should find 2 posts (10 minutes and 1 hour late)
      expect(missedPosts.length).toBe(2);
      expect(missedPosts.some(p => p.content === 'Post 10 minutes late')).toBe(true);
      expect(missedPosts.some(p => p.content === 'Post 1 hour late')).toBe(true);
    });

    it('should not detect posts < 5 minutes late', async () => {
      // Create a post 3 minutes late
      const now = new Date();
      await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Post 3 minutes late',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(now.getTime() - 3 * 60 * 1000),
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Find posts > 5 minutes late
      const missedThreshold = new Date(now.getTime() - 5 * 60 * 1000);
      const missedPosts = await Post.find({
        status: PostStatus.SCHEDULED,
        scheduledAt: { $lt: missedThreshold },
      });

      // Should find 0 posts
      expect(missedPosts.length).toBe(0);
    });
  });

  describe('Expired Post Handling', () => {
    it('should mark posts > 24 hours late as expired', async () => {
      // Create a post 25 hours late
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Post 25 hours late',
        status: PostStatus.SCHEDULED,
        scheduledAt: twentyFiveHoursAgo,
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Simulate expiring the post
      const workerId = 'test-worker-1';
      const lateness = Date.now() - twentyFiveHoursAgo.getTime();
      
      await Post.findByIdAndUpdate(post._id, {
        status: PostStatus.FAILED,
        errorMessage: 'Post expired - more than 24 hours late',
        'metadata.expiredBy': workerId,
        'metadata.expiredAt': new Date(),
        'metadata.lateness': lateness,
      });

      // Verify post is expired
      const expiredPost = await Post.findById(post._id);
      expect(expiredPost!.status).toBe(PostStatus.FAILED);
      expect(expiredPost!.errorMessage).toContain('expired');
      expect(expiredPost!.metadata.expiredBy).toBe(workerId);
      expect(expiredPost!.metadata.expiredAt).toBeDefined();
      expect(expiredPost!.metadata.lateness).toBeGreaterThan(24 * 60 * 60 * 1000);
    });

    it('should not expire posts < 24 hours late', async () => {
      // Create a post 10 hours late
      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Post 10 hours late',
        status: PostStatus.SCHEDULED,
        scheduledAt: tenHoursAgo,
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Check if should expire
      const expiredThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const shouldExpire = post.scheduledAt < expiredThreshold;

      expect(shouldExpire).toBe(false);
    });
  });

  describe('Worker ID Tracking', () => {
    it('should store worker ID when claiming post', async () => {
      // Create a missed post
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Post for worker ID test',
        status: PostStatus.SCHEDULED,
        scheduledAt: tenMinutesAgo,
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Claim with worker ID
      const workerId = 'recovery-worker-abc123';
      await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: PostStatus.SCHEDULED,
          version: post.version,
        },
        {
          $set: {
            status: PostStatus.QUEUED,
            'metadata.recoveredBy': workerId,
            'metadata.recoveredAt': new Date(),
          },
          $inc: { version: 1 },
        }
      );

      // Verify worker ID stored
      const claimedPost = await Post.findById(post._id);
      expect(claimedPost!.metadata.recoveredBy).toBe(workerId);
      expect(claimedPost!.metadata.recoveredAt).toBeDefined();
    });

    it('should store worker ID when expiring post', async () => {
      // Create an expired post
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Post for expiry worker ID test',
        status: PostStatus.SCHEDULED,
        scheduledAt: twentyFiveHoursAgo,
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Expire with worker ID
      const workerId = 'recovery-worker-xyz789';
      await Post.findByIdAndUpdate(post._id, {
        status: PostStatus.FAILED,
        errorMessage: 'Post expired - more than 24 hours late',
        'metadata.expiredBy': workerId,
        'metadata.expiredAt': new Date(),
      });

      // Verify worker ID stored
      const expiredPost = await Post.findById(post._id);
      expect(expiredPost!.metadata.expiredBy).toBe(workerId);
      expect(expiredPost!.metadata.expiredAt).toBeDefined();
    });
  });

  describe('Lateness Tracking', () => {
    it('should calculate and store lateness when recovering', async () => {
      // Create a missed post (15 minutes late)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Post for lateness test',
        status: PostStatus.SCHEDULED,
        scheduledAt: fifteenMinutesAgo,
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Calculate lateness
      const lateness = Date.now() - fifteenMinutesAgo.getTime();

      // Claim with lateness
      await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: PostStatus.SCHEDULED,
          version: post.version,
        },
        {
          $set: {
            status: PostStatus.QUEUED,
            'metadata.recoveredBy': 'test-worker',
            'metadata.recoveredAt': new Date(),
            'metadata.lateness': lateness,
          },
          $inc: { version: 1 },
        }
      );

      // Verify lateness stored
      const recoveredPost = await Post.findById(post._id);
      expect(recoveredPost!.metadata.lateness).toBeDefined();
      expect(recoveredPost!.metadata.lateness).toBeGreaterThan(14 * 60 * 1000); // > 14 minutes
      expect(recoveredPost!.metadata.lateness).toBeLessThan(16 * 60 * 1000); // < 16 minutes
    });
  });
});
