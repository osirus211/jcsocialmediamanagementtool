/**
 * CSRF Protection Middleware
 * 
 * Uses double-submit cookie pattern for CSRF protection
 */

import { doubleCsrf, DoubleCsrfConfigOptions } from 'csrf-csrf';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

// Configure double CSRF protection
const doubleCsrfOptions: DoubleCsrfConfigOptions = {
  getSecret: () => config.jwt.secret, // Use JWT secret as CSRF secret
  cookieName: 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: config.env === 'production' ? 'strict' : 'lax' as const,
    secure: config.env === 'production', // Only secure in production
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'] as const,
  getCsrfTokenFromRequest: (req: any) => {
    // Check multiple possible header names
    return req.headers['x-csrf-token'] || 
           req.headers['csrf-token'] || 
           req.body._csrf;
  },
  getSessionIdentifier: (req: any) => {
    // Use session ID or user ID if available, otherwise use a default
    return req.sessionID || req.user?.id || 'anonymous';
  },
};

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf(doubleCsrfOptions);

/**
 * CSRF protection middleware
 * Apply to all state-changing routes
 */
export const csrfProtection = doubleCsrfProtection;

/**
 * Generate CSRF token endpoint
 * GET /api/v1/auth/csrf-token
 */
export const getCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = generateCsrfToken(req, res);
    res.json({ csrfToken: token });
  } catch (error) {
    next(error);
  }
};
