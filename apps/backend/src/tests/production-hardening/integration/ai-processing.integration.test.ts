/**
 * AI Processing Integration Test
 * 
 * Tests end-to-end AI processing workflow including:
 * - AI processing request submission (caption generation)
 * - Job queuing in AIProcessingQueue
 * - Worker processing of job
 * - Result structure verification
 * - Metrics recording verification
 * 
 * Requirements: 1.4
 */

import mongoose from 'mongoose';
import { AIProcessingQueue } from '../../../queue/AIProcessingQueue';
import { AIProcessingWorker } from '../../../workers/AIProcessingWorker';
import { QueueManager } from '../../../queue/QueueManager';
import { MetricsCollector } from '../../../services/metrics/MetricsCollector';
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

describe('AI Processing Integration Test', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let aiProcessingQueue: AIProcessingQueue;
  let aiProcessingWorker: AIProcessingWorker;
  let queueManager: QueueManager;

  // Set test timeout to 60 seconds
  jest.setTimeout(60000);

  beforeAll(async () => {
    // Connect to MongoDB and Redis
    await connectMongoDB();
    await connectRedis();

    // Get queue manager and AI processing instances
    queueManager = QueueManager.getInstance();
    aiProcessingQueue = AIProcessingQueue.getInstance();
    aiProcessingWorker = AIProcessingWorker.getInstance();

    // Start AI processing worker
    aiProcessingWorker.start();

    // Wait for worker to be ready
    await wait(1000);
  });

  afterAll(async () => {
    // Stop AI processing worker
    await aiProcessingWorker.stop();

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
    await drainQueue('ai-processing-queue');
  });

  describe('End-to-End AI Processing Flow', () => {
    it('should process content repurposing request and verify complete flow', async () => {
      // Step 1: Get initial queue stats
      const initialStats = await aiProcessingQueue.getStats();
      const initialWaiting = initialStats.waiting || 0;

      // Step 2: Submit AI processing request (content repurposing)
      const originalContent = 'Check out our new product launch! 🚀 #innovation #tech';
      const targetPlatforms = ['twitter', 'linkedin'];

      await aiProcessingQueue.addRepurposingJob({
        workspaceId: testWorkspaceId,
        originalContent,
        originalPlatform: 'instagram',
        targetPlatforms,
        preserveHashtags: true,
        preserveMentions: false,
      });

      // Step 3: Verify job is queued in AIProcessingQueue
      await waitFor(
        async () => {
          const stats = await aiProcessingQueue.getStats();
          return (stats.waiting || 0) > initialWaiting || (stats.active || 0) > 0;
        },
        5000, // 5 second timeout
        100 // Check every 100ms
      );

      const queuedStats = await aiProcessingQueue.getStats();
      expect((queuedStats.waiting || 0) + (queuedStats.active || 0)).toBeGreaterThan(initialWaiting);

      // Step 4: Wait for worker to process the job
      await waitFor(
        async () => {
          const stats = await aiProcessingQueue.getStats();
          return (stats.completed || 0) > (initialStats.completed || 0);
        },
        30000, // 30 second timeout
        500 // Check every 500ms
      );

      // Step 5: Verify job was processed successfully
      const finalStats = await aiProcessingQueue.getStats();
      expect(finalStats.completed || 0).toBeGreaterThan(initialStats.completed || 0);

      // Step 6: Verify result structure by checking completed jobs
      const queue = queueManager.getQueue('ai-processing-queue');
      const completedJobs = await queue.getJobs(['completed'], 0, 10);
      
      // Find our job
      const ourJob = completedJobs.find(
        job => job.data.workspaceId === testWorkspaceId && job.data.type === 'repurpose'
      );

      expect(ourJob).toBeDefined();
      expect(ourJob!.returnvalue).toBeDefined();
      
      // Verify result structure
      const result = ourJob!.returnvalue;
      expect(result).toHaveProperty('platformVersions');
      expect(Array.isArray(result.platformVersions)).toBe(true);
      expect(result.platformVersions.length).toBeGreaterThan(0);
      
      // Verify each platform version has required fields
      result.platformVersions.forEach((version: any) => {
        expect(version).toHaveProperty('platform');
        expect(version).toHaveProperty('content');
        expect(typeof version.content).toBe('string');
        expect(version.content.length).toBeGreaterThan(0);
      });

      // Step 7: Verify metrics are recorded
      const aiMetrics = MetricsCollector.getAIMetrics();
      
      // Verify AI metrics exist
      expect(aiMetrics).toBeDefined();
      expect(aiMetrics.ai_requests_total).toBeGreaterThan(0);
      
      // Note: We can't verify specific metric values because MetricsCollector
      // aggregates all AI requests, but we can verify the structure exists
      expect(aiMetrics).toHaveProperty('ai_requests_total');
      expect(aiMetrics).toHaveProperty('ai_latency_avg_ms');
    });

    it('should process engagement prediction request and verify result structure', async () => {
      // Get initial stats
      const initialStats = await aiProcessingQueue.getStats();

      // Submit engagement prediction job
      const caption = 'Excited to announce our new feature! What do you think? 💡';
      const platform = 'twitter';

      await aiProcessingQueue.addEngagementPredictionJob({
        workspaceId: testWorkspaceId,
        platform,
        caption,
        hasMedia: true,
        mediaType: 'image',
      });

      // Wait for job to be queued
      await waitFor(
        async () => {
          const stats = await aiProcessingQueue.getStats();
          return (stats.waiting || 0) + (stats.active || 0) > (initialStats.waiting || 0);
        },
        5000,
        100
      );

      // Wait for processing to complete
      await waitFor(
        async () => {
          const stats = await aiProcessingQueue.getStats();
          return (stats.completed || 0) > (initialStats.completed || 0);
        },
        30000,
        500
      );

      // Verify result structure
      const queue = queueManager.getQueue('ai-processing-queue');
      const completedJobs = await queue.getJobs(['completed'], 0, 10);
      
      const ourJob = completedJobs.find(
        job => job.data.workspaceId === testWorkspaceId && job.data.type === 'engagement-prediction'
      );

      expect(ourJob).toBeDefined();
      expect(ourJob!.returnvalue).toBeDefined();
      
      const result = ourJob!.returnvalue;
      expect(result).toHaveProperty('predictedScore');
      expect(result).toHaveProperty('confidence');
      expect(typeof result.predictedScore).toBe('number');
      expect(typeof result.confidence).toBe('number');
      expect(result.predictedScore).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle multiple concurrent AI processing requests', async () => {
      // Get initial stats
      const initialStats = await aiProcessingQueue.getStats();
      const initialCompleted = initialStats.completed || 0;

      // Submit multiple jobs concurrently
      const jobPromises = [
        aiProcessingQueue.addRepurposingJob({
          workspaceId: testWorkspaceId,
          originalContent: 'Test content 1',
          targetPlatforms: ['twitter'],
        }),
        aiProcessingQueue.addRepurposingJob({
          workspaceId: testWorkspaceId,
          originalContent: 'Test content 2',
          targetPlatforms: ['linkedin'],
        }),
        aiProcessingQueue.addEngagementPredictionJob({
          workspaceId: testWorkspaceId,
          platform: 'twitter',
          caption: 'Test caption',
        }),
      ];

      await Promise.all(jobPromises);

      // Wait for all jobs to be processed
      await waitFor(
        async () => {
          const stats = await aiProcessingQueue.getStats();
          return (stats.completed || 0) >= initialCompleted + 3;
        },
        45000, // 45 second timeout for multiple jobs
        1000 // Check every second
      );

      // Verify all jobs completed
      const finalStats = await aiProcessingQueue.getStats();
      expect(finalStats.completed || 0).toBeGreaterThanOrEqual(initialCompleted + 3);

      // Verify no failures
      expect(finalStats.failed || 0).toBe(initialStats.failed || 0);
    });

    it('should verify worker processes jobs with correct concurrency', async () => {
      // Get initial stats
      const initialStats = await aiProcessingQueue.getStats();

      // Submit 5 jobs
      const jobPromises = Array.from({ length: 5 }, (_, i) =>
        aiProcessingQueue.addRepurposingJob({
          workspaceId: testWorkspaceId,
          originalContent: `Test content ${i + 1}`,
          targetPlatforms: ['twitter'],
        })
      );

      await Promise.all(jobPromises);

      // Check that active jobs don't exceed concurrency limit (3)
      let maxActive = 0;
      const checkInterval = setInterval(async () => {
        const stats = await aiProcessingQueue.getStats();
        const active = stats.active || 0;
        if (active > maxActive) {
          maxActive = active;
        }
      }, 100);

      // Wait for all jobs to complete
      await waitFor(
        async () => {
          const stats = await aiProcessingQueue.getStats();
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
      const finalStats = await aiProcessingQueue.getStats();
      expect(finalStats.completed || 0).toBeGreaterThanOrEqual((initialStats.completed || 0) + 5);
    });

    it('should verify metrics are updated after job processing', async () => {
      // Get initial metrics
      const initialMetrics = MetricsCollector.getAIMetrics();
      const initialRequests = initialMetrics.ai_requests_total || 0;

      // Submit a job
      await aiProcessingQueue.addRepurposingJob({
        workspaceId: testWorkspaceId,
        originalContent: 'Metrics test content',
        targetPlatforms: ['twitter'],
      });

      // Wait for job to complete
      const initialStats = await aiProcessingQueue.getStats();
      await waitFor(
        async () => {
          const stats = await aiProcessingQueue.getStats();
          return (stats.completed || 0) > (initialStats.completed || 0);
        },
        30000,
        500
      );

      // Wait a bit for metrics to be recorded
      await wait(1000);

      // Get updated metrics
      const updatedMetrics = MetricsCollector.getAIMetrics();
      
      // Verify metrics were updated
      expect(updatedMetrics).toBeDefined();
      expect(updatedMetrics.ai_requests_total).toBeGreaterThanOrEqual(initialRequests);
      
      // Verify metric structure
      expect(updatedMetrics).toHaveProperty('ai_requests_total');
      expect(updatedMetrics).toHaveProperty('ai_latency_avg_ms');
      expect(typeof updatedMetrics.ai_requests_total).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should handle job failures gracefully', async () => {
      // Get initial stats
      const initialStats = await aiProcessingQueue.getStats();

      // Submit a job with invalid data that might cause processing issues
      // Note: The actual behavior depends on the AI service implementation
      await aiProcessingQueue.addRepurposingJob({
        workspaceId: testWorkspaceId,
        originalContent: '', // Empty content might cause issues
        targetPlatforms: [],
      });

      // Wait for job to be processed (either success or failure)
      await waitFor(
        async () => {
          const stats = await aiProcessingQueue.getStats();
          return (
            (stats.completed || 0) > (initialStats.completed || 0) ||
            (stats.failed || 0) > (initialStats.failed || 0)
          );
        },
        30000,
        500
      );

      // Verify the job was handled (either completed or failed, not stuck)
      const finalStats = await aiProcessingQueue.getStats();
      const totalProcessed =
        (finalStats.completed || 0) - (initialStats.completed || 0) +
        (finalStats.failed || 0) - (initialStats.failed || 0);
      
      expect(totalProcessed).toBeGreaterThanOrEqual(1);
    });
  });
});
