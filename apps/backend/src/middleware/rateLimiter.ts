import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { getRedisClient } from '../config/redis';
import RedisStore from 'rate-limit-redis';

/**
 * Create Redis store for distributed rate limiting
 * Returns undefined if Redis is not available (falls back to memory store)
 */
const createRedisStore = () => {
  try {
    const redisClient = getRedisClient();

    if (!redisClient) {
      console.warn('Redis unavailable, using memory store');
      return undefined;
    }

    return new RedisStore({
      // @ts-ignore - rate-limit-redis types don't match ioredis perfectly
      sendCommand: async (...args: string[]) => redisClient.call(args[0], ...args.slice(1)),
      prefix: 'rl:',
    });
  } catch (error) {
    console.warn('Redis store unavailable, using memory store for rate limiting');
    return undefined;
  }
};

/**
 * Global API rate limiter
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Don't create store on import - let it use memory store
  store: undefined,
  skip: (req: Request) => req.path.startsWith('/health'),
});

/**
 * Auth limiter
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // Don't create store on import - let it use memory store
  store: undefined,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many authentication attempts. Please try again later.',
      retryAfter: 900,
    });
  },
});

/**
 * Password reset limiter
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  // Don't create store on import - let it use memory store
  store: undefined,
});

/**
 * API limiter
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // Don't create store on import - let it use memory store
  store: undefined,
  skip: (req: Request) => !!req.user,
});

/**
 * Registration limiter
 */
export const registrationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  // Don't create store on import - let it use memory store
  store: undefined,
});

/**
 * AI limiter
 */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Don't create store on import - let it use memory store
  store: undefined,
  keyGenerator: (req: Request) => req.user?.userId || req.ip || 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many AI requests. Please try again later.',
      retryAfter: 60,
    });
  },
});

/**
 * Upload limiter
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  // Don't create store on import - let it use memory store
  store: undefined,
  keyGenerator: (req: Request) => req.user?.userId || req.ip || 'unknown',
});

/**
 * OAuth authorize limiter - 10 requests per minute per user
 */
export const oauthAuthorizeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined,
  keyGenerator: (req: Request) => req.user?.userId || req.ip || 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many OAuth authorization attempts. Please try again later.',
      retryAfter: 60,
    });
  },
});

/**
 * OAuth callback limiter - 20 requests per minute per IP
 */
export const oauthCallbackRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined,
  keyGenerator: (req: Request) => req.ip || 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many OAuth callback requests. Please try again later.',
      retryAfter: 60,
    });
  },
});

/**
 * Strict rate limiter for sensitive operations (2FA recovery, etc.)
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined,
  keyGenerator: (req: Request) => req.ip || 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many sensitive operation attempts. Please try again later.',
      retryAfter: 3600, // 1 hour
    });
  },
});

/**
 * Workspace creation rate limiter - 10 creates per hour per user
 */
export const workspaceCreateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined,
  keyGenerator: (req: Request) => req.user?.userId || req.ip || 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many workspace creation attempts. Please try again later.',
      retryAfter: 3600,
    });
  },
});

/**
 * Workspace update rate limiter - 100 updates per hour per user
 */
export const workspaceUpdateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined,
  keyGenerator: (req: Request) => req.user?.userId || req.ip || 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many workspace update attempts. Please try again later.',
      retryAfter: 3600,
    });
  },
});

/**
 * Workspace delete rate limiter - 5 deletes per hour per user
 */
export const workspaceDeleteRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined,
  keyGenerator: (req: Request) => req.user?.userId || req.ip || 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many workspace deletion attempts. Please try again later.',
      retryAfter: 3600,
    });
  },
});

/**
 * Invitation create rate limiter - 20 invites per hour per user
 */
export const invitationCreateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined,
  keyGenerator: (req: Request) => req.user?.userId || req.ip || 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many invitation attempts. Please try again later.',
      retryAfter: 3600,
    });
  },
});

/**
 * Invitation resend rate limiter - 10 resends per hour per user
 */
export const invitationResendRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined,
  keyGenerator: (req: Request) => req.user?.userId || req.ip || 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many invitation resend attempts. Please try again later.',
      retryAfter: 3600,
    });
  },
});

/**
 * Invitation revoke rate limiter - 50 revokes per hour per user
 */
export const invitationRevokeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined,
  keyGenerator: (req: Request) => req.user?.userId || req.ip || 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many invitation revoke attempts. Please try again later.',
      retryAfter: 3600,
    });
  },
});

/**
 * Member remove rate limiter - 20 removes per hour per user
 */
export const memberRemoveRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined,
  keyGenerator: (req: Request) => req.user?.userId || req.ip || 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many member removal attempts. Please try again later.',
      retryAfter: 3600,
    });
  },
});

/**
 * Member deactivate rate limiter - 30 deactivations per hour per user
 */
export const memberDeactivateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined,
  keyGenerator: (req: Request) => req.user?.userId || req.ip || 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many member deactivation attempts. Please try again later.',
      retryAfter: 3600,
    });
  },
});

/**
 * Member reactivate rate limiter - 30 reactivations per hour per user
 */
export const memberReactivateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined,
  keyGenerator: (req: Request) => req.user?.userId || req.ip || 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many member reactivation attempts. Please try again later.',
      retryAfter: 3600,
    });
  },
});
