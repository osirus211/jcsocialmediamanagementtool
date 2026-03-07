import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { config } from '../../config';

const execAsync = promisify(exec);

/**
 * MongoDB Backup Service
 * 
 * Handles automated MongoDB backups with:
 * - Daily backup scheduling
 * - Local filesystem or S3 storage
 * - Automatic retention management
 * - Backup verification
 * - Health status reporting
 */

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // Cron expression
  retentionDays: number;
  localPath?: string;
  s3Bucket?: string;
  s3Region?: string;
  s3Prefix?: string;
  compressionEnabled: boolean;
  verifyAfterBackup: boolean;
}

export interface BackupMetadata {
  backupId: string;
  timestamp: Date;
  size: number;
  duration: number;
  status: 'success' | 'failed';
  location: string;
  verified: boolean;
  error?: string;
}

export interface BackupHealthStatus {
  enabled: boolean;
  lastBackupTime?: Date;
  lastBackupStatus?: 'success' | 'failed';
  lastBackupSize?: number;
  nextScheduledBackup?: Date;
  backupCount: number;
  oldestBackup?: Date;
  newestBackup?: Date;
  totalSize: number;
  healthy: boolean;
  issues: string[];
}

export class MongoBackupService {
  private config: BackupConfig;
  private lastBackupMetadata: BackupMetadata | null = null;
  private backupInProgress = false;

  constructor(config: BackupConfig) {
    this.config = config;
  }

  /**
   * Perform MongoDB backup
   */
  async performBackup(): Promise<BackupMetadata> {
    if (!this.config.enabled) {
      throw new Error('Backup service is disabled');
    }

    if (this.backupInProgress) {
      throw new Error('Backup already in progress');
    }

    this.backupInProgress = true;
    const startTime = Date.now();
    const backupId = this.generateBackupId();

    logger.info('Starting MongoDB backup', {
      backupId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Create backup directory if using local storage
      if (this.config.localPath) {
        await this.ensureBackupDirectory(this.config.localPath);
      }

      // Determine backup location
      const backupPath = this.getBackupPath(backupId);

      // Execute mongodump
      await this.executeMongoDump(backupPath);

      // Compress backup if enabled
      let finalPath = backupPath;
      if (this.config.compressionEnabled) {
        finalPath = await this.compressBackup(backupPath);
      }

      // Upload to S3 if configured
      if (this.config.s3Bucket) {
        await this.uploadToS3(finalPath, backupId);
      }

      // Get backup size
      const size = await this.getBackupSize(finalPath);

      // Verify backup if enabled
      let verified = false;
      if (this.config.verifyAfterBackup) {
        verified = await this.verifyBackup(finalPath);
      }

      const duration = Date.now() - startTime;

      const metadata: BackupMetadata = {
        backupId,
        timestamp: new Date(),
        size,
        duration,
        status: 'success',
        location: finalPath,
        verified,
      };

      this.lastBackupMetadata = metadata;

      logger.info('MongoDB backup completed successfully', {
        backupId,
        size: `${(size / 1024 / 1024).toFixed(2)} MB`,
        duration: `${(duration / 1000).toFixed(2)}s`,
        verified,
        location: finalPath,
      });

      // Clean up old backups
      await this.cleanupOldBackups();

      return metadata;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      const metadata: BackupMetadata = {
        backupId,
        timestamp: new Date(),
        size: 0,
        duration,
        status: 'failed',
        location: '',
        verified: false,
        error: error.message,
      };

      this.lastBackupMetadata = metadata;

      logger.error('MongoDB backup failed', {
        backupId,
        error: error.message,
        stack: error.stack,
        duration: `${(duration / 1000).toFixed(2)}s`,
      });

      throw error;
    } finally {
      this.backupInProgress = false;
    }
  }

  /**
   * Execute mongodump command
   */
  private async executeMongoDump(backupPath: string): Promise<void> {
    const mongoUri = config.database.uri;

    // Parse MongoDB URI to extract connection details
    const uriMatch = mongoUri.match(/mongodb:\/\/([^:]+):([^@]+)@([^\/]+)\/(.+)/);
    
    let dumpCommand: string;

    if (uriMatch) {
      // URI with authentication
      const [, username, password, host, database] = uriMatch;
      dumpCommand = `mongodump --uri="${mongoUri}" --out="${backupPath}"`;
    } else {
      // Simple URI without auth
      dumpCommand = `mongodump --uri="${mongoUri}" --out="${backupPath}"`;
    }

    logger.debug('Executing mongodump', { backupPath });

    try {
      const { stdout, stderr } = await execAsync(dumpCommand, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (stderr && !stderr.includes('done dumping')) {
        logger.warn('mongodump stderr output', { stderr });
      }

      logger.debug('mongodump completed', { stdout: stdout.substring(0, 500) });
    } catch (error: any) {
      logger.error('mongodump execution failed', {
        error: error.message,
        stderr: error.stderr,
        stdout: error.stdout,
      });
      throw new Error(`mongodump failed: ${error.message}`);
    }
  }

  /**
   * Compress backup directory
   */
  private async compressBackup(backupPath: string): Promise<string> {
    const compressedPath = `${backupPath}.tar.gz`;

    logger.debug('Compressing backup', { backupPath, compressedPath });

    try {
      const tarCommand = `tar -czf "${compressedPath}" -C "${path.dirname(backupPath)}" "${path.basename(backupPath)}"`;
      await execAsync(tarCommand);

      // Remove uncompressed directory
      await fs.rm(backupPath, { recursive: true, force: true });

      logger.debug('Backup compressed successfully', { compressedPath });

      return compressedPath;
    } catch (error: any) {
      logger.error('Backup compression failed', {
        error: error.message,
        backupPath,
      });
      throw new Error(`Compression failed: ${error.message}`);
    }
  }

  /**
   * Upload backup to S3
   */
  private async uploadToS3(localPath: string, backupId: string): Promise<void> {
    if (!this.config.s3Bucket) {
      return;
    }

    logger.info('Uploading backup to S3', {
      bucket: this.config.s3Bucket,
      backupId,
    });

    try {
      const s3Key = this.config.s3Prefix
        ? `${this.config.s3Prefix}/${backupId}.tar.gz`
        : `${backupId}.tar.gz`;

      // Use AWS CLI for upload (requires aws-cli installed)
      const uploadCommand = `aws s3 cp "${localPath}" "s3://${this.config.s3Bucket}/${s3Key}" --region ${this.config.s3Region || 'us-east-1'}`;
      
      await execAsync(uploadCommand);

      logger.info('Backup uploaded to S3 successfully', {
        bucket: this.config.s3Bucket,
        key: s3Key,
      });
    } catch (error: any) {
      logger.error('S3 upload failed', {
        error: error.message,
        bucket: this.config.s3Bucket,
      });
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Verify backup integrity
   */
  private async verifyBackup(backupPath: string): Promise<boolean> {
    logger.debug('Verifying backup integrity', { backupPath });

    try {
      // Check if file exists and is readable
      await fs.access(backupPath, fs.constants.R_OK);

      // For compressed backups, verify tar integrity
      if (backupPath.endsWith('.tar.gz')) {
        const verifyCommand = `tar -tzf "${backupPath}" > /dev/null`;
        await execAsync(verifyCommand);
      }

      // Check minimum size (should be at least 1KB)
      const stats = await fs.stat(backupPath);
      if (stats.size < 1024) {
        logger.warn('Backup file suspiciously small', {
          backupPath,
          size: stats.size,
        });
        return false;
      }

      logger.debug('Backup verification passed', { backupPath });
      return true;
    } catch (error: any) {
      logger.error('Backup verification failed', {
        error: error.message,
        backupPath,
      });
      return false;
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  private async cleanupOldBackups(): Promise<void> {
    if (!this.config.localPath) {
      return;
    }

    logger.info('Cleaning up old backups', {
      retentionDays: this.config.retentionDays,
    });

    try {
      const backupDir = this.config.localPath;
      const files = await fs.readdir(backupDir);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      let deletedCount = 0;
      let deletedSize = 0;

      for (const file of files) {
        const filePath = path.join(backupDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          logger.debug('Deleting old backup', {
            file,
            age: Math.floor((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)),
          });

          if (stats.isDirectory()) {
            await fs.rm(filePath, { recursive: true, force: true });
          } else {
            await fs.unlink(filePath);
          }

          deletedCount++;
          deletedSize += stats.size;
        }
      }

      if (deletedCount > 0) {
        logger.info('Old backups cleaned up', {
          deletedCount,
          deletedSize: `${(deletedSize / 1024 / 1024).toFixed(2)} MB`,
        });
      }
    } catch (error: any) {
      logger.error('Backup cleanup failed', {
        error: error.message,
      });
      // Don't throw - cleanup failure shouldn't break backup process
    }
  }

  /**
   * Get backup health status
   */
  async getHealthStatus(): Promise<BackupHealthStatus> {
    const issues: string[] = [];

    if (!this.config.enabled) {
      return {
        enabled: false,
        healthy: false,
        backupCount: 0,
        totalSize: 0,
        issues: ['Backup service is disabled'],
      };
    }

    // Check last backup time
    const lastBackupTime = this.lastBackupMetadata?.timestamp;
    const lastBackupStatus = this.lastBackupMetadata?.status;

    if (!lastBackupTime) {
      issues.push('No backups have been performed yet');
    } else {
      const hoursSinceLastBackup = (Date.now() - lastBackupTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastBackup > 48) {
        issues.push(`Last backup was ${Math.floor(hoursSinceLastBackup)} hours ago (> 48 hours)`);
      }
    }

    if (lastBackupStatus === 'failed') {
      issues.push('Last backup failed');
    }

    // Get backup statistics
    let backupCount = 0;
    let totalSize = 0;
    let oldestBackup: Date | undefined;
    let newestBackup: Date | undefined;

    if (this.config.localPath) {
      try {
        const stats = await this.getBackupStatistics();
        backupCount = stats.count;
        totalSize = stats.totalSize;
        oldestBackup = stats.oldestBackup;
        newestBackup = stats.newestBackup;

        if (backupCount === 0) {
          issues.push('No backup files found in backup directory');
        }
      } catch (error: any) {
        issues.push(`Failed to read backup directory: ${error.message}`);
      }
    }

    const healthy = issues.length === 0;

    return {
      enabled: this.config.enabled,
      lastBackupTime,
      lastBackupStatus,
      lastBackupSize: this.lastBackupMetadata?.size,
      backupCount,
      oldestBackup,
      newestBackup,
      totalSize,
      healthy,
      issues,
    };
  }

  /**
   * Get backup statistics from local directory
   */
  private async getBackupStatistics(): Promise<{
    count: number;
    totalSize: number;
    oldestBackup?: Date;
    newestBackup?: Date;
  }> {
    if (!this.config.localPath) {
      return { count: 0, totalSize: 0 };
    }

    const backupDir = this.config.localPath;
    const files = await fs.readdir(backupDir);

    let count = 0;
    let totalSize = 0;
    let oldestBackup: Date | undefined;
    let newestBackup: Date | undefined;

    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = await fs.stat(filePath);

      count++;
      totalSize += stats.size;

      if (!oldestBackup || stats.mtime < oldestBackup) {
        oldestBackup = stats.mtime;
      }

      if (!newestBackup || stats.mtime > newestBackup) {
        newestBackup = stats.mtime;
      }
    }

    return { count, totalSize, oldestBackup, newestBackup };
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `mongodb-backup-${timestamp}`;
  }

  /**
   * Get backup path for a backup ID
   */
  private getBackupPath(backupId: string): string {
    if (!this.config.localPath) {
      throw new Error('Local backup path not configured');
    }

    return path.join(this.config.localPath, backupId);
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      logger.info('Creating backup directory', { dirPath });
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Get backup size
   */
  private async getBackupSize(backupPath: string): Promise<number> {
    try {
      const stats = await fs.stat(backupPath);
      return stats.size;
    } catch (error: any) {
      logger.warn('Failed to get backup size', {
        error: error.message,
        backupPath,
      });
      return 0;
    }
  }

  /**
   * List all backups
   */
  async listBackups(): Promise<Array<{ name: string; size: number; date: Date }>> {
    if (!this.config.localPath) {
      return [];
    }

    try {
      const backupDir = this.config.localPath;
      const files = await fs.readdir(backupDir);

      const backups = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(backupDir, file);
          const stats = await fs.stat(filePath);

          return {
            name: file,
            size: stats.size,
            date: stats.mtime,
          };
        })
      );

      return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error: any) {
      logger.error('Failed to list backups', { error: error.message });
      return [];
    }
  }
}
