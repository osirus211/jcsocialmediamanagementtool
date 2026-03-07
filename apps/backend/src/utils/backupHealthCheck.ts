/**
 * Backup Health Check
 * 
 * Monitors backup status and alerts on failures
 * Ensures backups are running successfully
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

export interface BackupHealth {
  mongodb: {
    lastBackup: Date | null;
    status: 'success' | 'failed' | 'unknown';
    ageHours: number;
    healthy: boolean;
  };
  redis: {
    lastSnapshot: Date | null;
    status: 'success' | 'failed' | 'unknown';
    ageHours: number;
    healthy: boolean;
  };
  overall: {
    healthy: boolean;
    alerts: string[];
  };
}

export class BackupHealthCheck {
  private mongoBackupDir: string;
  private redisDataDir: string;
  private maxBackupAgeHours: number;

  constructor(
    mongoBackupDir: string = '/backups/mongodb',
    redisDataDir: string = '/data',
    maxBackupAgeHours: number = 26 // 24 hours + 2 hour buffer
  ) {
    this.mongoBackupDir = mongoBackupDir;
    this.redisDataDir = redisDataDir;
    this.maxBackupAgeHours = maxBackupAgeHours;
  }

  /**
   * Check MongoDB backup health
   */
  private async checkMongoBackup(): Promise<BackupHealth['mongodb']> {
    try {
      const statusFile = path.join(this.mongoBackupDir, '.last_backup_status');
      
      // Check if status file exists
      try {
        const content = await fs.readFile(statusFile, 'utf-8');
        const [status, timestamp] = content.trim().split(' ');
        
        if (status === 'SUCCESS' && timestamp) {
          const lastBackup = new Date(parseInt(timestamp) * 1000);
          const ageMs = Date.now() - lastBackup.getTime();
          const ageHours = ageMs / (1000 * 60 * 60);
          const healthy = ageHours < this.maxBackupAgeHours;

          if (!healthy) {
            logger.error('ALERT: MongoDB backup is stale', {
              lastBackup: lastBackup.toISOString(),
              ageHours: ageHours.toFixed(2),
              maxAgeHours: this.maxBackupAgeHours,
              severity: 'HIGH',
            });
          }

          return {
            lastBackup,
            status: 'success',
            ageHours: parseFloat(ageHours.toFixed(2)),
            healthy,
          };
        } else {
          logger.error('ALERT: MongoDB backup failed', {
            status,
            severity: 'CRITICAL',
          });

          return {
            lastBackup: null,
            status: 'failed',
            ageHours: 0,
            healthy: false,
          };
        }
      } catch (error: any) {
        // Status file doesn't exist
        logger.error('ALERT: MongoDB backup status file not found', {
          statusFile,
          error: error.message,
          severity: 'CRITICAL',
        });

        return {
          lastBackup: null,
          status: 'unknown',
          ageHours: 0,
          healthy: false,
        };
      }
    } catch (error: any) {
      logger.error('Failed to check MongoDB backup health', {
        error: error.message,
      });

      return {
        lastBackup: null,
        status: 'unknown',
        ageHours: 0,
        healthy: false,
      };
    }
  }

  /**
   * Check Redis snapshot health
   */
  private async checkRedisSnapshot(): Promise<BackupHealth['redis']> {
    try {
      const rdbFile = path.join(this.redisDataDir, 'dump.rdb');
      
      try {
        const stats = await fs.stat(rdbFile);
        const lastSnapshot = stats.mtime;
        const ageMs = Date.now() - lastSnapshot.getTime();
        const ageHours = ageMs / (1000 * 60 * 60);
        
        // Redis snapshots should be more frequent (every 6 hours)
        const maxSnapshotAge = 8; // 6 hours + 2 hour buffer
        const healthy = ageHours < maxSnapshotAge;

        if (!healthy) {
          logger.error('ALERT: Redis snapshot is stale', {
            lastSnapshot: lastSnapshot.toISOString(),
            ageHours: ageHours.toFixed(2),
            maxAgeHours: maxSnapshotAge,
            severity: 'MEDIUM',
          });
        }

        return {
          lastSnapshot,
          status: 'success',
          ageHours: parseFloat(ageHours.toFixed(2)),
          healthy,
        };
      } catch (error: any) {
        // RDB file doesn't exist
        logger.error('ALERT: Redis snapshot file not found', {
          rdbFile,
          error: error.message,
          severity: 'HIGH',
        });

        return {
          lastSnapshot: null,
          status: 'unknown',
          ageHours: 0,
          healthy: false,
        };
      }
    } catch (error: any) {
      logger.error('Failed to check Redis snapshot health', {
        error: error.message,
      });

      return {
        lastSnapshot: null,
        status: 'unknown',
        ageHours: 0,
        healthy: false,
      };
    }
  }

  /**
   * Check overall backup health
   */
  async check(): Promise<BackupHealth> {
    const mongodb = await this.checkMongoBackup();
    const redis = await this.checkRedisSnapshot();

    const alerts: string[] = [];

    if (!mongodb.healthy) {
      if (mongodb.status === 'failed') {
        alerts.push('MongoDB backup failed');
      } else if (mongodb.status === 'unknown') {
        alerts.push('MongoDB backup status unknown');
      } else if (mongodb.ageHours > this.maxBackupAgeHours) {
        alerts.push(`MongoDB backup is ${mongodb.ageHours.toFixed(1)} hours old`);
      }
    }

    if (!redis.healthy) {
      if (redis.status === 'unknown') {
        alerts.push('Redis snapshot not found');
      } else if (redis.ageHours > 8) {
        alerts.push(`Redis snapshot is ${redis.ageHours.toFixed(1)} hours old`);
      }
    }

    const overall = {
      healthy: mongodb.healthy && redis.healthy,
      alerts,
    };

    // Log overall health
    if (overall.healthy) {
      logger.info('Backup health check: All backups healthy', {
        mongodb: {
          lastBackup: mongodb.lastBackup?.toISOString(),
          ageHours: mongodb.ageHours,
        },
        redis: {
          lastSnapshot: redis.lastSnapshot?.toISOString(),
          ageHours: redis.ageHours,
        },
      });
    } else {
      logger.error('ALERT: Backup health check failed', {
        alerts,
        mongodb,
        redis,
        severity: 'HIGH',
      });
    }

    return {
      mongodb,
      redis,
      overall,
    };
  }

  /**
   * Start periodic health checks
   */
  startMonitoring(intervalMs: number = 3600000): NodeJS.Timeout {
    logger.info('Starting backup health monitoring', {
      intervalMs,
      intervalHours: intervalMs / (1000 * 60 * 60),
    });

    // Run immediately
    this.check();

    // Then run periodically
    return setInterval(() => {
      this.check();
    }, intervalMs);
  }
}
