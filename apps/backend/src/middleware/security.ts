/**
 * Security Middleware
 * Additional security hardening for production
 */

import { Request, Response, NextFunction } from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID middleware
 * Adds unique ID to each request for tracing
 */
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = req.headers['x-request-id'] as string || uuidv4();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
};

/**
 * MongoDB injection prevention
 * Sanitizes user input to prevent NoSQL injection
 */
export const mongoSanitization = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Sanitized potentially malicious input: ${key} in ${req.path}`);
  },
});

/**
 * XSS Protection Headers
 * Additional security headers beyond Helmet
 */
export const xssProtection = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
};

/**
 * Content Security Policy
 * Prevents XSS and other injection attacks
 */
export const contentSecurityPolicy = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none';"
  );
  next();
};

/**
 * Hide powered-by header
 * Don't reveal technology stack
 */
export const hidePoweredBy = (_req: Request, res: Response, next: NextFunction) => {
  res.removeHeader('X-Powered-By');
  next();
};

/**
 * Prevent parameter pollution
 * Ensures query parameters are not arrays when not expected
 */
export const preventParameterPollution = (req: Request, _res: Response, next: NextFunction) => {
  // List of parameters that should never be arrays
  const singleValueParams = ['id', 'email', 'workspaceId', 'userId', 'page', 'limit'];
  
  for (const param of singleValueParams) {
    if (Array.isArray(req.query[param])) {
      req.query[param] = req.query[param][0]; // Take first value
    }
  }
  
  next();
};

/**
 * Validate Content-Type for POST/PUT/PATCH
 * Prevents content-type confusion attacks
 */
export const validateContentType = (req: Request, res: Response, next: NextFunction): void => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    
    if (!contentType) {
      // If the body is empty, we can skip strict content-type validation
      // Most body parsers will not have processed the body yet, but we can check raw headers or rely on express.json()
      // For simplicity, we'll allow it if Content-Length is 0 or not present
      const contentLength = req.headers['content-length'];
      if (!contentLength || contentLength === '0') {
        return next();
      }

      res.status(400).json({
        error: 'Bad Request',
        message: 'Content-Type header is required',
      });
      return;
    }
    
    if (!contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
      res.status(415).json({
        error: 'Unsupported Media Type',
        message: 'Content-Type must be application/json or multipart/form-data',
      });
      return;
    }
  }
  
  next();
};

/**
 * IP Rate Limiting per User
 * Track requests per IP per user to detect suspicious activity
 */
const ipUserRequests = new Map<string, Map<string, number>>();

export const ipUserRateLimit = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next();
  
  const ip = req.ip || 'unknown';
  const userId = req.user.userId;
  const key = `${ip}:${userId}`;
  
  if (!ipUserRequests.has(ip)) {
    ipUserRequests.set(ip, new Map());
  }
  
  const userMap = ipUserRequests.get(ip)!;
  const count = userMap.get(userId) || 0;
  
  // Allow 1000 requests per 15 minutes per IP-user combination
  if (count > 1000) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded for this IP and user combination',
    });
  }
  
  userMap.set(userId, count + 1);
  
  // Reset after 15 minutes
  setTimeout(() => {
    const currentCount = userMap.get(userId) || 0;
    if (currentCount > 0) {
      userMap.set(userId, currentCount - 1);
    }
  }, 15 * 60 * 1000);
  
  next();
};

/**
 * Detect and block suspicious patterns
 * Basic anomaly detection
 */
export const anomalyDetection = (req: Request, res: Response, next: NextFunction): void => {
  const suspiciousPatterns = [
    /(\.\.|\/etc\/|\/proc\/|\/sys\/)/i, // Path traversal
    /(union.*select|insert.*into|drop.*table)/i, // SQL injection
    /(<script|javascript:|onerror=|onload=)/i, // XSS
    /(eval\(|exec\(|system\()/i, // Code injection
  ];
  
  const checkString = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      console.warn(`Suspicious pattern detected from IP ${req.ip}: ${pattern}`);
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid input detected',
      });
      return;
    }
  }
  
  next();
};
