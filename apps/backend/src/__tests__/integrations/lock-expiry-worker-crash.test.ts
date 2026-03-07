import { DistributedLockService } from '../../services/DistributedLockService';
import { connectRedis, disconnectRedis, getRedisClient } from '../../config/redis';
import { logger } from '../../utils/logger';

/**
 * Integration Test: Lock Expiry and Worker Crash Scenarios
 * 
 * This test verifies that distributed locks expire correctly when workers crash,
 * allowing other workers to acquire the lock and process the job.
 * 
 * NOTE: This test requires Redis to be running locally.
 * Skip in CI with: npm test -- --testPathIgnorePatterns=lock-expiry-worker-crash
 */

describe.skip('Lock Expiry - Worker Crash Integration Test', () => {
  let lockService: DistributedLockService;

  beforeAll(async () => {
    // Connect to Redis
    await connectRedis();
    
    // Reset singleton
    (DistributedLockService as any).instance = undefined;
    lockService = DistributedLockService.getInstance();
  });

  afterAll(async () => {
    await lockService.shutdown();
    await disconnectRedis();
  });

  afterEach(async () => {
    // Clean up any remaining locks
    const redis = getRedisClient();
    const keys = await redis.keys('lock:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('Worker Crash Scenarios', () => {
    it('should allow lock acquisition after TTL expires when worker crashes', async () => {
      const resource = 'post:crash-test-1';
      const ttl = 2000; // 2 seconds

      // Worker 1 acquires lock
      const lock1 = await lockService.acquireLock(resource, { ttl });
      expect(lock1).not.toBeNull();
      
      logger.info('Worker 1 acquired lock', { resource, lockKey: lock1!.key });

      // Simulate worker crash (no explicit release)
      // In real scenario, worker process would terminate here
      
      // Wait for TTL to expire
      logger.info('Simulating worker crash - waiting for TTL to expire', { ttl });
      await new Promise(resolve => setTimeout(resolve, ttl + 500));

      // Worker 2 should be able to acquire the lock
      const lock2 = await lockService.acquireLock(resource, { ttl });
      expect(lock2).not.toBeNull();
      
      logger.info('Worker 2 acquired lock after expiry', { resource, lockKey: lock2!.key });

      // Clean up
      await lockService.releaseLock(lock2!);
    }, 10000);

    it('should prevent duplicate processing with lock renewal', async () => {
      const resource = 'post:long-running-1';
      const ttl = 1000; // 1 second
      const renewInterval = 500; // Renew every 500ms

      // Worker 1 acquires lock with auto-renewal
      const lock1 = await lockService.acquireLock(resource, { ttl, renewInterval });
      expect(lock1).not.toBeNull();
      
      logger.info('Worker 1 acquired lock with auto-renewal', { resource });

      // Wait longer than TTL (but renewal should keep it alive)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Worker 2 should NOT be able to acquire the lock (still held by Worker 1)
      const lock2 = await lockService.acquireLock(resource, { 
        ttl, 
        retryAttempts: 1 
      });
      expect(lock2).toBeNull();
      
      logger.info('Worker 2 correctly blocked by active lock', { resource });

      // Clean up
      await lockService.releaseLock(lock1!);
      
      // Now Worker 2 should be able to acquire
      const lock3 = await lockService.acquireLock(resource, { ttl });
      expect(lock3).not.toBeNull();
      
      await lockService.releaseLock(lock3!);
    }, 10000);

    it('should handle multiple workers competing for same lock', async () => {
      const resource = 'post:competition-1';
      const ttl = 5000;

      // Simulate 5 workers trying to acquire the same lock
      const workers = Array.from({ length: 5 }, (_, i) => i + 1);
      
      const results = await Promise.all(
        workers.map(async (workerId) => {
          const lock = await lockService.acquireLock(resource, { 
            ttl,
            retryAttempts: 1 
          });
          
          if (lock) {
            logger.info(`Worker ${workerId} acquired lock`, { resource });
            return { workerId, acquired: true, lock };
          } else {
            logger.info(`Worker ${workerId} failed to acquire lock`, { resource });
            return { workerId, acquired: false, lock: null };
          }
        })
      );

      // Only one worker should have acquired the lock
      const acquired = results.filter(r => r.acquired);
      expect(acquired).toHaveLength(1);
      
      logger.info('Lock competition result', {
        totalWorkers: workers.length,
        acquired: acquired.length,
        winner: acquired[0]?.workerId,
      });

      // Clean up
      if (acquired[0]?.lock) {
        await lockService.releaseLock(acquired[0].lock);
      }
    }, 10000);

    it('should track lock timeouts and alert on frequent failures', async () => {
      const resources = Array.from({ length: 6 }, (_, i) => `post:timeout-${i}`);
      const ttl = 500;
      const renewInterval = 250;

      // Acquire locks with auto-renewal
      const locks = await Promise.all(
        resources.map(resource => 
          lockService.acquireLock(resource, { ttl, renewInterval })
        )
      );

      // Verify all locks acquired
      expect(locks.every(lock => lock !== null)).toBe(true);

      // Simulate Redis becoming unavailable (renewal will fail)
      // In real scenario, this would be a network partition or Redis crash
      const redis = getRedisClient();
      
      // Force renewal failures by deleting locks from Redis
      await Promise.all(
        locks.map(lock => redis.del(lock!.key))
      );

      // Wait for renewals to fail
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check metrics
      const metrics = lockService.getMetrics();
      logger.info('Lock timeout metrics', metrics);

      // Should have tracked timeouts
      expect(metrics.totalTimeouts).toBeGreaterThan(0);

      // Clean up remaining locks
      await Promise.all(
        locks.filter(lock => lock !== null).map(lock => 
          lockService.releaseLock(lock!).catch(() => {})
        )
      );
    }, 10000);

    it('should verify lock is still held before critical operations', async () => {
      const resource = 'post:verification-1';
      const ttl = 1000;

      // Worker acquires lock
      const lock = await lockService.acquireLock(resource, { ttl });
      expect(lock).not.toBeNull();

      // Verify lock is held
      let isHeld = await lockService.isLockHeld(lock!);
      expect(isHeld).toBe(true);

      // Wait for lock to expire
      await new Promise(resolve => setTimeout(resolve, ttl + 500));

      // Verify lock is no longer held
      isHeld = await lockService.isLockHeld(lock!);
      expect(isHeld).toBe(false);

      logger.info('Lock expiry verified', { resource, isHeld });
    }, 10000);

    it('should handle graceful shutdown by releasing all active locks', async () => {
      const resources = ['post:shutdown-1', 'post:shutdown-2', 'post:shutdown-3'];
      const ttl = 5000;

      // Acquire multiple locks
      const locks = await Promise.all(
        resources.map(resource => lockService.acquireLock(resource, { ttl }))
      );

      expect(locks.every(lock => lock !== null)).toBe(true);
      expect(lockService.getActiveLocks()).toHaveLength(3);

      // Shutdown should release all locks
      await lockService.shutdown();

      // Verify all locks released
      expect(lockService.getActiveLocks()).toHaveLength(0);

      // Verify locks can be acquired again
      const newLock = await lockService.acquireLock(resources[0], { ttl });
      expect(newLock).not.toBeNull();

      await lockService.releaseLock(newLock!);
    }, 10000);
  });

  describe('Lock Metrics and Monitoring', () => {
    it('should track lock acquisition and release metrics', async () => {
      const resource = 'post:metrics-1';
      const ttl = 2000;

      // Get initial metrics
      const initialMetrics = lockService.getMetrics();

      // Acquire and release lock
      const lock = await lockService.acquireLock(resource, { ttl });
      expect(lock).not.toBeNull();

      await new Promise(resolve => setTimeout(resolve, 100));
      await lockService.releaseLock(lock!);

      // Get updated metrics
      const updatedMetrics = lockService.getMetrics();

      expect(updatedMetrics.totalAcquired).toBe(initialMetrics.totalAcquired + 1);
      expect(updatedMetrics.totalReleased).toBe(initialMetrics.totalReleased + 1);
      expect(updatedMetrics.averageLockDuration).toBeGreaterThan(0);

      logger.info('Lock metrics', updatedMetrics);
    }, 10000);

    it('should track lock renewal metrics', async () => {
      const resource = 'post:renewal-metrics-1';
      const ttl = 1000;
      const renewInterval = 400;

      const initialMetrics = lockService.getMetrics();

      // Acquire lock with auto-renewal
      const lock = await lockService.acquireLock(resource, { ttl, renewInterval });
      expect(lock).not.toBeNull();

      // Wait for at least 2 renewals
      await new Promise(resolve => setTimeout(resolve, 1000));

      const updatedMetrics = lockService.getMetrics();

      expect(updatedMetrics.totalRenewed).toBeGreaterThan(initialMetrics.totalRenewed);

      logger.info('Renewal metrics', {
        renewals: updatedMetrics.totalRenewed - initialMetrics.totalRenewed,
      });

      await lockService.releaseLock(lock!);
    }, 10000);
  });
});
