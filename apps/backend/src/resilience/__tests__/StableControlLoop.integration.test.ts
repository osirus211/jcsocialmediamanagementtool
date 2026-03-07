/**
 * Stable Control Loop Integration Test
 * 
 * End-to-end test of EMA smoothing, hysteresis, dwell time, cooldown, oscillation detection, and concurrency ramping
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

// Now import after mocks
import { BackpressureManager } from '../BackpressureManager';
import { AdaptivePublishPacer } from '../AdaptivePublishPacer';

describe('Stable Control Loop - Integration', () => {
  let backpressureManager: BackpressureManager;
  let publishPacer: AdaptivePublishPacer;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    backpressureManager = BackpressureManager.getInstance();
    publishPacer = AdaptivePublishPacer.getInstance();
  });
  
  afterEach(() => {
    backpressureManager.shutdown();
    publishPacer.shutdown();
    jest.useRealTimers();
  });

  describe('Load Increase Scenario', () => {
    it('should handle gradual load increase with stable transitions', async () => {
      const mockCollectMetrics = jest.spyOn(backpressureManager as any, 'collectMetrics');
      
      // Start with low load
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 20,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 20,
        rateLimitHits: 2,
        refreshBacklog: 10,
        systemLoadScore: 20,
        loadState: LoadState.LOW_LOAD,
      });
      
      backpressureManager.startMonitoring();
      
      // Initial state
      expect(backpressureManager.getCurrentState()).toBe(LoadState.LOW_LOAD);
      expect(publishPacer.getCurrentConcurrency()).toBe(5);
      
      // Gradually increase load to ELEVATED threshold (45)
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
      
      // Wait for monitoring check + dwell time + cooldown
      jest.advanceTimersByTime(25000);
      
      // Should transition to ELEVATED
      expect(backpressureManager.getCurrentState()).toBe(LoadState.ELEVATED_LOAD);
      
      // Concurrency should start ramping down (5 → 4)
      expect(publishPacer.getTargetConcurrency()).toBe(4);
      
      // Wait for ramp
      jest.advanceTimersByTime(5000);
      expect(publishPacer.getCurrentConcurrency()).toBe(4);
      
      // Further increase load to HIGH threshold (65)
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 65,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 65,
        rateLimitHits: 7,
        refreshBacklog: 33,
        systemLoadScore: 65,
        loadState: LoadState.ELEVATED_LOAD,
      });
      
      // Wait for monitoring check + dwell time + cooldown
      jest.advanceTimersByTime(30000);
      
      // Should transition to HIGH
      expect(backpressureManager.getCurrentState()).toBe(LoadState.HIGH_LOAD);
      
      // Concurrency should ramp down to 2
      expect(publishPacer.getTargetConcurrency()).toBe(2);
      
      // Wait for ramp (4 → 3 → 2)
      jest.advanceTimersByTime(10000);
      expect(publishPacer.getCurrentConcurrency()).toBe(2);
    });
  });

  describe('Load Decrease Scenario', () => {
    it('should handle gradual load decrease with hysteresis', async () => {
      const mockCollectMetrics = jest.spyOn(backpressureManager as any, 'collectMetrics');
      
      // Start in HIGH load
      backpressureManager.forceState(LoadState.HIGH_LOAD);
      publishPacer['handleLoadStateChange'](LoadState.HIGH_LOAD);
      
      // Wait for concurrency to ramp down
      jest.advanceTimersByTime(20000);
      expect(publishPacer.getCurrentConcurrency()).toBe(2);
      
      backpressureManager.startMonitoring();
      
      // Decrease load to just above exit threshold (56)
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 56,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 56,
        rateLimitHits: 6,
        refreshBacklog: 28,
        systemLoadScore: 56,
        loadState: LoadState.HIGH_LOAD,
      });
      
      // Wait for monitoring check + dwell time
      jest.advanceTimersByTime(30000);
      
      // Should still be in HIGH (above exit threshold 55)
      expect(backpressureManager.getCurrentState()).toBe(LoadState.HIGH_LOAD);
      
      // Decrease load to exit threshold (55)
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 55,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 55,
        rateLimitHits: 6,
        refreshBacklog: 28,
        systemLoadScore: 55,
        loadState: LoadState.HIGH_LOAD,
      });
      
      // Wait for monitoring check + cooldown
      jest.advanceTimersByTime(25000);
      
      // Should transition to ELEVATED
      expect(backpressureManager.getCurrentState()).toBe(LoadState.ELEVATED_LOAD);
      
      // Concurrency should ramp up to 4
      expect(publishPacer.getTargetConcurrency()).toBe(4);
      
      // Wait for ramp (2 → 3 → 4)
      jest.advanceTimersByTime(10000);
      expect(publishPacer.getCurrentConcurrency()).toBe(4);
    });
  });

  describe('Oscillation Prevention', () => {
    it('should prevent rapid oscillation between states', async () => {
      const mockCollectMetrics = jest.spyOn(backpressureManager as any, 'collectMetrics');
      
      backpressureManager.startMonitoring();
      
      // Simulate fluctuating load around threshold
      for (let i = 0; i < 10; i++) {
        const isHigh = i % 2 === 0;
        
        mockCollectMetrics.mockResolvedValue({
          queueDepth: isHigh ? 50 : 40,
          activeWorkers: 5,
          workerCapacity: 25,
          retryRate: isHigh ? 50 : 40,
          rateLimitHits: isHigh ? 5 : 4,
          refreshBacklog: isHigh ? 25 : 20,
          systemLoadScore: isHigh ? 50 : 40,
          loadState: LoadState.LOW_LOAD,
        });
        
        // Advance monitoring interval
        jest.advanceTimersByTime(10000);
      }
      
      // Check oscillation metrics
      const oscillationMetrics = backpressureManager.getOscillationMetrics();
      
      // Should detect oscillation and freeze
      if (oscillationMetrics.transitionsPastMinute >= 5) {
        expect(oscillationMetrics.oscillationDetectedCount).toBeGreaterThan(0);
      }
    });

    it('should freeze transitions during oscillation', async () => {
      const mockCollectMetrics = jest.spyOn(backpressureManager as any, 'collectMetrics');
      
      // Force rapid transitions to trigger oscillation
      for (let i = 0; i < 6; i++) {
        backpressureManager.forceState(i % 2 === 0 ? LoadState.LOW_LOAD : LoadState.ELEVATED_LOAD);
        jest.advanceTimersByTime(15000);
      }
      
      expect(backpressureManager.getOscillationMetrics().oscillationFrozen).toBe(true);
      
      backpressureManager.startMonitoring();
      
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
      
      const stateBefore = backpressureManager.getCurrentState();
      
      // Advance monitoring interval
      jest.advanceTimersByTime(10000);
      
      const stateAfter = backpressureManager.getCurrentState();
      
      // State should not change during freeze
      expect(stateAfter).toBe(stateBefore);
    });
  });

  describe('EMA Smoothing Effect', () => {
    it('should smooth out load spikes', async () => {
      const mockCollectMetrics = jest.spyOn(backpressureManager as any, 'collectMetrics');
      
      backpressureManager.startMonitoring();
      
      // Start with low load
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 20,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 20,
        rateLimitHits: 2,
        refreshBacklog: 10,
        systemLoadScore: 20,
        loadState: LoadState.LOW_LOAD,
      });
      
      jest.advanceTimersByTime(10000);
      
      const smoothedBefore = backpressureManager.getSmoothedLoadScore();
      
      // Sudden spike
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 80,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 80,
        rateLimitHits: 8,
        refreshBacklog: 40,
        systemLoadScore: 80,
        loadState: LoadState.LOW_LOAD,
      });
      
      jest.advanceTimersByTime(10000);
      
      const rawAfter = backpressureManager.getRawLoadScore();
      const smoothedAfter = backpressureManager.getSmoothedLoadScore();
      
      // Raw should jump to 80
      expect(rawAfter).toBe(80);
      
      // Smoothed should be much lower (EMA dampens spike)
      expect(smoothedAfter).toBeLessThan(rawAfter);
      expect(smoothedAfter).toBeGreaterThan(smoothedBefore);
    });
  });

  describe('Coordinated Behavior', () => {
    it('should coordinate backpressure and concurrency ramping', async () => {
      const mockCollectMetrics = jest.spyOn(backpressureManager as any, 'collectMetrics');
      
      backpressureManager.startMonitoring();
      
      // Start with low load
      expect(backpressureManager.getCurrentState()).toBe(LoadState.LOW_LOAD);
      expect(publishPacer.getCurrentConcurrency()).toBe(5);
      
      // Increase load to CRITICAL
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 90,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 90,
        rateLimitHits: 9,
        refreshBacklog: 45,
        systemLoadScore: 90,
        loadState: LoadState.LOW_LOAD,
      });
      
      // Wait for state transitions (LOW → ELEVATED → HIGH → CRITICAL)
      // Each transition requires dwell time + cooldown
      jest.advanceTimersByTime(100000);
      
      // Should eventually reach CRITICAL
      expect(backpressureManager.getCurrentState()).toBe(LoadState.CRITICAL_LOAD);
      
      // Concurrency should ramp down to 0
      expect(publishPacer.getTargetConcurrency()).toBe(0);
      
      // Wait for full ramp down
      jest.advanceTimersByTime(30000);
      expect(publishPacer.getCurrentConcurrency()).toBe(0);
      
      // System is now paused
      expect(publishPacer.isPaused()).toBe(true);
    });
  });

  describe('Recovery Scenario', () => {
    it('should recover gracefully from CRITICAL to LOW', async () => {
      const mockCollectMetrics = jest.spyOn(backpressureManager as any, 'collectMetrics');
      
      // Start in CRITICAL
      backpressureManager.forceState(LoadState.CRITICAL_LOAD);
      publishPacer['handleLoadStateChange'](LoadState.CRITICAL_LOAD);
      
      // Wait for concurrency to reach 0
      jest.advanceTimersByTime(30000);
      expect(publishPacer.getCurrentConcurrency()).toBe(0);
      
      backpressureManager.startMonitoring();
      
      // Gradually decrease load
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 75,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 75,
        rateLimitHits: 8,
        refreshBacklog: 38,
        systemLoadScore: 75,
        loadState: LoadState.CRITICAL_LOAD,
      });
      
      // Wait for transition to HIGH
      jest.advanceTimersByTime(50000);
      expect(backpressureManager.getCurrentState()).toBe(LoadState.HIGH_LOAD);
      
      // Concurrency should start ramping up
      expect(publishPacer.getTargetConcurrency()).toBe(2);
      jest.advanceTimersByTime(10000);
      expect(publishPacer.getCurrentConcurrency()).toBeGreaterThan(0);
      
      // Continue decreasing load
      mockCollectMetrics.mockResolvedValue({
        queueDepth: 30,
        activeWorkers: 5,
        workerCapacity: 25,
        retryRate: 30,
        rateLimitHits: 3,
        refreshBacklog: 15,
        systemLoadScore: 30,
        loadState: LoadState.HIGH_LOAD,
      });
      
      // Wait for full recovery
      jest.advanceTimersByTime(100000);
      
      // Should eventually return to LOW
      expect(backpressureManager.getCurrentState()).toBe(LoadState.LOW_LOAD);
      
      // Concurrency should ramp back to 5
      expect(publishPacer.getTargetConcurrency()).toBe(5);
      jest.advanceTimersByTime(20000);
      expect(publishPacer.getCurrentConcurrency()).toBe(5);
    });
  });

  describe('Configuration Validation', () => {
    it('should have valid hysteresis configuration', () => {
      const thresholds = ResilienceConfig.LOAD_THRESHOLDS;
      
      // Verify hysteresis bands
      expect(thresholds.ELEVATED_TO_LOW_EXIT).toBeLessThan(thresholds.LOW_TO_ELEVATED_ENTER);
      expect(thresholds.HIGH_TO_ELEVATED_EXIT).toBeLessThan(thresholds.ELEVATED_TO_HIGH_ENTER);
      expect(thresholds.CRITICAL_TO_HIGH_EXIT).toBeLessThan(thresholds.HIGH_TO_CRITICAL_ENTER);
    });

    it('should have valid control loop configuration', () => {
      const config = ResilienceConfig.CONTROL_LOOP;
      
      expect(config.emaAlpha).toBeGreaterThan(0);
      expect(config.emaAlpha).toBeLessThanOrEqual(1);
      
      expect(config.dwellTimeLowMs).toBeGreaterThan(0);
      expect(config.dwellTimeElevatedMs).toBeGreaterThan(0);
      expect(config.dwellTimeHighMs).toBeGreaterThan(0);
      expect(config.dwellTimeCriticalMs).toBeGreaterThan(0);
      
      expect(config.transitionCooldownMs).toBeGreaterThan(0);
      expect(config.oscillationThreshold).toBeGreaterThan(0);
      expect(config.oscillationFreezeMs).toBeGreaterThan(0);
      
      expect(config.rampIntervalMs).toBeGreaterThan(0);
      expect(config.rampStepSize).toBeGreaterThan(0);
    });
  });
});
