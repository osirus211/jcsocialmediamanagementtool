/**
 * Workers Standalone
 * 
 * Entry point for running workers independently from API server
 * Used in Docker deployment
 */

import dotenv from 'dotenv';
dotenv.config();

import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { workerManager } from './services/WorkerManager';
import { queueMonitoringService } from './services/QueueMonitoringService';

async function startWorkers() {
  console.log('🚀 Starting workers standalone...\n');

  try {
    // Step 1: Connect to database
    console.log('📦 Connecting to MongoDB...');
    await connectDatabase();
    console.log('✅ MongoDB connected\n');

    // Step 2: Connect to Redis
    console.log('🔴 Connecting to Redis...');
    await connectRedis();
    console.log('✅ Redis connected\n');

    // Step 3: Import and register workers
    console.log('👷 Registering workers...');
    
    // Publishing Worker
    const { PublishingWorker } = await import('./workers/PublishingWorker');
    const publishingWorker = new PublishingWorker();
    workerManager.registerWorker('publishing-worker', publishingWorker, {
      enabled: true,
      maxRestarts: 3,
      restartDelay: 5000,
    });
    
    // Scheduler Worker
    const { schedulerWorker } = await import('./workers/SchedulerWorker');
    workerManager.registerWorker('scheduler-worker', schedulerWorker, {
      enabled: true,
      maxRestarts: 3,
      restartDelay: 5000,
    });
    
    // Token Refresh Worker (if exists)
    try {
      const { tokenRefreshWorker } = await import('./workers/TokenRefreshWorker');
      workerManager.registerWorker('token-refresh-worker', tokenRefreshWorker, {
        enabled: true,
        maxRestarts: 3,
        restartDelay: 5000,
      });
    } catch (error) {
      logger.info('Token refresh worker not available');
    }
    
    // Media Processing Worker (if exists)
    try {
      const { mediaProcessingWorker } = await import('./workers/MediaProcessingWorker');
      workerManager.registerWorker('media-processing-worker', mediaProcessingWorker, {
        enabled: true,
        maxRestarts: 3,
        restartDelay: 5000,
      });
    } catch (error) {
      logger.info('Media processing worker not available');
    }
    
    console.log('✅ Workers registered\n');

    // Step 4: Start all workers
    console.log('▶️  Starting all workers...');
    await workerManager.startAll();
    console.log('✅ All workers started\n');

    // Step 5: Start queue monitoring
    console.log('📊 Starting queue monitoring...');
    queueMonitoringService.startMonitoring(30000); // Every 30 seconds
    console.log('✅ Queue monitoring started\n');

    // Step 6: Print status
    workerManager.printStatus();

    // Step 7: Setup health check interval
    setInterval(() => {
      const isHealthy = workerManager.isHealthy();
      
      if (!isHealthy) {
        logger.warn('Workers unhealthy', {
          alert: 'workers_unhealthy',
          status: workerManager.getStatus(),
        });
      }
    }, 60000); // Every minute

    logger.info('Workers standalone started successfully', {
      workers: workerManager.getRunningWorkers(),
      monitoring: queueMonitoringService.getStatus(),
    });

  } catch (error: any) {
    console.error('\n❌ Failed to start workers:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    reason,
    promise,
  });
  process.exit(1);
});

// Start workers
startWorkers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
