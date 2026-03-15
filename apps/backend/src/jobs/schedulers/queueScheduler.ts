/**
 * Queue Job Scheduler
 * 
 * Schedules queue-related jobs using cron
 */

import { CronJob } from 'cron';
import { QueueAutoResumeJob } from '../QueueAutoResumeJob';
import { logger } from '../../utils/logger';

export class QueueScheduler {
  private static jobs: CronJob[] = [];

  /**
   * Start all queue scheduled jobs
   */
  static start(): void {
    logger.info('Starting queue job scheduler');

    // Auto-resume job every minute
    const autoResumeJob = new CronJob('* * * * *', async () => {
      try {
        await QueueAutoResumeJob.processAutoResume();
      } catch (error) {
        logger.error('Error in scheduled queue auto-resume job', { error });
      }
    }, null, false, 'UTC');

    // Store job references
    this.jobs = [autoResumeJob];

    // Start all jobs
    this.jobs.forEach(job => job.start());

    logger.info('Queue job scheduler started', {
      jobs: [
        'Auto-resume check (every minute)',
      ],
    });
  }

  /**
   * Stop all queue scheduled jobs
   */
  static stop(): void {
    logger.info('Stopping queue job scheduler');
    
    this.jobs.forEach(job => {
      job.stop();
    });
    
    this.jobs = [];
    logger.info('Queue job scheduler stopped');
  }

  /**
   * Get status of all scheduled jobs
   */
  static getStatus(): { job: string; running: boolean }[] {
    return [
      { job: 'Auto-resume check', running: this.jobs[0]?.running || false },
    ];
  }

  /**
   * Run auto-resume job manually (for testing)
   */
  static async runAutoResumeJob(): Promise<void> {
    logger.info('Manually running queue auto-resume job');

    try {
      await QueueAutoResumeJob.processAutoResume();
      logger.info('Manual queue auto-resume job completed');
    } catch (error) {
      logger.error('Error in manual queue auto-resume job', { error });
      throw error;
    }
  }

  /**
   * Get auto-resume statistics
   */
  static async getAutoResumeStats(): Promise<any> {
    try {
      return await QueueAutoResumeJob.getAutoResumeStats();
    } catch (error) {
      logger.error('Error getting auto-resume stats', { error });
      throw error;
    }
  }
}