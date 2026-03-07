import { DegradedModeManager } from '../DegradedModeManager';
import { LoadState } from '../types';
import { getRedisClient } from '../../config/redis';

jest.mock('../../config/redis');
jest.mock('../LatencyTracker');
jest.mock('../BackpressureManager');
jest.mock('../../services/RetryStormProtectionService');
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DegradedModeManager - RFC-005 Overload Freeze', () => {
  let manager: DegradedModeManager;
  let mockRedis: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Redis client
    mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue(null),
    };
    
    (getRedisClient as jest.Mock).mockReturnValue(mockRedis);
    
    // Reset singleton
    (DegradedModeManager as any).instance = null;
    manager = DegradedModeManager.getInstance();
  });
  
  describe('Freeze Activation Conditions', () => {
    test('activates freeze when rejectionRate > threshold AND loadState >= HIGH_LOAD', async () => {
      await manager.evaluateOverloadFreeze(0.35, LoadState.HIGH_LOAD, false);
      
      expect(manager.isOverloadFrozen()).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'publish:freeze:overload',
        expect.any(Number),
        '1'
      );
      
      const metrics = manager.getOverloadFreezeMetrics();
      expect(metrics.active).toBe(true);
      expect(metrics.reason).toBe('HIGH_REJECTION_RATE');
      expect(metrics.activationCount).toBe(1);
    });
    
    test('activates freeze when rejectionRate > threshold AND loadState = CRITICAL_LOAD', async () => {
      await manager.evaluateOverloadFreeze(0.4, LoadState.CRITICAL_LOAD, false);
      
      expect(manager.isOverloadFrozen()).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();
    });
    
    test('does NOT activate freeze when loadState < HIGH_LOAD', async () => {
      await manager.evaluateOverloadFreeze(0.5, LoadState.ELEVATED_LOAD, false);
      
      expect(manager.isOverloadFrozen()).toBe(false);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
    
    test('does NOT activate freeze when loadState = LOW_LOAD', async () => {
      await manager.evaluateOverloadFreeze(0.6, LoadState.LOW_LOAD, false);
      
      expect(manager.isOverloadFrozen()).toBe(false);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
    
    test('does NOT activate freeze when rejectionRate <= threshold', async () => {
      await manager.evaluateOverloadFreeze(0.25, LoadState.HIGH_LOAD, false);
      
      expect(manager.isOverloadFrozen()).toBe(false);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
    
    test('does NOT activate freeze when rejectionRate low despite HIGH_LOAD', async () => {
      await manager.evaluateOverloadFreeze(0.1, LoadState.HIGH_LOAD, false);
      
      expect(manager.isOverloadFrozen()).toBe(false);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });
  
  describe('Oscillation-Based Freeze', () => {
    test('activates freeze when oscillation detected AND loadState >= HIGH_LOAD', async () => {
      await manager.evaluateOverloadFreeze(0.1, LoadState.HIGH_LOAD, true);
      
      expect(manager.isOverloadFrozen()).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();
      
      const metrics = manager.getOverloadFreezeMetrics();
      expect(metrics.reason).toBe('OSCILLATION_UNDER_LOAD');
    });
    
    test('activates freeze when oscillation detected AND loadState = CRITICAL_LOAD', async () => {
      await manager.evaluateOverloadFreeze(0.05, LoadState.CRITICAL_LOAD, true);
      
      expect(manager.isOverloadFrozen()).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();
    });
    
    test('does NOT activate freeze when oscillation detected but loadState < HIGH_LOAD', async () => {
      await manager.evaluateOverloadFreeze(0.1, LoadState.ELEVATED_LOAD, true);
      
      expect(manager.isOverloadFrozen()).toBe(false);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });
  
  describe('Budget-Only Rejections', () => {
    test('budget rejections alone do NOT trigger freeze (low load)', async () => {
      // Simulate 100% budget rejections but low system load
      await manager.evaluateOverloadFreeze(1.0, LoadState.LOW_LOAD, false);
      
      expect(manager.isOverloadFrozen()).toBe(false);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
    
    test('budget rejections alone do NOT trigger freeze (elevated load)', async () => {
      // Simulate 80% budget rejections but only elevated load
      await manager.evaluateOverloadFreeze(0.8, LoadState.ELEVATED_LOAD, false);
      
      expect(manager.isOverloadFrozen()).toBe(false);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
    
    test('budget rejections WITH high load DO trigger freeze', async () => {
      // Simulate 50% budget rejections with high load
      await manager.evaluateOverloadFreeze(0.5, LoadState.HIGH_LOAD, false);
      
      expect(manager.isOverloadFrozen()).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });
  
  describe('Freeze Auto-Expiration', () => {
    test('freeze auto-expires after maximum duration', async () => {
      // Activate freeze
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      expect(manager.isOverloadFrozen()).toBe(true);
      
      // Simulate time passing beyond expiration
      const metrics = manager.getOverloadFreezeMetrics();
      (manager as any).overloadFreezeExpiresAt = Date.now() - 1000; // Expired 1 second ago
      
      // Evaluate again - should deactivate
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      
      expect(mockRedis.del).toHaveBeenCalledWith('publish:freeze:overload');
    });
    
    test('freeze remains active before expiration', async () => {
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      expect(manager.isOverloadFrozen()).toBe(true);
      
      // Set expiration far in future
      (manager as any).overloadFreezeExpiresAt = Date.now() + 300000;
      
      // Evaluate again - should remain active
      await manager.evaluateOverloadFreeze(0.1, LoadState.LOW_LOAD, false);
      
      expect(manager.isOverloadFrozen()).toBe(true);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
  
  describe('Freeze Cooldown', () => {
    test('prevents immediate reactivation within cooldown window', async () => {
      // Activate freeze
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      expect(manager.isOverloadFrozen()).toBe(true);
      
      // Deactivate
      (manager as any).overloadFreezeActivatedAt = Date.now() - 60000; // 60s ago
      await manager.deactivateOverloadFreeze();
      expect(manager.isOverloadFrozen()).toBe(false);
      
      // Try to reactivate immediately - should be blocked by cooldown
      await manager.evaluateOverloadFreeze(0.5, LoadState.HIGH_LOAD, false);
      
      expect(manager.isOverloadFrozen()).toBe(false);
      expect(mockRedis.setex).toHaveBeenCalledTimes(1); // Only first activation
    });
    
    test('allows reactivation after cooldown expires', async () => {
      // Activate freeze
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      
      // Deactivate
      (manager as any).overloadFreezeActivatedAt = Date.now() - 60000;
      await manager.deactivateOverloadFreeze();
      
      // Simulate cooldown expiration
      (manager as any).lastFreezeDeactivatedAt = Date.now() - 70000; // 70s ago (> 60s cooldown)
      
      // Try to reactivate - should succeed
      await manager.evaluateOverloadFreeze(0.5, LoadState.HIGH_LOAD, false);
      
      expect(manager.isOverloadFrozen()).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledTimes(2); // Both activations
    });
  });
  
  describe('Minimum Duration', () => {
    test('respects minimum duration before deactivation', async () => {
      // Activate freeze
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      expect(manager.isOverloadFrozen()).toBe(true);
      
      // Try to deactivate immediately (before minimum duration)
      (manager as any).overloadFreezeActivatedAt = Date.now() - 5000; // Only 5s ago
      await manager.deactivateOverloadFreeze();
      
      // Should still be active (minimum is 30s)
      expect(manager.isOverloadFrozen()).toBe(true);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
    
    test('allows deactivation after minimum duration', async () => {
      // Activate freeze
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      
      // Simulate minimum duration passing
      (manager as any).overloadFreezeActivatedAt = Date.now() - 35000; // 35s ago (> 30s minimum)
      
      // Deactivate - should succeed
      await manager.deactivateOverloadFreeze();
      
      expect(manager.isOverloadFrozen()).toBe(false);
      expect(mockRedis.del).toHaveBeenCalledWith('publish:freeze:overload');
    });
  });
  
  describe('Metrics Tracking', () => {
    test('tracks activation count', async () => {
      let metrics = manager.getOverloadFreezeMetrics();
      expect(metrics.activationCount).toBe(0);
      
      // First activation
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      metrics = manager.getOverloadFreezeMetrics();
      expect(metrics.activationCount).toBe(1);
      
      // Deactivate
      (manager as any).overloadFreezeActivatedAt = Date.now() - 60000;
      await manager.deactivateOverloadFreeze();
      
      // Allow cooldown to expire
      (manager as any).lastFreezeDeactivatedAt = Date.now() - 70000;
      
      // Second activation
      await manager.evaluateOverloadFreeze(0.5, LoadState.CRITICAL_LOAD, false);
      metrics = manager.getOverloadFreezeMetrics();
      expect(metrics.activationCount).toBe(2);
    });
    
    test('tracks total duration across multiple activations', async () => {
      // First activation
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      (manager as any).overloadFreezeActivatedAt = Date.now() - 40000; // 40s duration
      await manager.deactivateOverloadFreeze();
      
      let metrics = manager.getOverloadFreezeMetrics();
      expect(metrics.totalDurationMs).toBeGreaterThanOrEqual(40000);
      
      // Allow cooldown
      (manager as any).lastFreezeDeactivatedAt = Date.now() - 70000;
      
      // Second activation
      await manager.evaluateOverloadFreeze(0.5, LoadState.HIGH_LOAD, false);
      (manager as any).overloadFreezeActivatedAt = Date.now() - 50000; // 50s duration
      await manager.deactivateOverloadFreeze();
      
      metrics = manager.getOverloadFreezeMetrics();
      expect(metrics.totalDurationMs).toBeGreaterThanOrEqual(90000); // 40s + 50s
    });
    
    test('tracks current duration when active', async () => {
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      
      // Simulate 10 seconds passing
      (manager as any).overloadFreezeActivatedAt = Date.now() - 10000;
      
      const metrics = manager.getOverloadFreezeMetrics();
      expect(metrics.currentDurationMs).toBeGreaterThanOrEqual(10000);
      expect(metrics.currentDurationMs).toBeLessThan(11000);
    });
    
    test('tracks freeze reason', async () => {
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      
      let metrics = manager.getOverloadFreezeMetrics();
      expect(metrics.reason).toBe('HIGH_REJECTION_RATE');
      
      // Deactivate and reactivate with different reason
      (manager as any).overloadFreezeActivatedAt = Date.now() - 60000;
      await manager.deactivateOverloadFreeze();
      (manager as any).lastFreezeDeactivatedAt = Date.now() - 70000;
      
      await manager.evaluateOverloadFreeze(0.1, LoadState.CRITICAL_LOAD, true);
      
      metrics = manager.getOverloadFreezeMetrics();
      expect(metrics.reason).toBe('OSCILLATION_UNDER_LOAD');
    });
  });
  
  describe('Redis Integration', () => {
    test('sets Redis key with correct TTL on activation', async () => {
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'publish:freeze:overload',
        300, // 5 minutes in seconds
        '1'
      );
    });
    
    test('removes Redis key on deactivation', async () => {
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      
      (manager as any).overloadFreezeActivatedAt = Date.now() - 60000;
      await manager.deactivateOverloadFreeze();
      
      expect(mockRedis.del).toHaveBeenCalledWith('publish:freeze:overload');
    });
    
    test('handles Redis errors gracefully on activation', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis connection failed'));
      
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      
      // Should not be frozen due to Redis error
      expect(manager.isOverloadFrozen()).toBe(false);
    });
    
    test('handles Redis errors gracefully on deactivation', async () => {
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      expect(manager.isOverloadFrozen()).toBe(true);
      
      mockRedis.del.mockRejectedValue(new Error('Redis connection failed'));
      
      (manager as any).overloadFreezeActivatedAt = Date.now() - 60000;
      await manager.deactivateOverloadFreeze();
      
      // Should still deactivate locally despite Redis error
      expect(manager.isOverloadFrozen()).toBe(false);
    });
  });
  
  describe('Event Emission', () => {
    test('emits event on freeze activation', async () => {
      const activationHandler = jest.fn();
      manager.on('overloadFreezeActivated', activationHandler);
      
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      
      expect(activationHandler).toHaveBeenCalledWith({
        reason: 'HIGH_REJECTION_RATE',
        activatedAt: expect.any(Number),
        expiresAt: expect.any(Number),
      });
    });
    
    test('emits event on freeze deactivation', async () => {
      const deactivationHandler = jest.fn();
      manager.on('overloadFreezeDeactivated', deactivationHandler);
      
      await manager.evaluateOverloadFreeze(0.4, LoadState.HIGH_LOAD, false);
      
      (manager as any).overloadFreezeActivatedAt = Date.now() - 60000;
      await manager.deactivateOverloadFreeze();
      
      expect(deactivationHandler).toHaveBeenCalledWith({
        reason: 'HIGH_REJECTION_RATE',
        durationMs: expect.any(Number),
        deactivatedAt: expect.any(Number),
      });
    });
  });
  
  describe('Governance vs Stability Separation', () => {
    test('high budget rejections without system stress do NOT freeze', async () => {
      // 90% rejection rate but system healthy (LOW_LOAD)
      await manager.evaluateOverloadFreeze(0.9, LoadState.LOW_LOAD, false);
      
      expect(manager.isOverloadFrozen()).toBe(false);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
    
    test('moderate rejections with system stress DO freeze', async () => {
      // 35% rejection rate with system stressed (HIGH_LOAD)
      await manager.evaluateOverloadFreeze(0.35, LoadState.HIGH_LOAD, false);
      
      expect(manager.isOverloadFrozen()).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();
    });
    
    test('validates BOTH conditions required for freeze', async () => {
      // Test all combinations
      const testCases = [
        { rejectionRate: 0.5, loadState: LoadState.LOW_LOAD, shouldFreeze: false },
        { rejectionRate: 0.5, loadState: LoadState.ELEVATED_LOAD, shouldFreeze: false },
        { rejectionRate: 0.5, loadState: LoadState.HIGH_LOAD, shouldFreeze: true },
        { rejectionRate: 0.5, loadState: LoadState.CRITICAL_LOAD, shouldFreeze: true },
        { rejectionRate: 0.2, loadState: LoadState.HIGH_LOAD, shouldFreeze: false },
        { rejectionRate: 0.2, loadState: LoadState.CRITICAL_LOAD, shouldFreeze: false },
      ];
      
      for (const testCase of testCases) {
        // Reset state
        (DegradedModeManager as any).instance = null;
        manager = DegradedModeManager.getInstance();
        mockRedis.setex.mockClear();
        
        await manager.evaluateOverloadFreeze(
          testCase.rejectionRate,
          testCase.loadState,
          false
        );
        
        expect(manager.isOverloadFrozen()).toBe(testCase.shouldFreeze);
      }
    });
  });
});
