import { DistributedLockService, Lock } from '../../services/DistributedLockService';
import { getRedisClientSafe } from '../../config/redis';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../../config/redis');
jest.mock('../../utils/logger');

describe('DistributedLockService - Lock Expiry Handling', () => {
  let lockService: DistributedLockService;
  let mockRedis: any;

  beforeEach(() => {
    // Reset singleton instance
    (DistributedLockService as any).instance = undefined;
    lockService = DistributedLockService.getInstance();

    // Setup mock Redis client
    mockRedis = {
      set: jest.fn(),
      get: jest.fn(),
      eval: jest.fn(),
    };

    (getRedisClientSafe as jest.Mock).mockReturnValue(mockRedis);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Lock Expiry After TTL', () => {
    it('should set TTL when acquiring lock', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const lock = await lockService.acquireLock('test-resource', { ttl: 5000 });

      expect(lock).not.toBeNull();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:test-resource',
        expect.any(String),
        'PX',
        5000,
        'NX'
      );
    });

    it('should use default TTL of 30 seconds if not specified', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const lock = await lockService.acquireLock('test-resource');

      expect(lock).not.toBeNull();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:test-resource',
        expect.any(String),
        'PX',
        30000,
        'NX'
      );
    });

    it('should allow lock acquisition after TTL expires', async () => {
      // First acquisition succeeds
      mockRedis.set.mockResolvedValueOnce('OK');
      const lock1 = await lockService.acquireLock('test-resource', { ttl: 100 });
      expect(lock1).not.toBeNull();

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second acquisition should succeed (simulating expired lock)
      mockRedis.set.mockResolvedValueOnce('OK');
      const lock2 = await lockService.acquireLock('test-resource', { ttl: 100 });
      expect(lock2).not.toBeNull();
    });

    it('should handle worker crash by allowing lock to expire', async () => {
      mockRedis.set.mockResolvedValue('OK');

      // Worker acquires lock
      const lock = await lockService.acquireLock('test-resource', { ttl: 100 });
      expect(lock).not.toBeNull();

      // Simulate worker crash (no explicit release)
      // Lock should expire after TTL

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Another worker should be able to acquire the lock
      mockRedis.set.mockResolvedValueOnce('OK');
      const newLock = await lockService.acquireLock('test-resource', { ttl: 100 });
      expect(newLock).not.toBeNull();
    });
  });

  describe('Lock Renewal for Long-Running Operations', () => {
    it('should renew lock TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const lock = await lockService.acquireLock('test-resource', { ttl: 5000 });
      expect(lock).not.toBeNull();

      const renewed = await lockService.renewLock(lock!, 10000);
      expect(renewed).toBe(true);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        lock!.key,
        lock!.value,
        10000
      );
    });

    it('should fail to renew lock if ownership changed', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(0); // Ownership verification failed

      const lock = await lockService.acquireLock('test-resource', { ttl: 5000 });
      expect(lock).not.toBeNull();

      const renewed = await lockService.renewLock(lock!);
      expect(renewed).toBe(false);
    });

    it('should setup automatic lock renewal', async () => {
      jest.useFakeTimers();
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const lock = await lockService.acquireLock('test-resource', {
        ttl: 10000,
        renewInterval: 5000,
      });

      expect(lock).not.toBeNull();
      expect(lock!.renewalTimer).toBeDefined();

      // Fast-forward time to trigger renewal
      jest.advanceTimersByTime(5000);
      await Promise.resolve(); // Allow promises to resolve

      expect(mockRedis.eval).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should stop auto-renewal if renewal fails', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(0); // Renewal fails

      const lock = await lockService.acquireLock('test-resource', {
        ttl: 100,
        renewInterval: 50,
      });

      expect(lock).not.toBeNull();
      expect(lock!.renewalTimer).toBeDefined();

      // Wait for renewal to fail
      await new Promise(resolve => setTimeout(resolve, 100));

      // Lock should be removed from active locks after failed renewal
      const activeLocks = lockService.getActiveLocks();
      expect(activeLocks.find(l => l.key === lock!.key)).toBeUndefined();
    });

    it('should renew lock with original TTL if newTtl not specified', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const lock = await lockService.acquireLock('test-resource', { ttl: 5000 });
      expect(lock).not.toBeNull();

      await lockService.renewLock(lock!);

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        lock!.key,
        lock!.value,
        5000 // Original TTL
      );
    });
  });

  describe('Lock Timeout Monitoring', () => {
    it('should track active locks', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const lock1 = await lockService.acquireLock('resource-1', { ttl: 5000 });
      const lock2 = await lockService.acquireLock('resource-2', { ttl: 5000 });

      const activeLocks = lockService.getActiveLocks();
      expect(activeLocks).toHaveLength(2);
      expect(activeLocks.find(l => l.key === 'lock:resource-1')).toBeDefined();
      expect(activeLocks.find(l => l.key === 'lock:resource-2')).toBeDefined();
    });

    it('should cleanup expired locks from memory', async () => {
      jest.useFakeTimers();
      mockRedis.set.mockResolvedValue('OK');

      const lock = await lockService.acquireLock('test-resource', { ttl: 1000 });
      expect(lock).not.toBeNull();

      // Fast-forward past TTL + grace period
      jest.advanceTimersByTime(6500);

      lockService.cleanupExpiredLocks();

      const activeLocks = lockService.getActiveLocks();
      expect(activeLocks.find(l => l.key === lock!.key)).toBeUndefined();

      jest.useRealTimers();
    });

    it('should not cleanup locks within grace period', async () => {
      jest.useFakeTimers();
      mockRedis.set.mockResolvedValue('OK');

      const lock = await lockService.acquireLock('test-resource', { ttl: 5000 });
      expect(lock).not.toBeNull();

      // Fast-forward but stay within grace period
      jest.advanceTimersByTime(5000);

      lockService.cleanupExpiredLocks();

      const activeLocks = lockService.getActiveLocks();
      expect(activeLocks.find(l => l.key === lock!.key)).toBeDefined();

      jest.useRealTimers();
    });

    it('should check if lock is still held', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('matching-value');

      const lock = await lockService.acquireLock('test-resource', { ttl: 5000 });
      expect(lock).not.toBeNull();

      // Mock Redis returning the same value
      mockRedis.get.mockResolvedValue(lock!.value);
      const isHeld = await lockService.isLockHeld(lock!);
      expect(isHeld).toBe(true);
    });

    it('should detect when lock is no longer held', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const lock = await lockService.acquireLock('test-resource', { ttl: 5000 });
      expect(lock).not.toBeNull();

      // Mock Redis returning different value (lock expired or taken by another process)
      mockRedis.get.mockResolvedValue('different-value');
      const isHeld = await lockService.isLockHeld(lock!);
      expect(isHeld).toBe(false);
    });
  });

  describe('Worker Crash Scenarios', () => {
    it('should handle graceful shutdown by releasing all locks', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const lock1 = await lockService.acquireLock('resource-1', { ttl: 5000 });
      const lock2 = await lockService.acquireLock('resource-2', { ttl: 5000 });

      expect(lockService.getActiveLocks()).toHaveLength(2);

      await lockService.shutdown();

      expect(mockRedis.eval).toHaveBeenCalledTimes(2); // Both locks released
    });

    it('should handle Redis unavailable during lock acquisition', async () => {
      (getRedisClientSafe as jest.Mock).mockReturnValue(null);

      const lock = await lockService.acquireLock('test-resource', { ttl: 5000 });
      expect(lock).toBeNull();
    });

    it('should handle Redis unavailable during lock release', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const lock = await lockService.acquireLock('test-resource', { ttl: 5000 });
      expect(lock).not.toBeNull();

      // Simulate Redis becoming unavailable
      (getRedisClientSafe as jest.Mock).mockReturnValue(null);

      const released = await lockService.releaseLock(lock!);
      expect(released).toBe(false);
    });

    it('should handle Redis unavailable during lock renewal', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const lock = await lockService.acquireLock('test-resource', { ttl: 5000 });
      expect(lock).not.toBeNull();

      // Simulate Redis becoming unavailable
      (getRedisClientSafe as jest.Mock).mockReturnValue(null);

      const renewed = await lockService.renewLock(lock!);
      expect(renewed).toBe(false);
    });

    it('should retry lock acquisition with exponential backoff', async () => {
      mockRedis.set
        .mockResolvedValueOnce(null) // First attempt fails
        .mockResolvedValueOnce(null) // Second attempt fails
        .mockResolvedValueOnce('OK'); // Third attempt succeeds

      const lock = await lockService.acquireLock('test-resource', {
        ttl: 5000,
        retryAttempts: 3,
        retryDelay: 10, // Use shorter delay for testing
      });

      expect(lock).not.toBeNull();
      expect(mockRedis.set).toHaveBeenCalledTimes(3);
    });

    it('should return null after all retry attempts exhausted', async () => {
      mockRedis.set.mockResolvedValue(null); // All attempts fail

      const lock = await lockService.acquireLock('test-resource', {
        ttl: 5000,
        retryAttempts: 3,
        retryDelay: 10, // Use shorter delay for testing
      });

      expect(lock).toBeNull();
    });

    it('should stop auto-renewal timer on lock release', async () => {
      jest.useFakeTimers();
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const lock = await lockService.acquireLock('test-resource', {
        ttl: 10000,
        renewInterval: 5000,
      });

      expect(lock).not.toBeNull();
      expect(lock!.renewalTimer).toBeDefined();

      await lockService.releaseLock(lock!);

      expect(lock!.renewalTimer).toBeUndefined();

      jest.useRealTimers();
    });
  });

  describe('Lock Ownership Verification', () => {
    it('should verify ownership before releasing lock', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const lock = await lockService.acquireLock('test-resource', { ttl: 5000 });
      expect(lock).not.toBeNull();

      const released = await lockService.releaseLock(lock!);
      expect(released).toBe(true);

      // Verify Lua script was called with correct parameters
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('GET'),
        1,
        lock!.key,
        lock!.value
      );
    });

    it('should fail to release lock if ownership verification fails', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(0); // Ownership verification failed

      const lock = await lockService.acquireLock('test-resource', { ttl: 5000 });
      expect(lock).not.toBeNull();

      const released = await lockService.releaseLock(lock!);
      expect(released).toBe(false);
    });

    it('should verify ownership before renewing lock', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const lock = await lockService.acquireLock('test-resource', { ttl: 5000 });
      expect(lock).not.toBeNull();

      const renewed = await lockService.renewLock(lock!);
      expect(renewed).toBe(true);

      // Verify Lua script was called with correct parameters
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('GET'),
        1,
        lock!.key,
        lock!.value,
        5000
      );
    });
  });
});
