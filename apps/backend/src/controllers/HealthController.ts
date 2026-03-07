import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { getRedisClient, isRedisHealthy, getCircuitBreakerStatus } from '../config/redis';
import { QueueManager } from '../queue/QueueManager';
import { logger } from '../utils/logger';

/**
 * Health Controller
 * 
 * Provides system health status for monitoring
 * Must NOT crash if dependencies fail
 */

interface HealthStatus {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  dependencies: {
    db: 'ok' | 'fail';
    redis: 'ok' | 'fail';
    queue: 'ok' | 'fail';
    worker: 'ok' | 'fail';
  };
  redis?: {
    circuitBreaker: {
      state: string;
      errorRate: number;
      errors: number;
      successes: number;
      isHealthy: boolean;
    };
  };
}

export class HealthController {
  /**
   * Health check endpoint
   * GET /health
   */
  async getHealth(req: Response, res: Response): Promise<void> {
    try {
      const health = await this.checkHealth();
      
      // Return 200 for ok, 503 for degraded
      const statusCode = health.status === 'ok' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error: any) {
      // Even if health check fails, return a response
      logger.error('Health check failed', {
        error: error.message,
        stack: error.stack,
      });

      res.status(503).json({
        status: 'degraded',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        memory: this.getMemoryUsage(),
        dependencies: {
          db: 'fail',
          redis: 'fail',
          queue: 'fail',
          worker: 'fail',
        },
        error: 'Health check failed',
      });
    }
  }

  /**
   * Check overall system health
   */
  private async checkHealth(): Promise<HealthStatus> {
    // Check all dependencies in parallel (with timeout)
    const [dbStatus, redisStatus, queueStatus, workerStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueue(),
      this.checkWorker(),
    ]);

    // Get circuit breaker status
    const circuitBreakerStatus = getCircuitBreakerStatus();

    // Determine overall status
    const allOk = 
      dbStatus === 'ok' &&
      redisStatus === 'ok' &&
      queueStatus === 'ok' &&
      workerStatus === 'ok';

    return {
      status: allOk ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: this.getMemoryUsage(),
      dependencies: {
        db: dbStatus,
        redis: redisStatus,
        queue: queueStatus,
        worker: workerStatus,
      },
      redis: {
        circuitBreaker: {
          state: circuitBreakerStatus.state,
          errorRate: Math.round(circuitBreakerStatus.errorRate * 100) / 100,
          errors: circuitBreakerStatus.errors,
          successes: circuitBreakerStatus.successes,
          isHealthy: circuitBreakerStatus.isHealthy,
        },
      },
    };
  }

  /**
   * Check database connection
   */
  private async checkDatabase(): Promise<'ok' | 'fail'> {
    try {
      // Check if mongoose is connected
      if (mongoose.connection.readyState !== 1) {
        return 'fail';
      }

      // Ping database with timeout
      await Promise.race([
        mongoose.connection.db.admin().ping(),
        this.timeout(5000, 'Database ping timeout'),
      ]);

      return 'ok';
    } catch (error: any) {
      logger.error('Database health check failed', {
        error: error.message,
      });
      return 'fail';
    }
  }

  /**
   * Check Redis connection
   */
  private async checkRedis(): Promise<'ok' | 'fail'> {
    try {
      // Check circuit breaker first
      if (!isRedisHealthy()) {
        logger.warn('Redis health check failed: circuit breaker open or Redis unavailable');
        return 'fail';
      }

      // Get Redis client
      const redisClient = getRedisClient();

      // Ping Redis with timeout
      await Promise.race([
        redisClient.ping(),
        this.timeout(5000, 'Redis ping timeout'),
      ]);

      return 'ok';
    } catch (error: any) {
      logger.error('Redis health check failed', {
        error: error.message,
      });
      return 'fail';
    }
  }

  /**
   * Check queue health
   */
  private async checkQueue(): Promise<'ok' | 'fail'> {
    try {
      // Get queue manager instance
      const queueManager = QueueManager.getInstance();

      // Get queue stats with timeout
      const stats = await Promise.race([
        queueManager.getQueueStats('posting-queue'),
        this.timeout(5000, 'Queue stats timeout'),
      ]);

      // Check if queue is responsive
      if (stats && typeof stats.waiting === 'number') {
        return 'ok';
      }

      return 'fail';
    } catch (error: any) {
      logger.error('Queue health check failed', {
        error: error.message,
      });
      return 'fail';
    }
  }

  /**
   * Check worker health
   */
  private async checkWorker(): Promise<'ok' | 'fail'> {
    try {
      // Check worker heartbeat
      const lastHeartbeat = await this.getWorkerHeartbeat();
      
      if (!lastHeartbeat) {
        return 'fail';
      }

      const now = Date.now();
      const timeSinceHeartbeat = now - lastHeartbeat;

      // Worker should heartbeat every 60s, fail if > 120s
      if (timeSinceHeartbeat > 120000) {
        logger.warn('Worker heartbeat stale', {
          lastHeartbeat: new Date(lastHeartbeat).toISOString(),
          timeSinceHeartbeat: Math.floor(timeSinceHeartbeat / 1000),
        });
        return 'fail';
      }

      return 'ok';
    } catch (error: any) {
      logger.error('Worker health check failed', {
        error: error.message,
      });
      return 'fail';
    }
  }

  /**
   * Get worker heartbeat from Redis
   */
  private async getWorkerHeartbeat(): Promise<number | null> {
    try {
      const redisClient = getRedisClient();
      const heartbeat = await redisClient.get('worker:heartbeat');
      
      if (!heartbeat) {
        return null;
      }

      return parseInt(heartbeat, 10);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
  } {
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;
    const percentage = (usedMem / totalMem) * 100;

    return {
      used: Math.round(usedMem / 1024 / 1024), // MB
      total: Math.round(totalMem / 1024 / 1024), // MB
      percentage: Math.round(percentage * 100) / 100,
    };
  }

  /**
   * Timeout helper
   */
  private timeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }
}

export const healthController = new HealthController();
