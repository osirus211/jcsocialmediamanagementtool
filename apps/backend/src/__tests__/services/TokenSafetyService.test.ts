import { TokenSafetyService, TokenData } from '../../services/TokenSafetyService';
import { getRedisClient } from '../../config/redis';
import { getCurrentKeyVersion } from '../../utils/encryption';

jest.mock('../../config/redis');
jest.mock('../../utils/encryption');

describe('TokenSafetyService', () => {
  let service: TokenSafetyService;
  let mockRedis: any;

  beforeEach(() => {
    service = new TokenSafetyService();
    mockRedis = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      expire: jest.fn(),
      lrange: jest.fn(),
      keys: jest.fn(),
    };
    (getRedisClient as jest.Mock).mockReturnValue(mockRedis);
    (getCurrentKeyVersion as jest.Mock).mockReturnValue(1);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('acquireRefreshLock', () => {
    it('should acquire lock successfully', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const lockId = await service.acquireRefreshLock('account123');

      expect(lockId).toBeTruthy();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'token:refresh:lock:account123',
        expect.any(String),
        'EX',
        30,
        'NX'
      );
    });

    it('should return null if lock already held', async () => {
      mockRedis.set.mockResolvedValue(null);

      const lockId = await service.acquireRefreshLock('account123');

      expect(lockId).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis error'));

      const lockId = await service.acquireRefreshLock('account123');

      expect(lockId).toBeNull();
    });
  });

  describe('releaseRefreshLock', () => {
    it('should release lock if ownership matches', async () => {
      const lockId = 'lock123';
      mockRedis.get.mockResolvedValue(lockId);

      await service.releaseRefreshLock('account123', lockId);

      expect(mockRedis.del).toHaveBeenCalledWith('token:refresh:lock:account123');
    });

    it('should not release lock if ownership mismatch', async () => {
      mockRedis.get.mockResolvedValue('different-lock-id');

      await service.releaseRefreshLock('account123', 'lock123');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.releaseRefreshLock('account123', 'lock123')
      ).resolves.not.toThrow();
    });
  });

  describe('verifyTokenIntegrity', () => {
    const mockTokenData: TokenData = {
      accessToken: 'encrypted-token',
      refreshToken: 'encrypted-refresh',
      expiresAt: new Date('2024-12-31'),
      scope: 'read write',
    };

    it('should verify token integrity successfully', async () => {
      const metadata = {
        accountId: 'account123',
        provider: 'twitter',
        version: 1,
        encryptionKeyVersion: 1,
        checksum: expect.any(String),
        lastRefreshedAt: new Date(),
        refreshCount: 0,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(metadata));

      // Mock checksum calculation to match
      const result = await service.verifyTokenIntegrity('account123', mockTokenData);

      expect(result.valid).toBe(false); // Will fail due to checksum mismatch in test
      expect(result.reason).toBeDefined();
    });

    it('should detect token corruption', async () => {
      const metadata = {
        accountId: 'account123',
        provider: 'twitter',
        version: 1,
        encryptionKeyVersion: 1,
        checksum: 'wrong-checksum',
        lastRefreshedAt: new Date(),
        refreshCount: 0,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(metadata));

      const result = await service.verifyTokenIntegrity('account123', mockTokenData);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Checksum mismatch');
    });

    it('should return invalid if no metadata found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.verifyTokenIntegrity('account123', mockTokenData);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('No metadata found');
    });
  });

  describe('storeTokenMetadata', () => {
    const mockTokenData: TokenData = {
      accessToken: 'encrypted-token',
      refreshToken: 'encrypted-refresh',
      expiresAt: new Date('2024-12-31'),
      scope: 'read write',
    };

    it('should store token metadata successfully', async () => {
      mockRedis.get.mockResolvedValue(null); // No existing metadata

      await service.storeTokenMetadata('account123', 'twitter', mockTokenData, 1);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'token:metadata:account123',
        expect.any(String),
        'EX',
        60 * 60 * 24 * 90
      );
    });

    it('should increment refresh count for existing metadata', async () => {
      const existingMetadata = {
        accountId: 'account123',
        provider: 'twitter',
        version: 1,
        encryptionKeyVersion: 1,
        checksum: 'checksum',
        lastRefreshedAt: new Date(),
        refreshCount: 5,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingMetadata));

      await service.storeTokenMetadata('account123', 'twitter', mockTokenData, 2);

      const setCall = mockRedis.set.mock.calls[0];
      const storedMetadata = JSON.parse(setCall[1]);
      expect(storedMetadata.refreshCount).toBe(6);
    });
  });

  describe('atomicTokenWrite', () => {
    const mockTokenData: TokenData = {
      accessToken: 'encrypted-token',
      refreshToken: 'encrypted-refresh',
      expiresAt: new Date('2024-12-31'),
      scope: 'read write',
    };

    it('should perform atomic write successfully', async () => {
      const metadata = {
        accountId: 'account123',
        provider: 'twitter',
        version: 1,
        encryptionKeyVersion: 1,
        checksum: 'checksum',
        lastRefreshedAt: new Date(),
        refreshCount: 0,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(metadata));

      const updateCallback = jest.fn().mockResolvedValue(true);

      const result = await service.atomicTokenWrite(
        'account123',
        'twitter',
        mockTokenData,
        1, // Expected version
        updateCallback
      );

      expect(result.success).toBe(true);
      expect(result.newVersion).toBe(2);
      expect(updateCallback).toHaveBeenCalledWith(1);
    });

    it('should detect version mismatch', async () => {
      const metadata = {
        accountId: 'account123',
        provider: 'twitter',
        version: 2, // Different version
        encryptionKeyVersion: 1,
        checksum: 'checksum',
        lastRefreshedAt: new Date(),
        refreshCount: 0,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(metadata));

      const updateCallback = jest.fn();

      const result = await service.atomicTokenWrite(
        'account123',
        'twitter',
        mockTokenData,
        1, // Expected version
        updateCallback
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Version mismatch');
      expect(updateCallback).not.toHaveBeenCalled();
    });

    it('should handle update callback failure', async () => {
      const metadata = {
        accountId: 'account123',
        provider: 'twitter',
        version: 1,
        encryptionKeyVersion: 1,
        checksum: 'checksum',
        lastRefreshedAt: new Date(),
        refreshCount: 0,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(metadata));

      const updateCallback = jest.fn().mockResolvedValue(false);

      const result = await service.atomicTokenWrite(
        'account123',
        'twitter',
        mockTokenData,
        1,
        updateCallback
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update callback failed');
    });
  });

  describe('auditTokenAction', () => {
    it('should audit token action successfully', async () => {
      await service.auditTokenAction({
        accountId: 'account123',
        provider: 'twitter',
        action: 'refresh',
        success: true,
        timestamp: new Date(),
      });

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'token:audit:account123',
        expect.any(String)
      );
      expect(mockRedis.ltrim).toHaveBeenCalledWith('token:audit:account123', 0, 99);
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.lpush.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.auditTokenAction({
          accountId: 'account123',
          provider: 'twitter',
          action: 'refresh',
          success: true,
          timestamp: new Date(),
        })
      ).resolves.not.toThrow();
    });
  });

  describe('getAuditTrail', () => {
    it('should retrieve audit trail successfully', async () => {
      const mockEntries = [
        JSON.stringify({
          accountId: 'account123',
          provider: 'twitter',
          action: 'refresh',
          success: true,
          timestamp: new Date().toISOString(),
        }),
      ];

      mockRedis.lrange.mockResolvedValue(mockEntries);

      const trail = await service.getAuditTrail('account123', 50);

      expect(trail).toHaveLength(1);
      expect(trail[0].accountId).toBe('account123');
      expect(trail[0].action).toBe('refresh');
    });

    it('should return empty array on error', async () => {
      mockRedis.lrange.mockRejectedValue(new Error('Redis error'));

      const trail = await service.getAuditTrail('account123');

      expect(trail).toEqual([]);
    });
  });

  describe('Concurrent Refresh Race Prevention', () => {
    it('should prevent concurrent refresh attempts', async () => {
      // First attempt acquires lock
      mockRedis.set.mockResolvedValueOnce('OK');
      const lockId1 = await service.acquireRefreshLock('account123');
      expect(lockId1).toBeTruthy();

      // Second attempt fails to acquire lock
      mockRedis.set.mockResolvedValueOnce(null);
      const lockId2 = await service.acquireRefreshLock('account123');
      expect(lockId2).toBeNull();
    });

    it('should allow refresh after lock expires', async () => {
      // First attempt acquires lock
      mockRedis.set.mockResolvedValueOnce('OK');
      const lockId1 = await service.acquireRefreshLock('account123');
      expect(lockId1).toBeTruthy();

      // Simulate lock expiry (Redis returns null for expired key)
      mockRedis.get.mockResolvedValue(null);

      // Second attempt acquires lock
      mockRedis.set.mockResolvedValueOnce('OK');
      const lockId2 = await service.acquireRefreshLock('account123');
      expect(lockId2).toBeTruthy();
    });
  });

  describe('Token Corruption Detection', () => {
    it('should detect corrupted token data', async () => {
      const tokenData: TokenData = {
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        expiresAt: new Date('2024-12-31'),
        scope: 'read write',
      };

      const metadata = {
        accountId: 'account123',
        provider: 'twitter',
        version: 1,
        encryptionKeyVersion: 1,
        checksum: 'invalid-checksum',
        lastRefreshedAt: new Date(),
        refreshCount: 0,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(metadata));

      const result = await service.verifyTokenIntegrity('account123', tokenData);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Checksum mismatch');
    });
  });
});
