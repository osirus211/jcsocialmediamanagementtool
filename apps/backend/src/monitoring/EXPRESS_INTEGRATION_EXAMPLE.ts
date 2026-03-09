/**
 * Express Integration Example
 * 
 * This file shows how to integrate Sentry into your Express application
 * 
 * IMPORTANT: This is an example file. Apply these changes to your actual server.ts
import { config } from '../config';
 */

import express, { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import cors from 'cors';
import { config } from '../config';
import helmet from 'helmet';
import { config } from '../config';
import compression from 'compression';
import { config } from '../config';
import {
import { config } from '../config';
  initializeSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  attachSentryContext,
  flushSentry,
} from './sentry';

const app = express();

// ============================================================================
// STEP 1: Initialize Sentry FIRST (before any other middleware)
// ============================================================================
initializeSentry();

// ============================================================================
// STEP 2: Sentry Request Handler (BEFORE all routes)
// ============================================================================
app.use(sentryRequestHandler());

// ============================================================================
// STEP 3: Sentry Tracing Handler (BEFORE all routes)
// ============================================================================
app.use(sentryTracingHandler());

// ============================================================================
// STEP 4: Standard Middleware
// ============================================================================
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// STEP 5: Authentication Middleware (if you have one)
// ============================================================================
// app.use(requireAuth); // Your auth middleware

// ============================================================================
// STEP 6: Attach Sentry Context (AFTER authentication)
// ============================================================================
app.use(attachSentryContext);

// ============================================================================
// STEP 7: Your Routes
// ============================================================================
// app.use('/api/v1', routes);

// Health check (no Sentry tracking needed)
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Example route that might throw an error
app.get('/api/test', (req: Request, res: Response) => {
  // This error will be automatically captured by Sentry
  throw new Error('Test error for Sentry');
});

// ============================================================================
// STEP 8: Sentry Error Handler (AFTER routes, BEFORE other error handlers)
// ============================================================================
app.use(sentryErrorHandler());

// ============================================================================
// STEP 9: Your Error Handlers
// ============================================================================
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Your custom error handling logic
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    ...(config.env === 'development' && { stack: err.stack }),
  });
});

// ============================================================================
// STEP 10: Start Server
// ============================================================================
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ============================================================================
// STEP 11: Graceful Shutdown (flush Sentry events before exit)
// ============================================================================
const gracefulShutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);

  // Close server
  server.close(async () => {
    console.log('HTTP server closed');

    // Flush Sentry events
    await flushSentry(2000);

    // Close database connections, etc.
    // await mongoose.connection.close();

    console.log('Shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================================================
// Unhandled Rejections (Sentry will capture these automatically)
// ============================================================================
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Sentry will automatically capture this
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  // Sentry will automatically capture this
  // Exit after flushing
  flushSentry(2000).then(() => {
    process.exit(1);
  });
});

export default app;

