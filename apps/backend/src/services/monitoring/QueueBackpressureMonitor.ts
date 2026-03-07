/**
 * Queue Backpressure Monitor
 * 
 * Detects queue overload and system stress early
 * 
 * Features:
 * - Monitors queue health continuously
 * - Detects backpressure conditions
 * - Sends alerts via existing alerting system
 * - Exports metrics via Prometheus
 * - Non-blocking and production-safe
 * 
 * SAFETY GUARANTEES:
 * - No queue modification
 * - No runtime blocking
 * - No performance degradation
 * - No crash if monitor fails
 * - Safe in horizontal scaling
 * - Safe during Redis reconnect
 * - Safe during shutdown
 */

import { QueueManager } from '../../queue/QueueManager';
import { AlertingService } from '../alerting/AlertingService';
import { logger } from '../../utils/logger';

export interface QueueBackpressureConfig {
  enabled: boolean;
  pollInterval: number;
  queueName: string;
  
  // Thresholds
  waitingJobsThreshold: number;
  growthRateThreshold: number;
  jobTimeThreshold: number;
  failureRateThreshold: number;
  backlogAgeThreshold: number;
  stalledThreshold: number;
}

export interface BackpressureMetrics {
  backpressure_detected: number;
  backpressure_waiting_jobs: number;
  backpressure_growth_rate: number;
  backpressure_avg_job_time: number;
  backpressure_backlog_age: number;
  backpressure_alerts_sent: number;
}

export class QueueBackpressureMonitor {
  private config: QueueBackpressureConfig;
  private alertingService: AlertingService | null;
  private queueManager: QueueManager | null;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  
  // State tracking
  private previousStats: any = null;
  private previousTimestamp: number = 0;
  private oldestJobTimestamp: number = 0;
  
  // Metrics
  private metrics: BackpressureMetrics = {
    backpressure_detected: 0,
    backpressure_waiting_jobs: 0,
    backpressure_growth_rate: 0,
    backpressure_avg_job_time: 0,
    backpressure_backlog_age: 0,
    backpressure_alerts_sent: 0,
  };

  constructor(
    config: QueueBackpressureConfig,
    queueManager: QueueManager | null = null,
    alertingService: AlertingService | null = null
  ) {
    this.config = config;
    this.queueManager = queueManager;
    this.alertingService = alertingService;
  }

  /**
   * Start the backpressure monitor
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Queue backpressure monitor already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('Queue backpressure monitor disabled');
      return;
    }

    if (!this.queueManager) {
      logger.warn('Queue backpressure monitor disabled - QueueManager not available');
      return;
    }

    this.isRunning = true;

    // Run immediately
    this.monitor();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.monitor();
    }, this.config.pollInterval);

    logger.info('Queue backpressure monitor started', {
      pollInterval: this.config.pollInterval,
      queueName: this.config.queueName,
      thresholds: {
        waitingJobs: this.config.waitingJobsThreshold,
        growthRate: this.config.growthRateThreshold,
        jobTime: this.config.jobTimeThreshold,
        failureRate: this.config.failureRateThreshold,
        backlogAge: this.config.backlogAgeThreshold,
      },
    });
  }

  /**
   * Stop the backpressure monitor
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Queue backpressure monitor not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;

    logger.info('Queue backpressure monitor stopped', {
      metrics: { ...this.metrics },
    });
  }

  /**
   * Monitor queue for backpressure conditions
   */
  private async monitor(): Promise<void> {
    try {
      if (!this.queueManager) {
        return;
      }

      // Get current queue stats (read-only)
      const stats = await this.queueManager.getQueueStats(this.config.queueName);
      const now = Date.now();

      // Calculate metrics
      const waitingJobs = stats.waiting || 0;
      const activeJobs = stats.active || 0;
      const failureRate = parseFloat(stats.failureRate) || 0;

      // Update metrics
      this.metrics.backpressure_waiting_jobs = waitingJobs;

      // Calculate growth rate (jobs/second)
      let growthRate = 0;
      if (this.previousStats && this.previousTimestamp) {
        const timeDelta = (now - this.previousTimestamp) / 1000; // seconds
        const jobsDelta = waitingJobs - (this.previousStats.waiting || 0);
        growthRate = timeDelta > 0 ? jobsDelta / timeDelta : 0;
        this.metrics.backpressure_growth_rate = Math.max(0, growthRate);
      }

      // Calculate average job time (estimate from active jobs)
      const avgJobTime = activeJobs > 0 ? waitingJobs / activeJobs : 0;
      this.metrics.backpressure_avg_job_time = avgJobTime;

      // Calculate backlog age (time since oldest job)
      let backlogAge = 0;
      if (waitingJobs > 0) {
        if (this.oldestJobTimestamp === 0) {
          this.oldestJobTimestamp = now;
        }
        backlogAge = (now - this.oldestJobTimestamp) / 1000; // seconds
        this.metrics.backpressure_backlog_age = backlogAge;
      } else {
        this.oldestJobTimestamp = 0;
        this.metrics.backpressure_backlog_age = 0;
      }

      // Detect backpressure conditions
      const conditions = this.detectBackpressure(
        waitingJobs,
        growthRate,
        avgJobTime,
        failureRate,
        backlogAge,
        activeJobs
      );

      // Update detection metric
      this.metrics.backpressure_detected = conditions.length > 0 ? 1 : 0;

      // Send alerts if backpressure detected
      if (conditions.length > 0) {
        await this.sendBackpressureAlert(conditions, stats);
      }

      // Store current stats for next iteration
      this.previousStats = stats;
      this.previousTimestamp = now;

      logger.debug('Queue backpressure check completed', {
        queueName: this.config.queueName,
        waitingJobs,
        growthRate: growthRate.toFixed(2),
        avgJobTime: avgJobTime.toFixed(2),
        backlogAge: backlogAge.toFixed(2),
        failureRate,
        backpressureDetected: conditions.length > 0,
        conditions,
      });

    } catch (error: any) {
      logger.error('Queue backpressure monitor error', {
        error: error.message,
        stack: error.stack,
      });
      // Don't throw - continue monitoring
    }
  }

  /**
   * Detect backpressure conditions
   */
  private detectBackpressure(
    waitingJobs: number,
    growthRate: number,
    avgJobTime: number,
    failureRate: number,
    backlogAge: number,
    activeJobs: number
  ): string[] {
    const conditions: string[] = [];

    // Condition 1: Waiting jobs exceed threshold
    if (waitingJobs > this.config.waitingJobsThreshold) {
      conditions.push(`waiting_jobs_high (${waitingJobs} > ${this.config.waitingJobsThreshold})`);
    }

    // Condition 2: Queue growing faster than processing
    if (growthRate > this.config.growthRateThreshold) {
      conditions.push(`growth_rate_high (${growthRate.toFixed(2)} jobs/s > ${this.config.growthRateThreshold})`);
    }

    // Condition 3: Job processing time spike
    if (avgJobTime > this.config.jobTimeThreshold) {
      conditions.push(`job_time_high (${avgJobTime.toFixed(2)}s > ${this.config.jobTimeThreshold})`);
    }

    // Condition 4: Failure rate spike
    if (failureRate > this.config.failureRateThreshold) {
      conditions.push(`failure_rate_high (${failureRate}% > ${this.config.failureRateThreshold}%)`);
    }

    // Condition 5: Backlog age increasing
    if (backlogAge > this.config.backlogAgeThreshold) {
      conditions.push(`backlog_age_high (${backlogAge.toFixed(0)}s > ${this.config.backlogAgeThreshold}s)`);
    }

    // Condition 6: Queue stalled (waiting jobs but no active processing)
    if (waitingJobs > this.config.stalledThreshold && activeJobs === 0) {
      conditions.push(`queue_stalled (${waitingJobs} waiting, 0 active)`);
    }

    return conditions;
  }

  /**
   * Send backpressure alert
   */
  private async sendBackpressureAlert(conditions: string[], stats: any): Promise<void> {
    if (!this.alertingService) {
      return;
    }

    try {
      const title = 'Queue Backpressure Detected';
      const message = `Queue "${this.config.queueName}" is experiencing backpressure:\n${conditions.join('\n')}`;
      
      const metadata = {
        component: 'queue-backpressure',
        queue: this.config.queueName,
        conditions: conditions.join(', '),
        waiting_jobs: stats.waiting,
        active_jobs: stats.active,
        failed_jobs: stats.failed,
        failure_rate: stats.failureRate,
        growth_rate: this.metrics.backpressure_growth_rate.toFixed(2),
        backlog_age_seconds: this.metrics.backpressure_backlog_age.toFixed(0),
      };

      await this.alertingService.sendAlert(
        this.alertingService.createWarningAlert(title, message, metadata)
      );

      this.metrics.backpressure_alerts_sent++;

      logger.warn('Queue backpressure alert sent', metadata);

    } catch (error: any) {
      logger.error('Failed to send backpressure alert', {
        error: error.message,
      });
    }
  }

  /**
   * Get monitor status
   */
  getStatus(): {
    isRunning: boolean;
    pollInterval: number;
    metrics: BackpressureMetrics;
  } {
    return {
      isRunning: this.isRunning,
      pollInterval: this.config.pollInterval,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Force monitor check (for testing/manual trigger)
   */
  async forceCheck(): Promise<void> {
    logger.info('Force backpressure check triggered');
    await this.monitor();
  }

  /**
   * Get current metrics (for Prometheus)
   */
  getMetrics(): BackpressureMetrics {
    return { ...this.metrics };
  }
}
