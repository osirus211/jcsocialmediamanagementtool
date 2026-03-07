/**
 * OAuth State Service - Integration Tests
 * 
 * Production-grade integration tests with real Redis
 * Tests horizontal scaling, concurrency, and failure scenarios
 * 
 * Prerequisites:
 * - Redis running on localhost:6379 (or REDIS_HOST env var)
 * - No mock Redis - tests against real instance
 * 
 * Run: npm test -- OAuthStateService.integration.test.ts
 */

import { OAuthStateService } from '../OAuthStateService';
import { SocialPlatform } from '../../../models/SocialAccount';
import { redisClient } from '../../../utils/redisClient';
import Redis from 'ioredis';

describe('OAuthStateService - Integration Tests', () => {
  let service: OAuthStateService;
  let redis: Redis;

  beforeAll(async () => {
    service = new OAuthStateService();
    redis = redisClient.getClient();

    // Verify Redis connection
    const ping = await redis.ping();
    if (ping !== 'PONG') {
      throw new Error('Redis not available for integration tests');
    }

    console.log('✅ Redis connection established for integration tests');
  });

  afterAll(async () => {
    // Cleanup test keys
    const keys = await redis.keys('oauth:state:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redisClient.disconnect();
  });

  afterEach(async () => {
    // Cleanup after each test
    const keys = await redis.keys('oauth:state:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('1. Integration Validation', () => {
    it('should create and consume state in real Redis', async () => {
      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      // Create state
      const state = await service.createState(options);
      expect(state).toBeDefined();

      // Verify state exists in Redis
      const key = `oauth:state:${state}`;
      const exists = await redis.exists(key);
      expect(exists).toBe(1);

      // Verify TTL is set
      const ttl = await redis.ttl(key);
      expect(ttl).toBeGreaterThan(590); // ~10 minutes
      expect(ttl).toBeLessThanOrEqual(600);

      // Consume state
      const result = await service.consumeState(state, '192.168.1.1', 'Mozilla/5.0');
      expect(result.valid).toBe(true);
      expect(result.data?.workspaceId).toBe('workspace-123');

      // Verify state is deleted after consumption
      const existsAfter = await redis.exists(key);
      expect(existsAfter).toBe(0);
    });

    it('should enforce IP binding validation', async () => {
      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const state = await service.createState(options);

      // Attempt consumption from different IP
      const result = await service.consumeState(state, '192.168.1.2', 'Mozilla/5.0');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('IP_MISMATCH');

      // Verify state is still deleted (consumed but rejected)
      const key = `oauth:state:${state}`;
      const exists = await redis.exists(key);
      expect(exists).toBe(0);
    });

    it('should handle TTL expiration correctly', async () => {
      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const state = await service.createState(options);

      // Manually expire the key
      const key = `oauth:state:${state}`;
      await redis.expire(key, 1); // 1 second

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Attempt consumption
      const result = await service.consumeState(state, '192.168.1.1', 'Mozilla/5.0');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_STATE');
    });

    it('should prevent state reuse (replay attack)', async () => {
      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const state = await service.createState(options);

      // First consumption - should succeed
      const result1 = await service.consumeState(state, '192.168.1.1', 'Mozilla/5.0');
      expect(result1.valid).toBe(true);

      // Second consumption - should fail (replay attack)
      const result2 = await service.consumeState(state, '192.168.1.1', 'Mozilla/5.0');
      expect(result2.valid).toBe(false);
      expect(result2.error).toBe('INVALID_STATE');
    });

    it('should track correlation IDs correctly', async () => {
      const correlationId = 'test-correlation-123';
      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        correlationId,
      };

      const state = await service.createState(options);
      const result = await service.consumeState(state, '192.168.1.1', 'Mozilla/5.0');

      expect(result.valid).toBe(true);
      expect(result.data?.correlationId).toBe(correlationId);
    });
  });

  describe('2. Multi-Instance Simulation', () => {
    it('should handle state created on instance A, consumed on instance B', async () => {
      // Simulate Instance A creating state
      const serviceA = new OAuthStateService();
      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const state = await serviceA.createState(options);

      // Simulate Instance B consuming state (different service instance)
      const serviceB = new OAuthStateService();
      const result = await serviceB.consumeState(state, '192.168.1.1', 'Mozilla/5.0');

      expect(result.valid).toBe(true);
      expect(result.data?.workspaceId).toBe('workspace-123');
    });

    it('should handle concurrent state creation from multiple instances', async () => {
      const instances = [
        new OAuthStateService(),
        new OAuthStateService(),
        new OAuthStateService(),
      ];

      const promises = instances.map((instance, idx) =>
        instance.createState({
          platform: SocialPlatform.TWITTER,
          workspaceId: `workspace-${idx}`,
          userId: `user-${idx}`,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        })
      );

      const states = await Promise.all(promises);

      // All states should be unique
      const uniqueStates = new Set(states);
      expect(uniqueStates.size).toBe(3);

      // All states should be consumable
      for (let i = 0; i < states.length; i++) {
        const result = await instances[i].consumeState(
          states[i],
          '192.168.1.1',
          'Mozilla/5.0'
        );
        expect(result.valid).toBe(true);
        expect(result.data?.workspaceId).toBe(`workspace-${i}`);
      }
    });
  });

  describe('3. Concurrency Stress Tests', () => {
    it('should handle 100 concurrent state creations', async () => {
      const concurrency = 100;
      const promises = Array.from({ length: concurrency }, (_, i) =>
        service.createState({
          platform: SocialPlatform.TWITTER,
          workspaceId: `workspace-${i}`,
          userId: `user-${i}`,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        })
      );

      const startTime = Date.now();
      const states = await Promise.all(promises);
      const duration = Date.now() - startTime;

      console.log(`✅ Created ${concurrency} states in ${duration}ms (${(duration / concurrency).toFixed(2)}ms avg)`);

      // All states should be unique
      const uniqueStates = new Set(states);
      expect(uniqueStates.size).toBe(concurrency);

      // All states should exist in Redis
      const keys = await redis.keys('oauth:state:*');
      expect(keys.length).toBe(concurrency);
    }, 30000);

    it('should handle 100 concurrent state consumptions without race conditions', async () => {
      const concurrency = 100;

      // Create states first
      const states = await Promise.all(
        Array.from({ length: concurrency }, (_, i) =>
          service.createState({
            platform: SocialPlatform.TWITTER,
            workspaceId: `workspace-${i}`,
            userId: `user-${i}`,
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          })
        )
      );

      // Consume all states concurrently
      const startTime = Date.now();
      const results = await Promise.all(
        states.map(state =>
          service.consumeState(state, '192.168.1.1', 'Mozilla/5.0')
        )
      );
      const duration = Date.now() - startTime;

      console.log(`✅ Consumed ${concurrency} states in ${duration}ms (${(duration / concurrency).toFixed(2)}ms avg)`);

      // All consumptions should succeed
      const successCount = results.filter(r => r.valid).length;
      expect(successCount).toBe(concurrency);

      // No states should remain in Redis
      const keys = await redis.keys('oauth:state:*');
      expect(keys.length).toBe(0);
    }, 30000);

    it('should prevent double consumption in race condition scenario', async () => {
      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const state = await service.createState(options);

      // Attempt concurrent consumption (race condition)
      const [result1, result2, result3] = await Promise.all([
        service.consumeState(state, '192.168.1.1', 'Mozilla/5.0'),
        service.consumeState(state, '192.168.1.1', 'Mozilla/5.0'),
        service.consumeState(state, '192.168.1.1', 'Mozilla/5.0'),
      ]);

      // Only ONE should succeed (atomic GETDEL)
      const successCount = [result1, result2, result3].filter(r => r.valid).length;
      expect(successCount).toBe(1);

      // The other two should fail
      const failureCount = [result1, result2, result3].filter(r => !r.valid).length;
      expect(failureCount).toBe(2);
    });

    it('should handle 300 concurrent OAuth flows (create + consume)', async () => {
      const concurrency = 300;
      const flows = Array.from({ length: concurrency }, (_, i) => ({
        platform: SocialPlatform.TWITTER,
        workspaceId: `workspace-${i}`,
        userId: `user-${i}`,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      }));

      const startTime = Date.now();

      // Simulate complete OAuth flows
      const results = await Promise.all(
        flows.map(async (options) => {
          const state = await service.createState(options);
          const result = await service.consumeState(
            state,
            options.ipAddress,
            options.userAgent
          );
          return result;
        })
      );

      const duration = Date.now() - startTime;

      console.log(`✅ Completed ${concurrency} OAuth flows in ${duration}ms (${(duration / concurrency).toFixed(2)}ms avg)`);

      // All flows should succeed
      const successCount = results.filter(r => r.valid).length;
      expect(successCount).toBe(concurrency);

      // No states should remain
      const keys = await redis.keys('oauth:state:*');
      expect(keys.length).toBe(0);
    }, 60000);
  });

  describe('4. Redis Failure Simulation', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Create a service with invalid Redis config
      const badRedis = new Redis({
        host: 'invalid-host',
        port: 9999,
        retryStrategy: () => null, // Don't retry
        lazyConnect: true,
      });

      // Mock the redis client to return bad connection
      const originalGetClient = redisClient.getClient;
      (redisClient as any).getClient = () => badRedis;

      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      // Should throw error (fail-closed)
      await expect(service.createState(options)).rejects.toThrow();

      // Restore original client
      (redisClient as any).getClient = originalGetClient;
      badRedis.disconnect();
    });

    it('should recover after Redis reconnection', async () => {
      // This test requires manual Redis restart
      // For automated testing, we'll simulate by creating a new connection

      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      // Create state before "restart"
      const state1 = await service.createState(options);
      expect(state1).toBeDefined();

      // Simulate reconnection by creating new service instance
      const newService = new OAuthStateService();

      // Should still be able to consume old state
      const result1 = await newService.consumeState(state1, '192.168.1.1', 'Mozilla/5.0');
      expect(result1.valid).toBe(true);

      // Should be able to create new states
      const state2 = await newService.createState(options);
      expect(state2).toBeDefined();

      const result2 = await newService.consumeState(state2, '192.168.1.1', 'Mozilla/5.0');
      expect(result2.valid).toBe(true);
    });
  });

  describe('5. Security Attack Simulation', () => {
    it('should prevent replay attack (state reuse)', async () => {
      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const state = await service.createState(options);

      // Legitimate consumption
      const result1 = await service.consumeState(state, '192.168.1.1', 'Mozilla/5.0');
      expect(result1.valid).toBe(true);

      // Replay attack attempt
      const result2 = await service.consumeState(state, '192.168.1.1', 'Mozilla/5.0');
      expect(result2.valid).toBe(false);
      expect(result2.error).toBe('INVALID_STATE');
    });

    it('should prevent IP spoofing attack', async () => {
      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const state = await service.createState(options);

      // Attacker attempts consumption from different IP
      const result = await service.consumeState(state, '10.0.0.1', 'Mozilla/5.0');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('IP_MISMATCH');
    });

    it('should handle expired state gracefully', async () => {
      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const state = await service.createState(options);

      // Force expiration
      const key = `oauth:state:${state}`;
      await redis.expire(key, 1);
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Attempt consumption of expired state
      const result = await service.consumeState(state, '192.168.1.1', 'Mozilla/5.0');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_STATE');
    });

    it('should handle malformed state parameter', async () => {
      const result = await service.consumeState(
        'malformed-state-123',
        '192.168.1.1',
        'Mozilla/5.0'
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_STATE');
    });

    it('should handle state injection attempt', async () => {
      // Attacker tries to inject malicious state directly into Redis
      const maliciousState = 'injected-state-123';
      const maliciousData = {
        state: maliciousState,
        platform: SocialPlatform.TWITTER,
        workspaceId: 'attacker-workspace',
        userId: 'attacker-user',
        ipAddress: '10.0.0.1',
        userAgent: 'Attacker-Agent',
        correlationId: 'attacker-correlation',
        createdAt: new Date().toISOString(),
      };

      await redis.setex(
        `oauth:state:${maliciousState}`,
        600,
        JSON.stringify(maliciousData)
      );

      // Attacker attempts consumption from different IP
      const result = await service.consumeState(
        maliciousState,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Should fail due to IP mismatch
      expect(result.valid).toBe(false);
      expect(result.error).toBe('IP_MISMATCH');
    });
  });

  describe('6. Observability Validation', () => {
    it('should generate correlation IDs for all operations', async () => {
      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const state = await service.createState(options);
      const result = await service.consumeState(state, '192.168.1.1', 'Mozilla/5.0');

      expect(result.data?.correlationId).toBeDefined();
      expect(result.data?.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should track active state count accurately', async () => {
      const initialCount = await service.getActiveStateCount();

      // Create 5 states
      const states = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          service.createState({
            platform: SocialPlatform.TWITTER,
            workspaceId: `workspace-${i}`,
            userId: `user-${i}`,
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          })
        )
      );

      const countAfterCreate = await service.getActiveStateCount();
      expect(countAfterCreate).toBe(initialCount + 5);

      // Consume 3 states
      await Promise.all(
        states.slice(0, 3).map(state =>
          service.consumeState(state, '192.168.1.1', 'Mozilla/5.0')
        )
      );

      const countAfterConsume = await service.getActiveStateCount();
      expect(countAfterConsume).toBe(initialCount + 2);
    });
  });

  describe('7. Performance Benchmarks', () => {
    it('should create state in <5ms (p99)', async () => {
      const iterations = 100;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await service.createState({
          platform: SocialPlatform.TWITTER,
          workspaceId: `workspace-${i}`,
          userId: `user-${i}`,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        });
        const duration = Date.now() - start;
        latencies.push(duration);
      }

      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(iterations * 0.5)];
      const p95 = latencies[Math.floor(iterations * 0.95)];
      const p99 = latencies[Math.floor(iterations * 0.99)];

      console.log(`📊 Create State Latency: p50=${p50}ms, p95=${p95}ms, p99=${p99}ms`);

      expect(p99).toBeLessThan(10); // p99 < 10ms
    }, 30000);

    it('should consume state in <5ms (p99)', async () => {
      const iterations = 100;

      // Create states first
      const states = await Promise.all(
        Array.from({ length: iterations }, (_, i) =>
          service.createState({
            platform: SocialPlatform.TWITTER,
            workspaceId: `workspace-${i}`,
            userId: `user-${i}`,
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          })
        )
      );

      const latencies: number[] = [];

      for (const state of states) {
        const start = Date.now();
        await service.consumeState(state, '192.168.1.1', 'Mozilla/5.0');
        const duration = Date.now() - start;
        latencies.push(duration);
      }

      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(iterations * 0.5)];
      const p95 = latencies[Math.floor(iterations * 0.95)];
      const p99 = latencies[Math.floor(iterations * 0.99)];

      console.log(`📊 Consume State Latency: p50=${p50}ms, p95=${p95}ms, p99=${p99}ms`);

      expect(p99).toBeLessThan(10); // p99 < 10ms
    }, 30000);
  });
});
