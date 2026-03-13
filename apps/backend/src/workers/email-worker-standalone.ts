/**
 * Email Worker Standalone Process
 * 
 * Runs the email worker as a separate process
 * 
 * Usage:
 *   npm run worker:email
 *   or
 *   tsx src/workers/email-worker-standalone.ts
 */

import { connectDatabase } from '../config/database';
import { connectRedis } from '../config/redis';
import { EmailWorker } from './EmailWorker';
import { logger } from '../utils/logger';

async function main() {
  try {
    logger.info('Starting email worker process...');

    // Connect to MongoDB
    await connectDatabase();
    logger.info('MongoDB connected');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected');

    // Create and start email worker
    const emailWorker = new EmailWorker();
    emailWorker.start();

    logger.info('Email worker started successfully');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received - shutting down email worker...`);
      
      try {
        await emailWorker.stop();
        logger.info('Email worker stopped');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start email worker:', error);
    process.exit(1);
  }
}

main();
