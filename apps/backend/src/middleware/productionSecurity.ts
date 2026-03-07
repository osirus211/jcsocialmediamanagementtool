/**
 * Production Security Middleware
 * 
 * Comprehensive security hardening for production environment
 * - Helmet configuration
 * - CORS restrictions
 * - Body size limits
 * - Error sanitization
 * - Header hiding
 */

import helmet from 'helmet';
import cors from 'cors';
import { Request, Response, NextFunction, Express } from 'express';
import { logger } from '../utils/logger';

/**
 * Configure Helmet security headers
 */
export const configureHelmet = () => {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    // Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // Hide X-Powered-By
    hidePoweredBy: true,
    // Prevent MIME sniffing
    noSniff: true,
    // Prevent clickjacking
    frameguard: {
      action: 'deny',
    },
    // XSS Protection
    xssFilter: true,
    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  });
};

/**
 * Configure CORS with strict origin checking
 */
export const configureCors = () => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked request from origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Workspace-Id',
      'X-Request-ID',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ],
    maxAge: 86400, // 24 hours
  });
};

/**
 * Body size limit middleware
 * Prevents large payload attacks
 */
export const bodySizeLimit = (req: Request, res: Response, next: NextFunction): void => {
  const maxSize = 10 * 1024 * 1024; // 10MB

  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > maxSize) {
      req.pause();
      res.status(413).json({
        error: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds 10MB limit',
      });
      req.destroy();
    }
  });

  next();
};

/**
 * Hide stack traces in production
 * Sanitize error responses
 */
export const sanitizeErrors = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log full error server-side
  logger.error('Request error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
    workspaceId: req.headers['x-workspace-id'],
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Production: hide stack traces and internal details
  if (process.env.NODE_ENV === 'production') {
    res.status(statusCode).json({
      error: err.code || 'INTERNAL_ERROR',
      message: statusCode === 500 
        ? 'An unexpected error occurred. Please try again later.'
        : err.message || 'An error occurred',
      requestId: req.headers['x-request-id'],
    });
  } else {
    // Development: include stack trace
    res.status(statusCode).json({
      error: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An error occurred',
      stack: err.stack,
      requestId: req.headers['x-request-id'],
    });
  }
};

/**
 * Remove sensitive headers
 */
export const removeSensitiveHeaders = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Remove headers that reveal technology stack
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
};

/**
 * Request sanitization
 * Basic input cleaning
 */
export const sanitizeInput = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        // Remove null bytes
        req.query[key] = (req.query[key] as string).replace(/\0/g, '');
      }
    }
  }

  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  next();
};

/**
 * Recursively sanitize object
 */
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove null bytes
      obj[key] = obj[key].replace(/\0/g, '');
      
      // Trim whitespace
      obj[key] = obj[key].trim();
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

/**
 * Apply all production security middleware
 */
export const applyProductionSecurity = (app: Express): void => {
  // Helmet security headers
  app.use(configureHelmet());

  // CORS configuration
  app.use(configureCors());

  // Remove sensitive headers
  app.use(removeSensitiveHeaders);

  // Body size limit
  app.use(bodySizeLimit);

  // Input sanitization
  app.use(sanitizeInput);

  logger.info('✅ Production security middleware configured');
};
