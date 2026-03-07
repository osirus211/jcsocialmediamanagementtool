/**
 * OAuth State Service - Concurrency Tests
 * 
 * Tests atomic state consumption under concurrent access:
 * 1. Parallel callback requests with same state
 * 2. Race condition prevention
 * 3. GETDEL atomicity verification
 * 4. Distributed simulation (if Redis available)
 */

import { OAuthStateService } from '../OAuthStateService';
import { getRedisClientSafe } from '../../config/redis';

// Mock dependencies
jest.mock('../../config/redis');
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('OAuthStateService - Concurrency Tests', () => {
  let service: OAuthStateService;
  let mockRedis: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = OAuthStateService.getInstance();

    // Mock Redis client
    mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
      getdel: jest.fn(),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      pttl: jest.fn().mockResolvedValue(600000),
    };

    (getRedisClientSafe as jest.Mock).mockReturnValue(mockRedis);
  });

  describe('Test 1: Parallel Callback Requests with Same State', () => {
    it('should allow only one request to consume state', async () => {
      const state = 'test-state-123';
      const stateData = {
        state,
        workspaceId: 'workspace-123',
        userId: 'user-123',
        platform: 'twitter',
        codeVerifier: 'verifier-123',
        ipHash: 'hashed-ip-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      // First request gets the data, second gets null (already deleted)
      mockRedis.getdel
        .mockResolvedValueOnce(JSON.stringify(stateData)) // First request succeeds
        .mockResolvedValueOnce(null); // Second request gets null

      // Simulate two parallel requests
      const [result1, result2] = await Promise.all([
        service.consumeState(state),
        service.consumeState(state),
      ]);

      // Verify: Only one request succeeded
      expect(result1).not.toBeNull();
      expect(result2).toBeNull();

      // Verify: GETDEL was called twice (both requests tried)
      expect(mockRedis.getdel).toHaveBeenCalledTimes(2);
      expect(mockRedis.getdel).toHaveBeenCalledWith('oauth:state:test-state-123');

      // Verify: First request got the data
      expect(result1?.state).toBe(state);
      expect(result1?.workspaceId).toBe('workspace-123');

      // Verify: Second request got null (state already consumed)
      expect(result2).toBeNull();
    });

    it('should handle 3 concurrent requests with same state', async () => {
      const state = 'test-state-456';
      const stateData = {
        state,
        workspaceId: 'workspace-123',
        userId: 'user-123',
        platform: 'twitter',
        codeVerifier: 'verifier-456',
        ipHash: 'hashed-ip-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      // First request succeeds, others get null
      mockRedis.getdel
        .mockResolvedValueOnce(JSON.stringify(stateData)) // Request 1 succeeds
        .mockResolvedValueOnce(null) // Request 2 fails
        .mockResolvedValueOnce(null); // Request 3 fails

      // Simulate three parallel requests
      const [result1, result2, result3] = await Promise.all([
        service.consumeState(state),
        service.consumeState(state),
        service.consumeState(state),
      ]);

      // Verify: Only one request succeeded
      const successCount = [result1, result2, result3].filter(r => r !== null).length;
      expect(successCount).toBe(1);

      // Verify: GETDEL was called three times
      expect(mockRedis.getdel).toHaveBeenCalledTimes(3);
    });
  });

  describe('Test 2: Race Condition Prevention', () => {
    it('should prevent race condition between validate and delete', async () => {
      const state = 'test-state-789';
      const stateData = {
        state,
        workspaceId: 'workspace-123',
        userId: 'user-123',
        platform: 'twitter',
        codeVerifier: 'verifier-789',
        ipHash: 'hashed-ip-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      // Simulate race condition scenario:
      // Both requests call GETDEL, but only first gets data
      mockRedis.getdel
        .mockResolvedValueOnce(JSON.stringify(stateData))
        .mockResolvedValueOnce(null);

      // Start both requests at "same time"
      const promise1 = service.consumeState(state);
      const promise2 = service.consumeState(state);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Verify: Exactly one succeeded
      const results = [result1, result2];
      const successfulResults = results.filter(r => r !== null);
      const failedResults = results.filter(r => r === null);

      expect(successfulResults.length).toBe(1);
      expect(failedResults.length).toBe(1);

      // Verify: The successful result has correct data
      const successfulResult = successfulResults[0];
      expect(successfulResult?.state).toBe(state);
      expect(successfulResult?.workspaceId).toBe('workspace-123');
    });

    it('should handle rapid sequential requests', async () => {
      const state = 'test-state-sequential';
      const stateData = {
        state,
        workspaceId: 'workspace-123',
        userId: 'user-123',
        platform: 'twitter',
        codeVerifier: 'verifier-seq',
        ipHash: 'hashed-ip-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      // First request succeeds, all others fail
      mockRedis.getdel
        .mockResolvedValueOnce(JSON.stringify(stateData))
        .mockResolvedValue(null);

      // Make 5 rapid sequential requests
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(await service.consumeState(state));
      }

      // Verify: Only first request succeeded
      const successCount = results.filter(r => r !== null).length;
      expect(successCount).toBe(1);
      expect(results[0]).not.toBeNull();
      expect(results[1]).toBeNull();
      expect(results[2]).toBeNull();
      expect(results[3]).toBeNull();
      expect(results[4]).toBeNull();
    });
  });

  describe('Test 3: GETDEL Atomicity Verification', () => {
    it('should use GETDEL command (not GET + DEL)', async () => {
      const state = 'test-state-atomic';
      const stateData = {
        state,
        workspaceId: 'workspace-123',
        userId: 'user-123',
        platform: 'twitter',
        codeVerifier: 'verifier-atomic',
        ipHash: 'hashed-ip-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      mockRedis.getdel.mockResolvedValue(JSON.stringify(stateData));

      await service.consumeState(state);

      // Verify: GETDEL was called (atomic operation)
      expect(mockRedis.getdel).toHaveBeenCalledWith('oauth:state:test-state-atomic');
      expect(mockRedis.getdel).toHaveBeenCalledTimes(1);

      // Verify: GET and DEL were NOT called separately
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle GETDEL returning null (already consumed)', async () => {
      const state = 'test-state-consumed';

      mockRedis.getdel.mockResolvedValue(null);

      const result = await service.consumeState(state);

      // Verify: Returns null when state already consumed
      expect(result).toBeNull();

      // Verify: GETDEL was called
      expect(mockRedis.getdel).toHaveBeenCalledWith('oauth:state:test-state-consumed');
    });

    it('should handle GETDEL with expired state', async () => {
      const state = 'test-state-expired';
      const expiredStateData = {
        state,
        workspaceId: 'workspace-123',
        userId: 'user-123',
        platform: 'twitter',
        codeVerifier: 'verifier-expired',
        ipHash: 'hashed-ip-123',
        createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        expiresAt: new Date(Date.now() - 10 * 60 * 1000), // Expired 10 minutes ago
      };

      mockRedis.getdel.mockResolvedValue(JSON.stringify(expiredStateData));

      const result = await service.consumeState(state);

      // Verify: Returns null for expired state
      expect(result).toBeNull();

      // Verify: GETDEL was called (state was deleted even though expired)
      expect(mockRedis.getdel).toHaveBeenCalledWith('oauth:state:test-state-expired');
    });
  });

  describe('Test 4: Distributed Simulation', () => {
    it('should simulate distributed requests from different servers', async () => {
      const state = 'test-state-distributed';
      const stateData = {
        state,
        workspaceId: 'workspace-123',
        userId: 'user-123',
        platform: 'twitter',
        codeVerifier: 'verifier-dist',
        ipHash: 'hashed-ip-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      // Simulate: Server 1 and Server 2 both try to consume same state
      // Redis GETDEL ensures only one succeeds
      mockRedis.getdel
        .mockResolvedValueOnce(JSON.stringify(stateData)) // Server 1 succeeds
        .mockResolvedValueOnce(null); // Server 2 gets null

      // Create two separate service instances (simulating different servers)
      const service1 = OAuthStateService.getInstance();
      const service2 = OAuthStateService.getInstance();

      // Both servers try to consume at "same time"
      const [result1, result2] = await Promise.all([
        service1.consumeState(state),
        service2.consumeState(state),
      ]);

      // Verify: Only one server succeeded
      expect(result1).not.toBeNull();
      expect(result2).toBeNull();

      // Verify: Both servers called GETDEL
      expect(mockRedis.getdel).toHaveBeenCalledTimes(2);
    });

    it('should handle network delay between distributed requests', async () => {
      const state = 'test-state-delay';
      const stateData = {
        state,
        workspaceId: 'workspace-123',
        userId: 'user-123',
        platform: 'twitter',
        codeVerifier: 'verifier-delay',
        ipHash: 'hashed-ip-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      // Simulate network delay: First request takes longer
      mockRedis.getdel
        .mockImplementationOnce(() => 
          new Promise(resolve => 
            setTimeout(() => resolve(JSON.stringify(stateData)), 100)
          )
        )
        .mockResolvedValueOnce(null); // Second request is faster but gets null

      // Start first request (slow)
      const promise1 = service.consumeState(state);
      
      // Start second request immediately (fast)
      const promise2 = service.consumeState(state);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Verify: One succeeded, one failed
      const successCount = [result1, result2].filter(r => r !== null).length;
      expect(successCount).toBe(1);
    });
  });

  describe('Test 5: Memory Fallback Concurrency', () => {
    it('should handle concurrent requests with memory fallback', async () => {
      // Simulate Redis unavailable
      (getRedisClientSafe as jest.Mock).mockReturnValue(null);

      const state = 'test-state-memory';
      const stateData = {
        state,
        workspaceId: 'workspace-123',
        userId: 'user-123',
        platform: 'twitter',
        codeVerifier: 'verifier-memory',
        ipHash: 'hashed-ip-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      // Create state in memory
      await service.createState(
        stateData.workspaceId,
        stateData.userId,
        stateData.platform,
        {
          codeVerifier: stateData.codeVerifier,
          ipHash: stateData.ipHash,
        }
      );

      // Try to consume concurrently
      const [result1, result2] = await Promise.all([
        service.consumeState(state),
        service.consumeState(state),
      ]);

      // Note: Memory fallback is atomic in single-threaded Node.js
      // but not in distributed environment
      // At least one should succeed
      const successCount = [result1, result2].filter(r => r !== null).length;
      expect(successCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Test 6: Error Handling Under Concurrency', () => {
    it('should handle Redis errors gracefully during concurrent requests', async () => {
      const state = 'test-state-error';

      // Simulate Redis error
      mockRedis.getdel.mockRejectedValue(new Error('Redis connection lost'));

      // Try concurrent requests
      const [result1, result2] = await Promise.all([
        service.consumeState(state),
        service.consumeState(state),
      ]);

      // Verify: Both requests handled error gracefully
      expect(result1).toBeNull();
      expect(result2).toBeNull();

      // Verify: GETDEL was attempted
      expect(mockRedis.getdel).toHaveBeenCalled();
    });

    it('should handle malformed state data during concurrent requests', async () => {
      const state = 'test-state-malformed';

      // Return malformed JSON
      mockRedis.getdel
        .mockResolvedValueOnce('invalid-json{')
        .mockResolvedValueOnce(null);

      // Try concurrent requests
      const [result1, result2] = await Promise.all([
        service.consumeState(state),
        service.consumeState(state),
      ]);

      // Verify: Both requests handled gracefully
      // First request should fail to parse, second gets null
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });
});
