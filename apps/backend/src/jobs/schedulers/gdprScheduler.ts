/**
 * GDPR Job Scheduler
 * 
 * Schedules GDPR compliance jobs using cron
 */

import { CronJob } from 'cron';
import { GDPRCleanupJob } from '../GDPRCleanupJob';
import { logger } from '../../utils/logger';

export class GDPRScheduler {
  private static jobs: CronJob[] = [];

  /**
   * Start all GDPR scheduled jobs
   */
  static start(): void {
    logger.info('Starting GDPR job scheduler');

    // Daily permanent deletion job at 2 AM UTC
    const deletionJob = new CronJob('0 2 * * *', async () => {
      try {
        logger.info('Running scheduled GDPR permanent deletion job');
        await GDPRCleanupJob.processPendingDeletions();
      } catch (error) {
        logger.error('Error in scheduled GDPR deletion job', { error });
      }
    }, null, false, 'UTC');

    // Monthly request log cleanup on the 1st at 3 AM UTC
    const logCleanupJob = new CronJob('0 3 1 * *', async () => {
      try {
        logger.info('Running scheduled GDPR request log cleanup job');
        await GDPRCleanupJob.cleanupOldRequestLogs();
      } catch (error) {
        logger.error('Error in scheduled GDPR log cleanup job', { error });
      }
    }, null, false, 'UTC');

    // Weekly compliance report on Mondays at 9 AM UTC
    const reportJob = new CronJob('0 9 * * 1', async () => {
      try {
        logger.info('Running scheduled GDPR compliance report job');
        const report = await GDPRCleanupJob.generateComplianceReport();
        logger.info('GDPR compliance report', report);
      } catch (error) {
        logger.error('Error in scheduled GDPR compliance report job', { error });
      }
    }, null, false, 'UTC');

    // Store job references
    this.jobs = [deletionJob, logCleanupJob, reportJob];

    // Start all jobs
    this.jobs.forEach(job => job.start());

    logger.info('GDPR job scheduler started', {
      jobs: [
        'Daily permanent deletion (2 AM UTC)',
        'Monthly log cleanup (1st at 3 AM UTC)',
        'Weekly compliance report (Mondays at 9 AM UTC)',
      ],
    });
  }

  /**
   * Stop all GDPR scheduled jobs
   */
  static stop(): void {
    logger.info('Stopping GDPR job scheduler');
    
    this.jobs.forEach(job => {
      job.stop();
    });
    
    this.jobs = [];
    logger.info('GDPR job scheduler stopped');
  }

  /**
   * Get status of all scheduled jobs
   */
  static getStatus(): { job: string; running: boolean }[] {
    return [
      { job: 'Daily permanent deletion', running: this.jobs[0]?.running || false },
      { job: 'Monthly log cleanup', running: this.jobs[1]?.running || false },
      { job: 'Weekly compliance report', running: this.jobs[2]?.running || false },
    ];
  }

  /**
   * Run a specific job manually (for testing)
   */
  static async runJob(jobName: 'deletion' | 'cleanup' | 'report'): Promise<void> {
    logger.info(`Manually running GDPR job: ${jobName}`);

    try {
      switch (jobName) {
        case 'deletion':
          await GDPRCleanupJob.processPendingDeletions();
          break;
        case 'cleanup':
          await GDPRCleanupJob.cleanupOldRequestLogs();
          break;
        case 'report':
          const report = await GDPRCleanupJob.generateComplianceReport();
          logger.info('Manual GDPR compliance report', report);
          break;
        default:
          throw new Error(`Unknown job: ${jobName}`);
      }
      logger.info(`Manual GDPR job completed: ${jobName}`);
    } catch (error) {
      logger.error(`Error in manual GDPR job: ${jobName}`, { error });
      throw error;
    }
  }
}