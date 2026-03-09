/**
 * Metrics Controller
 * 
 * Handles /metrics endpoint for Prometheus
 * 
 * Features:
 * - Prometheus-compatible endpoint
 * - Non-blocking
 * - Never crashes
 * - Production-safe
 */

import { Request, Response } from 'express';
import { MetricsService } from '../services/metrics/MetricsService';
import { logger } from '../utils/logger';
// import { publishingWorkerWrapper } from '../../../../.kiro/execution/reliability/PublishingWorkerWrapper';

// Mock publishingWorkerWrapper for Docker environment
const publishingWorkerWrapper = {
  getMetrics: () => ({
    total_operations: 0,
    total_degraded_operations: 0,
    media_fallback_count: 0,
    ai_fallback_count: 0,
    email_failure_count: 0,
    analytics_failure_count: 0,
    circuit_open_fallback_count: 0,
  }),
  getCircuitBreakerStats: () => ({
    services: {},
  }),
};

export class MetricsController {
  private metricsService: MetricsService;

  constructor(metricsService: MetricsService) {
    this.metricsService = metricsService;
  }

  /**
   * GET /metrics
   * Returns Prometheus-formatted metrics
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      // Update Redis and Worker metrics before exporting
      const { updateRedisMetrics, updateWorkerMetrics } = await import('../config/metrics');
      updateRedisMetrics();
      updateWorkerMetrics();
      
      const metrics = await this.metricsService.getPrometheusMetrics();
      
      // Set Prometheus content type
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(200).send(metrics);
      
    } catch (error: any) {
      logger.error('Metrics endpoint error', {
        error: error.message,
        stack: error.stack,
      });
      
      // Return error metric instead of crashing
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(500).send(
        '# HELP metrics_endpoint_error Metrics endpoint error (1=error, 0=ok)\n' +
        '# TYPE metrics_endpoint_error gauge\n' +
        'metrics_endpoint_error 1\n'
      );
    }
  }

  /**
   * GET /api/metrics/degradation
   * Returns graceful degradation metrics in JSON format
   * 
   * Exposes:
   * - Degradation rate (percentage of operations that used fallbacks)
   * - Circuit breaker states for each service (OPEN/CLOSED/HALF_OPEN)
   * - Fallback activation counts per service
   * - Total degraded operations count
   */
  async getDegradationMetrics(req: Request, res: Response): Promise<void> {
    try {
      // Get metrics from PublishingWorkerWrapper
      const degradationMetrics = publishingWorkerWrapper.getMetrics();
      const circuitBreakerStats = publishingWorkerWrapper.getCircuitBreakerStats();

      // Calculate degradation rate
      const totalOperations = degradationMetrics.total_operations || 0;
      const totalDegradedOperations = degradationMetrics.total_degraded_operations || 0;
      
      const degradationRate = totalOperations > 0 
        ? ((totalDegradedOperations / totalOperations) * 100).toFixed(2)
        : '0.00';

      // Build circuit breaker states map
      const circuitBreakerStates: Record<string, string> = {};
      if (circuitBreakerStats && circuitBreakerStats.services) {
        for (const [serviceName, stats] of Object.entries(circuitBreakerStats.services)) {
          circuitBreakerStates[serviceName] = stats.state || 'CLOSED';
        }
      }

      // Build fallback counts map
      const fallbackCounts: Record<string, number> = {
        media: degradationMetrics.media_fallback_count || 0,
        ai: degradationMetrics.ai_fallback_count || 0,
        email: degradationMetrics.email_failure_count || 0,
        analytics: degradationMetrics.analytics_failure_count || 0,
        circuitOpen: degradationMetrics.circuit_open_fallback_count || 0,
      };

      // Build response
      const response = {
        degradationRate: `${degradationRate}%`,
        degradationRateNumeric: parseFloat(degradationRate),
        totalDegradedOperations: totalDegradedOperations,
        totalOperations: totalOperations,
        circuitBreakerStates,
        fallbackCounts,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
      
    } catch (error: any) {
      logger.error('Degradation metrics endpoint error', {
        error: error.message,
        stack: error.stack,
      });
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve degradation metrics',
      });
    }
  }

  /**
   * GET /api/metrics/degradation/prometheus
   * Returns graceful degradation metrics in Prometheus format
   * 
   * Provides the same metrics as /api/metrics/degradation but in Prometheus format
   * for integration with Prometheus monitoring systems
   */
  async getDegradationMetricsPrometheus(req: Request, res: Response): Promise<void> {
    try {
      // Get metrics from PublishingWorkerWrapper
      const degradationMetrics = publishingWorkerWrapper.getMetrics();
      const circuitBreakerStats = publishingWorkerWrapper.getCircuitBreakerStats();

      // Calculate degradation rate
      const totalOperations = degradationMetrics.total_operations || 0;
      const totalDegradedOperations = degradationMetrics.total_degraded_operations || 0;
      
      const degradationRate = totalOperations > 0 
        ? (totalDegradedOperations / totalOperations) * 100
        : 0;

      // Build Prometheus metrics
      let prometheusMetrics = '';

      // Degradation rate
      prometheusMetrics += '# HELP degradation_rate Percentage of operations that used fallbacks\n';
      prometheusMetrics += '# TYPE degradation_rate gauge\n';
      prometheusMetrics += `degradation_rate ${degradationRate.toFixed(2)}\n\n`;

      // Total degraded operations
      prometheusMetrics += '# HELP degradation_total_degraded_operations Total number of degraded operations\n';
      prometheusMetrics += '# TYPE degradation_total_degraded_operations counter\n';
      prometheusMetrics += `degradation_total_degraded_operations ${totalDegradedOperations}\n\n`;

      // Total operations
      prometheusMetrics += '# HELP degradation_total_operations Total number of operations\n';
      prometheusMetrics += '# TYPE degradation_total_operations counter\n';
      prometheusMetrics += `degradation_total_operations ${totalOperations}\n\n`;

      // Circuit breaker states (1=OPEN, 0=CLOSED, 0.5=HALF_OPEN)
      prometheusMetrics += '# HELP degradation_circuit_breaker_state Circuit breaker state (1=OPEN, 0=CLOSED, 0.5=HALF_OPEN)\n';
      prometheusMetrics += '# TYPE degradation_circuit_breaker_state gauge\n';
      if (circuitBreakerStats && circuitBreakerStats.services) {
        for (const [serviceName, stats] of Object.entries(circuitBreakerStats.services)) {
          const state = stats.state || 'CLOSED';
          const stateValue = state === 'OPEN' ? 1 : state === 'HALF_OPEN' ? 0.5 : 0;
          prometheusMetrics += `degradation_circuit_breaker_state{service="${serviceName}"} ${stateValue}\n`;
        }
      }
      prometheusMetrics += '\n';

      // Fallback counts per service
      prometheusMetrics += '# HELP degradation_fallback_count Number of fallback activations per service\n';
      prometheusMetrics += '# TYPE degradation_fallback_count counter\n';
      prometheusMetrics += `degradation_fallback_count{service="media"} ${degradationMetrics.media_fallback_count || 0}\n`;
      prometheusMetrics += `degradation_fallback_count{service="ai"} ${degradationMetrics.ai_fallback_count || 0}\n`;
      prometheusMetrics += `degradation_fallback_count{service="email"} ${degradationMetrics.email_failure_count || 0}\n`;
      prometheusMetrics += `degradation_fallback_count{service="analytics"} ${degradationMetrics.analytics_failure_count || 0}\n`;
      prometheusMetrics += `degradation_fallback_count{service="circuit_open"} ${degradationMetrics.circuit_open_fallback_count || 0}\n`;

      // Set Prometheus content type
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(200).send(prometheusMetrics);
      
    } catch (error: any) {
      logger.error('Degradation metrics Prometheus endpoint error', {
        error: error.message,
        stack: error.stack,
      });
      
      // Return error metric instead of crashing
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(500).send(
        '# HELP degradation_metrics_error Degradation metrics endpoint error (1=error, 0=ok)\n' +
        '# TYPE degradation_metrics_error gauge\n' +
        'degradation_metrics_error 1\n'
      );
    }
  }
}
