/**
 * Resilience System
 * 
 * Adaptive resilience, backpressure control, and degraded mode
 * 
 * Components:
 * - LatencyTracker: Tracks latency histograms with P50, P95, P99, Max
 * - BackpressureManager: Monitors system load and emits state change events
 * - AdaptivePublishPacer: Dynamically adjusts worker concurrency
 * - AdaptiveRefreshScheduler: Throttles token refresh operations
 * - AdmissionController: Controls admission of new schedule requests
 * - DegradedModeManager: Triggers degraded mode under extreme stress
 * - ResilienceDashboardService: Provides comprehensive metrics and status
 * 
 * Usage:
 * ```typescript
 * import { startResilienceSystem, stopResilienceSystem } from './resilience';
 * 
 * // Start monitoring
 * startResilienceSystem();
 * 
 * // Stop monitoring
 * await stopResilienceSystem();
 * ```
 */

export * from './types';
export * from './ResilienceConfig';
export * from './LatencyTracker';
export * from './BackpressureManager';
export * from './AdaptivePublishPacer';
export * from './AdaptiveRefreshScheduler';
export * from './AdmissionController';
export * from './DegradedModeManager';
export * from './ResilienceDashboardService';

import { logger } from '../utils/logger';
import { latencyTracker } from './LatencyTracker';
import { backpressureManager } from './BackpressureManager';
import { adaptivePublishPacer } from './AdaptivePublishPacer';
import { adaptiveRefreshScheduler } from './AdaptiveRefreshScheduler';
import { admissionController } from './AdmissionController';
import { degradedModeManager } from './DegradedModeManager';
import { resilienceDashboardService } from './ResilienceDashboardService';

/**
 * Start resilience system
 * 
 * Initializes all components and starts monitoring
 */
export function startResilienceSystem(): void {
  logger.info('Starting resilience system');
  
  // Start monitoring
  backpressureManager.startMonitoring();
  degradedModeManager.startMonitoring();
  
  logger.info('Resilience system started');
}

/**
 * Stop resilience system
 * 
 * Stops monitoring and shuts down all components
 */
export async function stopResilienceSystem(): Promise<void> {
  logger.info('Stopping resilience system');
  
  // Stop monitoring
  backpressureManager.stopMonitoring();
  degradedModeManager.stopMonitoring();
  
  // Shutdown components
  latencyTracker.shutdown();
  backpressureManager.shutdown();
  adaptivePublishPacer.shutdown();
  adaptiveRefreshScheduler.shutdown();
  admissionController.shutdown();
  degradedModeManager.shutdown();
  
  logger.info('Resilience system stopped');
}

/**
 * Get resilience status
 */
export async function getResilienceStatus(): Promise<any> {
  return resilienceDashboardService.getStatus();
}

/**
 * Get resilience metrics
 */
export async function getResilienceMetrics(): Promise<any> {
  return resilienceDashboardService.getMetrics();
}

/**
 * Export metrics (Prometheus format)
 */
export async function exportResilienceMetrics(): Promise<string> {
  return resilienceDashboardService.exportMetrics();
}
