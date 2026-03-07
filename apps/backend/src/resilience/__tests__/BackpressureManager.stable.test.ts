/**
 * BackpressureManager Stable Control Loop Tests
 * 
 * Tests for EMA smoothing, hysteresis, dwell time, cooldown, and oscillation detection
 */

import { LoadState } from '../types';
import { ResilienceConfig } from '../ResilienceConfig';

// Mock all dependencies before imports
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../queue/QueueManager', () => ({
  QueueManager: {
    getInstance: jest.fn(() => ({
      getQueueStats: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
      }),
    })),
  },
}));

jest.mock('../../services/RetryStormProtectionService', () => ({
  retryStormProtectionService: {
    getRetryStats: jest.fn().mockResolvedValue({
      global: 0,
      byAccount: {},
    }),
  },
}));

jest.mock('../../services/GlobalRateLimitManager', () => ({
  globalRateLimitManager: {
    getStats: jest.fn().mockResolvedValue({
      accountsLimited: 0,
      platformsLimited: 0,
    }),
  },
}));

// Now import after mocks are set up
import { BackpressureManager } from '../BackpressureManager';

describe('BackpressureManager - Stable Control Loop', () => {
  let manager: BackpressureManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Get fresh instance
    manager = BackpressureManager.getInstance();
  });
  
  afterEach(() => {
    manager.shutdown();
    jest.useRealTimers();
  });

  describe('EMA Smoothing', () => {
    it('should smooth load score using EMA', async () => {
      // Mock metrics collection to return controlled values
      const mockCollectMetrics = jest.spyOn(manager as any, 'collectMetrics');
      
      // First reading: raw = 50
      mockCollectMetrics.mockResolvedValueOnce({
        queueDepth: 50,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 50,
        rateLimitHits: 5,
        refreshBacklog: 25,
        systemLoadScore: 50,
        loadState: LoadState.LOW_LOAD,
      });
      
      await (manager as any).checkBackpressure();
      
      const rawScore1 = manager.getRawLoadScore();
      const smoothedScore1 = manager.getSmoothedLoadScore();
      
      expect(rawScore1).toBe(50);
      // First reading: smoothed = alpha * raw + (1 - alpha) * 0 = 0.2 * 50 = 10
      expect(smoothedScore1).toBe(10);
      
      // Second reading: raw = 80
      mockCollectMetrics.mockResolvedValueOnce({
        queueDepth: 80,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 80,
        rateLimitHits: 8,
        refreshBacklog: 40,
        systemLoadScore: 80,
        loadState: LoadState.LOW_LOAD,
      });
      
      await (manager as any).checkBackpressure();
      
      const rawScore2 = manager.getRawLoadScore();
      const smoothedScore2 = manager.getSmoothedLoadScore();
      
      expect(rawScore2).toBe(80);
      // Second reading: smoothed = 0.2 * 80 + 0.8 * 10 = 16 + 8 = 24
      expect(smoothedScore2).toBe(24);
    });

    it('should expose both raw and smoothed scores in metrics', async () => {
      const mockCollectMetrics = jest.spyOn(manager as any, 'collectMetrics');
      
      mockCollectMetrics.mockResolvedValueOnce({
        queueDepth: 60,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 60,
        rateLimitHits: 6,
        refreshBacklog: 30,
        systemLoadScore: 60,
        loadState: LoadState.LOW_LOAD,
      });
      
      await (manager as any).checkBackpressure();
      
      const metrics = manager.getLastMetrics();
      
      expect(metrics).toHaveProperty('rawLoadScore');
      expect(metrics).toHaveProperty('smoothedLoadScore');
      expect(metrics?.rawLoadScore).toBe(60);
      expect(metrics?.smoothedLoadScore).toBe(12); // 0.2 * 60
    });
  });

  describe('Hysteresis Bands', () => {
    it('should use enter threshold when transitioning up', async () => {
      const mockCollectMetrics = jest.spyOn(manager as any, 'collectMetrics');
      
      // Start in LOW_LOAD, smoothed score = 0
      manager.forceState(LoadState.LOW_LOAD);
      
      // Gradually increase load to just below enter threshold (45)
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 44,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 44,
        rateLimitHits: 4,
        refreshBacklog: 22,
        systemLoadScore: 44,
        loadState: LoadState.LOW_LOAD,
      });
      
      // Wait for dwell time and cooldown
      jest.advanceTimersByTime(15000);
      
      await (manager as any).checkBackpressure();
      
      // Should still be in LOW_LOAD (below enter threshold)
      expect(manager.getCurrentState()).toBe(LoadState.LOW_LOAD);
      
      // Now increase to enter threshold (45)
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 45,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 45,
        rateLimitHits: 5,
        refreshBacklog: 23,
        systemLoadScore: 45,
        loadState: LoadState.LOW_LOAD,
      });
      
      jest.advanceTimersByTime(15000);
      await (manager as any).checkBackpressure();
      
      // Should transition to ELEVATED_LOAD
      expect(manager.getCurrentState()).toBe(LoadState.ELEVATED_LOAD);
    });

    it('should use exit threshold when transitioning down', async () => {
      const mockCollectMetrics = jest.spyOn(manager as any, 'collectMetrics');
      
      // Start in ELEVATED_LOAD
      manager.forceState(LoadState.ELEVATED_LOAD);
      
      // Wait for dwell time
      jest.advanceTimersByTime(20000);
      
      // Decrease load to just above exit threshold (35)
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 36,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 36,
        rateLimitHits: 4,
        refreshBacklog: 18,
        systemLoadScore: 36,
        loadState: LoadState.ELEVATED_LOAD,
      });
      
      await (manager as any).checkBackpressure();
      
      // Should still be in ELEVATED_LOAD (above exit threshold)
      expect(manager.getCurrentState()).toBe(LoadState.ELEVATED_LOAD);
      
      // Now decrease to exit threshold (35)
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 35,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 35,
        rateLimitHits: 4,
        refreshBacklog: 18,
        systemLoadScore: 35,
        loadState: LoadState.ELEVATED_LOAD,
      });
      
      jest.advanceTimersByTime(20000);
      await (manager as any).checkBackpressure();
      
      // Should transition to LOW_LOAD
      expect(manager.getCurrentState()).toBe(LoadState.LOW_LOAD);
    });

    it('should prevent direct LOW to HIGH jumps', async () => {
      const mockCollectMetrics = jest.spyOn(manager as any, 'collectMetrics');
      
      // Start in LOW_LOAD
      manager.forceState(LoadState.LOW_LOAD);
      jest.advanceTimersByTime(15000);
      
      // Sudden spike to HIGH threshold (65)
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 65,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 65,
        rateLimitHits: 7,
        refreshBacklog: 33,
        systemLoadScore: 65,
        loadState: LoadState.LOW_LOAD,
      });
      
      await (manager as any).checkBackpressure();
      
      // Should transition to ELEVATED_LOAD first (not HIGH)
      expect(manager.getCurrentState()).toBe(LoadState.ELEVATED_LOAD);
    });
  });

  describe('Minimum Dwell Time', () => {
    it('should enforce minimum dwell time per state', async () => {
      const mockCollectMetrics = jest.spyOn(manager as any, 'collectMetrics');
      
      // Start in LOW_LOAD
      manager.forceState(LoadState.LOW_LOAD);
      
      // Immediately try to transition (dwell time = 10s)
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 50,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 50,
        rateLimitHits: 5,
        refreshBacklog: 25,
        systemLoadScore: 50,
        loadState: LoadState.LOW_LOAD,
      });
      
      // Advance only 5 seconds (less than 10s dwell time)
      jest.advanceTimersByTime(5000);
      await (manager as any).checkBackpressure();
      
      // Should still be in LOW_LOAD (dwell time not met)
      expect(manager.getCurrentState()).toBe(LoadState.LOW_LOAD);
      
      // Advance to meet dwell time (10s total)
      jest.advanceTimersByTime(5000);
      await (manager as any).checkBackpressure();
      
      // Now should transition
      expect(manager.getCurrentState()).toBe(LoadState.ELEVATED_LOAD);
    });

    it('should have different dwell times for different states', () => {
      const config = ResilienceConfig.CONTROL_LOOP;
      
      expect(config.dwellTimeLowMs).toBe(10000);
      expect(config.dwellTimeElevatedMs).toBe(15000);
      expect(config.dwellTimeHighMs).toBe(20000);
      expect(config.dwellTimeCriticalMs).toBe(30000);
    });
  });

  describe('Global Transition Cooldown', () => {
    it('should enforce cooldown between any transitions', async () => {
      const mockCollectMetrics = jest.spyOn(manager as any, 'collectMetrics');
      
      // Start in LOW_LOAD
      manager.forceState(LoadState.LOW_LOAD);
      jest.advanceTimersByTime(15000);
      
      // Transition to ELEVATED
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 50,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 50,
        rateLimitHits: 5,
        refreshBacklog: 25,
        systemLoadScore: 50,
        loadState: LoadState.LOW_LOAD,
      });
      
      await (manager as any).checkBackpressure();
      expect(manager.getCurrentState()).toBe(LoadState.ELEVATED_LOAD);
      
      // Immediately try to transition back (cooldown = 10s)
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 30,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 30,
        rateLimitHits: 3,
        refreshBacklog: 15,
        systemLoadScore: 30,
        loadState: LoadState.ELEVATED_LOAD,
      });
      
      // Advance only 5 seconds (less than 10s cooldown)
      jest.advanceTimersByTime(5000);
      await (manager as any).checkBackpressure();
      
      // Should still be in ELEVATED_LOAD (cooldown not met)
      expect(manager.getCurrentState()).toBe(LoadState.ELEVATED_LOAD);
      
      // Advance to meet cooldown (10s total)
      jest.advanceTimersByTime(5000);
      await (manager as any).checkBackpressure();
      
      // Now should transition
      expect(manager.getCurrentState()).toBe(LoadState.LOW_LOAD);
    });
  });

  describe('Oscillation Detection', () => {
    it('should detect rapid oscillation pattern', async () => {
      const mockCollectMetrics = jest.spyOn(manager as any, 'collectMetrics');
      
      // Simulate 6 rapid transitions (threshold = 5)
      for (let i = 0; i < 6; i++) {
        const state = i % 2 === 0 ? LoadState.LOW_LOAD : LoadState.ELEVATED_LOAD;
        manager.forceState(state);
        
        // Advance time to meet dwell time and cooldown
        jest.advanceTimersByTime(15000);
        
        mockCollectMetrics.mockResolvedValue({
          queueDepth: i % 2 === 0 ? 30 : 50,
          activeWorkers: 5,
          workerCapacity: 25,
          retryRate: i % 2 === 0 ? 30 : 50,
          rateLimitHits: i % 2 === 0 ? 3 : 5,
          refreshBacklog: i % 2 === 0 ? 15 : 25,
          systemLoadScore: i % 2 === 0 ? 30 : 50,
          loadState: state,
        });
        
        await (manager as any).checkBackpressure();
      }
      
      const oscillationMetrics = manager.getOscillationMetrics();
      
      expect(oscillationMetrics.oscillationDetectedCount).toBeGreaterThan(0);
      expect(oscillationMetrics.oscillationFrozen).toBe(true);
    });

    it('should freeze transitions when oscillation detected', async () => {
      const mockCollectMetrics = jest.spyOn(manager as any, 'collectMetrics');
      
      // Force oscillation detection
      for (let i = 0; i < 6; i++) {
        manager.forceState(i % 2 === 0 ? LoadState.LOW_LOAD : LoadState.ELEVATED_LOAD);
        jest.advanceTimersByTime(15000);
      }
      
      // Verify freeze is active
      expect(manager.getOscillationMetrics().oscillationFrozen).toBe(true);
      
      // Try to transition during freeze
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 70,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 70,
        rateLimitHits: 7,
        refreshBacklog: 35,
        systemLoadScore: 70,
        loadState: LoadState.LOW_LOAD,
      });
      
      const stateBefore = manager.getCurrentState();
      await (manager as any).checkBackpressure();
      const stateAfter = manager.getCurrentState();
      
      // State should not change during freeze
      expect(stateAfter).toBe(stateBefore);
    });

    it('should auto-recover after freeze duration', async () => {
      const mockCollectMetrics = jest.spyOn(manager as any, 'collectMetrics');
      
      // Force oscillation detection
      for (let i = 0; i < 6; i++) {
        manager.forceState(i % 2 === 0 ? LoadState.LOW_LOAD : LoadState.ELEVATED_LOAD);
        jest.advanceTimersByTime(15000);
      }
      
      expect(manager.getOscillationMetrics().oscillationFrozen).toBe(true);
      
      // Advance past freeze duration (30s)
      jest.advanceTimersByTime(35000);
      
      expect(manager.getOscillationMetrics().oscillationFrozen).toBe(false);
      
      // Should be able to transition now
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 70,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 70,
        rateLimitHits: 7,
        refreshBacklog: 35,
        systemLoadScore: 70,
        loadState: LoadState.LOW_LOAD,
      });
      
      await (manager as any).checkBackpressure();
      
      // State should change after freeze expires
      expect(manager.getCurrentState()).toBe(LoadState.ELEVATED_LOAD);
    });
  });

  describe('Transition History', () => {
    it('should record transition history', () => {
      manager.forceState(LoadState.LOW_LOAD);
      manager.forceState(LoadState.ELEVATED_LOAD);
      manager.forceState(LoadState.HIGH_LOAD);
      
      const history = manager.getTransitionHistory();
      
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].toState).toBe(LoadState.HIGH_LOAD);
    });

    it('should trim history to last 100 transitions', () => {
      // Force 150 transitions
      for (let i = 0; i < 150; i++) {
        manager.forceState(i % 2 === 0 ? LoadState.LOW_LOAD : LoadState.ELEVATED_LOAD);
      }
      
      const history = manager.getTransitionHistory();
      
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Metrics Exposure', () => {
    it('should expose state duration', () => {
      manager.forceState(LoadState.LOW_LOAD);
      
      jest.advanceTimersByTime(5000);
      
      const duration = manager.getStateDurationMs();
      
      expect(duration).toBeGreaterThanOrEqual(5000);
    });

    it('should expose transition count in window', async () => {
      const mockCollectMetrics = jest.spyOn(manager as any, 'collectMetrics');
      
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 50,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 50,
        rateLimitHits: 5,
        refreshBacklog: 25,
        systemLoadScore: 50,
        loadState: LoadState.LOW_LOAD,
      });
      
      await (manager as any).checkBackpressure();
      
      const metrics = manager.getLastMetrics();
      
      expect(metrics).toHaveProperty('transitionsPastMinute');
      expect(typeof metrics?.transitionsPastMinute).toBe('number');
    });
  });
});
