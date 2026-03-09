/**
 * Evergreen Content Integration Test
 * 
 * Tests end-to-end evergreen content reposting including:
 * - Evergreen rule creation with schedule
 * - Eligible content creation
 * - Evergreen scheduler triggering via EvergreenQueue
 * - Content selection based on rule criteria
 * - Post scheduling and queuing
 * 
 * Requirements: 1.3
 */

import mongoose from 'mongoose';
import { EvergreenRule } from '../../../models/EvergreenRule';
import { Post, PostStatus } from '../../../models/Post';
import { EvergreenQueue } from '../../../queue/EvergreenQueue';
import { evergreenWorker } from '../../../workers/EvergreenWorker';
import { evergreenScheduler } from '../../../services/EvergreenScheduler';
import {
  createTestWorkspace,
  createTestUser,
  connectMongoDB,
  connectRedis,
  waitFor,
  wait,
  getBackdatedTimestamp,
} from '../utils/test-helpers';
import {
  cleanupAllTestData,
  drainQueue,
} from '../utils/data-cleanup';

describe('Evergreen Content Integration Test', () => {
  let testWorkspaceId: string;
  let testUserId: string;

  // Set test timeout to 60 seconds
  jest.setTimeout(60000);

  beforeAll(async () => {
    // Connect to MongoDB and Redis
    await connectMongoDB();
    await connectRedis();

    // Start evergreen worker
    evergreenWorker.start();
  });

  afterAll(async () => {
    // Stop evergreen worker
    await evergreenWorker.stop();

    // Close connections
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Create test workspace and user
    testWorkspaceId = await createTestWorkspace();
    testUserId = await createTestUser();
  });

  afterEach(async () => {
    // Clean up test data
    await cleanupAllTestData(testWorkspaceId);
    await drainQueue('evergreen-evaluation');
  });

  describe('End-to-End Evergreen Reposting', () => {
    it('should create evergreen rule, trigger scheduler, and verify content is selected and queued', async () => {
      // Step 1: Create a published post (eligible content)
      const originalPost = new Post({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        socialAccountId: new mongoose.Types.ObjectId(),
        socialAccountIds: [new mongoose.Types.ObjectId()],
        content: 'This is evergreen content that should be reposted periodically #evergreen #test',
        platformContent: [
          {
            platform: 'twitter',
            text: 'This is evergreen content that should be reposted periodically #evergreen #test',
            enabled: true,
          },
        ],
        mediaUrls: [],
        mediaIds: [],
        status: PostStatus.PUBLISHED,
        publishedAt: getBackdatedTimestamp(10), // Published 10 days ago
        retryCount: 0,
        metadata: {
          platformPostId: 'twitter-12345',
          characterCount: 80,
          hashtags: ['evergreen', 'test'],
        },
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await originalPost.save();

      // Verify post was created
      expect(originalPost._id).toBeDefined();
      expect(originalPost.status).toBe(PostStatus.PUBLISHED);
      expect(originalPost.content).toContain('evergreen');

      // Step 2: Create an evergreen rule with schedule
      const evergreenRule = new EvergreenRule({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        postId: originalPost._id,
        repostInterval: 7, // Repost every 7 days
        maxReposts: 5, // Maximum 5 reposts
        repostCount: 0,
        enabled: true,
        contentModification: {
          prefix: '[Repost] ',
          suffix: ' #repost',
        },
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await evergreenRule.save();

      // Verify rule was created
      expect(evergreenRule._id).toBeDefined();
      expect(evergreenRule.enabled).toBe(true);
      expect(evergreenRule.repostInterval).toBe(7);
      expect(evergreenRule.maxReposts).toBe(5);
      expect(evergreenRule.repostCount).toBe(0);
      expect(evergreenRule.lastRepostedAt).toBeUndefined();

      // Step 3: Trigger evergreen scheduler manually
      // The scheduler will evaluate the rule and enqueue it if eligible
      await evergreenScheduler.forcePoll();

      // Wait a bit for scheduler to process
      await wait(1000);

      // Step 4: Verify rule evaluation job was added to queue
      // The job should be in the queue waiting to be processed
      const queue = EvergreenQueue.getQueue();
      const waitingJobs = await queue.getWaiting();
      const activeJobs = await queue.getActive();
      const completedJobs = await queue.getCompleted();

      const totalJobs = waitingJobs.length + activeJobs.length + completedJobs.length;
      expect(totalJobs).toBeGreaterThan(0);

      // Step 5: Wait for worker to process the job
      await waitFor(
        async () => {
          const completed = await queue.getCompletedCount();
          return completed > 0;
        },
        30000, // 30 second timeout
        500 // Check every 500ms
      );

      // Step 6: Verify rule was updated after processing
      const updatedRule = await EvergreenRule.findById(evergreenRule._id);
      expect(updatedRule).toBeDefined();
      expect(updatedRule!.repostCount).toBe(1);
      expect(updatedRule!.lastRepostedAt).toBeDefined();
      expect(updatedRule!.enabled).toBe(true); // Still enabled (not at max reposts)

      // Step 7: Verify a new post was created (the repost)
      const reposts = await Post.find({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        _id: { $ne: originalPost._id }, // Exclude original post
      });

      expect(reposts.length).toBe(1);

      const repost = reposts[0];
      expect(repost.content).toContain('[Repost]'); // Prefix applied
      expect(repost.content).toContain('#repost'); // Suffix applied
      expect(repost.content).toContain('evergreen'); // Original content preserved
      expect(repost.status).toBe(PostStatus.DRAFT); // New post starts as draft
      expect(repost.workspaceId.toString()).toBe(testWorkspaceId);

      // Step 8: Verify content modification was applied correctly
      expect(repost.content).toBe('[Repost] This is evergreen content that should be reposted periodically #evergreen #test #repost');
    });

    it('should respect repost interval and not repost before interval elapses', async () => {
      // Step 1: Create a published post
      const originalPost = new Post({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        socialAccountId: new mongoose.Types.ObjectId(),
        socialAccountIds: [new mongoose.Types.ObjectId()],
        content: 'Test content for interval checking',
        platformContent: [
          {
            platform: 'twitter',
            text: 'Test content for interval checking',
            enabled: true,
          },
        ],
        mediaUrls: [],
        mediaIds: [],
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        retryCount: 0,
        metadata: {},
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await originalPost.save();

      // Step 2: Create evergreen rule with recent lastRepostedAt
      const evergreenRule = new EvergreenRule({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        postId: originalPost._id,
        repostInterval: 30, // Repost every 30 days
        maxReposts: -1, // Unlimited
        repostCount: 1,
        lastRepostedAt: new Date(), // Just reposted now
        enabled: true,
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await evergreenRule.save();

      // Step 3: Trigger scheduler
      await evergreenScheduler.forcePoll();

      // Wait for potential processing
      await wait(2000);

      // Step 4: Verify no new repost was created (interval not elapsed)
      const reposts = await Post.find({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        _id: { $ne: originalPost._id },
      });

      expect(reposts.length).toBe(0);

      // Step 5: Verify rule counters unchanged
      const updatedRule = await EvergreenRule.findById(evergreenRule._id);
      expect(updatedRule).toBeDefined();
      expect(updatedRule!.repostCount).toBe(1); // Still 1, not incremented
    });

    it('should auto-disable rule when max reposts is reached', async () => {
      // Step 1: Create a published post
      const originalPost = new Post({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        socialAccountId: new mongoose.Types.ObjectId(),
        socialAccountIds: [new mongoose.Types.ObjectId()],
        content: 'Content with max reposts limit',
        platformContent: [
          {
            platform: 'twitter',
            text: 'Content with max reposts limit',
            enabled: true,
          },
        ],
        mediaUrls: [],
        mediaIds: [],
        status: PostStatus.PUBLISHED,
        publishedAt: getBackdatedTimestamp(10),
        retryCount: 0,
        metadata: {},
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await originalPost.save();

      // Step 2: Create evergreen rule at max reposts - 1
      const evergreenRule = new EvergreenRule({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        postId: originalPost._id,
        repostInterval: 1, // Repost every 1 day
        maxReposts: 3, // Maximum 3 reposts
        repostCount: 2, // Already reposted 2 times
        lastRepostedAt: getBackdatedTimestamp(2), // Last repost was 2 days ago
        enabled: true,
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await evergreenRule.save();

      // Step 3: Trigger scheduler (should create final repost and disable)
      await evergreenScheduler.forcePoll();

      // Wait for processing
      await waitFor(
        async () => {
          const queue = EvergreenQueue.getQueue();
          const completed = await queue.getCompletedCount();
          return completed > 0;
        },
        30000,
        500
      );

      // Step 4: Verify rule was auto-disabled
      const updatedRule = await EvergreenRule.findById(evergreenRule._id);
      expect(updatedRule).toBeDefined();
      expect(updatedRule!.repostCount).toBe(3); // Incremented to max
      expect(updatedRule!.enabled).toBe(false); // Auto-disabled
      expect(updatedRule!.lastRepostedAt).toBeDefined();

      // Step 5: Verify final repost was created
      const reposts = await Post.find({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        _id: { $ne: originalPost._id },
      });

      expect(reposts.length).toBe(1);
    });

    it('should handle multiple evergreen rules for different posts', async () => {
      // Step 1: Create two published posts
      const post1 = new Post({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        socialAccountId: new mongoose.Types.ObjectId(),
        socialAccountIds: [new mongoose.Types.ObjectId()],
        content: 'First evergreen post',
        platformContent: [
          {
            platform: 'twitter',
            text: 'First evergreen post',
            enabled: true,
          },
        ],
        mediaUrls: [],
        mediaIds: [],
        status: PostStatus.PUBLISHED,
        publishedAt: getBackdatedTimestamp(5),
        retryCount: 0,
        metadata: {},
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      const post2 = new Post({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        socialAccountId: new mongoose.Types.ObjectId(),
        socialAccountIds: [new mongoose.Types.ObjectId()],
        content: 'Second evergreen post',
        platformContent: [
          {
            platform: 'twitter',
            text: 'Second evergreen post',
            enabled: true,
          },
        ],
        mediaUrls: [],
        mediaIds: [],
        status: PostStatus.PUBLISHED,
        publishedAt: getBackdatedTimestamp(5),
        retryCount: 0,
        metadata: {},
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await post1.save();
      await post2.save();

      // Step 2: Create evergreen rules for both posts
      const rule1 = new EvergreenRule({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        postId: post1._id,
        repostInterval: 7,
        maxReposts: 5,
        repostCount: 0,
        enabled: true,
        contentModification: {
          prefix: '[Post1] ',
        },
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      const rule2 = new EvergreenRule({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        postId: post2._id,
        repostInterval: 7,
        maxReposts: 5,
        repostCount: 0,
        enabled: true,
        contentModification: {
          prefix: '[Post2] ',
        },
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await rule1.save();
      await rule2.save();

      // Step 3: Trigger scheduler
      await evergreenScheduler.forcePoll();

      // Wait for processing
      await waitFor(
        async () => {
          const queue = EvergreenQueue.getQueue();
          const completed = await queue.getCompletedCount();
          return completed >= 2; // Both jobs completed
        },
        30000,
        500
      );

      // Step 4: Verify both rules were processed
      const updatedRule1 = await EvergreenRule.findById(rule1._id);
      const updatedRule2 = await EvergreenRule.findById(rule2._id);

      expect(updatedRule1!.repostCount).toBe(1);
      expect(updatedRule2!.repostCount).toBe(1);

      // Step 5: Verify two reposts were created
      const reposts = await Post.find({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        _id: { $nin: [post1._id, post2._id] },
      });

      expect(reposts.length).toBe(2);

      // Verify correct prefixes
      const repost1 = reposts.find(r => r.content.includes('[Post1]'));
      const repost2 = reposts.find(r => r.content.includes('[Post2]'));

      expect(repost1).toBeDefined();
      expect(repost2).toBeDefined();
      expect(repost1!.content).toContain('First evergreen post');
      expect(repost2!.content).toContain('Second evergreen post');
    });

    it('should skip disabled evergreen rules', async () => {
      // Step 1: Create a published post
      const originalPost = new Post({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        socialAccountId: new mongoose.Types.ObjectId(),
        socialAccountIds: [new mongoose.Types.ObjectId()],
        content: 'Content with disabled rule',
        platformContent: [
          {
            platform: 'twitter',
            text: 'Content with disabled rule',
            enabled: true,
          },
        ],
        mediaUrls: [],
        mediaIds: [],
        status: PostStatus.PUBLISHED,
        publishedAt: getBackdatedTimestamp(10),
        retryCount: 0,
        metadata: {},
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await originalPost.save();

      // Step 2: Create disabled evergreen rule
      const evergreenRule = new EvergreenRule({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        postId: originalPost._id,
        repostInterval: 7,
        maxReposts: 5,
        repostCount: 0,
        enabled: false, // Disabled
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await evergreenRule.save();

      // Step 3: Trigger scheduler
      await evergreenScheduler.forcePoll();

      // Wait for potential processing
      await wait(2000);

      // Step 4: Verify no repost was created
      const reposts = await Post.find({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        _id: { $ne: originalPost._id },
      });

      expect(reposts.length).toBe(0);

      // Step 5: Verify rule counters unchanged
      const updatedRule = await EvergreenRule.findById(evergreenRule._id);
      expect(updatedRule!.repostCount).toBe(0);
      expect(updatedRule!.lastRepostedAt).toBeUndefined();
    });
  });
});
