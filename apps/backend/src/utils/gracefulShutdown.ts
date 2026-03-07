import { Server } from 'http';
import mongoose from 'mongoose';
import { getRedisClient } from '../config/redis';
import { QueueManager } from '../queue/QueueManager';
import { logger } from './logger';

/**
 * Graceful Shutdown Handler
 * 
 * Handles SIGTERM and SIGINT signals
 * Ensures clean shutdown of all services
 */

let isShuttingDown = false;

export async function gracefulShutdown(
  server: Server,
  signal: string
): Promise<void> {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal', { signal });
    return;
  }

  isShuttingDown = true;

  logger.info('Graceful shutdown initiated', {
    signal,
    uptime: process.uptime(),
  });

  // Set shutdown timeout (30 seconds)
  const shutdownTimeout = setTimeout(() => {
    logger.error('Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, 30000);

  try {
    // Step 1: Stop accepting new requests
    logger.info('Stopping HTTP server...');
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          logger.error('Error closing HTTP server', { error: err.message });
          reject(err);
        } else {
          logger.info('HTTP server closed');
          resolve();
        }
      });
    });

    // Step 2: Stop scheduler (if running)
    logger.info('Stopping scheduler...');
    try {
      // Import scheduler dynamically to avoid circular dependencies
      const { schedulerService } = await import('../services/SchedulerService');
      await schedulerService.stop();
      logger.info('Scheduler stopped');
    } catch (error: any) {
      logger.error('Error stopping scheduler', { error: error.message });
    }

    // Step 3: Stop worker and finish active jobs
    logger.info('Stopping worker...');
    try {
      const queueManager = QueueManager.getInstance();
      if (queueManager) {
        await queueManager.closeAll();
        logger.info('Worker and queues stopped');
      }
    } catch (error: any) {
      logger.error('Error stopping worker', { error: error.message });
    }

    // Step 4: Close Redis connection
    logger.info('Closing Redis connection...');
    try {
      const redisClient = getRedisClient();
      if (redisClient) {
        await redisClient.quit();
        logger.info('Redis connection closed');
      }
    } catch (error: any) {
      logger.error('Error closing Redis', { error: error.message });
    }

    // Step 5: Close database connection
    logger.info('Closing database connection...');
    try {
      await mongoose.connection.close();
      logger.info('Database connection closed');
    } catch (error: any) {
      logger.error('Error closing database', { error: error.message });
    }

    // Clear timeout
    clearTimeout(shutdownTimeout);

    logger.info('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error: any) {
    clearTimeout(shutdownTimeout);
    logger.error('Error during graceful shutdown', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

/**
 * Register shutdown handlers
 */
export function registerShutdownHandlers(server: Server): void {
  // Handle SIGTERM (Docker, Kubernetes)
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received');
    gracefulShutdown(server, 'SIGTERM');
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    logger.info('SIGINT signal received');
    gracefulShutdown(server, 'SIGINT');
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack,
    });
    gracefulShutdown(server, 'uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled promise rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
    });
    gracefulShutdown(server, 'unhandledRejection');
  });

  logger.info('Shutdown handlers registered');
}
