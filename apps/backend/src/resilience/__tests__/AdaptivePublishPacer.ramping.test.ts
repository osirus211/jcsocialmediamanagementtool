/**
 * AdaptivePublishPacer Concurrency Ramping Tests
 * 
 * Tests for gradual concurrency adjustment
 */

import { LoadState } from '../types';
import { ResilienceConfig } from '../ResilienceConfig';

// Mock dependencies before imports
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../BackpressureManager', () => ({
  backpressureManager: {
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  },
}));

// Now import after mocks
import { AdaptivePublishPacer } from '../AdaptivePublishPacer';
import { backpressureManager } from '../BackpressureManager';

describe('AdaptivePublishPacer - Concurrency Ramping', () => {
  let pacer: AdaptivePublishPacer;
  let mockBackpressureManager: jest.Mocked<typeof backpressureManager>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockBackpressureManager = backpressureManager as jest.Mocked<typeof backpressureManager>;
    mockBackpressureManager.on = jest.fn();
    mockBackpressureManager.removeAllListeners = jest.fn();
    
    pacer = AdaptivePublishPacer.getInstance();
  });
  
  afterEach(() => {
    pacer.shutdown();
    jest.useRealTimers();
  });

  describe('Gradual Ramping', () => {
    it('should ramp down concurrency gradually', () => {
      // Start at normal concurrency (5)
      expect(pacer.getCurrentConcurrency()).toBe(5);
      expect(pacer.getTargetConcurrency()).toBe(5);
      
      // Simulate load state change to HIGH (target = 2)
      const loadStateChangeHandler = (mockBackpressureManager.on as jest.Mock).mock.calls[0][1];
      loadStateChangeHandler({ newState: LoadState.HIGH_LOAD });
      
      expect(pacer.getTargetConcurrency()).toBe(2);
      expect(pacer.getCurrentConcurrency()).toBe(5); // Still at 5
      
      // Advance ramp interval (5s)
      jest.advanceTimersByTime(5000);
      
      // Should ramp down by 1
      expect(pacer.getCurrentConcurrency()).toBe(4);
      
      // Advance another interval
      jest.advanceTimersByTime(5000);
      
      // Should ramp down by 1 more
      expect(pacer.getCurrentConcurrency()).toBe(3);
      
      // Advance another interval
      jest.advanceTimersByTime(5000);
      
      // Should reach target
      expect(pacer.getCurrentConcurrency()).toBe(2);
      
      // Advance another interval
      jest.advanceTimersByTime(5000);
      
      // Should stay at target
      expect(pacer.getCurrentConcurrency()).toBe(2);
    });

    it('should ramp up concurrency gradually', () => {
      // Start at HIGH load (concurrency = 2)
      const loadStateChangeHandler = (mockBackpressureManager.on as jest.Mock).mock.calls[0][1];
      loadStateChangeHandler({ newState: LoadState.HIGH_LOAD });
      
      // Wait for ramp down
      jest.advanceTimersByTime(20000);
      
      expect(pacer.getCurrentConcurrency()).toBe(2);
      
      // Simulate load state change to LOW (target = 5)
      loadStateChangeHandler({ newState: LoadState.LOW_LOAD });
      
      expect(pacer.getTargetConcurrency()).toBe(5);
      expect(pacer.getCurrentConcurrency()).toBe(2); // Still at 2
      
      // Advance ramp interval (5s)
      jest.advanceTimersByTime(5000);
      
      // Should ramp up by 1
      expect(pacer.getCurrentConcurrency()).toBe(3);
      
      // Advance another interval
      jest.advanceTimersByTime(5000);
      
      // Should ramp up by 1 more
      expect(pacer.getCurrentConcurrency()).toBe(4);
      
      // Advance another interval
      jest.advanceTimersByTime(5000);
      
      // Should reach target
      expect(pacer.getCurrentConcurrency()).toBe(5);
    });

    it('should not jump instantly from 5 to 0', () => {
      // Start at normal concurrency (5)
      expect(pacer.getCurrentConcurrency()).toBe(5);
      
      // Simulate load state change to CRITICAL (target = 0)
      const loadStateChangeHandler = (mockBackpressureManager.on as jest.Mock).mock.calls[0][1];
      loadStateChangeHandler({ newState: LoadState.CRITICAL_LOAD });
      
      expect(pacer.getTargetConcurrency()).toBe(0);
      expect(pacer.getCurrentConcurrency()).toBe(5); // Still at 5
      
      // Advance ramp intervals
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(5000);
        expect(pacer.getCurrentConcurrency()).toBe(5 - (i + 1));
      }
      
      // Should reach 0 after 5 intervals (25 seconds)
      expect(pacer.getCurrentConcurrency()).toBe(0);
    });

    it('should respect ramp step size', () => {
      const stepSize = ResilienceConfig.CONTROL_LOOP.rampStepSize;
      
      expect(stepSize).toBe(1);
      
      // Start at 5, target 2
      const loadStateChangeHandler = (mockBackpressureManager.on as jest.Mock).mock.calls[0][1];
      loadStateChangeHandler({ newState: LoadState.HIGH_LOAD });
      
      const initialConcurrency = pacer.getCurrentConcurrency();
      
      jest.advanceTimersByTime(5000);
      
      const afterRamp = pacer.getCurrentConcurrency();
      
      // Should decrease by exactly stepSize
      expect(initialConcurrency - afterRamp).toBe(stepSize);
    });
  });

  describe('Ramp Interval', () => {
    it('should use configurable ramp interval', () => {
      const rampIntervalMs = ResilienceConfig.CONTROL_LOOP.rampIntervalMs;
      
      expect(rampIntervalMs).toBe(5000);
    });

    it('should ramp at correct intervals', () => {
      // Start at 5, target 2
      const loadStateChangeHandler = (mockBackpressureManager.on as jest.Mock).mock.calls[0][1];
      loadStateChangeHandler({ newState: LoadState.HIGH_LOAD });
      
      expect(pacer.getCurrentConcurrency()).toBe(5);
      
      // Advance less than interval
      jest.advanceTimersByTime(4000);
      expect(pacer.getCurrentConcurrency()).toBe(5); // No change
      
      // Advance to complete interval
      jest.advanceTimersByTime(1000);
      expect(pacer.getCurrentConcurrency()).toBe(4); // Ramped
      
      // Advance another interval
      jest.advanceTimersByTime(5000);
      expect(pacer.getCurrentConcurrency()).toBe(3); // Ramped again
    });
  });

  describe('Target Tracking', () => {
    it('should expose current and target concurrency', () => {
      expect(pacer.getCurrentConcurrency()).toBe(5);
      expect(pacer.getTargetConcurrency()).toBe(5);
      
      const loadStateChangeHandler = (mockBackpressureManager.on as jest.Mock).mock.calls[0][1];
      loadStateChangeHandler({ newState: LoadState.HIGH_LOAD });
      
      expect(pacer.getCurrentConcurrency()).toBe(5);
      expect(pacer.getTargetConcurrency()).toBe(2);
    });

    it('should stop ramping when target reached', () => {
      const loadStateChangeHandler = (mockBackpressureManager.on as jest.Mock).mock.calls[0][1];
      loadStateChangeHandler({ newState: LoadState.ELEVATED_LOAD });
      
      // Wait for ramp to complete
      jest.advanceTimersByTime(10000);
      
      expect(pacer.getCurrentConcurrency()).toBe(4);
      expect(pacer.getTargetConcurrency()).toBe(4);
      
      // Advance more intervals
      jest.advanceTimersByTime(20000);
      
      // Should stay at target
      expect(pacer.getCurrentConcurrency()).toBe(4);
    });
  });

  describe('Metrics', () => {
    it('should track ramp count', () => {
      const loadStateChangeHandler = (mockBackpressureManager.on as jest.Mock).mock.calls[0][1];
      loadStateChangeHandler({ newState: LoadState.HIGH_LOAD });
      
      const metricsBefore = pacer.getMetrics();
      expect(metricsBefore.concurrencyRampCount).toBe(0);
      
      // Trigger ramp
      jest.advanceTimersByTime(5000);
      
      const metricsAfter = pacer.getMetrics();
      expect(metricsAfter.concurrencyRampCount).toBe(1);
      
      // Trigger another ramp
      jest.advanceTimersByTime(5000);
      
      const metricsAfter2 = pacer.getMetrics();
      expect(metricsAfter2.concurrencyRampCount).toBe(2);
    });

    it('should expose target concurrency in metrics', () => {
      const loadStateChangeHandler = (mockBackpressureManager.on as jest.Mock).mock.calls[0][1];
      loadStateChangeHandler({ newState: LoadState.HIGH_LOAD });
      
      const metrics = pacer.getMetrics();
      
      expect(metrics.currentConcurrency).toBe(5);
      expect(metrics.targetConcurrency).toBe(2);
    });
  });

  describe('Multiple State Changes', () => {
    it('should handle rapid target changes', () => {
      const loadStateChangeHandler = (mockBackpressureManager.on as jest.Mock).mock.calls[0][1];
      
      // Change to HIGH (target = 2)
      loadStateChangeHandler({ newState: LoadState.HIGH_LOAD });
      expect(pacer.getTargetConcurrency()).toBe(2);
      
      // Ramp once
      jest.advanceTimersByTime(5000);
      expect(pacer.getCurrentConcurrency()).toBe(4);
      
      // Change to ELEVATED (target = 4)
      loadStateChangeHandler({ newState: LoadState.ELEVATED_LOAD });
      expect(pacer.getTargetConcurrency()).toBe(4);
      
      // Should stop ramping (already at target)
      jest.advanceTimersByTime(5000);
      expect(pacer.getCurrentConcurrency()).toBe(4);
      
      // Change to CRITICAL (target = 0)
      loadStateChangeHandler({ newState: LoadState.CRITICAL_LOAD });
      expect(pacer.getTargetConcurrency()).toBe(0);
      
      // Should ramp down
      jest.advanceTimersByTime(5000);
      expect(pacer.getCurrentConcurrency()).toBe(3);
    });

    it('should reverse ramp direction when target changes', () => {
      const loadStateChangeHandler = (mockBackpressureManager.on as jest.Mock).mock.calls[0][1];
      
      // Start ramping down to 2
      loadStateChangeHandler({ newState: LoadState.HIGH_LOAD });
      jest.advanceTimersByTime(5000);
      expect(pacer.getCurrentConcurrency()).toBe(4);
      
      // Change target back up to 5
      loadStateChangeHandler({ newState: LoadState.LOW_LOAD });
      expect(pacer.getTargetConcurrency()).toBe(5);
      
      // Should ramp up
      jest.advanceTimersByTime(5000);
      expect(pacer.getCurrentConcurrency()).toBe(5);
    });
  });

  describe('Shutdown', () => {
    it('should stop ramping on shutdown', () => {
      const loadStateChangeHandler = (mockBackpressureManager.on as jest.Mock).mock.calls[0][1];
      loadStateChangeHandler({ newState: LoadState.HIGH_LOAD });
      
      pacer.shutdown();
      
      // Advance time
      jest.advanceTimersByTime(10000);
      
      // Should not ramp after shutdown
      expect(pacer.getCurrentConcurrency()).toBe(5);
    });
  });
});
