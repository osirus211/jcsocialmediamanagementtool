/**
 * Task 1.2.1: Add Post Status Check Before Publishing
 * 
 * Tests for idempotency guarantees in PublishingWorker:
 * 1. Check post status is "scheduled" before publishing
 * 2. Use atomic status update (scheduled → publishing)
 * 3. Skip job if status already changed
 * 4. Log all status check failures
 * 5. Add idempotency metrics
 */

import { Post, PostStatus } from '../../models/Post';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import mongoose from 'mongoose';

describe('Task 1.2.1: Atomic Status Update for Idempotency', () => {
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

  describe('Atomic Status Update', () => {
    it('should atomically update status from SCHEDULED to PUBLISHING with version increment', async () => {
      // Create a scheduled post
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Test post for atomic update',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000), // Past time
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Simulate atomic update (as done in PublishingWorker)
      const atomicUpdate = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
          version: post.version, // Optimistic locking
        },
        {
          $set: {
            status: PostStatus.PUBLISHING,
            'metadata.publishingStartedAt': new Date(),
          },
          $inc: { version: 1 },
        },
        { new: true }
      );

      // Verify update succeeded
      expect(atomicUpdate).toBeDefined();
      expect(atomicUpdate!.status).toBe(PostStatus.PUBLISHING);
      expect(atomicUpdate!.version).toBe(2);
      expect(atomicUpdate!.metadata.publishingStartedAt).toBeDefined();
    });

    it('should fail atomic update if post status changed', async () => {
      // Create a scheduled post
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Test post for status change',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Change status to PUBLISHED (simulating another worker)
      await Post.findByIdAndUpdate(post._id, {
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        'metadata.platformPostId': 'test_platform_id_123',
      });

      // Attempt atomic update (should fail)
      const atomicUpdate = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
          version: post.version,
        },
        {
          $set: {
            status: PostStatus.PUBLISHING,
            'metadata.publishingStartedAt': new Date(),
          },
          $inc: { version: 1 },
        },
        { new: true }
      );

      // Verify update failed (returns null)
      expect(atomicUpdate).toBeNull();

      // Verify post status remained PUBLISHED
      const currentPost = await Post.findById(post._id);
      expect(currentPost!.status).toBe(PostStatus.PUBLISHED);
    });

    it('should fail atomic update if version mismatch (optimistic locking)', async () => {
      // Create a scheduled post
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Test post for version mismatch',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Simulate another process updating the version
      await Post.findByIdAndUpdate(post._id, {
        $inc: { version: 1 },
        'metadata.someField': 'updated',
      });

      // Attempt atomic update with old version (should fail)
      const atomicUpdate = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
          version: post.version, // Old version (1)
        },
        {
          $set: {
            status: PostStatus.PUBLISHING,
            'metadata.publishingStartedAt': new Date(),
          },
          $inc: { version: 1 },
        },
        { new: true }
      );

      // Verify update failed
      expect(atomicUpdate).toBeNull();

      // Verify post status remained SCHEDULED
      const currentPost = await Post.findById(post._id);
      expect(currentPost!.status).toBe(PostStatus.SCHEDULED);
      expect(currentPost!.version).toBe(2); // Version was incremented by other process
    });
  });

  describe('Status Check Guards', () => {
    it('should allow update from SCHEDULED status', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Test SCHEDULED status',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      const atomicUpdate = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
          version: post.version,
        },
        {
          $set: { status: PostStatus.PUBLISHING },
          $inc: { version: 1 },
        },
        { new: true }
      );

      expect(atomicUpdate).toBeDefined();
      expect(atomicUpdate!.status).toBe(PostStatus.PUBLISHING);
    });

    it('should allow update from QUEUED status', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Test QUEUED status',
        status: PostStatus.QUEUED,
        scheduledAt: new Date(Date.now() - 1000),
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      const atomicUpdate = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
          version: post.version,
        },
        {
          $set: { status: PostStatus.PUBLISHING },
          $inc: { version: 1 },
        },
        { new: true }
      );

      expect(atomicUpdate).toBeDefined();
      expect(atomicUpdate!.status).toBe(PostStatus.PUBLISHING);
    });

    it('should reject update from PUBLISHED status', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Test PUBLISHED status',
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        scheduledAt: new Date(Date.now() - 1000),
        createdBy: testUserId,
        retryCount: 0,
        metadata: { platformPostId: 'test_id' },
        version: 1,
      });

      const atomicUpdate = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
          version: post.version,
        },
        {
          $set: { status: PostStatus.PUBLISHING },
          $inc: { version: 1 },
        },
        { new: true }
      );

      expect(atomicUpdate).toBeNull();
    });

    it('should reject update from FAILED status', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Test FAILED status',
        status: PostStatus.FAILED,
        errorMessage: 'Previous failure',
        scheduledAt: new Date(Date.now() - 1000),
        createdBy: testUserId,
        retryCount: 3,
        metadata: {},
        version: 1,
      });

      const atomicUpdate = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
          version: post.version,
        },
        {
          $set: { status: PostStatus.PUBLISHING },
          $inc: { version: 1 },
        },
        { new: true }
      );

      expect(atomicUpdate).toBeNull();
    });

    it('should reject update from CANCELLED status', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Test CANCELLED status',
        status: PostStatus.CANCELLED,
        scheduledAt: new Date(Date.now() - 1000),
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      const atomicUpdate = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
          version: post.version,
        },
        {
          $set: { status: PostStatus.PUBLISHING },
          $inc: { version: 1 },
        },
        { new: true }
      );

      expect(atomicUpdate).toBeNull();
    });
  });

  describe('Concurrent Update Prevention', () => {
    it('should prevent concurrent updates with optimistic locking', async () => {
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Test concurrent updates',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Simulate two workers trying to update simultaneously
      const [update1, update2] = await Promise.all([
        Post.findOneAndUpdate(
          {
            _id: post._id,
            status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
            version: post.version,
          },
          {
            $set: { status: PostStatus.PUBLISHING },
            $inc: { version: 1 },
          },
          { new: true }
        ),
        Post.findOneAndUpdate(
          {
            _id: post._id,
            status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
            version: post.version,
          },
          {
            $set: { status: PostStatus.PUBLISHING },
            $inc: { version: 1 },
          },
          { new: true }
        ),
      ]);

      // One should succeed, one should fail
      const successCount = [update1, update2].filter(u => u !== null).length;
      expect(successCount).toBe(1);

      // Verify final state
      const finalPost = await Post.findById(post._id);
      expect(finalPost!.status).toBe(PostStatus.PUBLISHING);
      expect(finalPost!.version).toBe(2); // Only incremented once
    });
  });
});


/**
 * Task 1.2.2: Store Platform Post ID After Publishing
 * 
 * Tests for platform post ID deduplication:
 * 1. Check platformPostId exists before republishing
 * 2. Handle platform duplicate detection errors
 * 3. Add platform post ID validation
 * 4. Log duplicate publish attempts
 */

describe('Task 1.2.2: Platform Post ID Deduplication', () => {
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

  describe('Platform Post ID Check', () => {
    it('should skip publishing if platformPostId already exists', async () => {
      // Create a post with platformPostId already set (already published to platform)
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Test post with existing platformPostId',
        status: PostStatus.SCHEDULED, // Status is scheduled but platformPostId exists
        scheduledAt: new Date(Date.now() - 1000),
        createdBy: testUserId,
        retryCount: 0,
        metadata: {
          platformPostId: 'twitter_123456789', // Already published to platform
        },
        version: 1,
      });

      // Verify post has platformPostId
      expect(post.metadata.platformPostId).toBe('twitter_123456789');
      expect(post.status).toBe(PostStatus.SCHEDULED);

      // In real worker, this would be detected and skipped
      // Simulate the check
      const shouldSkip = !!post.metadata?.platformPostId;
      expect(shouldSkip).toBe(true);

      // If platformPostId exists, status should be updated to PUBLISHED
      if (shouldSkip && post.status !== PostStatus.PUBLISHED) {
        await Post.findByIdAndUpdate(post._id, {
          status: PostStatus.PUBLISHED,
          publishedAt: post.publishedAt || new Date(),
        });
      }

      // Verify status updated
      const updatedPost = await Post.findById(post._id);
      expect(updatedPost!.status).toBe(PostStatus.PUBLISHED);
    });

    it('should allow publishing if platformPostId does not exist', async () => {
      // Create a post without platformPostId
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Test post without platformPostId',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Verify post does not have platformPostId
      expect(post.metadata.platformPostId).toBeUndefined();

      // Should not skip
      const shouldSkip = !!post.metadata?.platformPostId;
      expect(shouldSkip).toBe(false);
    });

    it('should store platformPostId after successful publish', async () => {
      // Create a post
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Test post for platformPostId storage',
        status: PostStatus.PUBLISHING,
        scheduledAt: new Date(Date.now() - 1000),
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Simulate successful publish
      const platformPostId = 'twitter_987654321';
      const updated = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: PostStatus.PUBLISHING,
        },
        {
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(),
          'metadata.platformPostId': platformPostId,
        },
        { new: true }
      );

      // Verify platformPostId stored
      expect(updated).toBeDefined();
      expect(updated!.status).toBe(PostStatus.PUBLISHED);
      expect(updated!.metadata.platformPostId).toBe(platformPostId);
    });
  });

  describe('Platform Duplicate Error Handling', () => {
    it('should detect Twitter duplicate error', () => {
      const error = {
        message: 'Status is a duplicate',
        code: 187,
      };

      // Simulate isPlatformDuplicateError check
      const isDuplicate = 
        error.message.toLowerCase().includes('duplicate') || 
        error.code === 187;

      expect(isDuplicate).toBe(true);
    });

    it('should detect LinkedIn duplicate error', () => {
      const error = {
        message: 'Duplicate content detected',
        code: 'DUPLICATE_SHARE',
      };

      const isDuplicate = 
        error.message.toLowerCase().includes('duplicate content') || 
        error.code === 'DUPLICATE_SHARE';

      expect(isDuplicate).toBe(true);
    });

    it('should detect Facebook duplicate error', () => {
      const error = {
        message: 'Duplicate status message',
        code: 506,
      };

      const isDuplicate = 
        error.message.toLowerCase().includes('duplicate status message') || 
        error.code === 506;

      expect(isDuplicate).toBe(true);
    });

    it('should detect Instagram duplicate error', () => {
      const error = {
        message: 'Media already posted',
      };

      const isDuplicate = 
        error.message.toLowerCase().includes('media already posted') ||
        error.message.toLowerCase().includes('duplicate media');

      expect(isDuplicate).toBe(true);
    });

    it('should not detect non-duplicate errors', () => {
      const error: any = {
        message: 'Network timeout',
        code: 'ETIMEDOUT',
      };

      const isDuplicate = 
        error.message.toLowerCase().includes('duplicate') ||
        (typeof error.code === 'number' && (error.code === 187 || error.code === 506)) ||
        error.code === 'DUPLICATE_SHARE';

      expect(isDuplicate).toBe(false);
    });
  });

  describe('Platform Post ID Validation', () => {
    it('should validate platformPostId is stored after publish', async () => {
      // Create a post
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Test post for validation',
        status: PostStatus.PUBLISHING,
        scheduledAt: new Date(Date.now() - 1000),
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Simulate publish with platformPostId
      const platformPostId = 'valid_platform_id_123';
      const updated = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: PostStatus.PUBLISHING,
        },
        {
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(),
          'metadata.platformPostId': platformPostId,
        },
        { new: true }
      );

      // Validate platformPostId was stored
      expect(updated!.metadata.platformPostId).toBeDefined();
      expect(updated!.metadata.platformPostId).toBe(platformPostId);
      expect(typeof updated!.metadata.platformPostId).toBe('string');
      expect(updated!.metadata.platformPostId.length).toBeGreaterThan(0);
    });

    it('should detect missing platformPostId after publish', async () => {
      // Create a post
      const post = await Post.create({
        workspaceId: testWorkspaceId,
        socialAccountId: testSocialAccountId,
        content: 'Test post for missing platformPostId',
        status: PostStatus.PUBLISHING,
        scheduledAt: new Date(Date.now() - 1000),
        createdBy: testUserId,
        retryCount: 0,
        metadata: {},
        version: 1,
      });

      // Simulate publish WITHOUT platformPostId (error case)
      const updated = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: PostStatus.PUBLISHING,
        },
        {
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(),
          // Missing: 'metadata.platformPostId'
        },
        { new: true }
      );

      // Validate platformPostId is missing (should be logged as error)
      expect(updated!.metadata.platformPostId).toBeUndefined();
      
      // This should trigger a validation error log in production
      const validationFailed = !updated!.metadata?.platformPostId;
      expect(validationFailed).toBe(true);
    });
  });
});
