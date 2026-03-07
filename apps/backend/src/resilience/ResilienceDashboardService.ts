import { logger } from '../utils/logger';
import { ResilienceMetrics } from './types';
import { latencyTracker } from './LatencyTracker';
import { backpressureManager } from './BackpressureManager';
import { adaptivePublishPacer } from './AdaptivePublishPacer';
import { adaptiveRefreshScheduler } from './AdaptiveRefreshScheduler';
import { admissionController } from './AdmissionController';
import { degradedModeManager } from './DegradedModeManager';
import { QueueManager } from '../queue/QueueManager';
import { retryStormProtectionService } from '../services/RetryStormProtectionService';

/**
 * Resilience Dashboard Service
 * 
 * Provides comprehensive resilience metrics and status
 * 
 * Exposed via GET /resilience-status endpoint
 * 
 * Metrics include:
 * - Current load state
 * - Latency histograms (P50, P95, P99, Max)
 * - Retry metrics
 * - Queue health
 * - Refresh backlog
 * - Admission stats
 * - Degraded mode status
 */

export class ResilienceDashboardService {
  private static instance: ResilienceDashboardService;

  private constructor() {
    logger.info('ResilienceDashboardService initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ResilienceDashboardService {
    if (!ResilienceDashboardService.instance) {
      ResilienceDashboardService.instance = new ResilienceDashboardService();
    }
    return ResilienceDashboardService.instance;
  }

  /**
   * Get comprehensive resilience metrics
   */
  async getMetrics(): Promise<ResilienceMetrics> {
    const timestamp = new Date();
    
    // Collect all metrics
    const latency = latencyTracker.getMetrics();
    const backpressure = backpressureManager.getLastMetrics() || {
      queueDepth: 0,
      activeWorkers: 0,
      workerCapacity: 0,
      retryRate: 0,
      rateLimitHits: 0,
      refreshBacklog: 0,
      systemLoadScore: 0,
      loadState: backpressureManager.getCurrentState(),
    };
    const admissionControl = admissionController.getMetrics();
    const degradedMode = degradedModeManager.getMetrics();
    
    return {
      timestamp,
      latency,
      backpressure,
      admissionControl,
      degradedMode,
    };
  }

  /**
   * Get resilience status (human-readable)
   */
  async getStatus(): Promise<any> {
    const metrics = await this.getMetrics();
    const queueManager = QueueManager.getInstance();
    const retryStats = await retryStormProtectionService.getRetryStats();
    
    // Get queue stats
    const postingQueueStats = await queueManager.getQueueStats('posting-queue');
    const refreshQueueStats = await queueManager.getQueueStats('refresh-queue');
    
    // Get pacing metrics
    const pacingMetrics = adaptivePublishPacer.getMetrics();
    
    // Get refresh scheduler metrics
    const refreshMetrics = adaptiveRefreshScheduler.getMetrics();
    
    return {
      timestamp: metrics.timestamp.toISOString(),
      
      // System health
      health: {
        loadState: metrics.backpressure.loadState,
        systemLoadScore: metrics.backpressure.systemLoadScore,
        degradedMode: metrics.degradedMode.state,
        isDegraded: degradedModeManager.isDegraded(),
        isRecovering: degradedModeManager.isRecovering(),
      },
      
      // Latency metrics
      latency: {
        publish: {
          p50: `${Math.round(metrics.latency.publish.p50)}ms`,
          p95: `${Math.round(metrics.latency.publish.p95)}ms`,
          p99: `${Math.round(metrics.latency.publish.p99)}ms`,
          max: `${Math.round(metrics.latency.publish.max)}ms`,
          avg: `${Math.round(metrics.latency.publish.avg)}ms`,
          count: metrics.latency.publish.count,
        },
        refresh: {
          p50: `${Math.round(metrics.latency.refresh.p50)}ms`,
          p95: `${Math.round(metrics.latency.refresh.p95)}ms`,
          p99: `${Math.round(metrics.latency.refresh.p99)}ms`,
          max: `${Math.round(metrics.latency.refresh.max)}ms`,
          avg: `${Math.round(metrics.latency.refresh.avg)}ms`,
          count: metrics.latency.refresh.count,
        },
        queueLag: {
          p50: `${Math.round(metrics.latency.queueLag.p50 / 1000)}s`,
          p95: `${Math.round(metrics.latency.queueLag.p95 / 1000)}s`,
          p99: `${Math.round(metrics.latency.queueLag.p99 / 1000)}s`,
          max: `${Math.round(metrics.latency.queueLag.max / 1000)}s`,
          avg: `${Math.round(metrics.latency.queueLag.avg / 1000)}s`,
          count: metrics.latency.queueLag.count,
        },
        lockAcquisition: {
          p50: `${Math.round(metrics.latency.lockAcquisition.p50)}ms`,
          p95: `${Math.round(metrics.latency.lockAcquisition.p95)}ms`,
          p99: `${Math.round(metrics.latency.lockAcquisition.p99)}ms`,
          max: `${Math.round(metrics.latency.lockAcquisition.max)}ms`,
          avg: `${Math.round(metrics.latency.lockAcquisition.avg)}ms`,
          count: metrics.latency.lockAcquisition.count,
        },
      },
      
      // Backpressure metrics
      backpressure: {
        queueDepth: metrics.backpressure.queueDepth,
        activeWorkers: metrics.backpressure.activeWorkers,
        workerCapacity: metrics.backpressure.workerCapacity,
        utilization: `${Math.round((metrics.backpressure.activeWorkers / metrics.backpressure.workerCapacity) * 100)}%`,
        retryRate: `${metrics.backpressure.retryRate}/min`,
        rateLimitHits: metrics.backpressure.rateLimitHits,
        refreshBacklog: metrics.backpressure.refreshBacklog,
      },
      
      // Queue health
      queues: {
        posting: {
          waiting: postingQueueStats.waiting,
          active: postingQueueStats.active,
          completed: postingQueueStats.completed,
          failed: postingQueueStats.failed,
          delayed: postingQueueStats.delayed,
          failureRate: `${postingQueueStats.failureRate}%`,
          health: postingQueueStats.health,
        },
        refresh: {
          waiting: refreshQueueStats.waiting,
          active: refreshQueueStats.active,
          completed: refreshQueueStats.completed,
          failed: refreshQueueStats.failed,
          delayed: refreshQueueStats.delayed,
          failureRate: `${refreshQueueStats.failureRate}%`,
          health: refreshQueueStats.health,
        },
      },
      
      // Retry metrics
      retries: {
        global: retryStats.global,
        byComponent: retryStats.components,
      },
      
      // Pacing metrics
      pacing: {
        currentConcurrency: pacingMetrics.currentConcurrency,
        normalConcurrency: pacingMetrics.normalConcurrency,
        isPaused: pacingMetrics.isPaused,
        loadState: pacingMetrics.currentLoadState,
      },
      
      // Refresh scheduler metrics
      refreshScheduler: {
        loadState: refreshMetrics.currentLoadState,
        maxRefreshPerSecond: refreshMetrics.maxRefreshPerSecond,
        platforms: refreshMetrics.platformMetrics,
      },
      
      // Admission control metrics
      admissionControl: {
        totalRequests: metrics.admissionControl.totalRequests,
        acceptedRequests: metrics.admissionControl.acceptedRequests,
        rejectedRequests: metrics.admissionControl.rejectedRequests,
        delayedRequests: metrics.admissionControl.delayedRequests,
        rejectionRate: `${metrics.admissionControl.rejectionRate.toFixed(2)}%`,
      },
      
      // Degraded mode metrics
      degradedMode: {
        state: metrics.degradedMode.state,
        enteredAt: metrics.degradedMode.enteredAt?.toISOString(),
        duration: metrics.degradedMode.duration 
          ? `${Math.round(metrics.degradedMode.duration / 1000)}s`
          : undefined,
        triggers: metrics.degradedMode.triggers,
        recoveryProgress: `${Math.round(metrics.degradedMode.recoveryProgress * 100)}%`,
      },
    };
  }

  /**
   * Get resilience summary (compact)
   */
  async getSummary(): Promise<any> {
    const metrics = await this.getMetrics();
    
    return {
      timestamp: metrics.timestamp.toISOString(),
      loadState: metrics.backpressure.loadState,
      systemLoadScore: metrics.backpressure.systemLoadScore,
      degradedMode: metrics.degradedMode.state,
      publishP99: `${Math.round(metrics.latency.publish.p99)}ms`,
      queueLagP99: `${Math.round(metrics.latency.queueLag.p99 / 1000)}s`,
      queueDepth: metrics.backpressure.queueDepth,
      retryRate: `${metrics.backpressure.retryRate}/min`,
      rejectionRate: `${metrics.admissionControl.rejectionRate.toFixed(2)}%`,
    };
  }

  /**
   * Export metrics for monitoring systems (Prometheus format)
   */
  async exportMetrics(): Promise<string> {
    const metrics = await this.getMetrics();
    const lines: string[] = [];
    
    // Latency metrics
    lines.push(`# HELP resilience_publish_latency_p99 Publish latency P99 in milliseconds`);
    lines.push(`# TYPE resilience_publish_latency_p99 gauge`);
    lines.push(`resilience_publish_latency_p99 ${Math.round(metrics.latency.publish.p99)}`);
    
    lines.push(`# HELP resilience_queue_lag_p99 Queue lag P99 in seconds`);
    lines.push(`# TYPE resilience_queue_lag_p99 gauge`);
    lines.push(`resilience_queue_lag_p99 ${Math.round(metrics.latency.queueLag.p99 / 1000)}`);
    
    // Backpressure metrics
    lines.push(`# HELP resilience_system_load_score System load score (0-100)`);
    lines.push(`# TYPE resilience_system_load_score gauge`);
    lines.push(`resilience_system_load_score ${metrics.backpressure.systemLoadScore}`);
    
    lines.push(`# HELP resilience_queue_depth Queue depth (waiting + delayed)`);
    lines.push(`# TYPE resilience_queue_depth gauge`);
    lines.push(`resilience_queue_depth ${metrics.backpressure.queueDepth}`);
    
    lines.push(`# HELP resilience_retry_rate Retry rate per minute`);
    lines.push(`# TYPE resilience_retry_rate gauge`);
    lines.push(`resilience_retry_rate ${metrics.backpressure.retryRate}`);
    
    // Admission control metrics
    lines.push(`# HELP resilience_admission_rejection_rate Admission rejection rate percentage`);
    lines.push(`# TYPE resilience_admission_rejection_rate gauge`);
    lines.push(`resilience_admission_rejection_rate ${metrics.admissionControl.rejectionRate}`);
    
    // Degraded mode
    lines.push(`# HELP resilience_degraded_mode Degraded mode state (0=normal, 1=degraded, 2=recovering)`);
    lines.push(`# TYPE resilience_degraded_mode gauge`);
    const degradedModeValue = 
      metrics.degradedMode.state === 'NORMAL' ? 0 :
      metrics.degradedMode.state === 'DEGRADED' ? 1 : 2;
    lines.push(`resilience_degraded_mode ${degradedModeValue}`);
    
    return lines.join('\n') + '\n';
  }
}

// Export singleton instance
export const resilienceDashboardService = ResilienceDashboardService.getInstance();
