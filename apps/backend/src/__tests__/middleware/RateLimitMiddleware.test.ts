import { Request, Response, NextFunction } from 'express';
import { rateLimitMiddleware, DEFAULT_RATE_LIMITS } from '../../middleware/RateLimitMiddleware';
import { getRedisClient } from '../../config/redis';
import { securityAuditService } from '../../services/SecurityAuditService';

jest.mock('../../config/redis');
jest.mock('../../services/SecurityAuditService');

describe('RateLimitMiddleware', () => {
  let mockRedis: any;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRedis = {
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      zcard: jest.fn().mockResolvedValue(0),
      zadd: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      zrange: jest.fn().mockResolvedValue([]),
    };

    (getRedisClient as jest.Mock).mockReturnValue(mockRedis);

    mockReq = {
      socket: { remoteAddress: '192.168.1.1' },
      headers: {},
      path: '/api/test',
      method: 'GET',
      params: {},
      body: {},
    };

    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();

    (securityAuditService.logEvent as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('IP-based rate limiting', () => {
    it('should allow request within limit', async () => {
      mockRedis.zcard.mockResolvedValue(5); // 5 requests so far

      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 1000);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
    });

    it('should block request when limit exceeded', async () => {
      mockRedis.zcard.mockResolvedValue(1000); // At limit
      mockRedis.zrange.mockResolvedValue(['1234567890', '1234567890']);

      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many requests',
        })
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });

    it('should use X-Forwarded-For header if present', async () => {
      mockReq.headers = {
        'x-forwarded-for': '203.0.113.1, 198.51.100.1',
      };

      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        expect.stringContaining('203.0.113.1'),
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should handle invalid X-Forwarded-For header', async () => {
      mockReq.headers = {
        'x-forwarded-for': 'invalid-ip',
      };

      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Should fallback to socket address
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.1'),
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe('Workspace-based rate limiting', () => {
    it('should allow request within limit', async () => {
      mockReq.params = { workspaceId: 'workspace123' };
      mockRedis.zcard.mockResolvedValue(50); // 50 requests so far

      const middleware = rateLimitMiddleware({
        workspace: DEFAULT_RATE_LIMITS.WORKSPACE_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block request when limit exceeded', async () => {
      mockReq.params = { workspaceId: 'workspace123' };
      mockRedis.zcard.mockResolvedValue(1000); // At limit
      mockRedis.zrange.mockResolvedValue(['1234567890', '1234567890']);

      const middleware = rateLimitMiddleware({
        workspace: DEFAULT_RATE_LIMITS.WORKSPACE_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should skip workspace limit if no workspace ID', async () => {
      const middleware = rateLimitMiddleware({
        workspace: DEFAULT_RATE_LIMITS.WORKSPACE_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedis.zadd).not.toHaveBeenCalled();
    });

    it('should get workspace ID from authenticated user', async () => {
      (mockReq as any).user = { workspaceId: 'workspace456' };
      mockRedis.zcard.mockResolvedValue(10);

      const middleware = rateLimitMiddleware({
        workspace: DEFAULT_RATE_LIMITS.WORKSPACE_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        expect.stringContaining('workspace456'),
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe('Combined IP and Workspace limits', () => {
    it('should enforce both limits', async () => {
      mockReq.params = { workspaceId: 'workspace123' };
      mockRedis.zcard.mockResolvedValue(10);

      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
        workspace: DEFAULT_RATE_LIMITS.WORKSPACE_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedis.zadd).toHaveBeenCalledTimes(2); // Once for IP, once for workspace
    });

    it('should block if either limit exceeded', async () => {
      mockReq.params = { workspaceId: 'workspace123' };
      
      // IP limit OK, workspace limit exceeded
      mockRedis.zcard
        .mockResolvedValueOnce(10) // IP check
        .mockResolvedValueOnce(1000); // Workspace check (at limit)
      
      mockRedis.zrange.mockResolvedValue(['1234567890', '1234567890']);

      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
        workspace: DEFAULT_RATE_LIMITS.WORKSPACE_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Sliding window algorithm', () => {
    it('should remove old entries outside window', async () => {
      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        expect.any(String),
        0,
        expect.any(Number)
      );
    });

    it('should set expiry on rate limit key', async () => {
      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number)
      );
    });
  });

  describe('Graceful degradation', () => {
    it('should allow request if Redis fails', async () => {
      mockRedis.zcard.mockRejectedValue(new Error('Redis connection failed'));

      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow request if middleware throws error', async () => {
      mockRedis.zcard.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Security event logging', () => {
    it('should log security event when limit exceeded', async () => {
      mockRedis.zcard.mockResolvedValue(1000);
      mockRedis.zrange.mockResolvedValue(['1234567890', '1234567890']);

      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(securityAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rate_limit_exceeded',
          success: false,
        })
      );
    });
  });

  describe('Skip condition', () => {
    it('should skip rate limiting when condition met', async () => {
      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
        skipWhen: (req) => req.path === '/api/test',
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedis.zadd).not.toHaveBeenCalled();
    });

    it('should apply rate limiting when condition not met', async () => {
      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
        skipWhen: (req) => req.path === '/api/other',
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedis.zadd).toHaveBeenCalled();
    });
  });

  describe('Rate limit headers', () => {
    it('should set rate limit headers on success', async () => {
      mockRedis.zcard.mockResolvedValue(10);

      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 1000);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    it('should set Retry-After header when limit exceeded', async () => {
      mockRedis.zcard.mockResolvedValue(1000);
      mockRedis.zrange.mockResolvedValue(['1234567890', '1234567890']);

      const middleware = rateLimitMiddleware({
        ip: DEFAULT_RATE_LIMITS.IP_API,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });
  });
});
