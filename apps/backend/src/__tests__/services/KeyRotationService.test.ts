import { KeyRotationService } from '../../services/KeyRotationService';
import * as distributedLockService from '../../services/DistributedLockService';

// Mock distributed lock service
jest.mock('../../services/DistributedLockService', () => ({
  distributedLockService: {
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
  },
}));

// Mock encryption utils
jest.mock('../../utils/encryption', () => ({
  startKeyRotation: jest.fn(),
  endKeyRotation: jest.fn(),
  getCurrentKeyVersion: jest.fn(() => 2),
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

describe('KeyRotationService', () => {
  let keyRotationService: KeyRotationService;
  let mockLock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    keyRotationService = KeyRotationService.getInstance();
    
    mockLock = { id: 'test-lock' };
  });

  describe('rotateKeys', () => {
    it('should successfully rotate keys with lock', async () => {
      (distributedLockService.distributedLockService.acquireLock as jest.Mock)
        .mockResolvedValue(mockLock);
      (distributedLockService.distributedLockService.releaseLock as jest.Mock)
        .mockResolvedValue(undefined);

      const result = await keyRotationService.rotateKeys(1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Key rotation from version 1 to 2 completed');
      
      expect(distributedLockService.distributedLockService.acquireLock)
        .toHaveBeenCalledWith('key:rotation', {
          ttl: 10 * 60 * 1000,
          retryAttempts: 0,
        });
      
      expect(distributedLockService.distributedLockService.releaseLock)
        .toHaveBeenCalledWith(mockLock);
    });

    it('should fail if lock cannot be acquired', async () => {
      (distributedLockService.distributedLockService.acquireLock as jest.Mock)
        .mockResolvedValue(null);

      const result = await keyRotationService.rotateKeys(1);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Key rotation already in progress by another instance');
      
      expect(distributedLockService.distributedLockService.releaseLock)
        .not.toHaveBeenCalled();
    });

    it('should fail for invalid version', async () => {
      (distributedLockService.distributedLockService.acquireLock as jest.Mock)
        .mockResolvedValue(mockLock);
      (distributedLockService.distributedLockService.releaseLock as jest.Mock)
        .mockResolvedValue(undefined);

      const result = await keyRotationService.rotateKeys(2); // Same as current

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid rotation: fromVersion (2) must be less than current version (2)');
      
      expect(distributedLockService.distributedLockService.releaseLock)
        .toHaveBeenCalledWith(mockLock);
    });

    it('should handle rotation errors and release lock', async () => {
      (distributedLockService.distributedLockService.acquireLock as jest.Mock)
        .mockResolvedValue(mockLock);
      (distributedLockService.distributedLockService.releaseLock as jest.Mock)
        .mockResolvedValue(undefined);

      // Mock startKeyRotation to throw error
      const encryptionUtils = require('../../utils/encryption');
      (encryptionUtils.startKeyRotation as jest.Mock).mockImplementation(() => {
        throw new Error('Rotation failed');
      });

      const result = await keyRotationService.rotateKeys(1);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Key rotation failed: Rotation failed');
      
      expect(distributedLockService.distributedLockService.releaseLock)
        .toHaveBeenCalledWith(mockLock);
    });

    it('should handle lock release errors gracefully', async () => {
      (distributedLockService.distributedLockService.acquireLock as jest.Mock)
        .mockResolvedValue(mockLock);
      (distributedLockService.distributedLockService.releaseLock as jest.Mock)
        .mockRejectedValue(new Error('Lock release failed'));

      const result = await keyRotationService.rotateKeys(1);

      expect(result.success).toBe(true); // Rotation should still succeed
      expect(result.message).toContain('Key rotation from version 1 to 2 completed');
    });
  });

  describe('generateRollbackScript', () => {
    it('should generate rollback script', () => {
      const script = keyRotationService.generateRollbackScript(1, 2);

      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('From version: 2');
      expect(script).toContain('To version: 1');
      expect(script).toContain('kubectl scale deployment app --replicas=0');
      expect(script).toContain('curl -f http://localhost:3000/health');
    });
  });

  describe('getRotationStatus', () => {
    it('should return rotation status', () => {
      const status = keyRotationService.getRotationStatus();

      expect(status).toEqual({
        isRotating: false,
        currentVersion: 2,
        lockExists: false,
      });
    });
  });

  describe('monitorRotation', () => {
    it('should return health status', async () => {
      const health = await keyRotationService.monitorRotation();

      expect(health).toEqual({
        healthy: true,
        issues: [],
        metrics: {
          currentVersion: 2,
          rotationInProgress: false,
        },
      });
    });
  });
});