/**
 * Load Test Runner Unit Tests
 * 
 * Tests the LoadTestRunner class functionality including:
 * - Job addition with and without ramp-up
 * - Metrics calculation
 * - Queue lag monitoring
 * - Results saving
 * - Cleanup
 * 
 * Requirements: 8.1, 8.3, 8.4, 8.5, 8.8
 */

import { LoadTestRunner } from '../load-test-runner';
import { LoadTestConfig, LoadTestMetrics } from '../load-test-config';
import { QueueManager } from '../../../../queue/QueueManager';
import {
  connectMongoDB,
  connectRedis,
  wait,
} from '../../utils/test-helpers';
import {
  drainQueue,
} from '../../utils/data-cleanup';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('LoadTestRunner', () => {
  let queueManager: QueueManager;
  const testQueueName = 'load-test-queue';
  const resultsDir = path.join(__dirname, '../../../../load-testing/results');

  // Set test timeout to 120 seconds for load tests
  jest.setTimeout(120000);

  beforeAll(async () => {
    // Connect to MongoDB and Redis
    await connectMongoDB();
    await connectRedis();

    // Get queue manager
    queueManager = QueueManager.getInstance();
  });

  afterEach(async () => {
    // Clean up test queue
    await drainQueue(testQueueName);
  });

  describe('Job Addition', () => {
    it('should add jobs without ramp-up', async () => {
      const config: LoadTestConfig = {
        queueName: testQueueName,
        jobCount: 10,
        concurrency: 5,
        jobPayloadGenerator: () => ({
          testData: 'test-payload',
          timestamp: Date.now(),
        }),
      };

      const runner = new LoadTestRunner(config);

      // Create a simple worker to process jobs
      const worker = queueManager.createWorker(
        testQueueName,
        async (job) => {
          // Simple processing - just wait a bit
          await wait(100);
          return { success: true };
        },
        { concurrency: config.concurrency }
      );

      try {
        // Run the load test
        const metrics = await runner.run();

        // Verify metrics structure
        expect(metrics).toBeDefined();
        expect(metrics.totalJobs).toBe(10);
        expect(metrics.throughput).toBeGreaterThan(0);
        expect(metrics.latency).toBeDefined();
        expect(metrics.latency.avg).toBeGreaterThan(0);
        expect(metrics.queueLag).toBeDefined();
        expect(metrics.duration).toBeGreaterThan(0);
      } finally {
        await worker.close();
      }
    });

    it('should add jobs with ramp-up', async () => {
      const config: LoadTestConfig = {
        queueName: testQueueName,
        jobCount: 5,
        concurrency: 2,
        rampUpTime: 2000, // 2 seconds ramp-up
        jobPayloadGenerator: () => ({
          testData: 'test-payload-ramp',
          timestamp: Date.now(),
        }),
      };

      const runner = new LoadTestRunner(config);

      // Create a simple worker to process jobs
      const worker = queueManager.createWorker(
        testQueueName,
        async (job) => {
          await wait(50);
          return { success: true };
        },
        { concurrency: config.concurrency }
      );

      try {
        const startTime = Date.now();
        const metrics = await runner.run();
        const duration = Date.now() - startTime;

        // Verify ramp-up took at least the configured time
        expect(duration).toBeGreaterThanOrEqual(2000);
        expect(metrics.totalJobs).toBe(5);
      } finally {
        await worker.close();
      }
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate throughput correctly', async () => {
      const config: LoadTestConfig = {
        queueName: testQueueName,
        jobCount: 20,
        concurrency: 10,
        jobPayloadGenerator: () => ({
          testData: 'throughput-test',
        }),
      };

      const runner = new LoadTestRunner(config);

      const worker = queueManager.createWorker(
        testQueueName,
        async (job) => {
          await wait(50);
          return { success: true };
        },
        { concurrency: config.concurrency }
      );

      try {
        const metrics = await runner.run();

        // Verify throughput is calculated (jobs per second)
        expect(metrics.throughput).toBeGreaterThan(0);
        expect(metrics.completedJobs).toBeGreaterThan(0);
        
        // Throughput should be reasonable (not negative or infinite)
        expect(metrics.throughput).toBeLessThan(1000);
      } finally {
        await worker.close();
      }
    });

    it('should calculate latency percentiles', async () => {
      const config: LoadTestConfig = {
        queueName: testQueueName,
        jobCount: 10,
        concurrency: 5,
        jobPayloadGenerator: () => ({
          testData: 'latency-test',
        }),
      };

      const runner = new LoadTestRunner(config);

      const worker = queueManager.createWorker(
        testQueueName,
        async (job) => {
          // Variable processing time
          await wait(Math.random() * 200 + 50);
          return { success: true };
        },
        { concurrency: config.concurrency }
      );

      try {
        const metrics = await runner.run();

        // Verify latency metrics are present
        expect(metrics.latency.avg).toBeGreaterThan(0);
        expect(metrics.latency.p50).toBeGreaterThan(0);
        expect(metrics.latency.p95).toBeGreaterThan(0);
        expect(metrics.latency.p99).toBeGreaterThan(0);
        expect(metrics.latency.max).toBeGreaterThan(0);

        // Verify percentile ordering (p50 <= p95 <= p99 <= max)
        expect(metrics.latency.p50).toBeLessThanOrEqual(metrics.latency.p95);
        expect(metrics.latency.p95).toBeLessThanOrEqual(metrics.latency.p99);
        expect(metrics.latency.p99).toBeLessThanOrEqual(metrics.latency.max);
      } finally {
        await worker.close();
      }
    });

    it('should track queue lag samples', async () => {
      const config: LoadTestConfig = {
        queueName: testQueueName,
        jobCount: 15,
        concurrency: 3,
        jobPayloadGenerator: () => ({
          testData: 'queue-lag-test',
        }),
      };

      const runner = new LoadTestRunner(config);

      const worker = queueManager.createWorker(
        testQueueName,
        async (job) => {
          await wait(100);
          return { success: true };
        },
        { concurrency: config.concurrency }
      );

      try {
        const metrics = await runner.run();

        // Verify queue lag metrics
        expect(metrics.queueLag.samples).toBeDefined();
        expect(metrics.queueLag.samples.length).toBeGreaterThan(0);
        expect(metrics.queueLag.avg).toBeGreaterThanOrEqual(0);
        expect(metrics.queueLag.max).toBeGreaterThanOrEqual(metrics.queueLag.avg);
      } finally {
        await worker.close();
      }
    });
  });

  describe('Results Saving', () => {
    it('should save results to JSON file', async () => {
      const config: LoadTestConfig = {
        queueName: testQueueName,
        jobCount: 5,
        concurrency: 2,
        jobPayloadGenerator: () => ({
          testData: 'save-test',
        }),
      };

      const runner = new LoadTestRunner(config);

      const worker = queueManager.createWorker(
        testQueueName,
        async (job) => {
          await wait(50);
          return { success: true };
        },
        { concurrency: config.concurrency }
      );

      try {
        await runner.run();
        await runner.saveResults(resultsDir);

        // Verify file was created
        const files = await fs.readdir(resultsDir);
        const resultFiles = files.filter(f => f.startsWith('load-test-') && f.endsWith('.json'));
        
        expect(resultFiles.length).toBeGreaterThan(0);

        // Read and verify file content
        const latestFile = resultFiles[resultFiles.length - 1];
        const content = await fs.readFile(path.join(resultsDir, latestFile), 'utf-8');
        const results = JSON.parse(content);

        expect(results.config).toBeDefined();
        expect(results.config.queueName).toBe(testQueueName);
        expect(results.metrics).toBeDefined();
        expect(results.timestamp).toBeDefined();

        // Clean up test file
        await fs.unlink(path.join(resultsDir, latestFile));
      } finally {
        await worker.close();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle cleanup even if test fails', async () => {
      const config: LoadTestConfig = {
        queueName: testQueueName,
        jobCount: 5,
        concurrency: 2,
        duration: 1000, // Short timeout to force early termination
        jobPayloadGenerator: () => ({
          testData: 'cleanup-test',
        }),
      };

      const runner = new LoadTestRunner(config);

      const worker = queueManager.createWorker(
        testQueueName,
        async (job) => {
          // Slow processing to trigger timeout
          await wait(5000);
          return { success: true };
        },
        { concurrency: config.concurrency }
      );

      try {
        // Run with timeout - should complete even if jobs don't finish
        const metrics = await runner.run();
        
        // Should still return metrics
        expect(metrics).toBeDefined();
        expect(metrics.totalJobs).toBe(5);
      } finally {
        await worker.close();
      }
    });
  });
});
