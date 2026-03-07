/**
 * Publishing Health Service
 * 
 * Provides health status for the publishing system
 * Aggregates metrics from SchedulerWorker, QueueManager, and PublishingWorker
 * 
 * Used by /internal/publishing-health endpoint
 */

import { logger } from '../utils/logger';

export interface PublishingHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  scheduler: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    isRunning: boolean;
    metrics?: {
      runs: number;
      postsProcessed: number;
      jobsCreated: number;
      errors: number;
    };
  };
  publishQueue: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    waiting: number;
    active: number;
    failed: number;
    delayed: number;
    completed: number;
    failureRate: string;
  };
  workers: {
    publishingWorker: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      isRunning: boolean;
      metrics?: {
        success: number;
        failed: number;
        retries: number;
        skipped: number;
        activeJobs: number;
      };
    };
  };
}

export class PublishingHealthService {
  private static instance: PublishingHealthService;

  static getInstance(): PublishingHealthService {
    if (!PublishingHealthService.instance) {
      PublishingHealthService.instance = new PublishingHealthService();
    }
    return PublishingHealthService.instance;
  }

  /**
   * Get comprehensive publishing system health
   */
  async getPublishingHealth(): Promise<PublishingHealthStatus> {
    try {
      const [schedulerHealth, queueHealth, workerHealth] = await Promise.all([
        this.getSchedulerHealth(),
        this.getQueueHealth(),
        this.getWorkerHealth(),
      ]);

      // Determine overall status
      const overallStatus = this.determineOverallStatus({
        scheduler: schedulerHealth.status,
        queue: queueHealth.status,
        worker: workerHealth.status,
      });

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        scheduler: schedulerHealth,
        publishQueue: queueHealth,
        workers: {
          publishingWorker: workerHealth,
        },
      };
    } catch (error: any) {
      logger.error('Publishing health check failed', { error: error.message });
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        scheduler: {
          status: 'unhealthy',
          isRunning: false,
        },
        publishQueue: {
          status: 'unhealthy',
          waiting: 0,
          active: 0,
          failed: 0,
          delayed: 0,
          completed: 0,
          failureRate: '0',
        },
        workers: {
          publishingWorker: {
            status: 'unhealthy',
            isRunning: false,
          },
        },
      };
    }
  }

  /**
   * Get scheduler health
   */
  private async getSchedulerHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    isRunning: boolean;
    metrics?: any;
  }> {
    try {
      const { schedulerWorker } = await import('../workers/SchedulerWorker');
      const status = schedulerWorker.getStatus();
      const metrics = schedulerWorker.getMetrics();

      // Determine health based on error rate
      const errorRate = metrics.scheduler_runs_total > 0
        ? (metrics.errors_total / metrics.scheduler_runs_total) * 100
        : 0;

      let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (!status.isRunning) {
        health = 'unhealthy';
      } else if (errorRate > 20) {
        health = 'unhealthy';
      } else if (errorRate > 5) {
        health = 'degraded';
      }

      return {
        status: health,
        isRunning: status.isRunning,
        metrics: {
          runs: metrics.scheduler_runs_total,
          postsProcessed: metrics.posts_processed_total,
          jobsCreated: metrics.jobs_created_total,
          errors: metrics.errors_total,
        },
      };
    } catch (error: any) {
      logger.error('Failed to get scheduler health', { error: error.message });
      return {
        status: 'unhealthy',
        isRunning: false,
      };
    }
  }

  /**
   * Get queue health
   */
  private async getQueueHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    waiting: number;
    active: number;
    failed: number;
    delayed: number;
    completed: number;
    failureRate: string;
  }> {
    try {
      const { QueueManager } = await import('../queue/QueueManager');
      const queueManager = QueueManager.getInstance();
      
      const stats = await queueManager.getQueueStats('posting-queue');

      // Map health string to status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (stats.health === 'unhealthy') {
        status = 'unhealthy';
      } else if (stats.health === 'degraded') {
        status = 'degraded';
      }

      return {
        status,
        waiting: stats.waiting,
        active: stats.active,
        failed: stats.failed,
        delayed: stats.delayed,
        completed: stats.completed,
        failureRate: stats.failureRate,
      };
    } catch (error: any) {
      logger.error('Failed to get queue health', { error: error.message });
      return {
        status: 'unhealthy',
        waiting: 0,
        active: 0,
        failed: 0,
        delayed: 0,
        completed: 0,
        failureRate: '0',
      };
    }
  }

  /**
   * Get worker health
   */
  private async getWorkerHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    isRunning: boolean;
    metrics?: any;
  }> {
    try {
      // Check if PublishingWorker is running via QueueManager
      const { QueueManager } = await import('../queue/QueueManager');
      const queueManager = QueueManager.getInstance();
      const workerHealth = queueManager.getWorkerHealth();
      
      const publishingWorkerHealth = workerHealth['posting-queue'];
      
      if (!publishingWorkerHealth || !publishingWorkerHealth.isRunning) {
        return {
          status: 'unhealthy',
          isRunning: false,
        };
      }

      // Try to get metrics from worker instance
      // Note: This requires the worker to be accessible
      // For now, we'll just check if it's running
      return {
        status: 'healthy',
        isRunning: true,
        metrics: {
          success: 0,
          failed: 0,
          retries: 0,
          skipped: 0,
          activeJobs: 0,
        },
      };
    } catch (error: any) {
      logger.error('Failed to get worker health', { error: error.message });
      return {
        status: 'unhealthy',
        isRunning: false,
      };
    }
  }

  /**
   * Determine overall status based on component health
   */
  private determineOverallStatus(components: {
    scheduler: 'healthy' | 'degraded' | 'unhealthy';
    queue: 'healthy' | 'degraded' | 'unhealthy';
    worker: 'healthy' | 'degraded' | 'unhealthy';
  }): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(components);
    
    // If any component is unhealthy, system is unhealthy
    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    }
    
    // If any component is degraded, system is degraded
    if (statuses.includes('degraded')) {
      return 'degraded';
    }
    
    // All components healthy
    return 'healthy';
  }
}

export const publishingHealthService = PublishingHealthService.getInstance();
