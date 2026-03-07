/**
 * Backup Verification Worker
 * 
 * Automatically verifies MongoDB backups on a schedule
 * 
 * Features:
 * - Polls every N hours (configurable, default 12 hours)
 * - Verifies backup integrity
 * - Performs safe restore test
 * - Sends alerts on failure
 * - Never blocks main system
 * - Never touches production database
 * - Production-safe
 * - Sentry error tracking
 * 
 * SAFETY GUARANTEES:
 * - No production DB writes
 * - No crash loops
 * - No blocking operations
 * - Isolated from main system
 * - Timeout protection
 * - Alert on failure
 */

import { BackupVerifier, BackupVerificationResult } from '../services/backup/BackupVerifier';
import { AlertingService } from '../services/alerting/AlertingService';
import { logger } from '../utils/logger';
import { captureException, addBreadcrumb } from '../monitoring/sentry';

export interface BackupVerificationWorkerConfig {
  enabled: boolean;
  backupPath: string;
  mongoUri: string;
  intervalHours: number;
  timeoutMs: number;
  tempDbPrefix: string;
  maxBackupAgeHours: number;
}

export class BackupVerificationWorker {
  private config: BackupVerificationWorkerConfig;
  private alertingService: AlertingService | null;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  
  // Metrics
  private metrics = {
    verification_success_total: 0,
    verification_failed_total: 0,
    last_verification_timestamp: 0,
    last_verification_duration: 0,
  };

  constructor(
    config: BackupVerificationWorkerConfig,
    alertingService: AlertingService | null = null
  ) {
    this.config = config;
    this.alertingService = alertingService;
  }

  /**
   * Start the backup verification worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Backup verification worker already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('Backup verification worker disabled');
      return;
    }

    this.isRunning = true;

    // Setup error handlers
    this.setupErrorHandlers();

    // Run immediately on start
    this.verify();

    // Then run on interval
    const intervalMs = this.config.intervalHours * 60 * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.verify();
    }, intervalMs);

    logger.info('Backup verification worker started', {
      intervalHours: this.config.intervalHours,
      backupPath: this.config.backupPath,
      timeoutMs: this.config.timeoutMs,
    });
  }

  /**
   * Setup error handlers for worker
   */
  private setupErrorHandlers(): void {
    // Capture unhandled errors in worker context
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled rejection in backup verification worker', { reason });
      
      captureException(reason instanceof Error ? reason : new Error(String(reason)), {
        level: 'error',
        tags: {
          worker: 'backup-verification',
          errorType: 'unhandledRejection',
        },
        extra: {
          workerStatus: this.getStatus(),
        },
      });
    });
  }

  /**
   * Stop the backup verification worker
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Backup verification worker not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;

    logger.info('Backup verification worker stopped', {
      metrics: { ...this.metrics },
    });
  }

  /**
   * Perform backup verification
   */
  private async verify(): Promise<void> {
    try {
      logger.info('Starting backup verification');

      // Create verifier
      const verifier = new BackupVerifier({
        backupPath: this.config.backupPath,
        mongoUri: this.config.mongoUri,
        tempDbPrefix: this.config.tempDbPrefix,
        timeoutMs: this.config.timeoutMs,
        maxBackupAgeHours: this.config.maxBackupAgeHours,
      });

      // Perform verification
      const result = await verifier.verifyLatestBackup();

      // Update metrics
      this.metrics.last_verification_timestamp = Date.now();
      this.metrics.last_verification_duration = result.duration;

      if (result.success) {
        this.metrics.verification_success_total++;
        
        logger.info('Backup verification successful', {
          backupFile: result.backupFile,
          backupSize: result.backupSize,
          backupAgeHours: result.backupAge ? (result.backupAge / (60 * 60 * 1000)).toFixed(2) : 'unknown',
          collectionsRestored: result.collectionsRestored,
          duration: result.duration,
        });

        // Send info alert on success (optional, can be disabled)
        if (this.alertingService) {
          await this.alertingService.sendAlert(
            this.alertingService.createInfoAlert(
              'Backup Verification Successful',
              `Latest backup verified successfully. ${result.collectionsRestored} collections restored.`,
              {
                component: 'backup-verification',
                backupFile: result.backupFile,
                backupSizeMB: result.backupSize ? (result.backupSize / 1024 / 1024).toFixed(2) : 'unknown',
                backupAgeHours: result.backupAge ? (result.backupAge / (60 * 60 * 1000)).toFixed(2) : 'unknown',
                collectionsRestored: result.collectionsRestored,
                durationMs: result.duration,
              }
            )
          );
        }

      } else {
        this.metrics.verification_failed_total++;
        
        logger.error('Backup verification failed', {
          error: result.error,
          errorCode: result.errorCode,
          backupFile: result.backupFile,
          duration: result.duration,
        });

        // Capture to Sentry
        addBreadcrumb(
          'Backup verification failed',
          'worker',
          {
            errorCode: result.errorCode,
            backupFile: result.backupFile,
            duration: result.duration,
          }
        );

        captureException(new Error(result.error || 'Backup verification failed'), {
          level: 'error',
          tags: {
            worker: 'backup-verification',
            errorCode: result.errorCode || 'unknown',
            backupFile: result.backupFile || 'unknown',
          },
          extra: {
            verificationResult: result,
            workerConfig: {
              backupPath: this.config.backupPath,
              intervalHours: this.config.intervalHours,
              timeoutMs: this.config.timeoutMs,
            },
          },
        });

        // Send critical alert on failure
        await this.sendFailureAlert(result);
      }

    } catch (error: any) {
      this.metrics.verification_failed_total++;
      
      logger.error('Backup verification error', {
        error: error.message,
        stack: error.stack,
      });

      // Capture to Sentry
      captureException(error, {
        level: 'error',
        tags: {
          worker: 'backup-verification',
          operation: 'verify',
        },
        extra: {
          workerConfig: {
            backupPath: this.config.backupPath,
            intervalHours: this.config.intervalHours,
            timeoutMs: this.config.timeoutMs,
          },
          workerStatus: this.getStatus(),
        },
      });

      // Send critical alert on error
      if (this.alertingService) {
        await this.alertingService.sendAlert(
          this.alertingService.createCriticalAlert(
            'Backup Verification Error',
            `Backup verification failed with error: ${error.message}`,
            {
              component: 'backup-verification',
              error: error.message,
            }
          )
        );
      }
    }
  }

  /**
   * Send failure alert based on error code
   */
  private async sendFailureAlert(result: BackupVerificationResult): Promise<void> {
    if (!this.alertingService) {
      return;
    }

    let title = 'Backup Verification Failed';
    let message = result.error || 'Unknown error';
    let metadata: any = {
      component: 'backup-verification',
      errorCode: result.errorCode,
      backupFile: result.backupFile,
      duration: result.duration,
    };

    // Customize alert based on error code
    switch (result.errorCode) {
      case 'NO_BACKUP_FOUND':
        title = 'No Backup Found';
        message = `No backup files found in ${this.config.backupPath}. Backups may not be running.`;
        break;

      case 'FILE_NOT_FOUND':
        title = 'Backup File Missing';
        message = `Backup file not found: ${result.backupFile}`;
        break;

      case 'EMPTY_FILE':
        title = 'Backup File Empty';
        message = `Backup file is empty: ${result.backupFile}`;
        break;

      case 'FILE_TOO_SMALL':
        title = 'Backup File Too Small';
        message = `Backup file is suspiciously small (likely corrupted): ${result.backupFile}`;
        break;

      case 'CORRUPTED_FILE':
        title = 'Backup File Corrupted';
        message = `Backup file failed integrity check: ${result.backupFile}`;
        break;

      case 'RESTORE_TIMEOUT':
        title = 'Backup Restore Timeout';
        message = `Restore test timed out after ${this.config.timeoutMs}ms: ${result.backupFile}`;
        metadata.timeoutMs = this.config.timeoutMs;
        break;

      case 'RESTORE_FAILED':
        title = 'Backup Restore Failed';
        message = `Failed to restore backup: ${result.error}`;
        break;

      case 'RESTORE_VERIFICATION_FAILED':
        title = 'Restored Database Verification Failed';
        message = `Backup restored but verification failed: ${result.error}`;
        break;
    }

    // Check if backup is too old
    if (result.backupAge) {
      const ageHours = result.backupAge / (60 * 60 * 1000);
      if (ageHours > this.config.maxBackupAgeHours) {
        title = 'Backup Too Old';
        message = `Latest backup is ${ageHours.toFixed(2)} hours old (threshold: ${this.config.maxBackupAgeHours} hours)`;
        metadata.backupAgeHours = ageHours.toFixed(2);
        metadata.maxBackupAgeHours = this.config.maxBackupAgeHours;
      }
    }

    await this.alertingService.sendAlert(
      this.alertingService.createCriticalAlert(title, message, metadata)
    );
  }

  /**
   * Get worker status
   */
  getStatus(): {
    isRunning: boolean;
    intervalHours: number;
    metrics: typeof this.metrics;
  } {
    return {
      isRunning: this.isRunning,
      intervalHours: this.config.intervalHours,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Force verification (for testing/manual trigger)
   */
  async forceVerify(): Promise<void> {
    logger.info('Force verification triggered');
    await this.verify();
  }
}
