#!/usr/bin/env tsx
/**
 * Runtime System Validation Script
 * 
 * Validates current production system state
 * DO NOT MODIFY - INSPECTION ONLY
 */

import mongoose from 'mongoose';
import { getRedisClient } from '../src/config/redis';
import { QueueManager } from '../src/queue/QueueManager';
import { BackupHealthCheck } from '../src/utils/backupHealthCheck';
import { logger } from '../src/utils/logger';
import { config } from '../src/config';

interface SystemState {
  infrastructure: {
    mongodb: 'OK' | 'FAIL';
    redis: 'OK' | 'FAIL';
    worker: 'OK' | 'FAIL';
    scheduler: 'OK' | 'FAIL';
    queue: 'OK' | 'FAIL';
  };
  queueState: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  };
  workerHeartbeat: {
    lastHeartbeat: string | null;
    activeJobs: number;
    memoryUsageMB: number;
    uptimeSeconds: number;
    healthy: boolean;
  };
  failedJobs: Array<{
    jobId: string;
    postId: string;
    error: string;
    attempts: number;
    failedAt: string;
  }>;
  backupHealth: {
    mongodb: {
      lastBackup: string | null;
      status: string;
      ageHours: number;
      healthy: boolean;
    };
    redis: {
      lastSnapshot: string | null;
      status: string;
      ageHours: number;
      healthy: boolean;
    };
  };
  systemStatus: 'HEALTHY' | 'DEGRADED' | 'FAIL';
  warnings: string[];
}

class RuntimeValidator {
  private warnings: string[] = [];

  /**
   * Check MongoDB connection
   */
  private async checkMongoDB(): Promise<'OK' | 'FAIL'> {
    try {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(config.database.uri);
      }

      await mongoose.connection.db.admin().ping();
      return 'OK';
    } catch (error: any) {
      this.warnings.push(`MongoDB connection failed: ${error.message}`);
      return 'FAIL';
    }
  }

  /**
   * Check Redis connection
   */
  private async checkRedis(): Promise<'OK' | 'FAIL'> {
    try {
      const redis = getRedisClient();
      await redis.ping();
      return 'OK';
    } catch (error: any) {
      this.warnings.push(`Redis connection failed: ${error.message}`);
      return 'FAIL';
    }
  }

  /**
   * Check worker heartbeat
   */
  private async checkWorker(): Promise<'OK' | 'FAIL'> {
    try {
      const redis = getRedisClient();
      const heartbeat = await redis.get('worker:heartbeat');
      
      if (!heartbeat) {
        this.warnings.push('Worker heartbeat not found - worker may not be running');
        return 'FAIL';
      }

      const lastHeartbeat = parseInt(heartbeat, 10);
      const now = Date.now();
      const timeSinceHeartbeat = now - lastHeartbeat;

      if (timeSinceHeartbeat > 120000) {
        this.warnings.push(`Worker heartbeat stale (${Math.floor(timeSinceHeartbeat / 1000)}s ago)`);
        return 'FAIL';
      }

      return 'OK';
    } catch (error: any) {
      this.warnings.push(`Worker check failed: ${error.message}`);
      return 'FAIL';
    }
  }

  /**
   * Check scheduler
   */
  private async checkScheduler(): Promise<'OK' | 'FAIL'> {
    try {
      const redis = getRedisClient();
      const schedulerHeartbeat = await redis.get('scheduler:heartbeat');
      
      if (!schedulerHeartbeat) {
        this.warnings.push('Scheduler heartbeat not found - scheduler may not be running');
        return 'FAIL';
      }

      const lastHeartbeat = parseInt(schedulerHeartbeat, 10);
      const now = Date.now();
      const timeSinceHeartbeat = now - lastHeartbeat;

      if (timeSinceHeartbeat > 120000) {
        this.warnings.push(`Scheduler heartbeat stale (${Math.floor(timeSinceHeartbeat / 1000)}s ago)`);
        return 'FAIL';
      }

      return 'OK';
    } catch (error: any) {
      // Scheduler heartbeat may not be implemented yet
      return 'OK';
    }
  }

  /**
   * Check queue accessibility
   */
  private async checkQueue(): Promise<'OK' | 'FAIL'> {
    try {
      const queueManager = QueueManager.getInstance();
      await queueManager.getQueueStats('posting-queue');
      return 'OK';
    } catch (error: any) {
      this.warnings.push(`Queue check failed: ${error.message}`);
      return 'FAIL';
    }
  }

  /**
   * Get queue state
   */
  private async getQueueState(): Promise<SystemState['queueState']> {
    try {
      const queueManager = QueueManager.getInstance();
      const stats = await queueManager.getQueueStats('posting-queue');

      return {
        waiting: stats.waiting,
        active: stats.active,
        completed: stats.completed,
        failed: stats.failed,
        delayed: stats.delayed,
        paused: stats.paused,
      };
    } catch (error: any) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: false,
      };
    }
  }

  /**
   * Get worker heartbeat info
   */
  private async getWorkerHeartbeat(): Promise<SystemState['workerHeartbeat']> {
    try {
      const redis = getRedisClient();
      const heartbeat = await redis.get('worker:heartbeat');
      const activeJobs = await redis.get('worker:active_jobs');
      
      if (!heartbeat) {
        return {
          lastHeartbeat: null,
          activeJobs: 0,
          memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          uptimeSeconds: Math.floor(process.uptime()),
          healthy: false,
        };
      }

      const lastHeartbeatTime = parseInt(heartbeat, 10);
      const now = Date.now();
      const timeSinceHeartbeat = now - lastHeartbeatTime;

      return {
        lastHeartbeat: new Date(lastHeartbeatTime).toISOString(),
        activeJobs: activeJobs ? parseInt(activeJobs, 10) : 0,
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        uptimeSeconds: Math.floor(process.uptime()),
        healthy: timeSinceHeartbeat < 120000,
      };
    } catch (error: any) {
      return {
        lastHeartbeat: null,
        activeJobs: 0,
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        uptimeSeconds: Math.floor(process.uptime()),
        healthy: false,
      };
    }
  }

  /**
   * Get failed jobs
   */
  private async getFailedJobs(): Promise<SystemState['failedJobs']> {
    try {
      const queueManager = QueueManager.getInstance();
      const queue = queueManager.getQueue('posting-queue');
      
      const failedJobs = await queue.getFailed(0, 10); // Get first 10 failed jobs

      return failedJobs.map(job => ({
        jobId: job.id || 'unknown',
        postId: job.data?.postId || 'unknown',
        error: job.failedReason || 'Unknown error',
        attempts: job.attemptsMade,
        failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : 'unknown',
      }));
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Get backup health
   */
  private async getBackupHealth(): Promise<SystemState['backupHealth']> {
    try {
      const backupCheck = new BackupHealthCheck();
      const health = await backupCheck.check();

      return {
        mongodb: {
          lastBackup: health.mongodb.lastBackup?.toISOString() || null,
          status: health.mongodb.status,
          ageHours: health.mongodb.ageHours,
          healthy: health.mongodb.healthy,
        },
        redis: {
          lastSnapshot: health.redis.lastSnapshot?.toISOString() || null,
          status: health.redis.status,
          ageHours: health.redis.ageHours,
          healthy: health.redis.healthy,
        },
      };
    } catch (error: any) {
      return {
        mongodb: {
          lastBackup: null,
          status: 'unknown',
          ageHours: 0,
          healthy: false,
        },
        redis: {
          lastSnapshot: null,
          status: 'unknown',
          ageHours: 0,
          healthy: false,
        },
      };
    }
  }

  /**
   * Validate entire system
   */
  async validate(): Promise<SystemState> {
    console.log('🔍 Starting runtime system validation...\n');

    // 1. Infrastructure Health
    console.log('1️⃣  INFRASTRUCTURE HEALTH');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const mongodb = await this.checkMongoDB();
    console.log(`   MongoDB:   ${mongodb === 'OK' ? '✅' : '❌'} ${mongodb}`);
    
    const redis = await this.checkRedis();
    console.log(`   Redis:     ${redis === 'OK' ? '✅' : '❌'} ${redis}`);
    
    const worker = await this.checkWorker();
    console.log(`   Worker:    ${worker === 'OK' ? '✅' : '❌'} ${worker}`);
    
    const scheduler = await this.checkScheduler();
    console.log(`   Scheduler: ${scheduler === 'OK' ? '✅' : '❌'} ${scheduler}`);
    
    const queue = await this.checkQueue();
    console.log(`   Queue:     ${queue === 'OK' ? '✅' : '❌'} ${queue}`);
    console.log();

    // 2. Queue State
    console.log('2️⃣  QUEUE STATE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const queueState = await this.getQueueState();
    console.log(`   Waiting:   ${queueState.waiting}`);
    console.log(`   Active:    ${queueState.active}`);
    console.log(`   Completed: ${queueState.completed}`);
    console.log(`   Failed:    ${queueState.failed}`);
    console.log(`   Delayed:   ${queueState.delayed}`);
    console.log(`   Paused:    ${queueState.paused}`);
    console.log();

    // 3. Worker Heartbeat
    console.log('3️⃣  WORKER HEARTBEAT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const workerHeartbeat = await this.getWorkerHeartbeat();
    console.log(`   Last Heartbeat: ${workerHeartbeat.lastHeartbeat || 'N/A'}`);
    console.log(`   Active Jobs:    ${workerHeartbeat.activeJobs}`);
    console.log(`   Memory Usage:   ${workerHeartbeat.memoryUsageMB} MB`);
    console.log(`   Uptime:         ${workerHeartbeat.uptimeSeconds}s`);
    console.log(`   Healthy:        ${workerHeartbeat.healthy ? '✅ YES' : '❌ NO'}`);
    console.log();

    // 4. Failed Jobs
    console.log('4️⃣  FAILED JOBS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const failedJobs = await this.getFailedJobs();
    if (failedJobs.length === 0) {
      console.log('   ✅ No failed jobs');
    } else {
      failedJobs.forEach((job, index) => {
        console.log(`   [${index + 1}] Job ID: ${job.jobId}`);
        console.log(`       Post ID:   ${job.postId}`);
        console.log(`       Error:     ${job.error}`);
        console.log(`       Attempts:  ${job.attempts}`);
        console.log(`       Failed At: ${job.failedAt}`);
        console.log();
      });
    }
    console.log();

    // 5. Backup Health
    console.log('5️⃣  BACKUP HEALTH');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const backupHealth = await this.getBackupHealth();
    console.log(`   MongoDB Backup:`);
    console.log(`     Last Backup: ${backupHealth.mongodb.lastBackup || 'N/A'}`);
    console.log(`     Status:      ${backupHealth.mongodb.status.toUpperCase()}`);
    console.log(`     Age:         ${backupHealth.mongodb.ageHours.toFixed(1)} hours`);
    console.log(`     Healthy:     ${backupHealth.mongodb.healthy ? '✅ YES' : '❌ NO'}`);
    console.log();
    console.log(`   Redis Snapshot:`);
    console.log(`     Last Snapshot: ${backupHealth.redis.lastSnapshot || 'N/A'}`);
    console.log(`     Status:        ${backupHealth.redis.status.toUpperCase()}`);
    console.log(`     Age:           ${backupHealth.redis.ageHours.toFixed(1)} hours`);
    console.log(`     Healthy:       ${backupHealth.redis.healthy ? '✅ YES' : '❌ NO'}`);
    console.log();

    // Determine overall system status
    const criticalFail = mongodb === 'FAIL' || redis === 'FAIL' || queue === 'FAIL';
    const degraded = worker === 'FAIL' || scheduler === 'FAIL' || 
                     !backupHealth.mongodb.healthy || !backupHealth.redis.healthy ||
                     queueState.failed > 50;

    let systemStatus: SystemState['systemStatus'];
    if (criticalFail) {
      systemStatus = 'FAIL';
    } else if (degraded) {
      systemStatus = 'DEGRADED';
    } else {
      systemStatus = 'HEALTHY';
    }

    // 6. Final Result
    console.log('6️⃣  SYSTEM STATUS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const statusEmoji = systemStatus === 'HEALTHY' ? '✅' : systemStatus === 'DEGRADED' ? '⚠️' : '❌';
    console.log(`   ${statusEmoji} SYSTEM_STATUS = ${systemStatus}`);
    console.log();

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS DETECTED:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
      console.log();
    }

    return {
      infrastructure: {
        mongodb,
        redis,
        worker,
        scheduler,
        queue,
      },
      queueState,
      workerHeartbeat,
      failedJobs,
      backupHealth,
      systemStatus,
      warnings: this.warnings,
    };
  }
}

// Run validation
const validator = new RuntimeValidator();
validator.validate()
  .then((state) => {
    console.log('✅ Validation complete');
    process.exit(state.systemStatus === 'FAIL' ? 1 : 0);
  })
  .catch((error) => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
