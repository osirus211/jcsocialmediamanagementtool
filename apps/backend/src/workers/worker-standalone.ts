#!/usr/bin/env node
/**
 * Standalone Worker Process
 * 
 * This script runs the publishing worker as a separate process
 * for production deployment.
 * 
 * Features:
 * - Graceful shutdown
 * - Error handling
 * - Database connection management
 * - Redis connection management
 * - Health monitoring
 */

console.log('=== WORKER STARTING ===');
console.log('Node version:', process.version);
console.log('CWD:', process.cwd());

import dotenv from 'dotenv';
console.log('✓ dotenv imported');

import { connectDatabase } from '../config/database';
console.log('✓ database config imported');

import { connectRedis } from '../config/redis';
console.log('✓ redis config imported');

import { logger } from '../utils/logger';
console.log('✓ logger imported');

import { config } from '../config';
console.log('✓ config imported');

// Load environment variables
dotenv.config();
console.log('✓ dotenv configured');

// Import worker AFTER Redis is connected
let publishingWorker: unknown;

let isShuttingDown = false;

console.log('✓ Variables initialized');

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal: string) => {
  console.log(`Graceful shutdown called with signal: ${signal}`);
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info(`${signal} received. Starting graceful shutdown...`);

  try {
    // Stop accepting new jobs
    if (publishingWorker) {
      await publishingWorker.stop();
      logger.info('Worker stopped successfully');
    }

    // Give time for in-flight jobs to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

/**
 * Start the worker
 */
const startWorker = async () => {
  console.log('✓ startWorker function called');
  try {
    console.log('About to call logger.info...');
    logger.info('Starting publishing worker...');
    console.log('✓ First logger.info succeeded');
    logger.info(`Environment: ${config.env}`);
    console.log('✓ Second logger.info succeeded');
    logger.info(`Worker concurrency: ${config.worker.concurrency}`);
    console.log('✓ Third logger.info succeeded');

    // Connect to databases
    console.log('About to connect to MongoDB...');
    logger.info('Connecting to MongoDB...');
    await connectDatabase();
    console.log('✓ MongoDB connected');
    logger.info('MongoDB connected');

    console.log('About to connect to Redis...');
    logger.info('Connecting to Redis...');
    await connectRedis();
    console.log('✓ Redis connected');
    logger.info('Redis connected');

    // Import worker AFTER Redis is connected to avoid initialization errors
    console.log('About to import PublishingWorker...');
    const { PublishingWorker } = await import('./PublishingWorker');
    console.log('✓ PublishingWorker imported');
    publishingWorker = new PublishingWorker();
    console.log('✓ PublishingWorker instantiated');

    // Start the worker
    console.log('About to start worker...');
    try {
      publishingWorker.start();
      console.log('✓ Worker started');
      logger.info('✅ Publishing worker started successfully');
    } catch (error: unknown) {
      console.error('ERROR starting worker:', error instanceof Error ? error.message : 'Unknown error');
      if (error instanceof Error) {
        console.error('Stack:', error.stack);
      }
      throw error;
    }

    // Log worker status every 60 seconds
    setInterval(() => {
      const status = publishingWorker.getStatus();
      logger.info('Worker heartbeat', {
        isRunning: status.isRunning,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    }, 60000);

  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
};

// Graceful shutdown handlers
console.log('✓ Setting up signal handlers');
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
console.log('✓ Setting up rejection handler');
process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Rejection:', {
    message: reason.message,
    stack: reason.stack,
  });
  
  // Don't exit immediately, let current jobs finish
  if (!isShuttingDown) {
    gracefulShutdown('UNHANDLED_REJECTION');
  }
});

// Uncaught exception handler
console.log('✓ Setting up exception handler');
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
  });
  
  // Exit immediately on uncaught exception
  process.exit(1);
});

// Start the worker
console.log('✓ About to call startWorker()');
startWorker();
