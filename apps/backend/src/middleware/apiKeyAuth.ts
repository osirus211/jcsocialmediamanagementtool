/**
 * API Key Authentication Middleware
 * 
 * Authenticates external requests using API keys for Public API access
 */

import { Request, Response, NextFunction } from 'express';
import { apiKeyService } from '../services/ApiKeyService';
import { ApiKey, ApiKeyStatus } from '../models/ApiKey';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';
import { publicApiMetricsTracker } from './publicApiMetrics';
import { securityAuditService } from '../services/SecurityAuditService';
import { SecurityEventType } from '../models/SecurityEvent';
import mongoose from 'mongoose';

// Extend Express Request to include API key context
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        keyId: string;
        workspaceId: string;
        scopes: string[];
        name: string;
      };
    }
  }
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const clientIp = ips.split(',')[0].trim();
    
    // Basic validation to prevent spoofing
    if (/^[\d.:a-f]+$/i.test(clientIp)) {
      return clientIp;
    }
  }
  
  return req.socket.remoteAddress || 'unknown';
}

/**
 * API Key Authentication Middleware
 * 
 * Validates API key from x-api-key header and attaches context to request
 */
export const requireApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract API key from header
    const apiKeyHeader = req.headers['x-api-key'] as string;
    
    if (!apiKeyHeader) {
      throw new UnauthorizedError('API key required in x-api-key header');
    }

    // Validate header size (prevent DoS)
    if (apiKeyHeader.length > 200) {
      throw new UnauthorizedError('Invalid API key format');
    }
    
    // Validate key format
    if (!apiKeyHeader.startsWith('sk_')) {
      throw new UnauthorizedError('Invalid API key format');
    }
    
    // Hash the provided key (constant-time comparison via database)
    const keyHash = apiKeyService.hashApiKey(apiKeyHeader);
    
    // Lookup API key in database
    const apiKey = await ApiKey.findOne({ keyHash }).populate('workspaceId');
    
    if (!apiKey) {
      logger.warn('Invalid API key attempt', {
        prefix: apiKeyHeader.substring(0, 15),
        ip: getClientIp(req),
        path: req.path,
      });
      publicApiMetricsTracker.incrementAuthFailure();
      
      // Security audit log
      await securityAuditService.logEvent({
        type: SecurityEventType.API_KEY_AUTH_FAILURE,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        success: false,
        action: `${req.method} ${req.path}`,
        errorMessage: 'Invalid API key',
        metadata: {
          prefix: apiKeyHeader.substring(0, 15),
        },
      });
      
      throw new UnauthorizedError('Invalid API key');
    }
    
    // Check if key is active
    if (apiKey.status === ApiKeyStatus.REVOKED) {
      logger.warn('Revoked API key usage attempt', {
        keyId: apiKey._id,
        workspaceId: apiKey.workspaceId,
        ip: getClientIp(req),
      });
      publicApiMetricsTracker.incrementAuthFailure();
      
      // Security audit log
      await securityAuditService.logEvent({
        type: SecurityEventType.API_KEY_AUTH_FAILURE,
        workspaceId: apiKey.workspaceId,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        success: false,
        resource: apiKey._id.toString(),
        action: `${req.method} ${req.path}`,
        errorMessage: 'API key has been revoked',
        metadata: {
          keyName: apiKey.name,
          prefix: apiKey.prefix,
        },
      });
      
      throw new ForbiddenError('API key has been revoked');
    }
    
    if (apiKey.status === ApiKeyStatus.EXPIRED) {
      publicApiMetricsTracker.incrementAuthFailure();
      
      // Security audit log
      await securityAuditService.logEvent({
        type: SecurityEventType.API_KEY_AUTH_FAILURE,
        workspaceId: apiKey.workspaceId,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        success: false,
        resource: apiKey._id.toString(),
        action: `${req.method} ${req.path}`,
        errorMessage: 'API key has expired',
        metadata: {
          keyName: apiKey.name,
          prefix: apiKey.prefix,
          expiresAt: apiKey.expiresAt,
        },
      });
      
      throw new ForbiddenError('API key has expired');
    }
    
    // Check expiration date
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      logger.warn('Expired API key usage attempt', {
        keyId: apiKey._id,
        expiresAt: apiKey.expiresAt,
      });
      publicApiMetricsTracker.incrementAuthFailure();
      
      // Security audit log
      await securityAuditService.logEvent({
        type: SecurityEventType.API_KEY_AUTH_FAILURE,
        workspaceId: apiKey.workspaceId,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        success: false,
        resource: apiKey._id.toString(),
        action: `${req.method} ${req.path}`,
        errorMessage: 'API key has expired',
        metadata: {
          keyName: apiKey.name,
          prefix: apiKey.prefix,
          expiresAt: apiKey.expiresAt,
        },
      });
      
      throw new ForbiddenError('API key has expired');
    }
    
    // Check IP allowlist (if configured)
    if (apiKey.allowedIps && apiKey.allowedIps.length > 0) {
      const clientIp = getClientIp(req);
      if (!apiKey.allowedIps.includes(clientIp)) {
        logger.warn('API key used from non-allowlisted IP', {
          keyId: apiKey._id,
          clientIp,
          allowedIps: apiKey.allowedIps,
        });
        publicApiMetricsTracker.incrementAuthFailure();
        
        // Security audit log
        await securityAuditService.logEvent({
          type: SecurityEventType.API_KEY_AUTH_FAILURE,
          workspaceId: apiKey.workspaceId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'],
          success: false,
          resource: apiKey._id.toString(),
          action: `${req.method} ${req.path}`,
          errorMessage: 'IP not allowed',
          metadata: {
            keyName: apiKey.name,
            prefix: apiKey.prefix,
            allowedIps: apiKey.allowedIps,
          },
        });
        
        throw new ForbiddenError('API key not allowed from this IP address');
      }
    }
    
    // Attach API key context to request
    req.apiKey = {
      keyId: apiKey._id.toString(),
      workspaceId: apiKey.workspaceId.toString(),
      scopes: apiKey.scopes,
      name: apiKey.name,
    };
    
    // Attach workspace context (for compatibility with existing middleware)
    req.workspace = {
      workspaceId: apiKey.workspaceId as mongoose.Types.ObjectId,
      role: 'API_KEY' as any, // Special role identifier for API keys
      memberId: apiKey._id, // Use key ID as member ID
    };
    
    // Update last used timestamp and IP (async, don't block request)
    const clientIp = getClientIp(req);
    const lastUsedIp = apiKey.lastUsedIp;
    
    ApiKey.updateOne(
      { _id: apiKey._id },
      { 
        lastUsedAt: new Date(),
        lastUsedIp: clientIp,
        $inc: { requestCount: 1 }
      }
    ).exec().catch(err => {
      logger.error('Failed to update API key last used', { 
        keyId: apiKey._id,
        error: err.message 
      });
    });
    
    // Log new IP usage for security monitoring
    if (lastUsedIp && lastUsedIp !== clientIp) {
      logger.info('API key used from new IP address', {
        keyId: apiKey._id,
        workspaceId: apiKey.workspaceId,
        previousIp: lastUsedIp,
        newIp: clientIp,
      });
      
      // Security audit log for new IP detection
      await securityAuditService.logEvent({
        type: SecurityEventType.API_KEY_NEW_IP_DETECTED,
        workspaceId: apiKey.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        success: true,
        resource: apiKey._id.toString(),
        action: `${req.method} ${req.path}`,
        metadata: {
          keyName: apiKey.name,
          prefix: apiKey.prefix,
          previousIp: lastUsedIp,
        },
      });
    }
    
    logger.debug('API key authenticated successfully', {
      keyId: apiKey._id,
      workspaceId: apiKey.workspaceId,
      scopes: apiKey.scopes,
    });
    
    next();
  } catch (error) {
    // Never log the raw API key
    logger.error('API key authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      ip: getClientIp(req),
    });
    next(error);
  }
};

/**
 * Optional API key authentication
 * Attaches API key context if valid, but doesn't require it
 */
export const optionalApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiKeyHeader = req.headers['x-api-key'] as string;
    
    if (!apiKeyHeader || !apiKeyHeader.startsWith('sk_')) {
      return next(); // No API key, continue without context
    }
    
    // Use the same validation logic as requireApiKey
    await requireApiKey(req, res, next);
  } catch (error) {
    // API key invalid, continue without context (don't fail request)
    next();
  }
};
