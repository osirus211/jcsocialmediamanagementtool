/**
 * Backup Verifier
 * 
 * Core logic for verifying MongoDB backup integrity
 * 
 * Features:
 * - Detects latest backup file
 * - Validates backup structure
 * - Performs safe restore test to temporary database
 * - Never touches production database
 * - Timeout protection
 * - Comprehensive error handling
 * 
 * SAFETY GUARANTEES:
 * - NEVER writes to production DB
 * - Uses temporary database with unique name
 * - Cleans up temporary DB after verification
 * - Timeout if restore hangs
 * - Never crashes on failure
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import mongoose from 'mongoose';
import { logger } from '../../utils/logger';

const execAsync = promisify(exec);
const statAsync = promisify(fs.stat);
const readdirAsync = promisify(fs.readdir);

export interface BackupVerificationResult {
  success: boolean;
  backupFile?: string;
  backupSize?: number;
  backupAge?: number; // milliseconds
  error?: string;
  errorCode?: string;
  verifiedAt: Date;
  duration: number; // milliseconds
  collectionsRestored?: number;
  tempDbName?: string;
}

export interface BackupVerifierConfig {
  backupPath: string;
  mongoUri: string;
  tempDbPrefix: string;
  timeoutMs: number;
  maxBackupAgeHours: number;
}

export class BackupVerifier {
  private config: BackupVerifierConfig;

  constructor(config: BackupVerifierConfig) {
    this.config = config;
  }

  /**
   * Verify the latest backup
   * Main entry point for verification
   */
  async verifyLatestBackup(): Promise<BackupVerificationResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting backup verification', {
        backupPath: this.config.backupPath,
        timeoutMs: this.config.timeoutMs,
      });

      // Step 1: Find latest backup file
      const backupFile = await this.findLatestBackup();
      if (!backupFile) {
        return {
          success: false,
          error: 'No backup file found',
          errorCode: 'NO_BACKUP_FOUND',
          verifiedAt: new Date(),
          duration: Date.now() - startTime,
        };
      }

      logger.info('Found backup file', { backupFile });

      // Step 2: Validate backup file
      const validation = await this.validateBackupFile(backupFile);
      if (!validation.valid) {
        return {
          success: false,
          backupFile,
          error: validation.error,
          errorCode: validation.errorCode,
          verifiedAt: new Date(),
          duration: Date.now() - startTime,
        };
      }

      // Step 3: Check backup age
      const backupAge = Date.now() - validation.stats!.mtimeMs;
      const maxAgeMs = this.config.maxBackupAgeHours * 60 * 60 * 1000;
      
      if (backupAge > maxAgeMs) {
        logger.warn('Backup is older than threshold', {
          backupFile,
          ageHours: (backupAge / (60 * 60 * 1000)).toFixed(2),
          maxAgeHours: this.config.maxBackupAgeHours,
        });
      }

      // Step 4: Perform restore test
      const restoreResult = await this.performRestoreTest(backupFile);
      
      if (!restoreResult.success) {
        return {
          success: false,
          backupFile,
          backupSize: validation.stats!.size,
          backupAge,
          error: restoreResult.error,
          errorCode: restoreResult.errorCode,
          verifiedAt: new Date(),
          duration: Date.now() - startTime,
        };
      }

      // Success!
      logger.info('Backup verification successful', {
        backupFile,
        backupSize: validation.stats!.size,
        backupAgeHours: (backupAge / (60 * 60 * 1000)).toFixed(2),
        collectionsRestored: restoreResult.collectionsRestored,
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        backupFile,
        backupSize: validation.stats!.size,
        backupAge,
        collectionsRestored: restoreResult.collectionsRestored,
        tempDbName: restoreResult.tempDbName,
        verifiedAt: new Date(),
        duration: Date.now() - startTime,
      };

    } catch (error: any) {
      logger.error('Backup verification error', {
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
        errorCode: 'VERIFICATION_ERROR',
        verifiedAt: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Find the latest backup file in the backup directory
   */
  private async findLatestBackup(): Promise<string | null> {
    try {
      // Check if backup directory exists
      if (!fs.existsSync(this.config.backupPath)) {
        logger.warn('Backup directory does not exist', {
          backupPath: this.config.backupPath,
        });
        return null;
      }

      // Read directory
      const files = await readdirAsync(this.config.backupPath);
      
      // Filter for backup files (mongodb_backup_*.tar.gz)
      const backupFiles = files.filter(file => 
        file.startsWith('mongodb_backup_') && file.endsWith('.tar.gz')
      );

      if (backupFiles.length === 0) {
        logger.warn('No backup files found in directory', {
          backupPath: this.config.backupPath,
        });
        return null;
      }

      // Sort by modification time (newest first)
      const filesWithStats = await Promise.all(
        backupFiles.map(async (file) => {
          const filePath = path.join(this.config.backupPath, file);
          const stats = await statAsync(filePath);
          return { file, filePath, mtime: stats.mtimeMs };
        })
      );

      filesWithStats.sort((a, b) => b.mtime - a.mtime);

      return filesWithStats[0].filePath;

    } catch (error: any) {
      logger.error('Error finding latest backup', {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Validate backup file exists and is not empty
   */
  private async validateBackupFile(backupFile: string): Promise<{
    valid: boolean;
    error?: string;
    errorCode?: string;
    stats?: fs.Stats;
  }> {
    try {
      // Check if file exists
      if (!fs.existsSync(backupFile)) {
        return {
          valid: false,
          error: 'Backup file does not exist',
          errorCode: 'FILE_NOT_FOUND',
        };
      }

      // Get file stats
      const stats = await statAsync(backupFile);

      // Check if file is empty
      if (stats.size === 0) {
        return {
          valid: false,
          error: 'Backup file is empty',
          errorCode: 'EMPTY_FILE',
        };
      }

      // Check if file is too small (likely corrupted)
      const minSize = 1024; // 1 KB
      if (stats.size < minSize) {
        return {
          valid: false,
          error: `Backup file too small (${stats.size} bytes)`,
          errorCode: 'FILE_TOO_SMALL',
        };
      }

      // Verify tar.gz integrity
      try {
        await execAsync(`tar -tzf "${backupFile}" > /dev/null 2>&1`);
      } catch (error) {
        return {
          valid: false,
          error: 'Backup file is corrupted (tar integrity check failed)',
          errorCode: 'CORRUPTED_FILE',
        };
      }

      return {
        valid: true,
        stats,
      };

    } catch (error: any) {
      return {
        valid: false,
        error: error.message,
        errorCode: 'VALIDATION_ERROR',
      };
    }
  }

  /**
   * Perform restore test to temporary database
   * SAFETY: Uses unique temporary database name, never touches production
   */
  private async performRestoreTest(backupFile: string): Promise<{
    success: boolean;
    error?: string;
    errorCode?: string;
    collectionsRestored?: number;
    tempDbName?: string;
  }> {
    const tempDbName = `${this.config.tempDbPrefix}${Date.now()}`;
    const extractDir = path.join(path.dirname(backupFile), `extract_${Date.now()}`);

    try {
      logger.info('Starting restore test', {
        backupFile,
        tempDbName,
        extractDir,
      });

      // Step 1: Extract backup archive
      logger.debug('Extracting backup archive');
      await this.withTimeout(
        execAsync(`tar -xzf "${backupFile}" -C "${path.dirname(backupFile)}" --transform='s|^|extract_${Date.now()}/|'`),
        this.config.timeoutMs,
        'Extract timeout'
      );

      // Find the extracted directory
      const extractedDirs = fs.readdirSync(path.dirname(backupFile))
        .filter(f => f.startsWith('extract_'))
        .map(f => path.join(path.dirname(backupFile), f));

      if (extractedDirs.length === 0) {
        throw new Error('Failed to find extracted backup directory');
      }

      const actualExtractDir = extractedDirs[extractedDirs.length - 1];

      // Find the database directory inside extracted backup
      const backupDirs = fs.readdirSync(actualExtractDir);
      const dbDir = backupDirs.find(d => {
        const fullPath = path.join(actualExtractDir, d);
        return fs.statSync(fullPath).isDirectory();
      });

      if (!dbDir) {
        throw new Error('No database directory found in backup');
      }

      const dbPath = path.join(actualExtractDir, dbDir);

      // Step 2: Perform mongorestore to temporary database
      logger.debug('Restoring to temporary database', { tempDbName });
      
      const restoreCommand = `mongorestore --uri="${this.config.mongoUri}" --db="${tempDbName}" --gzip "${dbPath}"`;
      
      const { stdout, stderr } = await this.withTimeout(
        execAsync(restoreCommand),
        this.config.timeoutMs,
        'Restore timeout'
      );

      logger.debug('Restore output', { stdout, stderr });

      // Step 3: Verify restore by connecting and checking collections
      logger.debug('Verifying restored database');
      const verification = await this.verifyRestoredDatabase(tempDbName);

      if (!verification.success) {
        return {
          success: false,
          error: verification.error,
          errorCode: 'RESTORE_VERIFICATION_FAILED',
          tempDbName,
        };
      }

      // Step 4: Cleanup temporary database
      await this.cleanupTempDatabase(tempDbName);

      // Step 5: Cleanup extracted files
      await this.cleanupExtractedFiles(actualExtractDir);

      return {
        success: true,
        collectionsRestored: verification.collectionsCount,
        tempDbName,
      };

    } catch (error: any) {
      logger.error('Restore test failed', {
        error: error.message,
        tempDbName,
      });

      // Cleanup on error
      try {
        await this.cleanupTempDatabase(tempDbName);
        if (fs.existsSync(extractDir)) {
          await execAsync(`rm -rf "${extractDir}"`);
        }
      } catch (cleanupError) {
        logger.error('Cleanup after restore failure failed', {
          error: cleanupError.message,
        });
      }

      return {
        success: false,
        error: error.message,
        errorCode: error.message.includes('timeout') ? 'RESTORE_TIMEOUT' : 'RESTORE_FAILED',
        tempDbName,
      };
    }
  }

  /**
   * Verify restored database by checking collections
   */
  private async verifyRestoredDatabase(tempDbName: string): Promise<{
    success: boolean;
    error?: string;
    collectionsCount?: number;
  }> {
    let connection: mongoose.Connection | null = null;

    try {
      // Create separate connection to temp database
      connection = mongoose.createConnection(this.config.mongoUri, {
        dbName: tempDbName,
      });

      await connection.asPromise();

      // Get collections
      const collections = await connection.db.listCollections().toArray();

      if (collections.length === 0) {
        return {
          success: false,
          error: 'No collections found in restored database',
        };
      }

      logger.debug('Verified restored database', {
        tempDbName,
        collectionsCount: collections.length,
        collections: collections.map(c => c.name),
      });

      return {
        success: true,
        collectionsCount: collections.length,
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    } finally {
      // Close connection
      if (connection) {
        await connection.close();
      }
    }
  }

  /**
   * Cleanup temporary database
   * SAFETY: Only drops databases with temp prefix
   */
  private async cleanupTempDatabase(tempDbName: string): Promise<void> {
    // SAFETY: Verify temp database name has correct prefix
    if (!tempDbName.startsWith(this.config.tempDbPrefix)) {
      logger.error('Attempted to drop database without temp prefix', {
        tempDbName,
        expectedPrefix: this.config.tempDbPrefix,
      });
      throw new Error('Cannot drop database without temp prefix');
    }

    let connection: mongoose.Connection | null = null;

    try {
      logger.debug('Dropping temporary database', { tempDbName });

      // Create connection to temp database
      connection = mongoose.createConnection(this.config.mongoUri, {
        dbName: tempDbName,
      });

      await connection.asPromise();

      // Drop database
      await connection.db.dropDatabase();

      logger.debug('Temporary database dropped', { tempDbName });

    } catch (error: any) {
      logger.error('Failed to cleanup temporary database', {
        tempDbName,
        error: error.message,
      });
      // Don't throw - cleanup failure shouldn't fail verification
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  /**
   * Cleanup extracted backup files
   */
  private async cleanupExtractedFiles(extractDir: string): Promise<void> {
    try {
      if (fs.existsSync(extractDir)) {
        await execAsync(`rm -rf "${extractDir}"`);
        logger.debug('Cleaned up extracted files', { extractDir });
      }
    } catch (error: any) {
      logger.error('Failed to cleanup extracted files', {
        extractDir,
        error: error.message,
      });
      // Don't throw - cleanup failure shouldn't fail verification
    }
  }

  /**
   * Execute promise with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      ),
    ]);
  }
}
