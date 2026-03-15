import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { securityAuditService } from '../services/SecurityAuditService';
import { SecurityEventType } from '../models/SecurityEvent';

/**
 * Rate Limit Middleware
 * 
 * FOUNDATION LAYER for rate limiting
 * 
 * Provides:
 * - IP-based rate limiting (prevents brute force)
 * - Workspace-based rate limiting (prevents abuse)
 * - Sliding window algorithm
 * - Graceful degradation when Redis unavailable
 * 
 * Features:
 * - Configurable limits per endpoint type
 * - X-RateLimit-* headers in responses
 * - HTTP 429 with Retry-After header
 * - Security event logging
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string; // Redis key prefix
  skipSuccessfulRequests?: boolean; // Only count failed requests
  skipFailedRequests?: boolean; // Only count successful requests
}

export interface RateLimitOptions {
  ip?: RateLimitConfig;
  workspace?: RateLimitConfig;
  skipWhen?: (req: Request) => boolean; // Skip rate limiting conditionally
}

/**
 * Default rate limit configurations
 */
export const DEFAULT_RATE_LIMITS = {
  // IP-based limits (prevent brute force)
  IP_LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    keyPrefix: 'ratelimit:ip:login:',
    skipSuccessfulRequests: true, // Only count failed login attempts
  },
  IP_API: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 1000,
    keyPrefix: 'ratelimit:ip:api:',
  },
  
  // Workspace-based limits (prevent abuse)
  WORKSPACE_API: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 1000,
    keyPrefix: 'ratelimit:workspace:api:',
  },
  WORKSPACE_POSTS: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 100,
    keyPrefix: 'ratelimit:workspace:posts:',
  },
};

/**
 * Get client IP address from request
 * 
 * Handles X-Forwarded-For header (with validation)
 */
function getClientIp(req: Request): string {
  // Check X-Forwarded-For header (set by reverse proxy)
  const forwardedFor = req.headers['x-forwarded-for'];
  
  if (forwardedFor) {
    // Take first IP (client IP)
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const clientIp = ips.split(',')[0].trim();
    
    // Basic validation to prevent spoofing
    if (/^[\d.:a-f]+$/i.test(clientIp)) {
      return clientIp;
    }
  }
  
  // Fallback to socket address
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Get workspace ID from request
 * 
 * Assumes workspace ID is in req.user.workspaceId or req.params.workspaceId
 */
function getWorkspaceId(req: Request): string | null {
  // Check authenticated user's workspace
  if ((req as any).user?.workspaceId) {
    return (req as any).user.workspaceId.toString();
  }
  
  // Check URL params
  if (req.params.workspaceId) {
    return req.params.workspaceId;
  }
  
  // Check body
  if (req.body?.workspaceId) {
    return req.body.workspaceId;
  }
  
  return null;
}

/**
 * Sliding window rate limiter using Redis
 * 
 * Uses sorted sets with timestamps as scores
 */
async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
  total: number;
}> {
  try {
    const { getRedisClientSafe } = await import('../config/redis');
    const redis = getRedisClientSafe();
    
    if (!redis) {
      // If Redis not available, fail open (allow request)
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: Date.now() + config.windowMs,
        total: 1,
      };
    }
    
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Remove old entries outside the window
    await redis.zremrangebyscore(key, 0, windowStart);
    
    // Count requests in current window
    const count = await redis.zcard(key);
    
    // Check if limit exceeded
    if (count >= config.maxRequests) {
      // Get oldest entry to calculate reset time
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = oldest.length > 0 
        ? parseInt(oldest[1]) + config.windowMs 
        : now + config.windowMs;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        total: count,
      };
    }
    
    // Add current request
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiry on key (cleanup)
    await redis.expire(key, Math.ceil(config.windowMs / 1000));
    
    return {
      allowed: true,
      remaining: config.maxRequests - count - 1,
      resetTime: now + config.windowMs,
      total: count + 1,
    };
  } catch (error: any) {
    logger.error('Rate limit check failed', {
      key,
      error: error.message,
    });
    
    // Graceful degradation: allow request if Redis fails
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
      total: 0,
    };
  }
}

/**
 * Create rate limit middleware
 * 
 * Usage:
 * ```
 * app.post('/api/login', 
 *   rateLimitMiddleware({ ip: DEFAULT_RATE_LIMITS.IP_LOGIN }),
 *   loginHandler
 * );
 * ```
 */
export function rateLimitMiddleware(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if condition met
      if (options.skipWhen && options.skipWhen(req)) {
        return next();
      }
      
      const checks: Array<{
        type: 'ip' | 'workspace';
        result: Awaited<ReturnType<typeof checkRateLimit>>;
        config: RateLimitConfig;
      }> = [];
      
      // IP-based rate limiting
      if (options.ip) {
        const clientIp = getClientIp(req);
        const key = `${options.ip.keyPrefix}${clientIp}`;
        const result = await checkRateLimit(key, options.ip);
        checks.push({ type: 'ip', result, config: options.ip });
      }
      
      // Workspace-based rate limiting
      if (options.workspace) {
        const workspaceId = getWorkspaceId(req);
        if (workspaceId) {
          const key = `${options.workspace.keyPrefix}${workspaceId}`;
          const result = await checkRateLimit(key, options.workspace);
          checks.push({ type: 'workspace', result, config: options.workspace });
        }
      }
      
      // Check if any limit exceeded
      const exceeded = checks.find(check => !check.result.allowed);
      
      if (exceeded) {
        const retryAfter = Math.ceil((exceeded.result.resetTime - Date.now()) / 1000);
        
        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', exceeded.config.maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', exceeded.result.resetTime);
        res.setHeader('Retry-After', retryAfter);
        
        // Log security event
        const clientIp = getClientIp(req);
        const workspaceId = getWorkspaceId(req);
        
        await securityAuditService.logEvent({
          type: SecurityEventType.RATE_LIMIT_EXCEEDED,
          workspaceId: workspaceId || undefined,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'],
          resource: req.path,
          action: req.method,
          success: false,
          metadata: {
            limitType: exceeded.type,
            limit: exceeded.config.maxRequests,
            windowMs: exceeded.config.windowMs,
            total: exceeded.result.total,
          },
        });
        
        logger.warn('Rate limit exceeded', {
          type: exceeded.type,
          ip: clientIp,
          workspaceId,
          path: req.path,
          limit: exceeded.config.maxRequests,
          total: exceeded.result.total,
        });
        
        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        });
      }
      
      // Set rate limit headers for successful requests
      if (checks.length > 0) {
        const mostRestrictive = checks.reduce((prev, curr) => 
          curr.result.remaining < prev.result.remaining ? curr : prev
        );
        
        res.setHeader('X-RateLimit-Limit', mostRestrictive.config.maxRequests);
        res.setHeader('X-RateLimit-Remaining', mostRestrictive.result.remaining);
        res.setHeader('X-RateLimit-Reset', mostRestrictive.result.resetTime);
      }
      
      next();
    } catch (error: any) {
      logger.error('Rate limit middleware error', {
        error: error.message,
        path: req.path,
      });
      
      // Graceful degradation: allow request on error
      next();
    }
  };
}

/**
 * Helper: Create IP-based login rate limiter
 */
export const ipLoginRateLimit = rateLimitMiddleware({
  ip: DEFAULT_RATE_LIMITS.IP_LOGIN,
});

/**
 * Helper: Create IP-based API rate limiter
 */
export const ipApiRateLimit = rateLimitMiddleware({
  ip: DEFAULT_RATE_LIMITS.IP_API,
});

/**
 * Helper: Create workspace-based API rate limiter
 */
export const workspaceApiRateLimit = rateLimitMiddleware({
  workspace: DEFAULT_RATE_LIMITS.WORKSPACE_API,
});

/**
 * Helper: Create workspace-based post creation rate limiter
 */
export const workspacePostRateLimit = rateLimitMiddleware({
  workspace: DEFAULT_RATE_LIMITS.WORKSPACE_POSTS,
});
