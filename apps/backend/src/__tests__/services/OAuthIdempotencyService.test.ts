/**
 * OAuth Idempotency Service Tests
 * 
 * Tests for distributed idempotency guard
 */

import { OAuthIdempotencyService } from '../../services/OAuthIdempotencyService';
import { getRedisClientSafe } from '../../config/redis';

// Mock Redis
jest.mock('../../config/redis');
jest.mock('../../utils/logger');

describe('OAuthIdempotencyService', () => {
  let service: OAuthIdempotencyService;
  let mockRedis: any;

  beforeEach(() => {
    service = OAuthIdempotencyService.getInstance();
    
    // Mock Redis client
    mockRedis = {
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
    };
    
    (getRedisClientSafe as jest.Mock).mockReturnValue(mockRedis);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAndSet', () => {
    it('should return true for first attempt', async () => {
      // Mock Redis SETNX success
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.checkAndSet('state123', 'corr123');

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'oauth:idempotency:state123',
        '1',
        'EX',
        300,
        'NX'
      );
    });

    it('should return false for duplicate attempt', async () => {
      // Mock Redis SETNX failure (key already exists)
      mockRedis.set.mockResolvedValue(null);

      const result = await service.checkAndSet('state123', 'corr123');

      expect(result).toBe(false);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'oauth:idempotency:state123',
        '1',
        'EX',
        300,
        'NX'
      );
    });

    it('should throw error when Redis unavailable', async () => {
      // Mock Redis unavailable
      (getRedisClientSafe as jest.Mock).mockReturnValue(null);

      await expect(
        service.checkAndSet('state123', 'corr123')
      ).rejects.toThrow('OAuth idempotency check failed: Redis unavailable');
    });

    it('should throw error when Redis operation fails', async () => {
      // Mock Redis error
      mockRedis.set.mockRejectedValue(new Error('Redis connection error'));

      await expect(
        service.checkAndSet('state123', 'corr123')
      ).rejects.toThrow('OAuth idempotency check failed: Redis error');
    });

    it('should use correct key prefix', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.checkAndSet('abc123', 'corr123');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'oauth:idempotency:abc123',
        '1',
        'EX',
        300,
        'NX'
      );
    });

    it('should set 5-minute TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.checkAndSet('state123', 'corr123');

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.any(String),
        '1',
        'EX',
        300, // 5 minutes
        'NX'
      );
    });
  });

  describe('remove', () => {
    it('should remove idempotency key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.remove('state123');

      expect(mockRedis.del).toHaveBeenCalledWith('oauth:idempotency:state123');
    });

    it('should handle Redis unavailable gracefully', async () => {
      (getRedisClientSafe as jest.Mock).mockReturnValue(null);

      // Should not throw
      await expect(service.remove('state123')).resolves.toBeUndefined();
    });

    it('should handle Redis error gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(service.remove('state123')).resolves.toBeUndefined();
    });
  });

  describe('isProcessed', () => {
    it('should return true if key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await service.isProcessed('state123');

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('oauth:idempotency:state123');
    });

    it('should return false if key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await service.isProcessed('state123');

      expect(result).toBe(false);
    });

    it('should return false when Redis unavailable', async () => {
      (getRedisClientSafe as jest.Mock).mockReturnValue(null);

      const result = await service.isProcessed('state123');

      expect(result).toBe(false);
    });

    it('should return false when Redis error occurs', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Redis error'));

      const result = await service.isProcessed('state123');

      expect(result).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = OAuthIdempotencyService.getInstance();
      const instance2 = OAuthIdempotencyService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
