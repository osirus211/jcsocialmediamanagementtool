/**
 * Metrics Collector
 * 
 * Aggregates metrics from all workers and services
 * 
 * Features:
 * - Non-blocking metric collection
 * - Read-only access to existing metrics
 * - Never crashes if metrics unavailable
 * - Production-safe
 */

import { logger } from '../../utils/logger';
import * as os from 'os';

export interface MetricsCollectorConfig {
  publishingWorker?: any;
  tokenRefreshWorker?: any;
  backupVerificationWorker?: any;
  schedulerService?: any;
  queueManager?: any;
  systemMonitor?: any;
  backpressureMonitor?: any;
  authService?: any;
  httpMetrics?: any;
  publicApiMetrics?: any;
}

export interface CollectedMetrics {
  // System metrics
  process_uptime_seconds: number;
  process_memory_usage_bytes: number;
  cpu_load_average: number;
  
  // Worker metrics
  worker_alive: number;
  publish_success_total: number;
  publish_failed_total: number;
  publish_retry_total: number;
  publish_skipped_total: number;
  active_jobs: number;
  
  // Scheduler metrics
  scheduler_alive: number;
  scheduler_runs_total: number;
  
  // Queue metrics
  queue_waiting_jobs: number;
  queue_active_jobs: number;
  queue_completed_jobs: number;
  queue_failed_jobs: number;
  queue_delayed_jobs: number;
  queue_failure_rate: number;
  queue_jobs_processed_total: number;
  queue_jobs_failed_total: number;
  
  // Token refresh metrics
  token_refresh_success_total: number;
  token_refresh_failed_total: number;
  token_refresh_retry_total: number;
  token_refresh_skipped_total: number;
  
  // Backup verification metrics
  backup_verify_success_total: number;
  backup_verify_failed_total: number;
  backup_verify_last_duration_seconds: number;
  
  // Auth metrics
  auth_login_success_total: number;
  auth_register_success_total: number;
  
  // HTTP metrics
  http_requests_total: number;
  
  // Public API metrics
  public_api_requests_total: number;
  public_api_errors_total: number;
  public_api_rate_limit_hits: number;
  public_api_auth_failures: number;
  public_api_scope_denials: number;
  public_api_latency_avg_ms: number;
  
  // Alerting metrics (if available)
  alerts_total?: number;
  alerts_critical_total?: number;
  alerts_warning_total?: number;
  
  // Backpressure metrics (if available)
  backpressure_detected?: number;
  backpressure_waiting_jobs?: number;
  backpressure_growth_rate?: number;
  backpressure_avg_job_time?: number;
  backpressure_backlog_age?: number;
  backpressure_alerts_sent?: number;
}

export class MetricsCollector {
  private config: MetricsCollectorConfig;
  private static aiMetrics = {
    requests_total: 0,
    success_total: 0,
    failures_total: 0,
    latency_sum_ms: 0,
    latency_count: 0,
  };

  constructor(config: MetricsCollectorConfig) {
    this.config = config;
  }

  /**
   * Record AI request metrics (static method for easy access)
   */
  static recordAIRequest(
    operation: string,
    status: 'success' | 'failure',
    latencyMs: number
  ): void {
    try {
      MetricsCollector.aiMetrics.requests_total++;
      
      if (status === 'success') {
        MetricsCollector.aiMetrics.success_total++;
      } else {
        MetricsCollector.aiMetrics.failures_total++;
      }
      
      MetricsCollector.aiMetrics.latency_sum_ms += latencyMs;
      MetricsCollector.aiMetrics.latency_count++;
      
      logger.debug('AI request recorded', {
        operation,
        status,
        latencyMs,
      });
    } catch (error: any) {
      logger.debug('Failed to record AI metrics', {
        error: error.message,
      });
    }
  }

  /**
   * Get AI metrics
   */
  static getAIMetrics(): any {
    const avgLatency = MetricsCollector.aiMetrics.latency_count > 0
      ? MetricsCollector.aiMetrics.latency_sum_ms / MetricsCollector.aiMetrics.latency_count
      : 0;

    return {
      ai_requests_total: MetricsCollector.aiMetrics.requests_total,
      ai_success_total: MetricsCollector.aiMetrics.success_total,
      ai_failures_total: MetricsCollector.aiMetrics.failures_total,
      ai_latency_avg_ms: Math.round(avgLatency),
    };
  }

  /**
   * Collect all metrics from workers and services
   * SAFETY: Never throws - returns partial metrics on error
   */
  async collect(): Promise<CollectedMetrics> {
    const metrics: CollectedMetrics = {
      // System metrics (always available)
      process_uptime_seconds: Math.floor(process.uptime()),
      process_memory_usage_bytes: process.memoryUsage().rss,
      cpu_load_average: os.loadavg()[0],
      
      // Worker metrics (defaults)
      worker_alive: 0,
      publish_success_total: 0,
      publish_failed_total: 0,
      publish_retry_total: 0,
      publish_skipped_total: 0,
      active_jobs: 0,
      
      // Scheduler metrics (defaults)
      scheduler_alive: 0,
      scheduler_runs_total: 0,
      
      // Queue metrics (defaults)
      queue_waiting_jobs: 0,
      queue_active_jobs: 0,
      queue_completed_jobs: 0,
      queue_failed_jobs: 0,
      queue_delayed_jobs: 0,
      queue_failure_rate: 0,
      queue_jobs_processed_total: 0,
      queue_jobs_failed_total: 0,
      
      // Token refresh metrics (defaults)
      token_refresh_success_total: 0,
      token_refresh_failed_total: 0,
      token_refresh_retry_total: 0,
      token_refresh_skipped_total: 0,
      
      // Backup verification metrics (defaults)
      backup_verify_success_total: 0,
      backup_verify_failed_total: 0,
      backup_verify_last_duration_seconds: 0,
      
      // Auth metrics (defaults)
      auth_login_success_total: 0,
      auth_register_success_total: 0,
      
      // HTTP metrics (defaults)
      http_requests_total: 0,
      
      // Public API metrics (defaults)
      public_api_requests_total: 0,
      public_api_errors_total: 0,
      public_api_rate_limit_hits: 0,
      public_api_auth_failures: 0,
      public_api_scope_denials: 0,
      public_api_latency_avg_ms: 0,
    };

    // Collect publishing worker metrics
    try {
      if (this.config.publishingWorker) {
        const status = this.config.publishingWorker.getStatus();
        metrics.worker_alive = status.isRunning ? 1 : 0;
        
        // Access internal metrics object (read-only)
        const workerMetrics = (this.config.publishingWorker as any).metrics;
        if (workerMetrics) {
          metrics.publish_success_total = workerMetrics.publish_success_total || 0;
          metrics.publish_failed_total = workerMetrics.publish_failed_total || 0;
          metrics.publish_retry_total = workerMetrics.publish_retry_total || 0;
          metrics.publish_skipped_total = workerMetrics.publish_skipped_total || 0;
        }
        
        // Get active jobs count from heartbeat intervals
        const heartbeatIntervals = (this.config.publishingWorker as any).heartbeatIntervals;
        if (heartbeatIntervals) {
          metrics.active_jobs = heartbeatIntervals.size || 0;
        }
      }
    } catch (error: any) {
      logger.debug('Failed to collect publishing worker metrics', {
        error: error.message,
      });
    }

    // Collect scheduler metrics
    try {
      if (this.config.schedulerService) {
        const status = this.config.schedulerService.getStatus();
        metrics.scheduler_alive = status.isRunning ? 1 : 0;
        
        // Access scheduler metrics if available
        const schedulerMetrics = (this.config.schedulerService as any).metrics;
        if (schedulerMetrics) {
          metrics.scheduler_runs_total = schedulerMetrics.scheduler_runs_total || 0;
        }
      }
    } catch (error: any) {
      logger.debug('Failed to collect scheduler metrics', {
        error: error.message,
      });
    }

    // Collect queue metrics
    try {
      if (this.config.queueManager) {
        const stats = await this.config.queueManager.getQueueStats('posting-queue');
        metrics.queue_waiting_jobs = stats.waiting || 0;
        metrics.queue_active_jobs = stats.active || 0;
        metrics.queue_completed_jobs = stats.completed || 0;
        metrics.queue_failed_jobs = stats.failed || 0;
        metrics.queue_delayed_jobs = stats.delayed || 0;
        metrics.queue_failure_rate = parseFloat(stats.failureRate) || 0;
        
        // New queue metrics
        metrics.queue_jobs_processed_total = stats.completed || 0;
        metrics.queue_jobs_failed_total = stats.failed || 0;
      }
    } catch (error: any) {
      logger.debug('Failed to collect queue metrics', {
        error: error.message,
      });
    }

    // Collect token refresh worker metrics
    try {
      if (this.config.tokenRefreshWorker) {
        const status = this.config.tokenRefreshWorker.getStatus();
        if (status.metrics) {
          metrics.token_refresh_success_total = status.metrics.refresh_success_total || 0;
          metrics.token_refresh_failed_total = status.metrics.refresh_failed_total || 0;
          metrics.token_refresh_retry_total = status.metrics.refresh_retry_total || 0;
          metrics.token_refresh_skipped_total = status.metrics.refresh_skipped_total || 0;
        }
      }
    } catch (error: any) {
      logger.debug('Failed to collect token refresh worker metrics', {
        error: error.message,
      });
    }

    // Collect backup verification worker metrics
    try {
      if (this.config.backupVerificationWorker) {
        const status = this.config.backupVerificationWorker.getStatus();
        if (status.metrics) {
          metrics.backup_verify_success_total = status.metrics.verification_success_total || 0;
          metrics.backup_verify_failed_total = status.metrics.verification_failed_total || 0;
          
          // Convert duration from ms to seconds
          const durationMs = status.metrics.last_verification_duration || 0;
          metrics.backup_verify_last_duration_seconds = Math.floor(durationMs / 1000);
        }
      }
    } catch (error: any) {
      logger.debug('Failed to collect backup verification worker metrics', {
        error: error.message,
      });
    }

    // Collect alerting metrics (if system monitor available)
    try {
      if (this.config.systemMonitor) {
        const status = this.config.systemMonitor.getStatus();
        if (status.metrics) {
          metrics.alerts_total = status.metrics.alerts_sent_total || 0;
          metrics.alerts_critical_total = status.metrics.critical_alerts_total || 0;
          metrics.alerts_warning_total = status.metrics.warning_alerts_total || 0;
        }
      }
    } catch (error: any) {
      logger.debug('Failed to collect alerting metrics', {
        error: error.message,
      });
    }

    // Collect backpressure metrics (if backpressure monitor available)
    try {
      if (this.config.backpressureMonitor) {
        const backpressureMetrics = this.config.backpressureMonitor.getMetrics();
        if (backpressureMetrics) {
          metrics.backpressure_detected = backpressureMetrics.backpressure_detected || 0;
          metrics.backpressure_waiting_jobs = backpressureMetrics.backpressure_waiting_jobs || 0;
          metrics.backpressure_growth_rate = backpressureMetrics.backpressure_growth_rate || 0;
          metrics.backpressure_avg_job_time = backpressureMetrics.backpressure_avg_job_time || 0;
          metrics.backpressure_backlog_age = backpressureMetrics.backpressure_backlog_age || 0;
          metrics.backpressure_alerts_sent = backpressureMetrics.backpressure_alerts_sent || 0;
        }
      }
    } catch (error: any) {
      logger.debug('Failed to collect backpressure metrics', {
        error: error.message,
      });
    }

    // Collect auth metrics
    try {
      if (this.config.authService) {
        const authMetrics = this.config.authService.getMetrics();
        if (authMetrics) {
          metrics.auth_login_success_total = authMetrics.login_success_total || 0;
          metrics.auth_register_success_total = authMetrics.register_success_total || 0;
        }
      }
    } catch (error: any) {
      logger.debug('Failed to collect auth metrics', {
        error: error.message,
      });
    }

    // Collect HTTP metrics
    try {
      if (this.config.httpMetrics) {
        const httpMetrics = this.config.httpMetrics.getMetrics();
        if (httpMetrics) {
          metrics.http_requests_total = httpMetrics.requests_total || 0;
        }
      }
    } catch (error: any) {
      logger.debug('Failed to collect HTTP metrics', {
        error: error.message,
      });
    }

    // Collect Public API metrics
    try {
      if (this.config.publicApiMetrics) {
        const publicApiMetrics = this.config.publicApiMetrics.getMetrics();
        if (publicApiMetrics) {
          metrics.public_api_requests_total = publicApiMetrics.public_api_requests_total || 0;
          metrics.public_api_errors_total = publicApiMetrics.public_api_errors_total || 0;
          metrics.public_api_rate_limit_hits = publicApiMetrics.public_api_rate_limit_hits || 0;
          metrics.public_api_auth_failures = publicApiMetrics.public_api_auth_failures || 0;
          metrics.public_api_scope_denials = publicApiMetrics.public_api_scope_denials || 0;
          metrics.public_api_latency_avg_ms = this.config.publicApiMetrics.getAverageLatency() || 0;
        }
      }
    } catch (error: any) {
      logger.debug('Failed to collect Public API metrics', {
        error: error.message,
      });
    }

    return metrics;
  }
}
