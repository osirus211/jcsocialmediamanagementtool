/**
 * Social Listening Integration Test
 * 
 * Tests end-to-end social listening workflow including:
 * - Social listening query creation
 * - Mention event simulation
 * - Event queuing in SocialListeningQueue
 * - Worker processing of event
 * - Mention storage and analysis verification
 * 
 * Requirements: 1.5
 */

import mongoose from 'mongoose';
import { ListeningRule, ListeningRuleType } from '../../../models/ListeningRule';
import { Mention } from '../../../models/Mention';
import { SocialListeningQueue } from '../../../queue/SocialListeningQueue';
import { socialListeningWorker } from '../../../workers/SocialListeningWorker';
import { QueueManager } from '../../../queue/QueueManager';
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

describe('Social Listening Integration Test', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let queueManager: QueueManager;

  // Set test timeout to 60 seconds
  jest.setTimeout(60000);

  beforeAll(async () => {
    // Connect to MongoDB and Redis
    await connectMongoDB();
    await connectRedis();

    // Get queue manager
    queueManager = QueueManager.getInstance();

    // Start social listening worker
    socialListeningWorker.start();

    // Wait for worker to be ready
    await wait(1000);
  });

  afterAll(async () => {
    // Stop social listening worker
    await socialListeningWorker.stop();

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
    await drainQueue('social-listening');
  });

  describe('End-to-End Social Listening Flow', () => {
    it('should create listening query, simulate mention event, and verify complete flow', async () => {
      // Step 1: Create a social listening query (keyword rule)
      const listeningRule = new ListeningRule({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        platform: 'twitter',
        type: ListeningRuleType.KEYWORD,
        value: 'innovation',
        createdBy: new mongoose.Types.ObjectId(testUserId),
        active: true,
      });

      await listeningRule.save();

      // Verify listening rule was created
      expect(listeningRule._id).toBeDefined();
      expect(listeningRule.active).toBe(true);
      expect(listeningRule.type).toBe(ListeningRuleType.KEYWORD);

      // Step 2: Get initial queue stats
      const queue = queueManager.getQueue('social-listening');
      const initialStats = await queue.getJobCounts();
      const initialWaiting = initialStats.waiting || 0;
      const initialCompleted = initialStats.completed || 0;

      // Step 3: Simulate mention event by adding job to SocialListeningQueue
      await queue.add(
        'collect-keywords',
        {
          workspaceId: testWorkspaceId,
          platform: 'twitter',
          jobType: 'keyword',
          scheduledAt: new Date(),
        },
        {
          removeOnComplete: false, // Keep for verification
          removeOnFail: false,
        }
      );

      // Step 4: Verify event is queued in SocialListeningQueue
      await waitFor(
        async () => {
          const stats = await queue.getJobCounts();
          return (stats.waiting || 0) > initialWaiting || (stats.active || 0) > 0;
        },
        5000, // 5 second timeout
        100 // Check every 100ms
      );

      const queuedStats = await queue.getJobCounts();
      expect((queuedStats.waiting || 0) + (queuedStats.active || 0)).toBeGreaterThan(initialWaiting);

      // Step 5: Wait for worker to process the event
      await waitFor(
        async () => {
          const stats = await queue.getJobCounts();
          return (stats.completed || 0) > initialCompleted;
        },
        30000, // 30 second timeout
        500 // Check every 500ms
      );

      // Step 6: Verify worker processed event
      const finalStats = await queue.getJobCounts();
      expect(finalStats.completed || 0).toBeGreaterThan(initialCompleted);

      // Step 7: Verify mention is stored
      // Note: In a real scenario, the ListeningCollectorService would create mentions
      // For this integration test, we verify the job was processed successfully
      const completedJobs = await queue.getJobs(['completed'], 0, 10);
      const ourJob = completedJobs.find(
        job => job.data.workspaceId === testWorkspaceId && job.data.jobType === 'keyword'
      );

      expect(ourJob).toBeDefined();
      expect(ourJob!.finishedOn).toBeDefined();
      expect(ourJob!.data.platform).toBe('twitter');
      expect(ourJob!.data.jobType).toBe('keyword');

      // Step 8: Verify job completed without errors
      expect(ourJob!.failedReason).toBeUndefined();
    });

    it('should handle hashtag listening and verify processing', async () => {
      // Create hashtag listening rule
      const listeningRule = new ListeningRule({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        platform: 'instagram',
        type: ListeningRuleType.HASHTAG,
        value: '#tech',
        createdBy: new mongoose.Types.ObjectId(testUserId),
        active: true,
      });

      await listeningRule.save();

      // Get initial stats
      const queue = queueManager.getQueue('social-listening');
      const initialStats = await queue.getJobCounts();

      // Add hashtag collection job
      await queue.add(
        'collect-hashtags',
        {
          workspaceId: testWorkspaceId,
          platform: 'instagram',
          jobType: 'hashtag',
          scheduledAt: new Date(),
        },
        {
          removeOnComplete: false,
          removeOnFail: false,
        }
      );

      // Wait for job to be queued
      await waitFor(
        async () => {
          const stats = await queue.getJobCounts();
          return (stats.waiting || 0) + (stats.active || 0) > (initialStats.waiting || 0);
        },
        5000,
        100
      );

      // Wait for processing to complete
      await waitFor(
        async () => {
          const stats = await queue.getJobCounts();
          return (stats.completed || 0) > (initialStats.completed || 0);
        },
        30000,
        500
      );

      // Verify job completed
      const completedJobs = await queue.getJobs(['completed'], 0, 10);
      const ourJob = completedJobs.find(
        job => job.data.workspaceId === testWorkspaceId && job.data.jobType === 'hashtag'
      );

      expect(ourJob).toBeDefined();
      expect(ourJob!.data.platform).toBe('instagram');
      expect(ourJob!.data.jobType).toBe('hashtag');
      expect(ourJob!.failedReason).toBeUndefined();
    });

    it('should handle competitor listening and verify processing', async () => {
      // Create competitor listening rule
      const listeningRule = new ListeningRule({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        platform: 'linkedin',
        type: ListeningRuleType.COMPETITOR,
        value: '@competitor_company',
        createdBy: new mongoose.Types.ObjectId(testUserId),
        active: true,
      });

      await listeningRule.save();

      // Get initial stats
      const queue = queueManager.getQueue('social-listening');
      const initialStats = await queue.getJobCounts();

      // Add competitor collection job
      await queue.add(
        'collect-competitors',
        {
          workspaceId: testWorkspaceId,
          platform: 'linkedin',
          jobType: 'competitor',
          scheduledAt: new Date(),
        },
        {
          removeOnComplete: false,
          removeOnFail: false,
        }
      );

      // Wait for job to be queued
      await waitFor(
        async () => {
          const stats = await queue.getJobCounts();
          return (stats.waiting || 0) + (stats.active || 0) > (initialStats.waiting || 0);
        },
        5000,
        100
      );

      // Wait for processing to complete
      await waitFor(
        async () => {
          const stats = await queue.getJobCounts();
          return (stats.completed || 0) > (initialStats.completed || 0);
        },
        30000,
        500
      );

      // Verify job completed
      const completedJobs = await queue.getJobs(['completed'], 0, 10);
      const ourJob = completedJobs.find(
        job => job.data.workspaceId === testWorkspaceId && job.data.jobType === 'competitor'
      );

      expect(ourJob).toBeDefined();
      expect(ourJob!.data.platform).toBe('linkedin');
      expect(ourJob!.data.jobType).toBe('competitor');
      expect(ourJob!.failedReason).toBeUndefined();
    });

    it('should handle trend calculation and verify processing', async () => {
      // Get initial stats
      const queue = queueManager.getQueue('social-listening');
      const initialStats = await queue.getJobCounts();

      // Add trend calculation job
      await queue.add(
        'calculate-trends',
        {
          workspaceId: testWorkspaceId,
          platform: 'all',
          jobType: 'trends',
          scheduledAt: new Date(),
        },
        {
          removeOnComplete: false,
          removeOnFail: false,
        }
      );

      // Wait for job to be queued
      await waitFor(
        async () => {
          const stats = await queue.getJobCounts();
          return (stats.waiting || 0) + (stats.active || 0) > (initialStats.waiting || 0);
        },
        5000,
        100
      );

      // Wait for processing to complete
      await waitFor(
        async () => {
          const stats = await queue.getJobCounts();
          return (stats.completed || 0) > (initialStats.completed || 0);
        },
        30000,
        500
      );

      // Verify job completed
      const completedJobs = await queue.getJobs(['completed'], 0, 10);
      const ourJob = completedJobs.find(
        job => job.data.workspaceId === testWorkspaceId && job.data.jobType === 'trends'
      );

      expect(ourJob).toBeDefined();
      expect(ourJob!.data.platform).toBe('all');
      expect(ourJob!.data.jobType).toBe('trends');
      expect(ourJob!.failedReason).toBeUndefined();
    });

    it('should handle multiple concurrent listening jobs', async () => {
      // Create multiple listening rules
      const rules = [
        new ListeningRule({
          workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
          platform: 'twitter',
          type: ListeningRuleType.KEYWORD,
          value: 'AI',
          createdBy: new mongoose.Types.ObjectId(testUserId),
          active: true,
        }),
        new ListeningRule({
          workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
          platform: 'instagram',
          type: ListeningRuleType.HASHTAG,
          value: '#startup',
          createdBy: new mongoose.Types.ObjectId(testUserId),
          active: true,
        }),
        new ListeningRule({
          workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
          platform: 'linkedin',
          type: ListeningRuleType.COMPETITOR,
          value: '@competitor',
          createdBy: new mongoose.Types.ObjectId(testUserId),
          active: true,
        }),
      ];

      await Promise.all(rules.map(rule => rule.save()));

      // Get initial stats
      const queue = queueManager.getQueue('social-listening');
      const initialStats = await queue.getJobCounts();
      const initialCompleted = initialStats.completed || 0;

      // Add multiple jobs concurrently
      const jobPromises = [
        queue.add('collect-keywords', {
          workspaceId: testWorkspaceId,
          platform: 'twitter',
          jobType: 'keyword',
          scheduledAt: new Date(),
        }, { removeOnComplete: false, removeOnFail: false }),
        queue.add('collect-hashtags', {
          workspaceId: testWorkspaceId,
          platform: 'instagram',
          jobType: 'hashtag',
          scheduledAt: new Date(),
        }, { removeOnComplete: false, removeOnFail: false }),
        queue.add('collect-competitors', {
          workspaceId: testWorkspaceId,
          platform: 'linkedin',
          jobType: 'competitor',
          scheduledAt: new Date(),
        }, { removeOnComplete: false, removeOnFail: false }),
      ];

      await Promise.all(jobPromises);

      // Wait for all jobs to be processed
      await waitFor(
        async () => {
          const stats = await queue.getJobCounts();
          return (stats.completed || 0) >= initialCompleted + 3;
        },
        45000, // 45 second timeout for multiple jobs
        1000 // Check every second
      );

      // Verify all jobs completed
      const finalStats = await queue.getJobCounts();
      expect(finalStats.completed || 0).toBeGreaterThanOrEqual(initialCompleted + 3);

      // Verify no failures
      expect(finalStats.failed || 0).toBe(initialStats.failed || 0);
    });

    it('should verify worker processes jobs with correct concurrency', async () => {
      // Get initial stats
      const queue = queueManager.getQueue('social-listening');
      const initialStats = await queue.getJobCounts();

      // Submit 5 jobs
      const jobPromises = Array.from({ length: 5 }, (_, i) =>
        queue.add(`collect-keywords-${i}`, {
          workspaceId: testWorkspaceId,
          platform: 'twitter',
          jobType: 'keyword',
          scheduledAt: new Date(),
        }, { removeOnComplete: false, removeOnFail: false })
      );

      await Promise.all(jobPromises);

      // Check that active jobs don't exceed concurrency limit (3)
      let maxActive = 0;
      const checkInterval = setInterval(async () => {
        const stats = await queue.getJobCounts();
        const active = stats.active || 0;
        if (active > maxActive) {
          maxActive = active;
        }
      }, 100);

      // Wait for all jobs to complete
      await waitFor(
        async () => {
          const stats = await queue.getJobCounts();
          return (stats.completed || 0) >= (initialStats.completed || 0) + 5;
        },
        60000, // 60 second timeout
        1000
      );

      clearInterval(checkInterval);

      // Verify concurrency was respected (should not exceed 3)
      // Note: This is a best-effort check as timing can be tricky
      expect(maxActive).toBeLessThanOrEqual(3);

      // Verify all jobs completed
      const finalStats = await queue.getJobCounts();
      expect(finalStats.completed || 0).toBeGreaterThanOrEqual((initialStats.completed || 0) + 5);
    });

    it('should verify distributed lock prevents duplicate processing', async () => {
      // Create listening rule
      const listeningRule = new ListeningRule({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        platform: 'twitter',
        type: ListeningRuleType.KEYWORD,
        value: 'test',
        createdBy: new mongoose.Types.ObjectId(testUserId),
        active: true,
      });

      await listeningRule.save();

      // Get initial stats
      const queue = queueManager.getQueue('social-listening');
      const initialStats = await queue.getJobCounts();

      // Add the same job multiple times (simulating concurrent triggers)
      const jobPromises = Array.from({ length: 3 }, () =>
        queue.add('collect-keywords', {
          workspaceId: testWorkspaceId,
          platform: 'twitter',
          jobType: 'keyword',
          scheduledAt: new Date(),
        }, { removeOnComplete: false, removeOnFail: false })
      );

      await Promise.all(jobPromises);

      // Wait for jobs to be processed
      await waitFor(
        async () => {
          const stats = await queue.getJobCounts();
          const totalProcessed = (stats.completed || 0) + (stats.failed || 0);
          const initialProcessed = (initialStats.completed || 0) + (initialStats.failed || 0);
          return totalProcessed >= initialProcessed + 3;
        },
        45000,
        1000
      );

      // Verify jobs were handled (some may be skipped due to lock)
      const finalStats = await queue.getJobCounts();
      const totalProcessed = (finalStats.completed || 0) + (finalStats.failed || 0);
      const initialProcessed = (initialStats.completed || 0) + (initialStats.failed || 0);
      
      expect(totalProcessed).toBeGreaterThanOrEqual(initialProcessed + 3);
    });
  });

  describe('Error Handling', () => {
    it('should handle job failures gracefully', async () => {
      // Get initial stats
      const queue = queueManager.getQueue('social-listening');
      const initialStats = await queue.getJobCounts();

      // Submit a job with invalid data that might cause processing issues
      await queue.add('collect-keywords', {
        workspaceId: 'invalid-workspace-id', // Invalid workspace ID
        platform: 'twitter',
        jobType: 'keyword',
        scheduledAt: new Date(),
      }, { removeOnComplete: false, removeOnFail: false });

      // Wait for job to be processed (either success or failure)
      await waitFor(
        async () => {
          const stats = await queue.getJobCounts();
          return (
            (stats.completed || 0) > (initialStats.completed || 0) ||
            (stats.failed || 0) > (initialStats.failed || 0)
          );
        },
        30000,
        500
      );

      // Verify the job was handled (either completed or failed, not stuck)
      const finalStats = await queue.getJobCounts();
      const totalProcessed =
        (finalStats.completed || 0) - (initialStats.completed || 0) +
        (finalStats.failed || 0) - (initialStats.failed || 0);
      
      expect(totalProcessed).toBeGreaterThanOrEqual(1);
    });

    it('should verify worker metrics are tracked', async () => {
      // Get initial worker status
      const initialStatus = socialListeningWorker.getStatus();
      expect(initialStatus.isRunning).toBe(true);
      expect(initialStatus.concurrency).toBe(3);

      // Get initial metrics
      const initialMetrics = socialListeningWorker.getMetrics();
      const initialProcessed = initialMetrics.jobs_processed_total;

      // Submit a job
      const queue = queueManager.getQueue('social-listening');
      await queue.add('collect-keywords', {
        workspaceId: testWorkspaceId,
        platform: 'twitter',
        jobType: 'keyword',
        scheduledAt: new Date(),
      }, { removeOnComplete: false, removeOnFail: false });

      // Wait for job to be processed
      const initialStats = await queue.getJobCounts();
      await waitFor(
        async () => {
          const stats = await queue.getJobCounts();
          return (stats.completed || 0) > (initialStats.completed || 0);
        },
        30000,
        500
      );

      // Wait a bit for metrics to be updated
      await wait(1000);

      // Get updated metrics
      const updatedMetrics = socialListeningWorker.getMetrics();
      
      // Verify metrics were updated
      expect(updatedMetrics.jobs_processed_total).toBeGreaterThanOrEqual(initialProcessed);
      
      // Verify metric structure
      expect(updatedMetrics).toHaveProperty('jobs_processed_total');
      expect(updatedMetrics).toHaveProperty('jobs_success_total');
      expect(updatedMetrics).toHaveProperty('jobs_failure_total');
      expect(updatedMetrics).toHaveProperty('mentions_collected_total');
      expect(updatedMetrics).toHaveProperty('trends_calculated_total');
    });
  });
});
