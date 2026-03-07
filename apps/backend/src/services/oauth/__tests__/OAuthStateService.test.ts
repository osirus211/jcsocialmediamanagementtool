/**
 * OAuth State Service Tests
 * 
 * Tests for Redis-based OAuth state management
 */

import { OAuthStateService } from '../OAuthStateService';
import { SocialPlatform } from '../../../models/SocialAccount';
import { redisClient } from '../../../utils/redisClient';

// Mock Redis client
jest.mock('../../../utils/redisClient', () => ({
  redisClient: {
    getClient: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('OAuthStateService', () => {
  let service: OAuthStateService;
  let mockRedis: any;

  beforeEach(() => {
    service = new OAuthStateService();
    mockRedis = {
      setex: jest.fn(),
      getdel: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };
    (redisClient.getClient as jest.Mock).mockReturnValue(mockRedis);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createState', () => {
    it('should create OAuth state with all required fields', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const state = await service.createState(options);

      expect(state).toBeDefined();
      expect(state.length).toBeGreaterThan(40); // 256-bit base64url
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('oauth:state:'),
        600, // 10 minutes
        expect.any(String)
      );
    });

    it('should include codeVerifier when provided (PKCE)', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        codeVerifier: 'test-code-verifier',
      };

      const state = await service.createState(options);

      expect(state).toBeDefined();
      
      const setexCall = mockRedis.setex.mock.calls[0];
      const storedData = JSON.parse(setexCall[2]);
      expect(storedData.codeVerifier).toBe('test-code-verifier');
    });

    it('should include providerType when provided (Instagram)', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const options = {
        platform: SocialPlatform.INSTAGRAM,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        providerType: 'INSTAGRAM_BUSINESS',
      };

      const state = await service.createState(options);

      const setexCall = mockRedis.setex.mock.calls[0];
      const storedData = JSON.parse(setexCall[2]);
      expect(storedData.providerType).toBe('INSTAGRAM_BUSINESS');
    });

    it('should generate correlation ID if not provided', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      await service.createState(options);

      const setexCall = mockRedis.setex.mock.calls[0];
      const storedData = JSON.parse(setexCall[2]);
      expect(storedData.correlationId).toBeDefined();
      expect(storedData.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should use provided correlation ID', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        correlationId: 'custom-correlation-id',
      };

      await service.createState(options);

      const setexCall = mockRedis.setex.mock.calls[0];
      const storedData = JSON.parse(setexCall[2]);
      expect(storedData.correlationId).toBe('custom-correlation-id');
    });

    it('should throw error if Redis fails', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis connection failed'));

      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      await expect(service.createState(options)).rejects.toThrow('Failed to create OAuth state');
    });
  });

  describe('consumeState', () => {
    it('should consume valid state successfully', async () => {
      const stateData = {
        state: 'test-state',
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        correlationId: 'correlation-123',
        createdAt: new Date().toISOString(),
      };

      mockRedis.getdel.mockResolvedValue(JSON.stringify(stateData));

      const result = await service.consumeState('test-state', '192.168.1.1', 'Mozilla/5.0');

      expect(result.valid).toBe(true);
      expect(result.data).toEqual(stateData);
      expect(mockRedis.getdel).toHaveBeenCalledWith('oauth:state:test-state');
    });

    it('should reject state with IP mismatch', async () => {
      const stateData = {
        state: 'test-state',
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        correlationId: 'correlation-123',
        createdAt: new Date().toISOString(),
      };

      mockRedis.getdel.mockResolvedValue(JSON.stringify(stateData));

      const result = await service.consumeState('test-state', '192.168.1.2', 'Mozilla/5.0');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('IP_MISMATCH');
    });

    it('should warn but not reject on User-Agent mismatch', async () => {
      const stateData = {
        state: 'test-state',
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        correlationId: 'correlation-123',
        createdAt: new Date().toISOString(),
      };

      mockRedis.getdel.mockResolvedValue(JSON.stringify(stateData));

      const result = await service.consumeState('test-state', '192.168.1.1', 'Chrome/90.0');

      expect(result.valid).toBe(true);
      expect(result.data).toEqual(stateData);
    });

    it('should reject state not found', async () => {
      mockRedis.getdel.mockResolvedValue(null);

      const result = await service.consumeState('invalid-state', '192.168.1.1', 'Mozilla/5.0');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_STATE');
    });

    it('should reject expired state', async () => {
      const stateData = {
        state: 'test-state',
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        correlationId: 'correlation-123',
        createdAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(), // 11 minutes ago
      };

      mockRedis.getdel.mockResolvedValue(JSON.stringify(stateData));

      const result = await service.consumeState('test-state', '192.168.1.1', 'Mozilla/5.0');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('STATE_EXPIRED');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.getdel.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.consumeState('test-state', '192.168.1.1', 'Mozilla/5.0');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('INTERNAL_ERROR');
    });
  });

  describe('validateState', () => {
    it('should validate state without consuming', async () => {
      const stateData = {
        state: 'test-state',
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        correlationId: 'correlation-123',
        createdAt: new Date().toISOString(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(stateData));

      const result = await service.validateState('test-state');

      expect(result).toEqual(stateData);
      expect(mockRedis.get).toHaveBeenCalledWith('oauth:state:test-state');
      expect(mockRedis.getdel).not.toHaveBeenCalled();
    });

    it('should return null for non-existent state', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.validateState('invalid-state');

      expect(result).toBeNull();
    });
  });

  describe('deleteState', () => {
    it('should delete state successfully', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await service.deleteState('test-state');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('oauth:state:test-state');
    });

    it('should return false if state does not exist', async () => {
      mockRedis.del.mockResolvedValue(0);

      const result = await service.deleteState('invalid-state');

      expect(result).toBe(false);
    });
  });

  describe('getActiveStateCount', () => {
    it('should return count of active states', async () => {
      mockRedis.keys.mockResolvedValue([
        'oauth:state:state1',
        'oauth:state:state2',
        'oauth:state:state3',
      ]);

      const count = await service.getActiveStateCount();

      expect(count).toBe(3);
      expect(mockRedis.keys).toHaveBeenCalledWith('oauth:state:*');
    });

    it('should return 0 if no active states', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const count = await service.getActiveStateCount();

      expect(count).toBe(0);
    });

    it('should return 0 on Redis error', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis connection failed'));

      const count = await service.getActiveStateCount();

      expect(count).toBe(0);
    });
  });

  describe('State generation', () => {
    it('should generate unique states', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const state1 = await service.createState(options);
      const state2 = await service.createState(options);

      expect(state1).not.toBe(state2);
    });

    it('should generate states with sufficient entropy', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const options = {
        platform: SocialPlatform.TWITTER,
        workspaceId: 'workspace-123',
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const state = await service.createState(options);

      // 256-bit entropy encoded as base64url should be ~43 characters
      expect(state.length).toBeGreaterThanOrEqual(43);
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/); // base64url format
    });
  });
});
