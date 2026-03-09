/**
 * RSS Feed Integration Test
 * 
 * Tests end-to-end RSS feed ingestion including:
 * - RSS feed creation
 * - RSS polling via RSSQueue
 * - Item collection and deduplication
 * - RSSFeedItem document creation
 * - Workflow event dispatching for new items
 * 
 * Requirements: 1.2
 */

import mongoose from 'mongoose';
import { RSSFeed } from '../../../models/RSSFeed';
import { RSSFeedItem } from '../../../models/RSSFeedItem';
import { Workflow, WorkflowTriggerType, WorkflowActionType } from '../../../models/Workflow';
import { WorkflowRun, WorkflowRunStatus } from '../../../models/WorkflowRun';
import { RSSQueue } from '../../../queue/RSSQueue';
import { rssCollectorWorker } from '../../../workers/RSSCollectorWorker';
import { workflowExecutorWorker } from '../../../workers/WorkflowExecutorWorker';
import {
  createTestWorkspace,
  createTestUser,
  connectMongoDB,
  connectRedis,
  waitFor,
  wait,
} from '../utils/test-helpers';
import {
  cleanupAllTestData,
  drainQueue,
} from '../utils/data-cleanup';

describe('RSS Feed Integration Test', () => {
  let testWorkspaceId: string;
  let testUserId: string;

  // Set test timeout to 60 seconds
  jest.setTimeout(60000);

  beforeAll(async () => {
    // Connect to MongoDB and Redis
    await connectMongoDB();
    await connectRedis();

    // Start RSS collector worker and workflow executor worker
    rssCollectorWorker.start();
    workflowExecutorWorker.start();
  });

  afterAll(async () => {
    // Stop workers
    await rssCollectorWorker.stop();
    await workflowExecutorWorker.stop();

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
    await drainQueue('rss-collection');
    await drainQueue('workflow-execution');
  });

  describe('End-to-End RSS Feed Ingestion', () => {
    it('should create RSS feed, poll it, collect items, and verify deduplication', async () => {
      // Step 1: Create an RSS feed with a test URL
      // Using a real RSS feed URL for testing (NASA RSS feed is reliable and public)
      const testFeedUrl = 'https://www.nasa.gov/rss/dyn/breaking_news.rss';

      const rssFeed = new RSSFeed({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        name: 'Test NASA RSS Feed',
        feedUrl: testFeedUrl,
        pollingInterval: 60, // 60 minutes
        enabled: true,
        failureCount: 0,
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await rssFeed.save();

      // Verify feed was created
      expect(rssFeed._id).toBeDefined();
      expect(rssFeed.feedUrl).toBe(testFeedUrl);
      expect(rssFeed.enabled).toBe(true);
      expect(rssFeed.lastFetchedAt).toBeUndefined();

      // Step 2: Trigger RSS polling via RSSQueue
      await RSSQueue.addFeedPoll({
        feedId: rssFeed._id.toString(),
        workspaceId: testWorkspaceId,
        feedUrl: testFeedUrl,
      });

      // Step 3: Wait for RSS collection to complete
      // Wait for lastFetchedAt to be updated (indicates polling completed)
      await waitFor(
        async () => {
          const updatedFeed = await RSSFeed.findById(rssFeed._id);
          return updatedFeed?.lastFetchedAt !== undefined;
        },
        30000,
        1000
      );

      // Step 4: Verify RSSFeedItem documents are created
      const feedItems = await RSSFeedItem.find({
        feedId: rssFeed._id,
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
      });

      expect(feedItems.length).toBeGreaterThan(0);

      // Verify item structure
      const firstItem = feedItems[0];
      expect(firstItem.guid).toBeDefined();
      expect(firstItem.title).toBeDefined();
      expect(firstItem.link).toBeDefined();
      expect(firstItem.feedId.toString()).toBe(rssFeed._id.toString());
      expect(firstItem.workspaceId.toString()).toBe(testWorkspaceId);

      // Step 5: Verify deduplication - poll the same feed again
      const initialItemCount = feedItems.length;

      // Trigger second poll
      await RSSQueue.addFeedPoll({
        feedId: rssFeed._id.toString(),
        workspaceId: testWorkspaceId,
        feedUrl: testFeedUrl,
      });

      // Wait for second poll to complete
      await wait(5000);

      // Verify item count hasn't increased (deduplication working)
      const feedItemsAfterSecondPoll = await RSSFeedItem.find({
        feedId: rssFeed._id,
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
      });

      // Item count should be the same or very similar
      expect(feedItemsAfterSecondPoll.length).toBeLessThanOrEqual(initialItemCount + 2);

      // Step 6: Verify feed status was updated
      const updatedFeed = await RSSFeed.findById(rssFeed._id);
      expect(updatedFeed).toBeDefined();
      expect(updatedFeed!.lastFetchedAt).toBeDefined();
      expect(updatedFeed!.failureCount).toBe(0);
      expect(updatedFeed!.lastError).toBeNull();
    });

    it('should dispatch workflow events for new RSS items', async () => {
      // Step 1: Create a workflow triggered by RSS item fetched events
      const workflow = new Workflow({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        name: 'Test RSS Workflow',
        description: 'Workflow triggered by RSS item fetched events',
        enabled: true,
        trigger: {
          type: WorkflowTriggerType.RSS_ITEM_FETCHED,
          config: {
            // No feedId filter - trigger for all feeds
          },
        },
        actions: [
          {
            type: WorkflowActionType.SEND_NOTIFICATION,
            config: {
              type: 'info',
              message: 'New RSS item fetched',
              recipient: 'test@example.com',
            },
          },
        ],
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await workflow.save();

      // Step 2: Create an RSS feed
      const testFeedUrl = 'https://www.nasa.gov/rss/dyn/breaking_news.rss';

      const rssFeed = new RSSFeed({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        name: 'Test NASA RSS Feed for Workflow',
        feedUrl: testFeedUrl,
        pollingInterval: 60,
        enabled: true,
        failureCount: 0,
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await rssFeed.save();

      // Step 3: Trigger RSS polling
      await RSSQueue.addFeedPoll({
        feedId: rssFeed._id.toString(),
        workspaceId: testWorkspaceId,
        feedUrl: testFeedUrl,
      });

      // Step 4: Wait for RSS collection to complete
      await waitFor(
        async () => {
          const updatedFeed = await RSSFeed.findById(rssFeed._id);
          return updatedFeed?.lastFetchedAt !== undefined;
        },
        30000,
        1000
      );

      // Step 5: Verify RSSFeedItem documents were created
      const feedItems = await RSSFeedItem.find({
        feedId: rssFeed._id,
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
      });

      expect(feedItems.length).toBeGreaterThan(0);

      // Step 6: Wait for workflow events to be dispatched and processed
      // Each new RSS item should trigger a workflow execution
      await waitFor(
        async () => {
          const workflowRuns = await WorkflowRun.find({
            workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
            workflowId: workflow._id,
          });
          return workflowRuns.length > 0;
        },
        30000, // 30 second timeout
        1000 // Check every 1 second
      );

      // Step 7: Verify workflow runs were created
      const workflowRuns = await WorkflowRun.find({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        workflowId: workflow._id,
      });

      expect(workflowRuns.length).toBeGreaterThan(0);

      // Verify workflow run structure
      const firstRun = workflowRuns[0];
      expect(firstRun.triggerType).toBe(WorkflowTriggerType.RSS_ITEM_FETCHED);
      expect(firstRun.triggerData).toBeDefined();
      expect(firstRun.triggerData.feedId).toBe(rssFeed._id.toString());
      expect(firstRun.triggerData.itemId).toBeDefined();
      expect(firstRun.triggerData.title).toBeDefined();
      expect(firstRun.triggerData.link).toBeDefined();

      // Step 8: Wait for at least one workflow to complete
      await waitFor(
        async () => {
          const completedRuns = await WorkflowRun.find({
            workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
            workflowId: workflow._id,
            status: WorkflowRunStatus.COMPLETED,
          });
          return completedRuns.length > 0;
        },
        30000,
        1000
      );

      // Verify at least one workflow completed successfully
      const completedRuns = await WorkflowRun.find({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        workflowId: workflow._id,
        status: WorkflowRunStatus.COMPLETED,
      });

      expect(completedRuns.length).toBeGreaterThan(0);
    });

    it('should handle RSS feed with specific feed ID filter in workflow', async () => {
      // Step 1: Create two RSS feeds
      const testFeedUrl1 = 'https://www.nasa.gov/rss/dyn/breaking_news.rss';
      const testFeedUrl2 = 'https://www.nasa.gov/rss/dyn/lg_image_of_the_day.rss';

      const rssFeed1 = new RSSFeed({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        name: 'Test Feed 1',
        feedUrl: testFeedUrl1,
        pollingInterval: 60,
        enabled: true,
        failureCount: 0,
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      const rssFeed2 = new RSSFeed({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        name: 'Test Feed 2',
        feedUrl: testFeedUrl2,
        pollingInterval: 60,
        enabled: true,
        failureCount: 0,
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await rssFeed1.save();
      await rssFeed2.save();

      // Step 2: Create a workflow that only triggers for feed 1
      const workflow = new Workflow({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        name: 'Test RSS Workflow - Feed 1 Only',
        description: 'Workflow triggered only by feed 1',
        enabled: true,
        trigger: {
          type: WorkflowTriggerType.RSS_ITEM_FETCHED,
          config: {
            feedId: rssFeed1._id.toString(), // Filter for feed 1 only
          },
        },
        actions: [
          {
            type: WorkflowActionType.SEND_NOTIFICATION,
            config: {
              type: 'info',
              message: 'New RSS item from Feed 1',
              recipient: 'test@example.com',
            },
          },
        ],
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await workflow.save();

      // Step 3: Poll feed 1
      await RSSQueue.addFeedPoll({
        feedId: rssFeed1._id.toString(),
        workspaceId: testWorkspaceId,
        feedUrl: testFeedUrl1,
      });

      // Wait for feed 1 collection
      await waitFor(
        async () => {
          const updatedFeed = await RSSFeed.findById(rssFeed1._id);
          return updatedFeed?.lastFetchedAt !== undefined;
        },
        30000,
        1000
      );

      // Step 4: Poll feed 2
      await RSSQueue.addFeedPoll({
        feedId: rssFeed2._id.toString(),
        workspaceId: testWorkspaceId,
        feedUrl: testFeedUrl2,
      });

      // Wait for feed 2 collection
      await waitFor(
        async () => {
          const updatedFeed = await RSSFeed.findById(rssFeed2._id);
          return updatedFeed?.lastFetchedAt !== undefined;
        },
        30000,
        1000
      );

      // Step 5: Wait for workflow runs
      await wait(5000); // Wait 5 seconds for workflow processing

      // Step 6: Verify only feed 1 items triggered workflows
      const workflowRuns = await WorkflowRun.find({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        workflowId: workflow._id,
      });

      // Should have workflow runs for feed 1 items
      expect(workflowRuns.length).toBeGreaterThan(0);

      // All workflow runs should be for feed 1
      workflowRuns.forEach(run => {
        expect(run.triggerData.feedId).toBe(rssFeed1._id.toString());
      });

      // Verify feed 2 items exist but didn't trigger workflows
      const feed2Items = await RSSFeedItem.find({
        feedId: rssFeed2._id,
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
      });

      expect(feed2Items.length).toBeGreaterThan(0);
    });
  });
});
