/**
 * Sentry Error Tracking Integration
 * 
 * Centralized error monitoring and tracking
 * 
 * Features:
 * - Unhandled exception capture
 * - Unhandled promise rejection capture
 * - Request context tracking
 * - User context tracking
 * - Workspace context tracking
 * - Environment-based filtering
 * - 4xx error filtering
 */

import * as Sentry from '@sentry/node';
import { config } from '../config';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Initialize Sentry
 * 
 * Only enabled in production and staging environments
 */
export function initializeSentry(): void {
  const dsn = config.sentry.dsn;
  const environment = config.env || 'development';
  const appVersion = config.sentry.appVersion;

  // Only enable Sentry in production and staging
  if (environment === 'development' || environment === 'test') {
    logger.info('Sentry disabled in development/test environment');
    return;
  }

  if (!dsn) {
    logger.warn('SENTRY_DSN not configured - error tracking disabled');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment,
      release: appVersion,

      // Performance monitoring
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

      // Ignore 4xx errors (client errors)
      beforeSend(event, hint) {
        const error = hint.originalException;

        // Ignore 4xx HTTP errors
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const statusCode = (error as any).statusCode;
          if (statusCode >= 400 && statusCode < 500) {
            return null; // Don't send to Sentry
          }
        }

        // Ignore specific error types
        if (error && typeof error === 'object' && 'name' in error) {
          const errorName = (error as any).name;
          const ignoredErrors = [
            'BadRequestError',
            'UnauthorizedError',
            'ForbiddenError',
            'NotFoundError',
            'ValidationError',
          ];

          if (ignoredErrors.includes(errorName)) {
            return null; // Don't send to Sentry
          }
        }

        return event;
      },

      // Integrations
      integrations: [
        // Capture unhandled exceptions
        Sentry.onUncaughtExceptionIntegration({
          onFatalError: async (err) => {
            logger.error('Uncaught exception - shutting down', { error: err.message });
            process.exit(1);
          },
        }),

        // Capture unhandled promise rejections
        Sentry.onUnhandledRejectionIntegration({
          mode: 'warn',
        }),
      ],
    });

    logger.info('Sentry initialized', {
      environment,
      release: appVersion,
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    });
  } catch (error: any) {
    logger.error('Failed to initialize Sentry', { error: error.message });
  }
}

/**
 * Sentry request handler middleware
 * 
 * Must be used BEFORE all routes
 * Captures request context for error tracking
 */
export function sentryRequestHandler() {
  const environment = config.env || 'development';
  
  // Return no-op middleware in development/test
  if (environment === 'development' || environment === 'test') {
    return (req: Request, res: Response, next: NextFunction) => next();
  }
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Set user context if available
    if (req.user) {
      const user = req.user as any;
      Sentry.setUser({
        id: user.userId || user.id,
        email: user.email,
      });
    }
    next();
  };
}

/**
 * Sentry tracing handler middleware
 * 
 * Must be used BEFORE all routes (after request handler)
 * Enables performance monitoring
 */
export function sentryTracingHandler() {
  const environment = config.env || 'development';
  
  // Return no-op middleware in development/test
  if (environment === 'development' || environment === 'test') {
    return (req: Request, res: Response, next: NextFunction) => next();
  }
  
  return (req: Request, res: Response, next: NextFunction) => next();
}

/**
 * Sentry error handler middleware
 * 
 * Must be used AFTER all routes but BEFORE other error handlers
 * Captures errors and sends to Sentry
 */
export function sentryErrorHandler() {
  const environment = config.env || 'development';
  
  // Return no-op middleware in development/test
  if (environment === 'development' || environment === 'test') {
    return (err: any, req: Request, res: Response, next: NextFunction) => next(err);
  }
  
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    // Only handle 5xx errors
    if (err && typeof err === 'object' && 'statusCode' in err) {
      const statusCode = (err as any).statusCode;
      if (statusCode >= 400 && statusCode < 500) {
        return next(err); // Don't send 4xx errors to Sentry
      }
    }
    
    // Capture the error in Sentry
    Sentry.captureException(err);
    next(err);
  };
}

/**
 * Set user context for Sentry
 * 
 * Call this after authentication to track user-specific errors
 */
export function setSentryUser(userId: string, email?: string): void {
  Sentry.setUser({
    id: userId,
    email,
  });
}

/**
 * Set workspace context for Sentry
 * 
 * Call this when workspace context is available
 */
export function setSentryWorkspace(workspaceId: string): void {
  Sentry.setContext('workspace', {
    workspaceId,
  });
}

/**
 * Set post context for Sentry
 * 
 * Call this when processing post-related operations
 */
export function setSentryPost(postId: string): void {
  Sentry.setContext('post', {
    postId,
  });
}

/**
 * Clear user context
 * 
 * Call this on logout or when user context is no longer valid
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Capture exception manually
 * 
 * Use this to explicitly send errors to Sentry
 */
export function captureException(
  error: Error,
  options?: {
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    user?: { id?: string; email?: string; username?: string };
  }
): void {
  if (options) {
    if (options.tags) {
      Object.entries(options.tags).forEach(([key, value]) => {
        Sentry.setTag(key, value);
      });
    }
    if (options.extra) {
      Sentry.setContext('additional', options.extra);
    }
    if (options.user) {
      Sentry.setUser(options.user);
    }
  }
  
  Sentry.captureException(error, {
    level: options?.level || 'error',
  });
}

/**
 * Capture message manually
 * 
 * Use this to send informational messages to Sentry
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): void {
  Sentry.captureMessage(message, level);
}

/**
 * Add breadcrumb for debugging
 * 
 * Breadcrumbs help trace the sequence of events leading to an error
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

/**
 * Middleware to attach user and workspace context from request
 * 
 * Use this AFTER authentication middleware
 */
export function attachSentryContext(req: Request, res: Response, next: NextFunction): void {
  try {
    // Attach user context if available
    if (req.user) {
      const user = req.user as any;
      setSentryUser(user.userId || user.id, user.email);
    }

    // Attach workspace context if available
    if (req.workspace) {
      const workspace = req.workspace as any;
      setSentryWorkspace(workspace.workspaceId?.toString() || workspace.id);
    }

    // Attach post context if available in params
    if (req.params.postId || req.params.id) {
      const postId = req.params.postId || req.params.id;
      setSentryPost(postId);
    }
  } catch (error: any) {
    // Don't break request flow if context attachment fails
    logger.error('Failed to attach Sentry context', { error: error.message });
  }

  next();
}

/**
 * Flush Sentry events
 * 
 * Call this before shutting down the server
 */
export async function flushSentry(timeout: number = 2000): Promise<void> {
  try {
    await Sentry.close(timeout);
    logger.info('Sentry events flushed');
  } catch (error: any) {
    logger.error('Failed to flush Sentry events', { error: error.message });
  }
}
