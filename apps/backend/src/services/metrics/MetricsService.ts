/**
 * Metrics Service
 * 
 * Formats metrics in Prometheus text format
 * 
 * Features:
 * - Prometheus-compatible text format
 * - Non-blocking
 * - Never crashes
 * - Production-safe
 */

import { MetricsCollector, CollectedMetrics } from './MetricsCollector';
import { logger } from '../../utils/logger';

export class MetricsService {
  private collector: MetricsCollector;

  constructor(collector: MetricsCollector) {
    this.collector = collector;
  }

  /**
   * Get metrics in Prometheus text format
   * SAFETY: Never throws - returns error metric on failure
   */
  async getPrometheusMetrics(): Promise<string> {
    try {
      const metrics = await this.collector.collect();
      return this.formatPrometheusMetrics(metrics);
    } catch (error: any) {
      logger.error('Failed to collect metrics', {
        error: error.message,
        stack: error.stack,
      });
      
      // Return error metric
      return this.formatErrorMetric(error.message);
    }
  }

  /**
   * Format metrics in Prometheus text format
   */
  private formatPrometheusMetrics(metrics: CollectedMetrics): string {
    const lines: string[] = [];

    // System metrics
    lines.push('# HELP process_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${metrics.process_uptime_seconds}`);
    lines.push('');

    lines.push('# HELP process_memory_usage_bytes Process memory usage in bytes');
    lines.push('# TYPE process_memory_usage_bytes gauge');
    lines.push(`process_memory_usage_bytes ${metrics.process_memory_usage_bytes}`);
    lines.push('');

    lines.push('# HELP cpu_load_average CPU load average (1 minute)');
    lines.push('# TYPE cpu_load_average gauge');
    lines.push(`cpu_load_average ${metrics.cpu_load_average.toFixed(2)}`);
    lines.push('');

    // Worker metrics
    lines.push('# HELP worker_alive Publishing worker alive status (1=alive, 0=dead)');
    lines.push('# TYPE worker_alive gauge');
    lines.push(`worker_alive ${metrics.worker_alive}`);
    lines.push('');

    lines.push('# HELP publish_success_total Total successful publishes');
    lines.push('# TYPE publish_success_total counter');
    lines.push(`publish_success_total ${metrics.publish_success_total}`);
    lines.push('');

    lines.push('# HELP publish_failed_total Total failed publishes');
    lines.push('# TYPE publish_failed_total counter');
    lines.push(`publish_failed_total ${metrics.publish_failed_total}`);
    lines.push('');

    lines.push('# HELP publish_retry_total Total publish retries');
    lines.push('# TYPE publish_retry_total counter');
    lines.push(`publish_retry_total ${metrics.publish_retry_total}`);
    lines.push('');

    lines.push('# HELP publish_skipped_total Total skipped publishes');
    lines.push('# TYPE publish_skipped_total counter');
    lines.push(`publish_skipped_total ${metrics.publish_skipped_total}`);
    lines.push('');

    lines.push('# HELP active_jobs Number of active publishing jobs');
    lines.push('# TYPE active_jobs gauge');
    lines.push(`active_jobs ${metrics.active_jobs}`);
    lines.push('');

    // Scheduler metrics
    lines.push('# HELP scheduler_alive Scheduler alive status (1=alive, 0=dead)');
    lines.push('# TYPE scheduler_alive gauge');
    lines.push(`scheduler_alive ${metrics.scheduler_alive}`);
    lines.push('');

    lines.push('# HELP scheduler_runs_total Total scheduler runs');
    lines.push('# TYPE scheduler_runs_total counter');
    lines.push(`scheduler_runs_total ${metrics.scheduler_runs_total}`);
    lines.push('');

    // Queue metrics
    lines.push('# HELP queue_waiting_jobs Number of jobs waiting in queue');
    lines.push('# TYPE queue_waiting_jobs gauge');
    lines.push(`queue_waiting_jobs ${metrics.queue_waiting_jobs}`);
    lines.push('');

    lines.push('# HELP queue_active_jobs Number of active jobs in queue');
    lines.push('# TYPE queue_active_jobs gauge');
    lines.push(`queue_active_jobs ${metrics.queue_active_jobs}`);
    lines.push('');

    lines.push('# HELP queue_completed_jobs Total completed jobs in queue');
    lines.push('# TYPE queue_completed_jobs counter');
    lines.push(`queue_completed_jobs ${metrics.queue_completed_jobs}`);
    lines.push('');

    lines.push('# HELP queue_failed_jobs Total failed jobs in queue');
    lines.push('# TYPE queue_failed_jobs counter');
    lines.push(`queue_failed_jobs ${metrics.queue_failed_jobs}`);
    lines.push('');

    lines.push('# HELP queue_delayed_jobs Number of delayed jobs in queue');
    lines.push('# TYPE queue_delayed_jobs gauge');
    lines.push(`queue_delayed_jobs ${metrics.queue_delayed_jobs}`);
    lines.push('');

    lines.push('# HELP queue_failure_rate Queue failure rate percentage');
    lines.push('# TYPE queue_failure_rate gauge');
    lines.push(`queue_failure_rate ${metrics.queue_failure_rate.toFixed(2)}`);
    lines.push('');

    lines.push('# HELP queue_jobs_processed_total Total jobs processed from queue');
    lines.push('# TYPE queue_jobs_processed_total counter');
    lines.push(`queue_jobs_processed_total ${metrics.queue_jobs_processed_total}`);
    lines.push('');

    lines.push('# HELP queue_jobs_failed_total Total jobs failed from queue');
    lines.push('# TYPE queue_jobs_failed_total counter');
    lines.push(`queue_jobs_failed_total ${metrics.queue_jobs_failed_total}`);
    lines.push('');

    // Token refresh metrics
    lines.push('# HELP token_refresh_success_total Total successful token refreshes');
    lines.push('# TYPE token_refresh_success_total counter');
    lines.push(`token_refresh_success_total ${metrics.token_refresh_success_total}`);
    lines.push('');

    lines.push('# HELP token_refresh_failed_total Total failed token refreshes');
    lines.push('# TYPE token_refresh_failed_total counter');
    lines.push(`token_refresh_failed_total ${metrics.token_refresh_failed_total}`);
    lines.push('');

    lines.push('# HELP token_refresh_retry_total Total token refresh retries');
    lines.push('# TYPE token_refresh_retry_total counter');
    lines.push(`token_refresh_retry_total ${metrics.token_refresh_retry_total}`);
    lines.push('');

    lines.push('# HELP token_refresh_skipped_total Total skipped token refreshes');
    lines.push('# TYPE token_refresh_skipped_total counter');
    lines.push(`token_refresh_skipped_total ${metrics.token_refresh_skipped_total}`);
    lines.push('');

    // Backup verification metrics
    lines.push('# HELP backup_verify_success_total Total successful backup verifications');
    lines.push('# TYPE backup_verify_success_total counter');
    lines.push(`backup_verify_success_total ${metrics.backup_verify_success_total}`);
    lines.push('');

    lines.push('# HELP backup_verify_failed_total Total failed backup verifications');
    lines.push('# TYPE backup_verify_failed_total counter');
    lines.push(`backup_verify_failed_total ${metrics.backup_verify_failed_total}`);
    lines.push('');

    lines.push('# HELP backup_verify_last_duration_seconds Duration of last backup verification in seconds');
    lines.push('# TYPE backup_verify_last_duration_seconds gauge');
    lines.push(`backup_verify_last_duration_seconds ${metrics.backup_verify_last_duration_seconds}`);
    lines.push('');

    // Auth metrics
    lines.push('# HELP auth_login_success_total Total successful logins');
    lines.push('# TYPE auth_login_success_total counter');
    lines.push(`auth_login_success_total ${metrics.auth_login_success_total}`);
    lines.push('');

    lines.push('# HELP auth_register_success_total Total successful registrations');
    lines.push('# TYPE auth_register_success_total counter');
    lines.push(`auth_register_success_total ${metrics.auth_register_success_total}`);
    lines.push('');

    // HTTP metrics
    lines.push('# HELP http_requests_total Total HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${metrics.http_requests_total}`);
    lines.push('');

    // Alerting metrics (optional)
    if (metrics.alerts_total !== undefined) {
      lines.push('# HELP alerts_total Total alerts sent');
      lines.push('# TYPE alerts_total counter');
      lines.push(`alerts_total ${metrics.alerts_total}`);
      lines.push('');

      lines.push('# HELP alerts_critical_total Total critical alerts sent');
      lines.push('# TYPE alerts_critical_total counter');
      lines.push(`alerts_critical_total ${metrics.alerts_critical_total}`);
      lines.push('');

      lines.push('# HELP alerts_warning_total Total warning alerts sent');
      lines.push('# TYPE alerts_warning_total counter');
      lines.push(`alerts_warning_total ${metrics.alerts_warning_total}`);
      lines.push('');
    }

    // Backpressure metrics (optional)
    if (metrics.backpressure_detected !== undefined) {
      lines.push('# HELP backpressure_detected Queue backpressure detected (1=yes, 0=no)');
      lines.push('# TYPE backpressure_detected gauge');
      lines.push(`backpressure_detected ${metrics.backpressure_detected}`);
      lines.push('');

      lines.push('# HELP backpressure_waiting_jobs Number of waiting jobs in queue');
      lines.push('# TYPE backpressure_waiting_jobs gauge');
      lines.push(`backpressure_waiting_jobs ${metrics.backpressure_waiting_jobs}`);
      lines.push('');

      lines.push('# HELP backpressure_growth_rate Queue growth rate (jobs/second)');
      lines.push('# TYPE backpressure_growth_rate gauge');
      lines.push(`backpressure_growth_rate ${metrics.backpressure_growth_rate?.toFixed(2) || 0}`);
      lines.push('');

      lines.push('# HELP backpressure_avg_job_time Average job processing time estimate (seconds)');
      lines.push('# TYPE backpressure_avg_job_time gauge');
      lines.push(`backpressure_avg_job_time ${metrics.backpressure_avg_job_time?.toFixed(2) || 0}`);
      lines.push('');

      lines.push('# HELP backpressure_backlog_age Age of oldest job in backlog (seconds)');
      lines.push('# TYPE backpressure_backlog_age gauge');
      lines.push(`backpressure_backlog_age ${metrics.backpressure_backlog_age?.toFixed(0) || 0}`);
      lines.push('');

      lines.push('# HELP backpressure_alerts_sent Total backpressure alerts sent');
      lines.push('# TYPE backpressure_alerts_sent counter');
      lines.push(`backpressure_alerts_sent ${metrics.backpressure_alerts_sent || 0}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format error metric when collection fails
   */
  private formatErrorMetric(errorMessage: string): string {
    const lines: string[] = [];
    
    lines.push('# HELP metrics_collection_error Metrics collection error (1=error, 0=ok)');
    lines.push('# TYPE metrics_collection_error gauge');
    lines.push('metrics_collection_error 1');
    lines.push('');
    
    lines.push(`# Error: ${errorMessage}`);
    
    return lines.join('\n');
  }
}
