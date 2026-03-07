/**
 * Degradation Metrics Tests
 * 
 * Tests the degradation metrics functionality
 */

import { publishingWorkerWrapper } from '../../../../../.kiro/execution/reliability/PublishingWorkerWrapper';

describe('Degradation Metrics', () => {
  beforeEach(() => {
    // Reset metrics before each test
    publishingWorkerWrapper.resetMetrics();
  });

  describe('getMetrics()', () => {
    it('should return metrics object with expected properties', () => {
      const metrics = publishingWorkerWrapper.getMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
      expect(metrics).toHaveProperty('total_operations');
      expect(metrics).toHaveProperty('total_degraded_operations');
      expect(metrics).toHaveProperty('media_fallback_count');
      expect(metrics).toHaveProperty('ai_fallback_count');
      expect(metrics).toHaveProperty('email_failure_count');
      expect(metrics).toHaveProperty('analytics_failure_count');
      expect(metrics).toHaveProperty('circuit_open_fallback_count');
    });

    it('should return zero values when no operations', () => {
      const metrics = publishingWorkerWrapper.getMetrics();

      expect(metrics.total_degraded_operations).toBe(0);
      expect(metrics.total_operations).toBe(0);
    });
  });

  describe('getCircuitBreakerStats()', () => {
    it('should return circuit breaker statistics', () => {
      const stats = publishingWorkerWrapper.getCircuitBreakerStats();

      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
      expect(stats).toHaveProperty('services');
    });
  });

  describe('Metrics Calculation', () => {
    it('should handle zero operations gracefully', () => {
      const metrics = publishingWorkerWrapper.getMetrics();

      const totalOperations = metrics.total_operations || 0;
      const totalDegradedOperations = metrics.total_degraded_operations || 0;
      
      const degradationRate = totalOperations > 0 
        ? ((totalDegradedOperations / totalOperations) * 100).toFixed(2)
        : '0.00';

      expect(degradationRate).toBe('0.00');
    });
  });

  describe('Metrics Reset', () => {
    it('should reset metrics to zero', () => {
      publishingWorkerWrapper.resetMetrics();

      const metrics = publishingWorkerWrapper.getMetrics();

      expect(metrics.total_degraded_operations).toBe(0);
      expect(metrics.media_fallback_count).toBe(0);
      expect(metrics.ai_fallback_count).toBe(0);
      expect(metrics.email_failure_count).toBe(0);
      expect(metrics.analytics_failure_count).toBe(0);
    });
  });
});
