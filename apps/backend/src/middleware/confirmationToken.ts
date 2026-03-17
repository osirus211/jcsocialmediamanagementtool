import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Confirmation token middleware for destructive operations
 * Requires a confirmation token to be provided for dangerous operations
 */
export const requireConfirmationToken = (req: Request, res: Response, next: NextFunction): void | Response => {
  const confirmationToken = req.headers['x-confirmation-token'] as string;
  
  if (!confirmationToken) {
    return res.status(400).json({
      code: 'CONFIRMATION_REQUIRED',
      message: 'Confirmation token required for this operation',
      details: {
        header: 'x-confirmation-token',
        description: 'Generate a confirmation token and include it in the request header'
      }
    });
  }

  // Validate token format (should be 32 character hex string)
  if (!/^[a-f0-9]{32}$/.test(confirmationToken)) {
    return res.status(400).json({
      code: 'INVALID_CONFIRMATION_TOKEN',
      message: 'Invalid confirmation token format',
      details: {
        expected: '32 character hexadecimal string',
        received: confirmationToken.length + ' characters'
      }
    });
  }

  // Store token for audit logging
  req.confirmationToken = confirmationToken;
  
  logger.info('Destructive operation confirmed', {
    userId: req.user?.userId,
    workspaceId: req.workspace?.workspaceId,
    operation: req.method + ' ' + req.path,
    confirmationToken: confirmationToken.substring(0, 8) + '...'
  });

  next();
};

/**
 * Generate a confirmation token
 */
export const generateConfirmationToken = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      confirmationToken?: string;
    }
  }
}