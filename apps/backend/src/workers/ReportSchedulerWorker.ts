import { Worker, Job } from 'bullmq';
import { QueueManager } from '../queue/QueueManager';
import { ScheduledReport } from '../models/ScheduledReport';
import { ReportGeneratorService } from '../services/ReportGeneratorService';
import { logger } from '../utils/logger';

/**
 * Report Scheduler Worker
 * 
 * Dedicated BullMQ worker for processing scheduled reports
 * 
 * Features:
 * - Runs every hour as repeatable job
 * - Queries MongoDB for due reports
 * - Generates and sends reports via email
 * - Updates next send dates
 * - Error handling and retry logic
 */

export class ReportSchedulerWorker {
  private worker: Worker | null = null;
  
  // Metrics
  private metrics = {
    scheduler_runs_total: 0,
    reports_processed_total: 0,
    reports_sent_total: 0,
    errors_total: 0,
  };

  constructor() {
    logger.info('ReportSchedulerWorker initialized');
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    try {
      const queueManager = QueueManager.getInstance();
      const queue = queueManager.getQueue('report_scheduler_queue');

      this.worker = new Worker(
        'report_scheduler_queue',
        async (job: Job) => {
          return this.processScheduledReports(job);
        },
        {
          connection: queueManager.getConnection(),
          concurrency: 1, // Process one at a time to avoid conflicts
          removeOnComplete: 10 as any,
          removeOnFail: 50 as any,
        }
      );

      this.worker.on('completed', (job) => {
        logger.info('Report scheduler job completed', {
          jobId: job.id,
          reportsProcessed: job.returnvalue?.reportsProcessed || 0,
        });
      });

      this.worker.on('failed', (job, err) => {
        this.metrics.errors_total++;
        logger.error('Report scheduler job failed', {
          jobId: job?.id,
          error: err.message,
        });
      });

      // Add repeatable job to run every hour
      await queue.add(
        'process-scheduled-reports',
        {},
        {
          repeat: {
            pattern: '0 * * * *', // Every hour at minute 0
          },
          jobId: 'report-scheduler-hourly',
        }
      );

      logger.info('ReportSchedulerWorker started successfully');
    } catch (error: unknown) {
      logger.error('Failed to start ReportSchedulerWorker', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info('ReportSchedulerWorker stopped');
    }
  }

  /**
   * Process scheduled reports
   */
  private async processScheduledReports(job: Job): Promise<{ reportsProcessed: number }> {
    const startTime = Date.now();
    this.metrics.scheduler_runs_total++;
    
    try {
      logger.info('Processing scheduled reports', { jobId: job.id });

      // Find all due reports
      const now = new Date();
      const dueReports = await ScheduledReport.find({
        nextSendAt: { $lte: now },
        isActive: true,
      }).populate('workspaceId');

      logger.info('Found due reports', { count: dueReports.length });

      let reportsProcessed = 0;

      for (const report of dueReports) {
        try {
          await this.processReport(report as any);
          reportsProcessed++;
          this.metrics.reports_processed_total++;
          this.metrics.reports_sent_total++;
        } catch (error: unknown) {
          this.metrics.errors_total++;
          logger.error('Failed to process report', {
            reportId: report._id.toString(),
            reportName: report.name,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue processing other reports even if one fails
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Scheduled reports processing completed', {
        reportsProcessed,
        duration: `${duration}ms`,
      });

      return { reportsProcessed };
    } catch (error: unknown) {
      this.metrics.errors_total++;
      logger.error('Scheduled reports processing failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: `${Date.now() - startTime}ms`,
      });
      throw error;
    }
  }

  /**
   * Process individual report
   */
  private async processReport(report: Record<string, unknown>): Promise<void> {
    try {
      logger.info('Processing report', {
        reportId: report._id.toString(),
        reportName: report.name,
        reportType: report.reportType,
        format: report.format,
      });

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      const dateRange = typeof report.dateRange === 'number' ? report.dateRange : 7;
      startDate.setDate(startDate.getDate() - dateRange);

      // Generate report
      let buffer: Buffer;
      const workspaceId = typeof report.workspaceId === 'object' && report.workspaceId && '_id' in report.workspaceId 
        ? String((report.workspaceId as any)._id) 
        : String(report.workspaceId);
      const reportType = String(report.reportType);
      const format = String(report.format);
      const platforms = Array.isArray(report.platforms) && report.platforms.length > 0 
        ? report.platforms.map(p => String(p))
        : undefined;

      if (format === 'pdf') {
        buffer = await ReportGeneratorService.generatePDF(
          workspaceId,
          reportType as any,
          startDate,
          endDate,
          platforms
        );
      } else {
        buffer = await ReportGeneratorService.generateCSV(
          workspaceId,
          reportType as any,
          startDate,
          endDate,
          platforms
        );
      }

      // Send email
      await ReportGeneratorService.sendReportEmail(report as any, buffer, format);

      // Update report timestamps
      const now = new Date();
      const reportDoc = report as any; // Cast for property access
      reportDoc.lastSentAt = now;
      
      // Calculate next send date based on frequency
      const frequency = String(report.frequency);
      switch (frequency) {
        case 'daily':
          reportDoc.nextSendAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          reportDoc.nextSendAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          const nextMonth = new Date(now);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          reportDoc.nextSendAt = nextMonth;
          break;
      }

      await reportDoc.save();

      logger.info('Report processed successfully', {
        reportId: String(report._id),
        nextSendAt: reportDoc.nextSendAt.toISOString(),
      });

      // Fire webhook event for report generation
      try {
        const { webhookService, WebhookEventType } = await import('../services/WebhookService');
        const reportWorkspaceId = typeof report.workspaceId === 'object' && report.workspaceId && '_id' in report.workspaceId 
          ? String((report.workspaceId as any)._id) 
          : String(report.workspaceId);
        const recipients = Array.isArray(report.recipients) ? report.recipients : [];
        const reportPlatforms = Array.isArray(report.platforms) ? report.platforms.map(p => String(p)) : [];

        await webhookService.sendWebhookEvent({
          workspaceId: reportWorkspaceId,
          event: WebhookEventType.REPORT_GENERATED,
          payload: {
            reportId: String(report._id),
            reportName: String(report.name),
            reportType: String(report.reportType),
            format: format,
            recipientCount: recipients.length,
            dateRange: dateRange,
            platforms: reportPlatforms,
            generatedAt: now,
            nextSendAt: reportDoc.nextSendAt,
          },
        });
      } catch (webhookError: unknown) {
        logger.warn('Failed to send REPORT_GENERATED webhook (non-blocking)', {
          reportId: String(report._id),
          error: webhookError instanceof Error ? webhookError.message : String(webhookError),
        });
      }
    } catch (error: unknown) {
      logger.error('Failed to process individual report', {
        reportId: String(report._id),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get worker metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Health check
   */
  isHealthy(): boolean {
    return this.worker !== null;
  }
}

export const reportSchedulerWorker = new ReportSchedulerWorker();