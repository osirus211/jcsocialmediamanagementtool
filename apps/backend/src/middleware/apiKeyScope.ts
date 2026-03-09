/**
 * API Key Scope Validation Middleware
 * 
 * Validates that API keys have required permission scopes for endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';
import { publicApiMetricsTracker } from './publicApiMetrics';
import { securityAuditService } from '../services/SecurityAuditService';
import { SecurityEventType } from '../models/SecurityEvent';
import {
  hasScope as checkHasScope,
  API_SCOPES,
  VALID_SCOPES,
  getAllScopesGroupedByCategory,
} from '../config/apiScopes';

/**
 * Check if an API key has a specific scope
 * Implements write-implies-read logic using centralized registry
 */
function hasScope(keyScopes: string[], requiredScope: string): boolean {
  return checkHasScope(keyScopes, requiredScope);
}

/**
 * Require API key to have specific scopes
 * 
 * Usage:
 * router.get('/posts', requireScope('posts:read'), handler);
 * router.post('/posts', requireScope('posts:write'), handler);
 */
export const requireScope = (...requiredScopes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Ensure API key authentication has been performed
      if (!req.apiKey) {
        throw new UnauthorizedError('API key authentication required');
      }
      
      const keyScopes = req.apiKey.scopes;
      
      // Check if API key has all required scopes
      const missingScopes: string[] = [];
      
      for (const required of requiredScopes) {
        if (!hasScope(keyScopes, required)) {
          missingScopes.push(required);
        }
      }
      
      if (missingScopes.length > 0) {
        logger.warn('API key missing required scopes', {
          keyId: req.apiKey.keyId,
          requiredScopes,
          keyScopes,
          missingScopes,
          path: req.path,
          method: req.method,
        });
        
        publicApiMetricsTracker.incrementScopeDenial();
        
        // Security audit log
        await securityAuditService.logEvent({
          type: SecurityEventType.API_KEY_SCOPE_DENIED,
          workspaceId: req.apiKey.workspaceId,
          ipAddress: req.socket.remoteAddress || 'unknown',
          userAgent: req.headers['user-agent'],
          success: false,
          resource: req.apiKey.keyId,
          action: `${req.method} ${req.path}`,
          errorMessage: `Missing required scopes: ${missingScopes.join(', ')}`,
          metadata: {
            keyName: req.apiKey.name,
            requiredScopes,
            keyScopes,
            missingScopes,
          },
        });
        
        throw new ForbiddenError(
          `Missing required scopes: ${missingScopes.join(', ')}`
        );
      }
      
      logger.debug('API key scope validation passed', {
        keyId: req.apiKey.keyId,
        requiredScopes,
        path: req.path,
      });
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Require API key to have ANY of the specified scopes
 * 
 * Usage:
 * router.get('/data', requireAnyScope('posts:read', 'analytics:read'), handler);
 */
export const requireAnyScope = (...allowedScopes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.apiKey) {
        throw new UnauthorizedError('API key authentication required');
      }
      
      const keyScopes = req.apiKey.scopes;
      
      // Check if API key has at least one of the allowed scopes
      const hasAnyScope = allowedScopes.some(allowed => 
        hasScope(keyScopes, allowed)
      );
      
      if (!hasAnyScope) {
        logger.warn('API key missing any required scope', {
          keyId: req.apiKey.keyId,
          allowedScopes,
          keyScopes,
          path: req.path,
          method: req.method,
        });
        
        publicApiMetricsTracker.incrementScopeDenial();
        
        // Security audit log
        await securityAuditService.logEvent({
          type: SecurityEventType.API_KEY_SCOPE_DENIED,
          workspaceId: req.apiKey.workspaceId,
          ipAddress: req.socket.remoteAddress || 'unknown',
          userAgent: req.headers['user-agent'],
          success: false,
          resource: req.apiKey.keyId,
          action: `${req.method} ${req.path}`,
          errorMessage: `Requires at least one of: ${allowedScopes.join(', ')}`,
          metadata: {
            keyName: req.apiKey.name,
            allowedScopes,
            keyScopes,
          },
        });
        
        throw new ForbiddenError(
          `Requires at least one of: ${allowedScopes.join(', ')}`
        );
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Export scope registry for use in other modules
 */
export { API_SCOPES, VALID_SCOPES };

/**
 * Get scopes grouped by category
 */
export function getScopesByCategory(): Record<string, any[]> {
  return getAllScopesGroupedByCategory();
}
