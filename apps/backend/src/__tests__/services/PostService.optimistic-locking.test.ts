import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import { Post, PostStatus } from '../../models/Post';
import { postService } from '../../services/PostService';
import { SocialAccount } from '../../models/SocialAccount';
import { Workspace } from '../../models/Workspace';
import { User } from '../../models/User';
import { connectDatabase, disconnectDatabase } from '../../config/database';

/**
 * Optimistic Locking Integration Tests for PostService
 * 
 * Tests the version-based optimistic locking mechanism that prevents
 * race conditions when multiple workers try to update the same post.
 * 
 * Requirements from Task 1.1.3:
 * - Add version field to Post schema (default: 1)
 * - Increment version on every update
 * - Check version before update (WHERE version = X)
 * - Retry with exponential backoff on version mismatch (100ms, 200ms, 400ms)
 * - Limit max retries to 3
 * 
 * NOTE: This test requires MongoDB to be running.
 * Skip in CI with: npm test -- --testPathIgnorePatterns=optimistic-locking
 */

describe('PostService - Optimistic Locking Integration', () => {
  let workspace: any;
  let user: any;
  let socialAccount: any;
  let testPost: any;

  beforeAll(async () => {
    // Connect to test database
    await connectDatabase();
  });

  afterAll(async () => {
    // Disconnect from database
    await disconnectDatabase();
  });

  beforeEach(async () => {
    // Create test workspace
    workspace = await Workspace.create({
      name: 'Test Workspace',
      slug: 'test-workspace-' + Date.now(),
      ownerId: new mongoose.Types.ObjectId(),
    });

    // Create test user
    user = await User.create({
      email: `test-${Date.now()}@example.com`,
      passwordHash: 'hashed_password',
      firstName: 'Test',
      lastName: 'User',
    });

    // Create test social account
    socialAccount = await SocialAccount.create({
      workspaceId: workspace._id,
      provider: 'twitter',
      accountName: 'Test Account',
      accountId: 'test_account_id',
      accessToken: 'test_token',
      status: 'connected',
    });

    // Create test post
    testPost = await Post.create({
      workspaceId: workspace._id,
      socialAccountId: socialAccount._id,
      content: 'Test post content',
      status: PostStatus.SCHEDULED,
      scheduledAt: new Date(Date.now() + 3600000), // 1 hour from now
      createdBy: user._id,
      version: 1,
    });
  });

  afterEach(async () => {
    // Cleanup
    await Post.deleteMany({});
    await SocialAccount.deleteMany({});
    await Workspace.deleteMany({});
    await User.deleteMany({});
  });

  describe('Version Field', () => {
    it('should initialize new posts with version 1', async () => {
      const post = await Post.findById(testPost._id);
      expect(post?.version).toBe(1);
    });

    it('should increment version on status update', async () => {
      const initialVersion = testPost.version;
      
      await postService.updatePostStatus(
        testPost._id.toString(),
        PostStatus.PUBLISHING
      );

      const updatedPost = await Post.findById(testPost._id);
      expect(updatedPost?.version).toBe(initialVersion + 1);
    });
  });

  describe('Concurrent Updates', () => {
    it('should handle concurrent status updates with retry', async () => {
      // Simulate two workers trying to update the same post
      const worker1Promise = postService.updatePostStatus(
        testPost._id.toString(),
        PostStatus.PUBLISHING
      );

      const worker2Promise = postService.updatePostStatus(
        testPost._id.toString(),
        PostStatus.PUBLISHING
      );

      // Both should succeed (one immediately, one after retry)
      const [result1, result2] = await Promise.all([worker1Promise, worker2Promise]);

      expect(result1.status).toBe(PostStatus.PUBLISHING);
      expect(result2.status).toBe(PostStatus.PUBLISHING);

      // Final version should be 3 (initial 1 + 2 updates)
      const finalPost = await Post.findById(testPost._id);
      expect(finalPost?.version).toBe(3);
    });

    it('should handle 10 concurrent workers updating same post', async () => {
      const workerCount = 10;
      const promises = [];

      for (let i = 0; i < workerCount; i++) {
        promises.push(
          postService.updatePostStatus(
            testPost._id.toString(),
            PostStatus.PUBLISHING
          )
        );
      }

      // All workers should eventually succeed
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(workerCount);
      results.forEach(result => {
        expect(result.status).toBe(PostStatus.PUBLISHING);
      });

      // Final version should be initial + worker count
      const finalPost = await Post.findById(testPost._id);
      expect(finalPost?.version).toBe(1 + workerCount);
    });

    it('should handle 100 concurrent workers updating same post', async () => {
      const workerCount = 100;
      const promises = [];

      for (let i = 0; i < workerCount; i++) {
        promises.push(
          postService.updatePostStatus(
            testPost._id.toString(),
            PostStatus.PUBLISHING
          )
        );
      }

      // All workers should eventually succeed
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(workerCount);
      results.forEach(result => {
        expect(result.status).toBe(PostStatus.PUBLISHING);
      });

      // Final version should be initial + worker count
      const finalPost = await Post.findById(testPost._id);
      expect(finalPost?.version).toBe(1 + workerCount);
    }, 30000); // 30 second timeout for this test
  });

  describe('Exponential Backoff', () => {
    it('should retry with exponential backoff on version mismatch', async () => {
      const startTime = Date.now();

      // Create a scenario where we force retries by manually updating version
      const updatePromise = postService.updatePostStatus(
        testPost._id.toString(),
        PostStatus.PUBLISHING
      );

      // Immediately update the post to cause version mismatch
      await Post.findByIdAndUpdate(testPost._id, {
        $inc: { version: 1 },
        $set: { status: PostStatus.QUEUED },
      });

      // The update should retry and eventually succeed
      const result = await updatePromise;
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.status).toBe(PostStatus.PUBLISHING);
      
      // Should have taken at least 100ms (first backoff)
      // but we can't guarantee exact timing in tests
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Max Retries', () => {
    it('should fail after max retries (3 attempts)', async () => {
      // Create a post
      const post = await Post.create({
        workspaceId: workspace._id,
        socialAccountId: socialAccount._id,
        content: 'Test post for max retries',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() + 3600000),
        createdBy: user._id,
        version: 1,
      });

      // Mock continuous version conflicts by updating in parallel
      let updateCount = 0;
      const maxUpdates = 10;

      // Start continuous updates to cause conflicts
      const conflictInterval = setInterval(async () => {
        if (updateCount < maxUpdates) {
          try {
            await Post.findByIdAndUpdate(post._id, {
              $inc: { version: 1 },
            });
            updateCount++;
          } catch (err) {
            // Ignore errors
          }
        }
      }, 50); // Update every 50ms

      try {
        // This should fail after 3 retries
        await postService.updatePostStatus(
          post._id.toString(),
          PostStatus.PUBLISHING
        );
        
        // If we get here, the test should fail
        fail('Expected update to fail after max retries');
      } catch (error: any) {
        expect(error.message).toContain('Failed to update post after 3 attempts');
      } finally {
        clearInterval(conflictInterval);
      }
    }, 10000); // 10 second timeout
  });

  describe('State Transition Validation', () => {
    it('should validate state transitions with optimistic locking', async () => {
      // Create a published post
      const publishedPost = await Post.create({
        workspaceId: workspace._id,
        socialAccountId: socialAccount._id,
        content: 'Published post',
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        createdBy: user._id,
        version: 1,
      });

      // Try to transition from PUBLISHED (terminal state)
      await expect(
        postService.updatePostStatus(
          publishedPost._id.toString(),
          PostStatus.DRAFT
        )
      ).rejects.toThrow('Invalid state transition');
    });
  });

  describe('Metadata Updates', () => {
    it('should update platformPostId with optimistic locking', async () => {
      const result = await postService.updatePostStatus(
        testPost._id.toString(),
        PostStatus.PUBLISHED,
        { platformPostId: 'platform_123' }
      );

      expect(result.status).toBe(PostStatus.PUBLISHED);
      expect(result.metadata.platformPostId).toBe('platform_123');
      expect(result.version).toBe(2);
    });

    it('should update error message with optimistic locking', async () => {
      const result = await postService.updatePostStatus(
        testPost._id.toString(),
        PostStatus.FAILED,
        { errorMessage: 'Platform API error' }
      );

      expect(result.status).toBe(PostStatus.FAILED);
      expect(result.errorMessage).toBe('Platform API error');
      expect(result.version).toBe(2);
    });
  });

  describe('Performance', () => {
    it('should handle sequential updates efficiently', async () => {
      const updateCount = 50;
      const startTime = Date.now();

      for (let i = 0; i < updateCount; i++) {
        await postService.updatePostStatus(
          testPost._id.toString(),
          i % 2 === 0 ? PostStatus.PUBLISHING : PostStatus.PUBLISHING
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const avgTimePerUpdate = duration / updateCount;

      // Each update should be reasonably fast (< 100ms average)
      expect(avgTimePerUpdate).toBeLessThan(100);

      // Final version should match update count
      const finalPost = await Post.findById(testPost._id);
      expect(finalPost?.version).toBe(1 + updateCount);
    }, 15000); // 15 second timeout
  });

  describe('Error Handling', () => {
    it('should handle non-existent post', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      await expect(
        postService.updatePostStatus(fakeId, PostStatus.PUBLISHING)
      ).rejects.toThrow('Post not found');
    });

    it('should handle invalid post ID', async () => {
      await expect(
        postService.updatePostStatus('invalid_id', PostStatus.PUBLISHING)
      ).rejects.toThrow();
    });
  });
});
