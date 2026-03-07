import { GlobalRateLimitManager, PublishBudgetCheckParams } from '../GlobalRateLimitManager';
import Redis from 'ioredis';

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('GlobalRateLimitManager - Publish Budget (RFC-005)', () => {
  let manager: GlobalRateLimitManager;
  let mockRedis: jest.Mocked<Redis>;
  
  beforeEach(() => {
    // Create mock Redis client
    mockRedis = {
      script: jest.fn().mockResolvedValue('mock_sha'),
      evalsha: jest.fn(),
      eval: jest.fn(),
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
      del: jest.fn(),
      setex: jest.fn().mockResolvedValue('OK'),
    } as any;
    
    // Mock getRedisClient to return our mock
    const { getRedisClient } = require('../config/redis');
    getRedisClient.mockReturnValue(mockRedis);
    
    // Get fresh instance
    (GlobalRateLimitManager as any).instance = null;
    manager = GlobalRateLimitManager.getInstance();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('checkPublishBudget', () => {
    test('admits request when budget available', async () => {
      // Mock Lua script return: [allowed=1, reason=1 (ADMITTED), retry=0, global=1, workspace=1, platform=0]
      mockRedis.evalsha.mockResolvedValue([1, 1, 0, 1, 1, 0]);
      
      const params: PublishBudgetCheckParams = {
        workspaceId: 'ws_test',
        platform: 'twitter',
        tier: 'pro',
        correlationId: 'corr_123',
        shouldIncrement: true,
      };
      
      const result = await manager.checkPublishBudget(params);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('ADMITTED');
      expect(result.retryAfterSeconds).toBe(0);
      expect(result.budgetRemaining.global).toBe(999);
      expect(result.budgetRemaining.workspace).toBe(49);
    });
    
    test('rejects when global budget exhausted', async () => {
      // Mock Lua script return: [allowed=0, reason=3 (GLOBAL_BUDGET), retry=30, global=1000, workspace=5, platform=0]
      mockRedis.evalsha.mockResolvedValue([0, 3, 30, 1000, 5, 0]);
      
      const params: PublishBudgetCheckParams = {
        workspaceId: 'ws_test',
        platform: 'twitter',
        tier: 'pro',
        correlationId: 'corr_456',
        shouldIncrement: true,
      };
      
      const result = await manager.checkPublishBudget(params);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('GLOBAL_BUDGET');
      expect(result.retryAfterSeconds).toBe(30);
      expect(result.budgetRemaining.global).toBe(0);
      expect(result.budgetRemaining.workspace).toBe(45);
    });
    
    test('rejects when workspace budget exhausted', async () => {
      // Mock Lua script return: [allowed=0, reason=4 (WORKSPACE_BUDGET), retry=45, global=100, workspace=50, platform=0]
      mockRedis.evalsha.mockResolvedValue([0, 4, 45, 100, 50, 0]);
      
      const params: PublishBudgetCheckParams = {
        workspaceId: 'ws_test',
        platform: 'twitter',
        tier: 'pro',
        correlationId: 'corr_789',
        shouldIncrement: true,
      };
      
      const result = await manager.checkPublishBudget(params);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('WORKSPACE_BUDGET');
      expect(result.retryAfterSeconds).toBe(45);
      expect(result.budgetRemaining.workspace).toBe(0);
    });
    
    test('rejects when overload freeze active', async () => {
      // Mock Lua script return: [allowed=0, reason=2 (OVERLOAD_FREEZE), retry=60, global=0, workspace=0, platform=0]
      mockRedis.evalsha.mockResolvedValue([0, 2, 60, 0, 0, 0]);
      
      const params: PublishBudgetCheckParams = {
        workspaceId: 'ws_test',
        platform: 'twitter',
        tier: 'pro',
        correlationId: 'corr_freeze',
        shouldIncrement: true,
      };
      
      const result = await manager.checkPublishBudget(params);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('OVERLOAD_FREEZE');
      expect(result.retryAfterSeconds).toBe(60);
    });
    
    test('enforces tier limits correctly', async () => {
      mockRedis.evalsha.mockResolvedValue([1, 1, 0, 1, 1, 0]);
      
      // Free tier
      await manager.checkPublishBudget({
        workspaceId: 'ws_free',
        platform: 'twitter',
        tier: 'free',
        correlationId: 'corr_1',
        shouldIncrement: true,
      });
      
      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        expect.any(String),
        4,
        'publish:budget:global',
        'publish:budget:workspace:ws_free',
        '',
        'publish:freeze:overload',
        expect.any(String),
        '60000',
        '1000',
        '10', // free tier limit
        '0',
        expect.any(String),
        '1',
        '0'
      );
      
      // Pro tier
      await manager.checkPublishBudget({
        workspaceId: 'ws_pro',
        platform: 'twitter',
        tier: 'pro',
        correlationId: 'corr_2',
        shouldIncrement: true,
      });
      
      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        expect.any(String),
        4,
        'publish:budget:global',
        'publish:budget:workspace:ws_pro',
        '',
        'publish:freeze:overload',
        expect.any(String),
        '60000',
        '1000',
        '50', // pro tier limit
        '0',
        expect.any(String),
        '1',
        '0'
      );
      
      // Enterprise tier
      await manager.checkPublishBudget({
        workspaceId: 'ws_enterprise',
        platform: 'twitter',
        tier: 'enterprise',
        correlationId: 'corr_3',
        shouldIncrement: true,
      });
      
      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        expect.any(String),
        4,
        'publish:budget:global',
        'publish:budget:workspace:ws_enterprise',
        '',
        'publish:freeze:overload',
        expect.any(String),
        '60000',
        '1000',
        '200', // enterprise tier limit
        '0',
        expect.any(String),
        '1',
        '0'
      );
    });
    
    test('passes shouldIncrement flag correctly', async () => {
      mockRedis.evalsha.mockResolvedValue([1, 1, 0, 0, 0, 0]);
      
      // shouldIncrement = true
      await manager.checkPublishBudget({
        workspaceId: 'ws_test',
        platform: 'twitter',
        tier: 'pro',
        correlationId: 'corr_1',
        shouldIncrement: true,
      });
      
      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        expect.any(String),
        4,
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        '1', // shouldIncrement = 1
        expect.any(String)
      );
      
      // shouldIncrement = false
      await manager.checkPublishBudget({
        workspaceId: 'ws_test',
        platform: 'twitter',
        tier: 'pro',
        correlationId: 'corr_2',
        shouldIncrement: false,
      });
      
      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        expect.any(String),
        4,
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        '0', // shouldIncrement = 0
        expect.any(String)
      );
    });
    
    test('fails open when Redis unavailable', async () => {
      mockRedis.evalsha.mockRejectedValue(new Error('Redis connection failed'));
      
      const params: PublishBudgetCheckParams = {
        workspaceId: 'ws_test',
        platform: 'twitter',
        tier: 'pro',
        correlationId: 'corr_error',
        shouldIncrement: true,
      };
      
      const result = await manager.checkPublishBudget(params);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('ADMITTED');
      expect(result.retryAfterSeconds).toBe(0);
    });
    
    test('falls back to EVAL when EVALSHA fails with NOSCRIPT', async () => {
      // First call fails with NOSCRIPT
      mockRedis.evalsha.mockRejectedValueOnce(new Error('NOSCRIPT No matching script'));
      
      // Fallback EVAL succeeds
      mockRedis.eval.mockResolvedValue([1, 1, 0, 1, 1, 0]);
      
      const params: PublishBudgetCheckParams = {
        workspaceId: 'ws_test',
        platform: 'twitter',
        tier: 'pro',
        correlationId: 'corr_noscript',
        shouldIncrement: true,
      };
      
      const result = await manager.checkPublishBudget(params);
      
      expect(result.allowed).toBe(true);
      expect(mockRedis.eval).toHaveBeenCalled();
    });
    
    test('tracks global budget exhaustion', async () => {
      mockRedis.evalsha.mockResolvedValue([0, 3, 30, 1000, 5, 0]);
      
      const params: PublishBudgetCheckParams = {
        workspaceId: 'ws_test',
        platform: 'twitter',
        tier: 'pro',
        correlationId: 'corr_exhaustion',
        shouldIncrement: true,
      };
      
      await manager.checkPublishBudget(params);
      
      // Should set exhaustion tracking key
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^publish:budget:global:exhausted:\d+$/),
        120,
        '1'
      );
    });
  });
  
  describe('incrementPublishCounters', () => {
    test('calls checkPublishBudget with shouldIncrement=true', async () => {
      mockRedis.evalsha.mockResolvedValue([1, 1, 0, 1, 1, 0]);
      
      const params = {
        workspaceId: 'ws_test',
        platform: 'twitter' as const,
        tier: 'pro' as const,
        correlationId: 'corr_increment',
      };
      
      const result = await manager.incrementPublishCounters(params);
      
      expect(result.allowed).toBe(true);
      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        expect.any(String),
        4,
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        '1', // shouldIncrement = 1
        expect.any(String)
      );
    });
  });
  
  describe('Workspace Isolation', () => {
    test('different workspaces have independent budgets', async () => {
      mockRedis.evalsha.mockResolvedValue([1, 1, 0, 1, 1, 0]);
      
      await manager.checkPublishBudget({
        workspaceId: 'ws_1',
        platform: 'twitter',
        tier: 'pro',
        correlationId: 'corr_1',
        shouldIncrement: true,
      });
      
      await manager.checkPublishBudget({
        workspaceId: 'ws_2',
        platform: 'twitter',
        tier: 'pro',
        correlationId: 'corr_2',
        shouldIncrement: true,
      });
      
      // Should use different workspace keys
      expect(mockRedis.evalsha).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        4,
        'publish:budget:global',
        'publish:budget:workspace:ws_1',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
      
      expect(mockRedis.evalsha).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        4,
        'publish:budget:global',
        'publish:budget:workspace:ws_2',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
    });
  });
});
