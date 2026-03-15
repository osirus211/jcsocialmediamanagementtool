/**
 * OAuth Security Middleware
 * 
 * Provides security features for OAuth endpoints:
 * - Rate limiting (20 requests/minute per IP)
 * - IP and User-Agent binding for state
 * - Suspicious activity detection
 * - Failure tracking
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClientSafe } from '../config/redis';
import { RateLimiterService } from '../services/RateLimiterService';
import { OAuthStateBindingService } from '../services/OAuthStateBindingService';
import { SuspiciousActivityDetectionService } from '../services/SuspiciousActivityDetectionService';
import { OAuthFailureLog, OAuthErrorTypes } from '../models/OAuthFailureLog';
import { AuditLog } from '../models/AuditLog';
import { logger } from '../utils/logger';

// Lazy initialization - only create services when Redis is available
let rateLimiter: RateLimiterService | null = null;
let stateBinding: OAuthStateBindingService | null = null;
let suspiciousActivity: SuspiciousActivityDetectionService | null = null;

const getServices = () => {
  if (!rateLimiter || !stateBinding || !suspiciousActivity) {
    const redis = getRedisClientSafe();
    if (redis) {
      rateLimiter = new RateLimiterService(redis);
      stateBinding = new OAuthStateBindingService(redis);
      suspiciousActivity = new SuspiciousActivityDetectionService(redis);
    }
  }
  return { rateLimiter, stateBinding, suspiciousActivity };
};

/**
 * Rate limit OAuth endpoints
 * 
 * Limit: 20 requests per minute per IP
 */
export async function oauthRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const ip = req.ip || 'unknown';

  try {
    const { rateLimiter: rateLimiterSvc, suspiciousActivity: suspiciousActivitySvc } = getServices();
    
    if (!rateLimiterSvc || !suspiciousActivitySvc) {
      // If Redis not available, fail open (allow request)
      logger.warn('OAuth rate limiter unavailable - allowing request', { ip });
      next();
      return;
    }

    const isAllowed = await rateLimiterSvc.isAllowed('oauth', ip);

    if (!isAllowed) {
      const resetTime = await rateLimiterSvc.getResetTime('oauth', ip);

      logger.warn('OAuth rate limit exceeded', {
        ip,
        path: req.path,
        alert: 'OAUTH_RATE_LIMIT_EXCEEDED',
      });

      // Track as failure
      await suspiciousActivitySvc.trackFailure(
        ip,
        'oauth',
        OAuthErrorTypes.RATE_LIMIT_EXCEEDED,
        req.headers['user-agent'] || 'unknown'
      );

      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many OAuth requests. Limit: 20 requests per minute.',
        retryAfter: resetTime,
      });
      return;
    }

    next();
  } catch (error: any) {
    logger.error('OAuth rate limit check failed', {
      ip,
      error: error.message,
    });
    // Fail open - allow request if rate limiter fails
    next();
  }
}

/**
 * Bind OAuth state to IP and User-Agent
 * 
 * Call this when creating OAuth authorization URL
 */
export async function bindOAuthState(
  state: string,
  ip: string,
  userAgent: string,
  provider: string,
  workspaceId?: string
): Promise<void> {
  const { stateBinding: stateBindingSvc } = getServices();
  if (stateBindingSvc) {
    await stateBindingSvc.bindState(state, ip, userAgent, provider, workspaceId);
  }
}

/**
 * Verify OAuth state matches IP and User-Agent
 * 
 * Call this in OAuth callback handler
 */
export async function verifyOAuthState(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const state = req.query.state as string;
  const ip = req.ip || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  if (!state) {
    logger.warn('OAuth callback missing state', { ip });
    res.status(400).json({
      error: 'Missing state parameter',
    });
    return;
  }

  try {
    const { stateBinding: stateBindingSvc, suspiciousActivity: suspiciousActivitySvc } = getServices();
    
    if (!stateBindingSvc || !suspiciousActivitySvc) {
      // If Redis not available, skip state verification (fail open)
      logger.warn('OAuth state verification unavailable - allowing request', { ip, state });
      next();
      return;
    }

    const verification = await stateBindingSvc.verifyState(state, ip, userAgent);

    if (!verification.valid) {
      const provider = verification.data?.provider || 'unknown';

      logger.warn('OAuth state verification failed', {
        state,
        ip,
        reason: verification.reason,
        provider,
        alert: 'OAUTH_STATE_VERIFICATION_FAILED',
      });

      // Track failure
      const errorType =
        verification.reason === 'ip_mismatch'
          ? OAuthErrorTypes.IP_MISMATCH
          : verification.reason === 'user_agent_mismatch'
          ? OAuthErrorTypes.USER_AGENT_MISMATCH
          : verification.reason === 'state_not_found'
          ? OAuthErrorTypes.EXPIRED_STATE
          : OAuthErrorTypes.INVALID_STATE;

      const isSuspicious = await suspiciousActivitySvc.trackFailure(
        ip,
        provider,
        errorType,
        userAgent,
        verification.data?.workspaceId,
        state
      );

      // Log to audit log
      await AuditLog.log({
        userId: '000000000000000000000000',
        workspaceId: verification.data?.workspaceId || '000000000000000000000000',
        action: 'oauth.callback.failed',
        entityType: 'oauth_callback',
        entityId: state,
        metadata: {
          provider,
          reason: verification.reason,
          suspicious: isSuspicious,
        },
        ipAddress: ip,
        userAgent,
      });

      res.status(403).json({
        error: 'OAuth verification failed',
        reason: verification.reason,
      });
      return;
    }

    // Store verification data in request for use in callback handler
    (req as any).oauthVerification = verification.data;

    // Consume state (one-time use)
    await stateBindingSvc.consumeState(state);

    next();
  } catch (error: any) {
    logger.error('OAuth state verification error', {
      state,
      ip,
      error: error.message,
    });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}

/**
 * Log successful OAuth callback
 */
export async function logOAuthSuccess(
  provider: string,
  workspaceId: string,
  userId: string,
  ip: string,
  userAgent: string
): Promise<void> {
  await AuditLog.log({
    userId,
    workspaceId,
    action: 'oauth.callback.success',
    entityType: 'oauth_callback',
    entityId: provider,
    metadata: { provider },
    ipAddress: ip,
    userAgent,
  });
}

/**
 * Log failed OAuth callback
 */
export async function logOAuthFailure(
  provider: string,
  errorType: string,
  ip: string,
  userAgent: string,
  workspaceId?: string,
  state?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const { suspiciousActivity: suspiciousActivitySvc } = getServices();
  
  let isSuspicious = false;
  if (suspiciousActivitySvc) {
    isSuspicious = await suspiciousActivitySvc.trackFailure(
      ip,
      provider,
      errorType as any,
      userAgent,
      workspaceId,
      state,
      metadata
    );
  }

  await AuditLog.log({
    userId: '000000000000000000000000',
    workspaceId: workspaceId || '000000000000000000000000',
    action: 'oauth.callback.failed',
    entityType: 'oauth_callback',
    entityId: state || 'unknown',
    metadata: {
      provider,
      errorType,
      suspicious: isSuspicious,
      ...metadata,
    },
    ipAddress: ip,
    userAgent,
  });
}

/**
 * Export services for use in controllers
 */
export { getServices };
