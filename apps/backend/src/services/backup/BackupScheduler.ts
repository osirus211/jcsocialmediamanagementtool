import { CronJob } from 'cron';
import { MongoBackupService, BackupConfig } from './MongoBackupService';
import { logger } from '../../utils/logger';
import { config } from '../../config';

/**
 * Backup Scheduler
 * 
 * Manages automated backup scheduling using cron
 * Runs backups at configured intervals
 */

export class BackupScheduler {
  private backupService: MongoBackupService;
  private cronJob: CronJob | null = null;
  private isRunning = false;

  constructor(backupConfig: BackupConfig) {
    this.backupService = new MongoBackupService(backupConfig);
  }

  /**
   * Start backup scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Backup scheduler already running');
      return;
    }

    const backupConfig = this.getBackupConfig();

    if (!backupConfig.enabled) {
      logger.info('Backup scheduler disabled by configuration');
      return;
    }

    logger.info('Starting backup scheduler', {
      schedule: backupConfig.schedule,
      retentionDays: backupConfig.retentionDays,
      localPath: backupConfig.localPath,
      s3Bucket: backupConfig.s3Bucket,
    });

    // Create cron job
    this.cronJob = new CronJob(
      backupConfig.schedule,
      async () => {
        await this.executeScheduledBackup();
      },
      null, // onComplete
      true, // start immediately
      'UTC' // timezone
    );

    this.isRunning = true;

    logger.info('Backup scheduler started successfully', {
      nextRun: this.cronJob.nextDate().toISO(),
    });
  }

  /**
   * Stop backup scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Backup scheduler not running');
      return;
    }

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    this.isRunning = false;

    logger.info('Backup scheduler stopped');
  }

  /**
   * Execute scheduled backup
   */
  private async executeScheduledBackup(): Promise<void> {
    logger.info('Executing scheduled backup');

    try {
      const metadata = await this.backupService.performBackup();

      logger.info('Scheduled backup completed successfully', {
        backupId: metadata.backupId,
        size: `${(metadata.size / 1024 / 1024).toFixed(2)} MB`,
        duration: `${(metadata.duration / 1000).toFixed(2)}s`,
        verified: metadata.verified,
      });
    } catch (error: any) {
      logger.error('Scheduled backup failed', {
        error: error.message,
        stack: error.stack,
      });

      // Don't throw - let scheduler continue
    }
  }

  /**
   * Trigger manual backup
   */
  async triggerManualBackup(): Promise<void> {
    logger.info('Triggering manual backup');

    try {
      const metadata = await this.backupService.performBackup();

      logger.info('Manual backup completed successfully', {
        backupId: metadata.backupId,
        size: `${(metadata.size / 1024 / 1024).toFixed(2)} MB`,
        duration: `${(metadata.duration / 1000).toFixed(2)}s`,
      });
    } catch (error: any) {
      logger.error('Manual backup failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get backup health status
   */
  async getHealthStatus() {
    return this.backupService.getHealthStatus();
  }

  /**
   * List all backups
   */
  async listBackups() {
    return this.backupService.listBackups();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.cronJob?.nextDate().toISO() || null,
    };
  }

  /**
   * Get backup configuration from environment
   */
  private getBackupConfig(): BackupConfig {
    return {
      enabled: config.backup.enabled,
      schedule: config.backup.schedule || '0 2 * * *', // Default: 2 AM daily
      retentionDays: config.backup.retentionDays || 14,
      localPath: config.backup.localPath,
      s3Bucket: config.backup.s3Bucket,
      s3Region: config.backup.s3Region,
      s3Prefix: config.backup.s3Prefix,
      compressionEnabled: config.backup.compressionEnabled !== false,
      verifyAfterBackup: config.backup.verifyAfterBackup !== false,
    };
  }
}

// Singleton instance
let backupScheduler: BackupScheduler | null = null;

/**
 * Get backup scheduler instance
 */
export const getBackupScheduler = (): BackupScheduler => {
  if (!backupScheduler) {
    const backupConfig: BackupConfig = {
      enabled: config.backup.enabled,
      schedule: config.backup.schedule || '0 2 * * *',
      retentionDays: config.backup.retentionDays || 14,
      localPath: config.backup.localPath,
      s3Bucket: config.backup.s3Bucket,
      s3Region: config.backup.s3Region,
      s3Prefix: config.backup.s3Prefix,
      compressionEnabled: config.backup.compressionEnabled !== false,
      verifyAfterBackup: config.backup.verifyAfterBackup !== false,
    };

    backupScheduler = new BackupScheduler(backupConfig);
  }

  return backupScheduler;
};
