import { Request, Response, NextFunction } from 'express';
import { AuthTokenService as TokenService } from '../services/AuthTokenService';
import { User, UserRole } from '../models/User';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload = TokenService.verifyAccessToken(token);

    // Check if user still exists and is not soft-deleted
    const user = await User.findOne({ _id: payload.userId, softDeletedAt: null });
    if (!user) {
      throw new UnauthorizedError('User not found or has been deleted');
    }

    // Attach user info to request
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as UserRole,
    };

    next();
  } catch (error) {
    logger.error('RUNTIME_TRACE INVALID_TOKEN_REJECTED', { timestamp: new Date().toISOString() });
    logger.error('Authentication error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      ip: req.ip,
      requestId: req.headers['x-request-id'],
    });
    next(error);
  }
};

/**
 * Role-based authorization middleware
 * Requires user to have one of the specified roles
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`
        );
      }

      // ADMIN and OWNER must have 2FA enabled
      if (allowedRoles.includes(UserRole.ADMIN) || allowedRoles.includes(UserRole.OWNER)) {
        const fullUser = await User.findById(req.user.userId).select('twoFactorEnabled');
        if (fullUser && !fullUser.twoFactorEnabled) {
          res.status(403).json({
            code: 'TWO_FA_REQUIRED',
            message: 'Admin and Owner accounts must enable two-factor authentication to access this resource.',
            details: { redirectTo: '/settings/security' },
          });
          return;
        }
      }

      next();
    } catch (error) {
      logger.error('Authorization error:', error);
      next(error);
    }
  };
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't require it
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token, continue without user
    }

    const token = authHeader.substring(7);
    const payload = await TokenService.verifyAccessToken(token);

    const user = await User.findOne({ _id: payload.userId, softDeletedAt: null });
    if (user) {
      req.user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role as UserRole,
      };
    }

    next();
  } catch (error) {
    // Token invalid, continue without user
    next();
  }
};
