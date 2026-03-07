import { Worker, Job } from 'bullmq';
import { QueueManager } from '../queue/QueueManager';
import { EMAIL_QUEUE_NAME, EmailJobData } from '../queue/EmailQueue';
import { emailService } from '../services/EmailService';
import { emailTemplateService } from '../services/EmailTemplateService';
import { logger } from '../utils/logger';
import { captureException, addBreadcrumb } from '../monitoring/sentry';

/**
 * Email Worker
 * 
 * Processes email notification jobs from the queue
 * 
 * Features:
 * - Idempotent operations
 * - Retry with exponential backoff
 * - Template rendering
 * - Error handling
 * - Sentry error tracking
 * - Non-blocking (failures don't crash worker)
 * 
 * IMPORTANT: Email failures are logged but don't block the main workflow
 */

export class EmailWorker {
  private worker: Worker | null = null;
  
  // Metrics counters
  private metrics = {
    email_success_total: 0,
    email_failed_total: 0,
    email_retry_total: 0,
    email_skipped_total: 0,
    queue_jobs_processed_total: 0,
    queue_jobs_failed_total: 0,
  };
  
  // Queue health monitor
  private queueHealthInterval: NodeJS.Timeout | null = null;
  private workerHeartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Start the worker
   */
  start(): void {
    if (this.worker) {
      logger.warn('Email worker already running');
      return;
    }

    const queueManager = QueueManager.getInstance();
    this.worker = queueManager.createWorker(
      EMAIL_QUEUE_NAME,
      this.processJob.bind(this),
      {
        concurrency: 3, // Process 3 emails concurrently
        limiter: {
          max: 10, // Max 10 emails
          duration: 1000, // per second (rate limiting)
        },
      }
    );

    // Setup Sentry error handlers
    this.setupSentryHandlers();

    // Start monitoring
    this.startQueueHealthMonitor();
    this.startWorkerHeartbeat();

    logger.info('Email worker started with observability');
  }

  /**
   * Setup Sentry error handlers for worker
   */
  private setupSentryHandlers(): void {
    if (!this.worker) return;

    // Capture worker-level errors
    this.worker.on('error', (error: Error) => {
      logger.error('Email worker error', { error: error.message });
      
      captureException(error, {
        level: 'error',
        tags: {
          worker: 'email',
          queue: EMAIL_QUEUE_NAME,
        },
        extra: {
          workerStatus: this.getStatus(),
        },
      });
    });

    // Capture failed jobs (after all retries exhausted)
    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      if (!job) return;

      const { type, to } = job.data as EmailJobData;
      const currentAttempt = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts || 3;

      // Only capture to Sentry if this is the final failure
      if (currentAttempt >= maxAttempts) {
        addBreadcrumb(
          'Email job failed after all retries',
          'worker',
          {
            jobId: job.id,
            type,
            to,
            attemptsMade: job.attemptsMade,
            maxAttempts,
          }
        );

        captureException(error, {
          level: 'warning', // Email failures are warnings, not errors
          tags: {
            worker: 'email',
            queue: EMAIL_QUEUE_NAME,
            jobId: job.id || 'unknown',
            emailType: type || 'unknown',
            finalFailure: 'true',
          },
          extra: {
            jobData: job.data,
            attemptsMade: job.attemptsMade,
            maxAttempts,
          },
        });
      }
    });
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.worker) {
      logger.warn('Email worker not running');
      return;
    }

    // Stop monitoring
    this.stopQueueHealthMonitor();
    this.stopWorkerHeartbeat();

    await this.worker.close();
    this.worker = null;

    logger.info('Email worker stopped');
  }

  /**
   * Start queue health monitoring
   */
  private startQueueHealthMonitor(): void {
    if (this.queueHealthInterval) {
      return;
    }

    this.queueHealthInterval = setInterval(async () => {
      try {
        const queueManager = QueueManager.getInstance();
        const stats = await queueManager.getQueueStats(EMAIL_QUEUE_NAME);
        
        logger.info('Email queue health monitor', {
          queue: EMAIL_QUEUE_NAME,
          waiting: stats.waiting,
          active: stats.active,
          completed: stats.completed,
          failed: stats.failed,
          delayed: stats.delayed,
          total: stats.total,
          failureRate: stats.failureRate,
          health: stats.health,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        logger.error('Email queue health monitor failed', {
          error: error.message,
        });
      }
    }, 30000); // Every 30 seconds

    logger.info('Email queue health monitor started');
  }

  /**
   * Stop queue health monitoring
   */
  private stopQueueHealthMonitor(): void {
    if (this.queueHealthInterval) {
      clearInterval(this.queueHealthInterval);
      this.queueHealthInterval = null;
      logger.info('Email queue health monitor stopped');
    }
  }

  /**
   * Start worker heartbeat logging
   */
  private startWorkerHeartbeat(): void {
    if (this.workerHeartbeatInterval) {
      return;
    }

    this.workerHeartbeatInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const uptimeSeconds = Math.floor(process.uptime());
      
      logger.info('Email worker heartbeat', {
        worker_alive: true,
        memory_usage: {
          rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
          heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external_mb: Math.round(memoryUsage.external / 1024 / 1024),
        },
        uptime_seconds: uptimeSeconds,
        metrics: { ...this.metrics },
        timestamp: new Date().toISOString(),
      });
    }, 60000); // Every 60 seconds

    logger.info('Email worker heartbeat started');
  }

  /**
   * Stop worker heartbeat logging
   */
  private stopWorkerHeartbeat(): void {
    if (this.workerHeartbeatInterval) {
      clearInterval(this.workerHeartbeatInterval);
      this.workerHeartbeatInterval = null;
      logger.info('Email worker heartbeat stopped');
    }
  }

  /**
   * Process an email job
   */
  private async processJob(job: Job<EmailJobData>): Promise<any> {
    const { type, to, subject, body, html, data } = job.data;
    const currentAttempt = job.attemptsMade + 1;
    
    const startTime = Date.now();

    logger.info('Processing email job', {
      jobId: job.id,
      type,
      to,
      attemptsMade: job.attemptsMade,
      currentAttempt,
    });

    try {
      // Check if email service is configured
      if (!emailService.isReady()) {
        this.metrics.email_skipped_total++;
        
        logger.warn('Email service not configured - skipping email', {
          jobId: job.id,
          type,
          to,
        });

        return {
          success: false,
          message: 'Email service not configured',
          skipped: true,
        };
      }

      // Render template if not provided
      let emailSubject = subject;
      let emailBody = body;
      let emailHtml = html;

      if (!subject || !body) {
        const template = emailTemplateService.render(type, data);
        emailSubject = template.subject;
        emailBody = template.body;
        emailHtml = template.html;
      }

      // Send email
      const result = await emailService.sendEmail({
        to,
        subject: emailSubject,
        body: emailBody,
        html: emailHtml,
      });

      if (result.success) {
        this.metrics.email_success_total++;
        this.metrics.queue_jobs_processed_total++;
        
        const duration = Date.now() - startTime;

        logger.info('Email sent successfully', {
          jobId: job.id,
          type,
          to,
          emailId: result.emailId,
          email_send_duration_ms: duration,
          attempt: currentAttempt,
          status: 'success',
        });

        return {
          success: true,
          emailId: result.emailId,
        };
      } else {
        // Email failed - check if retryable
        if (result.retryable && currentAttempt < (job.opts.attempts || 3)) {
          this.metrics.email_retry_total++;
          
          const duration = Date.now() - startTime;

          logger.warn('Email send failed - will retry', {
            jobId: job.id,
            type,
            to,
            error: result.error,
            errorCode: result.errorCode,
            email_send_duration_ms: duration,
            attempt: currentAttempt,
            status: 'retry',
          });

          // Throw error to trigger BullMQ retry
          const error: any = new Error(result.error || 'Email send failed');
          error.retryable = true;
          error.errorCode = result.errorCode;
          throw error;
        } else {
          // Final failure or non-retryable error
          this.metrics.email_failed_total++;
          this.metrics.queue_jobs_failed_total++;
          
          const duration = Date.now() - startTime;

          logger.error('Email send failed - final', {
            jobId: job.id,
            type,
            to,
            error: result.error,
            errorCode: result.errorCode,
            retryable: result.retryable,
            email_send_duration_ms: duration,
            attempt: currentAttempt,
            status: 'failed_final',
          });

          // Don't throw - email failures should not crash the worker
          return {
            success: false,
            error: result.error,
            errorCode: result.errorCode,
          };
        }
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error('Email job processing error', {
        jobId: job.id,
        type,
        to,
        error: error.message,
        stack: error.stack,
        email_send_duration_ms: duration,
        attempt: currentAttempt,
      });

      // Check if this is a retryable error
      if (error.retryable && currentAttempt < (job.opts.attempts || 3)) {
        this.metrics.email_retry_total++;
        throw error; // Let BullMQ handle retry
      } else {
        this.metrics.email_failed_total++;
        this.metrics.queue_jobs_failed_total++;
        
        // Don't throw - email failures should not crash the worker
        return {
          success: false,
          error: error.message,
        };
      }
    }
  }

  /**
   * Get worker status
   */
  getStatus(): { isRunning: boolean } {
    return {
      isRunning: this.worker !== null,
    };
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }
}
