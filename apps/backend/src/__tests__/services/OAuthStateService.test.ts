import { OAuthStateService } from '../../services/OAuthStateService';
import * as redisConfig from '../../config/redis';

// Mock Redis
jest.mock('../../config/redis', () => ({
  getRedisClientSafe: jest.fn(),
  recordCircuitBreakerSuccess: jest.fn(),
  recordCircuitBreakerError: jest.fn(),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('OAuthStateService', () => {
  let oauthStateService: OAuthStateService;
  let mockRedis: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock Redis client
    mockRedis = {
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };

    // Mock Redis client to return our mock
    (redisConfig.getRedisClientSafe as jest.Mock).mockReturnValue(mockRedis);

    // Create fresh instance
    oauthStateService = OAuthStateService.getInstance();
  });

  afterEach(() => {
    oauthStateService.shutdown();
  });

  describe('createState', () => {
    it('should create OAuth state with workspaceId', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const state = await oauthStateService.createState(
        'workspace123',
        'user456',
        'twitter',
        {
          redirectUri: 'https://example.com/callback',
          codeVerifier: 'verifier123',
        }
      );

      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(20);

      // Verify Redis was called
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('oauth:state:'),
        600, // 10 minutes
        expect.stringContaining('workspace123')
      );
    });

    it('should fallback to in-memory when Redis unavailable', async () => {
      (redisConfig.getRedisClientSafe as jest.Mock).mockReturnValue(null);

      const state = await oauthStateService.createState(
        'workspace123',
        'user456',
        'twitter'
      );

      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis connection failed'));

      const state = await oauthStateService.createState(
        'workspace123',
        'user456',
        'twitter'
      );

      expect(state).toBeDefined();
      expect(redisConfig.recordCircuitBreakerError).toHaveBeenCalled();
    });
  });

  describe('validateState', () => {
    it('should validate existing state', async () => {
      const stateData = {
        state: 'test-state',
        workspaceId: 'workspace123',
        userId: 'user456',
        platform: 'twitter',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 600000), // 10 minutes from now
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(stateData));

      const result = await oauthStateService.validateState('test-state');

      expect(result).toEqual(stateData);
      expect(mockRedis.get).toHaveBeenCalledWith('oauth:state:test-state');
    });

    it('should return null for non-existent state', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await oauthStateService.validateState('non-existent');

      expect(result).toBeNull();
    });

    it('should return null for expired state', async () => {
      const expiredStateData = {
        state: 'test-state',
        workspaceId: 'workspace123',
        userId: 'user456',
        platform: 'twitter',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(expiredStateData));
      mockRedis.del.mockResolvedValue(1);

      const result = await oauthStateService.validateState('test-state');

      expect(result).toBeNull();
      expect(mockRedis.del).toHaveBeenCalledWith('oauth:state:test-state');
    });

    it('should handle invalid state format', async () => {
      const result = await oauthStateService.validateState('');
      expect(result).toBeNull();

      const result2 = await oauthStateService.validateState(null as any);
      expect(result2).toBeNull();
    });
  });

  describe('validateStateForWorkspace', () => {
    it('should validate state with matching workspaceId', async () => {
      const stateData = {
        state: 'test-state',
        workspaceId: 'workspace123',
        userId: 'user456',
        platform: 'twitter',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(stateData));

      const result = await oauthStateService.validateStateForWorkspace(
        'test-state',
        'workspace123'
      );

      expect(result).toEqual(stateData);
    });

    it('should return null for mismatched workspaceId', async () => {
      const stateData = {
        state: 'test-state',
        workspaceId: 'workspace123',
        userId: 'user456',
        platform: 'twitter',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(stateData));

      const result = await oauthStateService.validateStateForWorkspace(
        'test-state',
        'workspace456' // Different workspace
      );

      expect(result).toBeNull();
    });
  });

  describe('consumeState', () => {
    it('should consume state and delete it', async () => {
      const stateData = {
        state: 'test-state',
        workspaceId: 'workspace123',
        userId: 'user456',
        platform: 'twitter',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(stateData));
      mockRedis.del.mockResolvedValue(1);

      const result = await oauthStateService.consumeState('test-state');

      expect(result).toEqual(stateData);
      expect(mockRedis.del).toHaveBeenCalledWith('oauth:state:test-state');
    });

    it('should return null for non-existent state', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await oauthStateService.consumeState('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredStates', () => {
    it('should clean up expired states', async () => {
      const expiredState = {
        state: 'expired-state',
        workspaceId: 'workspace123',
        userId: 'user456',
        platform: 'twitter',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      const validState = {
        state: 'valid-state',
        workspaceId: 'workspace123',
        userId: 'user456',
        platform: 'twitter',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 600000), // Valid
      };

      mockRedis.keys.mockResolvedValue([
        'oauth:state:expired-state',
        'oauth:state:valid-state',
      ]);

      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(expiredState))
        .mockResolvedValueOnce(JSON.stringify(validState));

      mockRedis.del.mockResolvedValue(1);

      const cleanedCount = await oauthStateService.cleanupExpiredStates();

      expect(cleanedCount).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledWith('oauth:state:expired-state');
      expect(mockRedis.del).not.toHaveBeenCalledWith('oauth:state:valid-state');
    });

    it('should handle Redis unavailable during cleanup', async () => {
      (redisConfig.getRedisClientSafe as jest.Mock).mockReturnValue(null);

      const cleanedCount = await oauthStateService.cleanupExpiredStates();

      expect(cleanedCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      mockRedis.keys.mockResolvedValue(['oauth:state:test1', 'oauth:state:test2']);
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'test',
        workspaceId: 'workspace123',
        userId: 'user456',
        platform: 'twitter',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
      }));

      const stats = await oauthStateService.getStats();

      expect(stats).toEqual({
        activeStates: 2,
        memoryFallbackStates: 0,
        redisAvailable: true,
      });
    });
  });
});