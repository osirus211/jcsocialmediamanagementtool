/**
 * CSRF Protection Middleware
 * 
 * Uses double-submit cookie pattern for CSRF protection
 */

import { doubleCsrf } from 'csrf-csrf';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

// Configure double CSRF protection
const {
  generateToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => config.jwt.secret, // Use JWT secret as CSRF secret
  cookieName: '__Host-csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.env === 'production',
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});

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
    const token = generateToken(req, res);
    res.json({ csrfToken: token });
  } catch (error) {
    next(error);
  }
};
