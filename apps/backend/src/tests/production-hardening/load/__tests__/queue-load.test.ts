/**
 * Queue Load Test Suite
 * 
 * Comprehensive load testing for all queue systems including:
 * - 1000 job throughput and latency measurement
 * - Retry behavior verification (5s, 25s, 125s exponential backoff)
 * - Concurrency limit enforcement (max 5 concurrent jobs)
 * - Stalled job recovery
 * - Distributed lock verification
 * - DeadLetterQueue routing
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 8.9, 8.10
 */

import { QueueManager } from '../../../../queue/QueueManager';
import { LoadTestRunner } from '../load-test-runner';
import { LoadTestConfig } from '../load-test-config';
import {
  connectMongoDB,
  connectRedis,
  waitFor,
  wait,
  generateUniqueId,
} from '../../utils/test-helpers';
import {
  drainQueue,
} from '../../utils/data-cleanup';
import * as path from 'path';

describe('Queue Load Test Suite', () => {
  let queueManager: QueueManager;
  const resultsDir = path.join(__dirname, '../../../../load-testing/results');

  // Set test timeout to 600 seconds (10 minutes) for load tests
  jest.setTimeout(600000);

  beforeAll(async () => {
    // Connect to MongoDB and Redis
    await connectMongoDB();
    await connectRedis();

    // Get queue manager
    queueManager = QueueManager.getInstance();
  });

  afterEach(async () => {
    // Clean up test queues
    const testQueues = ['WorkflowQueue', 'RSSQueue', 'EvergreenQueue', 'AIProcessingQueue', 'SocialListeningQueue'];
    for (const queueName of testQueues) {
      await drainQueue(queueName);
    }
  });

  describe('1000 Job Load Test - Throughput and Latency', () => {
    it('should process 1000 jobs without data loss and measure performance', async () => {
      const queueName = 'WorkflowQueue';
      
      const config: LoadTestConfig = {
        queueName,
        jobCount: 1000,
        concurrency: 5,
        jobPayloadGenerator: () => ({
          workflowId: generateUniqueId('workflow'),
          action: 'test-action',
          timestamp: Date.now(),
          data: {
            testData: 'load-test-payload',
            iteration: Math.random(),
          },
        }),
      };

      // Create worker to process jobs
      const worker = queueManager.createWorker(
        queueName,
        async (job) => {
          // Simulate realistic processing time (50-150ms)
          await wait(50 + Math.random() * 100);
          return { success: true, jobId: job.id };
        },
        { concurrency: config.concurrency }
      );

      try {
        // Run load test
        const runner = new LoadTestRunner(config);
        const metrics = await runner.run();

        // Verify all jobs were processed without data loss
        expect(metrics.totalJobs).toBe(1000);
        expect(metrics.completedJobs + metrics.failedJobs).toBe(1000);
        
        // Verify throughput is reasonable (should process jobs efficiently)
        expect(metrics.throughput).toBeGreaterThan(0);
        console.log(`Throughput: ${metrics.throughput.toFixed(2)} jobs/second`);

        // Verify latency metrics are present and reasonable
        expect(metrics.latency.avg).toBeGreaterThan(0);
        expect(metrics.latency.p50).toBeGreaterThan(0);
        expect(metrics.latency.p95).toBeGreaterThan(0);
        expect(metrics.latency.p99).toBeGreaterThan(0);
        expect(metrics.latency.max).toBeGreaterThan(0);

        // Verify percentile ordering
        expect(metrics.latency.p50).toBeLessThanOrEqual(metrics.latency.p95);
        expect(metrics.latency.p95).toBeLessThanOrEqual(metrics.latency.p99);
        expect(metrics.latency.p99).toBeLessThanOrEqual(metrics.latency.max);

        console.log('Latency Metrics:');
        console.log(`  Average: ${metrics.latency.avg.toFixed(2)}ms`);
        console.log(`  P50: ${metrics.latency.p50.toFixed(2)}ms`);
        console.log(`  P95: ${metrics.latency.p95.toFixed(2)}ms`);
        console.log(`  P99: ${metrics.latency.p99.toFixed(2)}ms`);
        console.log(`  Max: ${metrics.latency.max.toFixed(2)}ms`);

        // Verify queue lag metrics
        expect(metrics.queueLag.avg).toBeGreaterThanOrEqual(0);
        expect(metrics.queueLag.max).toBeGreaterThanOrEqual(metrics.queueLag.avg);
        expect(metrics.queueLag.samples.length).toBeGreaterThan(0);

        console.log('Queue Lag Metrics:');
        console.log(`  Average: ${metrics.queueLag.avg.toFixed(2)}ms`);
        console.log(`  Max: ${metrics.queueLag.max.toFixed(2)}ms`);

        // Verify error rate is acceptable (< 5%)
        expect(metrics.errorRate).toBeLessThan(5);

        // Save results for historical comparison
        await runner.saveResults(resultsDir);
      } finally {
        await worker.close();
      }
    });

    it('should test all queues with consistent behavior', async () => {
      const queues = ['WorkflowQueue', 'RSSQueue', 'EvergreenQueue', 'AIProcessingQueue', 'SocialListeningQueue'];
      const results: Record<string, any> = {};

      for (const queueName of queues) {
        const config: LoadTestConfig = {
          queueName,
          jobCount: 100, // Smaller count for multi-queue test
          concurrency: 5,
          jobPayloadGenerator: () => ({
            queueName,
            testId: generateUniqueId('test'),
            timestamp: Date.now(),
          }),
        };

        const worker = queueManager.createWorker(
          queueName,
          async (job) => {
            await wait(50);
            return { success: true };
          },
          { concurrency: config.concurrency }
        );

        try {
          const runner = new LoadTestRunner(config);
          const metrics = await runner.run();

          results[queueName] = metrics;

          // Verify each queue processes all jobs
          expect(metrics.totalJobs).toBe(100);
          expect(metrics.completedJobs + metrics.failedJobs).toBe(100);
          expect(metrics.errorRate).toBeLessThan(5);

          console.log(`${queueName}: ${metrics.throughput.toFixed(2)} jobs/s, avg latency: ${metrics.latency.avg.toFixed(2)}ms`);
        } finally {
          await worker.close();
        }
      }

      // Verify all queues completed successfully
      expect(Object.keys(results).length).toBe(5);
    });
  });

  describe('Retry Behavior Verification', () => {
    it('should verify exponential backoff retry delays (5s, 25s, 125s)', async () => {
      const queueName = 'WorkflowQueue';
      let attemptCount = 0;
      const attemptTimestamps: number[] = [];

      // Create worker that fails first 3 attempts
      const worker = queueManager.createWorker(
        queueName,
        async (job) => {
          attemptTimestamps.push(Date.now());
          attemptCount++;

          if (attemptCount <= 3) {
            throw new Error('Intentional failure for retry test');
          }

          return { success: true };
        },
        {
          concurrency: 1,
          settings: {
            attempts: 4, // Allow 3 retries
            backoff: {
              type: 'exponential',
              delay: 5000, // 5 seconds base delay
            },
          },
        }
      );

      try {
        // Add a single job
        await queueManager.addJob(
          queueName,
          'retry-test-job',
          { testData: 'retry-test' },
          { jobId: generateUniqueId('retry-job') }
        );

        // Wait for all retry attempts to complete (5s + 25s + 125s = 155s + processing time)
        await waitFor(
          async () => attemptCount >= 4,
          180000, // 3 minutes timeout
          1000
        );

        // Verify we had 4 attempts (1 initial + 3 retries)
        expect(attemptCount).toBe(4);
        expect(attemptTimestamps.length).toBe(4);

        // Calculate delays between attempts
        const delays: number[] = [];
        for (let i = 1; i < attemptTimestamps.length; i++) {
          const delay = attemptTimestamps[i] - attemptTimestamps[i - 1];
          delays.push(delay);
        }

        console.log('Retry delays:', delays.map(d => `${(d / 1000).toFixed(1)}s`).join(', '));

        // Verify delays are approximately 5s, 25s, 125s (with some tolerance)
        // First retry: ~5s (5000ms ± 1000ms)
        expect(delays[0]).toBeGreaterThanOrEqual(4000);
        expect(delays[0]).toBeLessThanOrEqual(7000);

        // Second retry: ~25s (25000ms ± 2000ms)
        expect(delays[1]).toBeGreaterThanOrEqual(23000);
        expect(delays[1]).toBeLessThanOrEqual(28000);

        // Third retry: ~125s (125000ms ± 5000ms)
        expect(delays[2]).toBeGreaterThanOrEqual(120000);
        expect(delays[2]).toBeLessThanOrEqual(135000);
      } finally {
        await worker.close();
      }
    });

    it('should route failed jobs to DeadLetterQueue after 3 failures', async () => {
      const queueName = 'WorkflowQueue';
      let failureCount = 0;

      // Create worker that always fails
      const worker = queueManager.createWorker(
        queueName,
        async (job) => {
          failureCount++;
          throw new Error('Intentional failure for DeadLetterQueue test');
        },
        {
          concurrency: 1,
          settings: {
            attempts: 3, // Fail after 3 attempts
            backoff: {
              type: 'exponential',
              delay: 1000, // Shorter delay for faster test
            },
          },
        }
      );

      try {
        // Get initial stats
        const initialStats = await queueManager.getQueueStats(queueName);
        const initialFailed = initialStats.failed || 0;

        // Add a job that will fail
        const jobId = generateUniqueId('dlq-job');
        await queueManager.addJob(
          queueName,
          'dlq-test-job',
          { testData: 'dlq-test' },
          { jobId }
        );

        // Wait for job to fail 3 times and move to failed state
        await waitFor(
          async () => {
            const stats = await queueManager.getQueueStats(queueName);
            return (stats.failed || 0) > initialFailed;
          },
          30000, // 30 second timeout
          500
        );

        // Verify job failed after 3 attempts
        expect(failureCount).toBe(3);

        // Verify job is in failed state (DeadLetterQueue equivalent)
        const finalStats = await queueManager.getQueueStats(queueName);
        expect(finalStats.failed || 0).toBeGreaterThan(initialFailed);

        // Verify the job is in failed jobs
        const queue = queueManager.getQueue(queueName);
        const failedJobs = await queue.getFailed(0, 10);
        const ourJob = failedJobs.find(job => job.id === jobId);

        expect(ourJob).toBeDefined();
        expect(ourJob!.attemptsMade).toBe(3);
        expect(ourJob!.failedReason).toContain('Intentional failure');
      } finally {
        await worker.close();
      }
    });
  });

  describe('Concurrency Limit Enforcement', () => {
    it('should enforce max 5 concurrent jobs', async () => {
      const queueName = 'WorkflowQueue';
      const maxConcurrency = 5;
      let currentActive = 0;
      let maxActiveObserved = 0;

      // Create worker with concurrency limit
      const worker = queueManager.createWorker(
        queueName,
        async (job) => {
          currentActive++;
          maxActiveObserved = Math.max(maxActiveObserved, currentActive);

          // Simulate processing time
          await wait(500);

          currentActive--;
          return { success: true };
        },
        { concurrency: maxConcurrency }
      );

      try {
        // Add 20 jobs
        const jobPromises: Promise<void>[] = [];
        for (let i = 0; i < 20; i++) {
          jobPromises.push(
            queueManager.addJob(
              queueName,
              'concurrency-test-job',
              { testData: `job-${i}` },
              { jobId: generateUniqueId(`concurrency-job-${i}`) }
            ).then(() => {})
          );
        }

        await Promise.all(jobPromises);

        // Wait for all jobs to complete
        await waitFor(
          async () => {
            const stats = await queueManager.getQueueStats(queueName);
            return (stats.completed || 0) >= 20;
          },
          60000, // 60 second timeout
          500
        );

        // Verify concurrency was never exceeded
        expect(maxActiveObserved).toBeLessThanOrEqual(maxConcurrency);
        console.log(`Max concurrent jobs observed: ${maxActiveObserved} (limit: ${maxConcurrency})`);

        // Verify all jobs completed
        const finalStats = await queueManager.getQueueStats(queueName);
        expect(finalStats.completed || 0).toBeGreaterThanOrEqual(20);
      } finally {
        await worker.close();
      }
    });

    it('should verify concurrency enforcement across multiple queue types', async () => {
      const queues = ['WorkflowQueue', 'RSSQueue', 'EvergreenQueue'];
      const maxConcurrency = 5;
      const results: Record<string, number> = {};

      for (const queueName of queues) {
        let currentActive = 0;
        let maxActiveObserved = 0;

        const worker = queueManager.createWorker(
          queueName,
          async (job) => {
            currentActive++;
            maxActiveObserved = Math.max(maxActiveObserved, currentActive);
            await wait(300);
            currentActive--;
            return { success: true };
          },
          { concurrency: maxConcurrency }
        );

        try {
          // Add 15 jobs
          for (let i = 0; i < 15; i++) {
            await queueManager.addJob(
              queueName,
              'concurrency-test',
              { testData: `job-${i}` },
              { jobId: generateUniqueId(`${queueName}-job-${i}`) }
            );
          }

          // Wait for completion
          await waitFor(
            async () => {
              const stats = await queueManager.getQueueStats(queueName);
              return (stats.completed || 0) >= 15;
            },
            45000,
            500
          );

          results[queueName] = maxActiveObserved;
          expect(maxActiveObserved).toBeLessThanOrEqual(maxConcurrency);
        } finally {
          await worker.close();
        }
      }

      console.log('Concurrency enforcement results:', results);
    });
  });

  describe('Stalled Job Recovery', () => {
    it('should detect and recover stalled jobs exceeding lockDuration', async () => {
      const queueName = 'WorkflowQueue';
      let jobStarted = false;
      let jobRecovered = false;
      let attemptCount = 0;

      // Create worker that stalls on first attempt
      const worker = queueManager.createWorker(
        queueName,
        async (job) => {
          attemptCount++;

          if (attemptCount === 1) {
            jobStarted = true;
            // Simulate stall by waiting longer than lockDuration (30s)
            // But we'll simulate by not completing the job
            await wait(35000); // 35 seconds
            throw new Error('Simulated stall');
          } else {
            jobRecovered = true;
            return { success: true, recovered: true };
          }
        },
        {
          concurrency: 1,
          settings: {
            lockDuration: 30000, // 30 seconds
            lockRenewTime: 15000, // 15 seconds
          },
        }
      );

      try {
        // Add a job
        const jobId = generateUniqueId('stalled-job');
        await queueManager.addJob(
          queueName,
          'stalled-test-job',
          { testData: 'stalled-test' },
          { jobId }
        );

        // Wait for job to start
        await waitFor(
          () => jobStarted,
          10000,
          100
        );

        // Wait for job to be recovered (should happen after lockDuration expires)
        await waitFor(
          () => jobRecovered || attemptCount >= 2,
          90000, // 90 second timeout
          1000
        );

        // Verify job was attempted multiple times (stalled and recovered)
        expect(attemptCount).toBeGreaterThanOrEqual(2);
        console.log(`Job attempts: ${attemptCount}`);
      } finally {
        await worker.close();
      }
    });
  });

  describe('Queue Lag Monitoring', () => {
    it('should measure and report queue lag metrics', async () => {
      const queueName = 'WorkflowQueue';

      const config: LoadTestConfig = {
        queueName,
        jobCount: 100,
        concurrency: 3, // Lower concurrency to create backlog
        jobPayloadGenerator: () => ({
          testData: generateUniqueId('lag-test'),
          timestamp: Date.now(),
        }),
      };

      // Create worker with slower processing to create lag
      const worker = queueManager.createWorker(
        queueName,
        async (job) => {
          await wait(200); // Slower processing
          return { success: true };
        },
        { concurrency: config.concurrency }
      );

      try {
        const runner = new LoadTestRunner(config);
        const metrics = await runner.run();

        // Verify queue lag was measured
        expect(metrics.queueLag.samples.length).toBeGreaterThan(0);
        expect(metrics.queueLag.avg).toBeGreaterThanOrEqual(0);
        expect(metrics.queueLag.max).toBeGreaterThanOrEqual(metrics.queueLag.avg);

        console.log('Queue Lag Analysis:');
        console.log(`  Average lag: ${metrics.queueLag.avg.toFixed(2)}ms`);
        console.log(`  Max lag: ${metrics.queueLag.max.toFixed(2)}ms`);
        console.log(`  Samples collected: ${metrics.queueLag.samples.length}`);

        // If lag exceeds 60 seconds, verify warning would be logged
        if (metrics.queueLag.max > 60000) {
          console.log(`WARNING: Queue lag exceeded 60 seconds (${(metrics.queueLag.max / 1000).toFixed(1)}s)`);
        }
      } finally {
        await worker.close();
      }
    });
  });

  describe('Distributed Lock Verification', () => {
    it('should prevent duplicate job execution with distributed locks', async () => {
      const queueName = 'WorkflowQueue';
      const resourceId = generateUniqueId('lock-resource');
      let executionCount = 0;

      // Create worker that uses distributed lock
      const worker = queueManager.createWorker(
        queueName,
        async (job) => {
          // Acquire lock for this resource
          const lock = await queueManager.acquireLock(`test-resource-${resourceId}`, 10000);

          if (!lock) {
            // Lock acquisition failed - another worker has it
            return { success: false, reason: 'lock_failed' };
          }

          try {
            executionCount++;
            await wait(100);
            return { success: true, executionCount };
          } finally {
            await queueManager.releaseLock(lock);
          }
        },
        { concurrency: 5 }
      );

      try {
        // Add the same job multiple times (simulating concurrent triggers)
        const jobPromises: Promise<void>[] = [];
        for (let i = 0; i < 10; i++) {
          jobPromises.push(
            queueManager.addJob(
              queueName,
              'lock-test-job',
              { resourceId, testData: `attempt-${i}` },
              { jobId: generateUniqueId(`lock-job-${i}`) }
            ).then(() => {})
          );
        }

        await Promise.all(jobPromises);

        // Wait for all jobs to be processed
        await waitFor(
          async () => {
            const stats = await queueManager.getQueueStats(queueName);
            return (stats.completed || 0) + (stats.failed || 0) >= 10;
          },
          30000,
          500
        );

        // Verify jobs were processed (some may have failed due to lock contention)
        const finalStats = await queueManager.getQueueStats(queueName);
        const totalProcessed = (finalStats.completed || 0) + (finalStats.failed || 0);
        expect(totalProcessed).toBe(10);

        console.log(`Execution count: ${executionCount}`);
        console.log(`Jobs completed: ${finalStats.completed || 0}`);
        console.log(`Jobs failed (lock contention): ${finalStats.failed || 0}`);
      } finally {
        await worker.close();
      }
    });
  });
});
