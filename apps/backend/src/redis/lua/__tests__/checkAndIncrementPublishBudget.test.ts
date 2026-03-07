import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

describe('checkAndIncrementPublishBudget Lua Script', () => {
  let redis: Redis;
  let luaScript: string;
  
  const REASON_ADMITTED = 1;
  const REASON_OVERLOAD_FREEZE = 2;
  const REASON_GLOBAL_BUDGET = 3;
  const REASON_WORKSPACE_BUDGET = 4;
  const REASON_PLATFORM_BUDGET = 5;
  
  beforeAll(() => {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: parseInt(process.env.REDIS_TEST_DB || '15', 10),
    });
    
    const scriptPath = path.join(__dirname, '../checkAndIncrementPublishBudget.lua');
    luaScript = fs.readFileSync(scriptPath, 'utf8');
  });
  
  afterAll(async () => {
    await redis.quit();
  });
  
  beforeEach(async () => {
    await redis.flushdb();
  });
  
  const executeScript = async (
    globalKey: string,
    workspaceKey: string,
    platformKey: string,
    freezeKey: string,
    currentTs: number,
    globalWindow: number,
    globalLimit: number,
    workspaceLimit: number,
    platformLimit: number,
    memberId: string,
    shouldIncrement: number,
    platformWindow: number
  ): Promise<number[]> => {
    const result = await redis.eval(
      luaScript,
      4,
      globalKey,
      workspaceKey,
      platformKey,
      freezeKey,
      currentTs,
      globalWindow,
      globalLimit,
      workspaceLimit,
      platformLimit,
      memberId,
      shouldIncrement,
      platformWindow
    );
    
    return result as number[];
  };
  
  describe('Global Budget Enforcement', () => {
    test('admits request when global budget available', async () => {
      const now = Date.now();
      const result = await executeScript(
        'test:global',
        'test:workspace:ws1',
        '',
        'test:freeze',
        now,
        60000,
        1000,
        50,
        0,
        `${now}:corr1`,
        1,
        0
      );
      
      expect(result[0]).toBe(1); // allowed
      expect(result[1]).toBe(REASON_ADMITTED);
      expect(result[2]).toBe(0); // retry_after
      expect(result[3]).toBe(1); // global_count
      expect(result[4]).toBe(1); // workspace_count
    });
    
    test('rejects when global budget exhausted', async () => {
      const now = Date.now();
      const globalKey = 'test:global';
      const workspaceKey = 'test:workspace:ws1';
      
      // Fill global budget to limit
      for (let i = 0; i < 10; i++) {
        await executeScript(
          globalKey,
          workspaceKey,
          '',
          'test:freeze',
          now + i,
          60000,
          10,
          50,
          0,
          `${now + i}:corr${i}`,
          1,
          0
        );
      }
      
      // Next request should be rejected
      const result = await executeScript(
        globalKey,
        workspaceKey,
        '',
        'test:freeze',
        now + 100,
        60000,
        10,
        50,
        0,
        `${now + 100}:corr11`,
        1,
        0
      );
      
      expect(result[0]).toBe(0); // not allowed
      expect(result[1]).toBe(REASON_GLOBAL_BUDGET);
      expect(result[2]).toBeGreaterThan(0); // retry_after
      expect(result[3]).toBe(10); // global_count
    });
    
    test('returns correct retry-after on global exhaustion', async () => {
      const now = Date.now();
      const globalKey = 'test:global';
      
      // Add entry at specific timestamp
      await redis.zadd(globalKey, now, `${now}:oldest`);
      
      // Fill to limit
      for (let i = 1; i < 10; i++) {
        await redis.zadd(globalKey, now + i * 1000, `${now + i * 1000}:corr${i}`);
      }
      
      // Check 30 seconds later
      const checkTime = now + 30000;
      const result = await executeScript(
        globalKey,
        'test:workspace:ws1',
        '',
        'test:freeze',
        checkTime,
        60000,
        10,
        50,
        0,
        `${checkTime}:corr`,
        1,
        0
      );
      
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(REASON_GLOBAL_BUDGET);
      
      // retry_after should be approximately 30 seconds (with jitter ±10%)
      expect(result[2]).toBeGreaterThanOrEqual(27);
      expect(result[2]).toBeLessThanOrEqual(33);
    });
  });
  
  describe('Workspace Budget Isolation', () => {
    test('enforces per-workspace limits independently', async () => {
      const now = Date.now();
      const globalKey = 'test:global';
      
      // Workspace 1: fill to limit (5)
      for (let i = 0; i < 5; i++) {
        const result = await executeScript(
          globalKey,
          'test:workspace:ws1',
          '',
          'test:freeze',
          now + i,
          60000,
          1000,
          5,
          0,
          `${now + i}:ws1_corr${i}`,
          1,
          0
        );
        expect(result[0]).toBe(1);
      }
      
      // Workspace 1: next request rejected
      const ws1Result = await executeScript(
        globalKey,
        'test:workspace:ws1',
        '',
        'test:freeze',
        now + 100,
        60000,
        1000,
        5,
        0,
        `${now + 100}:ws1_corr6`,
        1,
        0
      );
      expect(ws1Result[0]).toBe(0);
      expect(ws1Result[1]).toBe(REASON_WORKSPACE_BUDGET);
      
      // Workspace 2: still has budget
      const ws2Result = await executeScript(
        globalKey,
        'test:workspace:ws2',
        '',
        'test:freeze',
        now + 200,
        60000,
        1000,
        5,
        0,
        `${now + 200}:ws2_corr1`,
        1,
        0
      );
      expect(ws2Result[0]).toBe(1);
      expect(ws2Result[1]).toBe(REASON_ADMITTED);
    });
    
    test('workspace budget does not affect other workspaces', async () => {
      const now = Date.now();
      
      // Exhaust workspace 1
      for (let i = 0; i < 10; i++) {
        await executeScript(
          'test:global',
          'test:workspace:ws1',
          '',
          'test:freeze',
          now + i,
          60000,
          1000,
          10,
          0,
          `${now + i}:ws1_${i}`,
          1,
          0
        );
      }
      
      // Workspace 2 should be unaffected
      for (let i = 0; i < 10; i++) {
        const result = await executeScript(
          'test:global',
          'test:workspace:ws2',
          '',
          'test:freeze',
          now + 1000 + i,
          60000,
          1000,
          10,
          0,
          `${now + 1000 + i}:ws2_${i}`,
          1,
          0
        );
        expect(result[0]).toBe(1);
      }
    });
  });
  
  describe('Platform Budget (Optional)', () => {
    test('admits when platform budget disabled', async () => {
      const now = Date.now();
      const result = await executeScript(
        'test:global',
        'test:workspace:ws1',
        '',
        'test:freeze',
        now,
        60000,
        1000,
        50,
        0, // platform_limit = 0 (disabled)
        `${now}:corr1`,
        1,
        0
      );
      
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(REASON_ADMITTED);
      expect(result[5]).toBe(0); // platform_count = 0
    });
    
    test('enforces platform budget when enabled', async () => {
      const now = Date.now();
      const platformKey = 'test:platform:twitter';
      
      // Fill platform budget to limit
      for (let i = 0; i < 5; i++) {
        await executeScript(
          'test:global',
          'test:workspace:ws1',
          platformKey,
          'test:freeze',
          now + i,
          60000,
          1000,
          50,
          5, // platform_limit = 5
          `${now + i}:corr${i}`,
          1,
          60000
        );
      }
      
      // Next request should be rejected
      const result = await executeScript(
        'test:global',
        'test:workspace:ws1',
        platformKey,
        'test:freeze',
        now + 100,
        60000,
        1000,
        50,
        5,
        `${now + 100}:corr6`,
        1,
        60000
      );
      
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(REASON_PLATFORM_BUDGET);
      expect(result[5]).toBe(5); // platform_count
    });
    
    test('platform budget independent of workspace budget', async () => {
      const now = Date.now();
      
      // Exhaust platform budget
      for (let i = 0; i < 3; i++) {
        await executeScript(
          'test:global',
          'test:workspace:ws1',
          'test:platform:twitter',
          'test:freeze',
          now + i,
          60000,
          1000,
          50,
          3,
          `${now + i}:corr${i}`,
          1,
          60000
        );
      }
      
      // Different platform should work
      const result = await executeScript(
        'test:global',
        'test:workspace:ws1',
        'test:platform:linkedin',
        'test:freeze',
        now + 100,
        60000,
        1000,
        50,
        3,
        `${now + 100}:corr_linkedin`,
        1,
        60000
      );
      
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(REASON_ADMITTED);
    });
  });
  
  describe('Sliding Window Expiry', () => {
    test('entries expire after window duration', async () => {
      const now = Date.now();
      const globalKey = 'test:global';
      const workspaceKey = 'test:workspace:ws1';
      
      // Add entries at T=0
      for (let i = 0; i < 10; i++) {
        await executeScript(
          globalKey,
          workspaceKey,
          '',
          'test:freeze',
          now + i,
          60000,
          10,
          10,
          0,
          `${now + i}:corr${i}`,
          1,
          0
        );
      }
      
      // At T=0, budget exhausted
      let result = await executeScript(
        globalKey,
        workspaceKey,
        '',
        'test:freeze',
        now + 100,
        60000,
        10,
        10,
        0,
        `${now + 100}:corr_check1`,
        0, // don't increment
        0
      );
      expect(result[0]).toBe(0);
      expect(result[3]).toBe(10);
      
      // At T=60s, entries expired
      result = await executeScript(
        globalKey,
        workspaceKey,
        '',
        'test:freeze',
        now + 60000,
        60000,
        10,
        10,
        0,
        `${now + 60000}:corr_check2`,
        0,
        0
      );
      expect(result[0]).toBe(1);
      expect(result[3]).toBe(0); // all expired
    });
    
    test('partial window expiration', async () => {
      const now = Date.now();
      const globalKey = 'test:global';
      
      // Add 5 entries at T=0
      for (let i = 0; i < 5; i++) {
        await redis.zadd(globalKey, now + i, `${now + i}:batch1_${i}`);
      }
      
      // Add 5 entries at T=30s
      for (let i = 0; i < 5; i++) {
        await redis.zadd(globalKey, now + 30000 + i, `${now + 30000 + i}:batch2_${i}`);
      }
      
      // Check at T=60s (first batch expired, second batch still valid)
      const result = await executeScript(
        globalKey,
        'test:workspace:ws1',
        '',
        'test:freeze',
        now + 60000,
        60000,
        10,
        10,
        0,
        `${now + 60000}:corr`,
        0,
        0
      );
      
      expect(result[3]).toBe(5); // only second batch remains
    });
  });
  
  describe('No Double Increment', () => {
    test('should_increment=0 does not modify counters', async () => {
      const now = Date.now();
      const globalKey = 'test:global';
      const workspaceKey = 'test:workspace:ws1';
      
      // Check without increment
      const result1 = await executeScript(
        globalKey,
        workspaceKey,
        '',
        'test:freeze',
        now,
        60000,
        10,
        10,
        0,
        `${now}:corr1`,
        0, // don't increment
        0
      );
      
      expect(result1[0]).toBe(1);
      expect(result1[3]).toBe(0); // global_count = 0
      expect(result1[4]).toBe(0); // workspace_count = 0
      
      // Check again, counts should still be 0
      const result2 = await executeScript(
        globalKey,
        workspaceKey,
        '',
        'test:freeze',
        now + 100,
        60000,
        10,
        10,
        0,
        `${now + 100}:corr2`,
        0,
        0
      );
      
      expect(result2[3]).toBe(0);
      expect(result2[4]).toBe(0);
    });
    
    test('should_increment=1 increments counters', async () => {
      const now = Date.now();
      const globalKey = 'test:global';
      const workspaceKey = 'test:workspace:ws1';
      
      // Increment
      const result1 = await executeScript(
        globalKey,
        workspaceKey,
        '',
        'test:freeze',
        now,
        60000,
        10,
        10,
        0,
        `${now}:corr1`,
        1, // increment
        0
      );
      
      expect(result1[0]).toBe(1);
      expect(result1[3]).toBe(1); // global_count = 1
      expect(result1[4]).toBe(1); // workspace_count = 1
      
      // Check without increment
      const result2 = await executeScript(
        globalKey,
        workspaceKey,
        '',
        'test:freeze',
        now + 100,
        60000,
        10,
        10,
        0,
        `${now + 100}:corr2`,
        0, // don't increment
        0
      );
      
      expect(result2[3]).toBe(1); // still 1
      expect(result2[4]).toBe(1);
    });
  });
  
  describe('Correlation ID Uniqueness', () => {
    test('different correlation IDs create separate entries', async () => {
      const now = Date.now();
      const globalKey = 'test:global';
      
      // Add 3 entries with different correlation IDs
      await executeScript(
        globalKey,
        'test:workspace:ws1',
        '',
        'test:freeze',
        now,
        60000,
        10,
        10,
        0,
        `${now}:corr1`,
        1,
        0
      );
      
      await executeScript(
        globalKey,
        'test:workspace:ws1',
        '',
        'test:freeze',
        now + 1,
        60000,
        10,
        10,
        0,
        `${now + 1}:corr2`,
        1,
        0
      );
      
      await executeScript(
        globalKey,
        'test:workspace:ws1',
        '',
        'test:freeze',
        now + 2,
        60000,
        10,
        10,
        0,
        `${now + 2}:corr3`,
        1,
        0
      );
      
      // Check count
      const count = await redis.zcard(globalKey);
      expect(count).toBe(3);
    });
    
    test('same correlation ID at different timestamps creates separate entries', async () => {
      const now = Date.now();
      const globalKey = 'test:global';
      
      // Same correlation ID but different timestamps
      await executeScript(
        globalKey,
        'test:workspace:ws1',
        '',
        'test:freeze',
        now,
        60000,
        10,
        10,
        0,
        `${now}:same_corr`,
        1,
        0
      );
      
      await executeScript(
        globalKey,
        'test:workspace:ws1',
        '',
        'test:freeze',
        now + 1000,
        60000,
        10,
        10,
        0,
        `${now + 1000}:same_corr`,
        1,
        0
      );
      
      // Should have 2 entries (member_id includes timestamp)
      const count = await redis.zcard(globalKey);
      expect(count).toBe(2);
    });
  });
  
  describe('Overload Freeze Override', () => {
    test('rejects all requests when freeze key exists', async () => {
      const now = Date.now();
      const freezeKey = 'test:freeze';
      
      // Set freeze key with 60s TTL
      await redis.setex(freezeKey, 60, '1');
      
      // Request should be rejected
      const result = await executeScript(
        'test:global',
        'test:workspace:ws1',
        '',
        freezeKey,
        now,
        60000,
        1000,
        50,
        0,
        `${now}:corr1`,
        1,
        0
      );
      
      expect(result[0]).toBe(0); // not allowed
      expect(result[1]).toBe(REASON_OVERLOAD_FREEZE);
      expect(result[2]).toBeGreaterThan(0); // retry_after = TTL
      expect(result[2]).toBeLessThanOrEqual(60);
    });
    
    test('admits requests when freeze key does not exist', async () => {
      const now = Date.now();
      
      const result = await executeScript(
        'test:global',
        'test:workspace:ws1',
        '',
        'test:freeze',
        now,
        60000,
        1000,
        50,
        0,
        `${now}:corr1`,
        1,
        0
      );
      
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(REASON_ADMITTED);
    });
    
    test('freeze check happens before budget checks', async () => {
      const now = Date.now();
      const globalKey = 'test:global';
      const freezeKey = 'test:freeze';
      
      // Exhaust global budget
      for (let i = 0; i < 10; i++) {
        await redis.zadd(globalKey, now + i, `${now + i}:corr${i}`);
      }
      
      // Set freeze key
      await redis.setex(freezeKey, 60, '1');
      
      // Should return freeze rejection, not budget rejection
      const result = await executeScript(
        globalKey,
        'test:workspace:ws1',
        '',
        freezeKey,
        now + 100,
        60000,
        10,
        50,
        0,
        `${now + 100}:corr`,
        1,
        0
      );
      
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(REASON_OVERLOAD_FREEZE); // not GLOBAL_BUDGET
    });
  });
  
  describe('Key Expiration', () => {
    test('sets expiration on budget keys after increment', async () => {
      const now = Date.now();
      const globalKey = 'test:global';
      const workspaceKey = 'test:workspace:ws1';
      
      await executeScript(
        globalKey,
        workspaceKey,
        '',
        'test:freeze',
        now,
        60000,
        10,
        10,
        0,
        `${now}:corr1`,
        1,
        0
      );
      
      // Check TTL (should be 2x window = 120 seconds)
      const globalTtl = await redis.ttl(globalKey);
      const workspaceTtl = await redis.ttl(workspaceKey);
      
      expect(globalTtl).toBeGreaterThan(100);
      expect(globalTtl).toBeLessThanOrEqual(120);
      expect(workspaceTtl).toBeGreaterThan(100);
      expect(workspaceTtl).toBeLessThanOrEqual(120);
    });
  });
});
