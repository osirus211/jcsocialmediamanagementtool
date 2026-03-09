import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { httpMetricsMiddleware } from './middleware/httpMetrics';
import { publicApiMetricsMiddleware } from './middleware/publicApiMetrics';
import { sanitizeInput } from './middleware/validate';
import {
  requestId,
  mongoSanitization,
  xssProtection,
  contentSecurityPolicy,
  hidePoweredBy,
  preventParameterPollution,
  validateContentType,
  anomalyDetection,
} from './middleware/security';
import { 
  sentryRequestHandler, 
  sentryTracingHandler 
} from './monitoring/sentry';
import apiV1Routes from './routes/v1';
import publicApiV1Routes from './routes/public/v1';

const app: Application = express();

// Trust proxy (for rate limiting and IP detection behind load balancers)
app.set('trust proxy', 1);

// Sentry request handler (must be first to capture all requests)
app.use(sentryRequestHandler());

// Request ID (must be early for tracing)
app.use(requestId);

// Sentry tracing handler (after request ID for proper trace correlation)
app.use(sentryTracingHandler());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // We set our own CSP
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
app.use(hidePoweredBy);
app.use(xssProtection);
if (config.env === 'production') {
  app.use(contentSecurityPolicy);
}

// CORS configuration
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Workspace-ID', 'X-API-Key'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-API-Version'],
    maxAge: 86400, // 24 hours
  })
);

// Response compression
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Balanced compression
}));

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser middleware
app.use(cookieParser());

// Security hardening
app.use(mongoSanitization);
app.use(sanitizeInput);
app.use(preventParameterPollution);
app.use(validateContentType);
app.use(anomalyDetection);

// Request logging
app.use(requestLogger);

// HTTP metrics tracking
app.use(httpMetricsMiddleware);

// Public API metrics tracking
app.use(publicApiMetricsMiddleware);

// Health check endpoints (before API routes for fast response)
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const { healthCheckService } = await import('./services/HealthCheckService');
    const isHealthy = await healthCheckService.isHealthy();

    if (isHealthy) {
      res.status(200).json({ status: 'ok' });
    } else {
      res.status(503).json({ status: 'unhealthy' });
    }
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: error.message,
    });
  }
});

// Detailed health status endpoint
app.get('/health/detailed', async (_req: Request, res: Response) => {
  try {
    const { healthCheckService } = await import('./services/HealthCheckService');
    const healthStatus = await healthCheckService.getHealthStatus();

    // Set appropriate HTTP status code
    let statusCode = 200;
    if (healthStatus.status === 'unhealthy') {
      statusCode = 503;
    } else if (healthStatus.status === 'degraded') {
      statusCode = 200; // Still serving traffic, but degraded
    }

    res.status(statusCode).json(healthStatus);
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: config.sentry.appVersion,
      error: 'Health check failed',
      details: {
        error: error.message,
      },
    });
  }
});

// Kubernetes liveness probe (simple check - is process alive?)
app.get('/health/live', (_req: Request, res: Response) => {
  try {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({ status: 'not alive' });
  }
});

// Kubernetes readiness probe (check critical dependencies)
app.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    const { healthCheckService } = await import('./services/HealthCheckService');
    const healthStatus = await healthCheckService.getHealthStatus();

    // System is ready if not unhealthy
    const isReady = healthStatus.status !== 'unhealthy';

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        components: Object.keys(healthStatus.components).reduce((acc, key) => {
          acc[key] = healthStatus.components[key as keyof typeof healthStatus.components].status;
          return acc;
        }, {} as Record<string, string>),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        reason: 'System unhealthy',
        components: Object.keys(healthStatus.components).reduce((acc, key) => {
          acc[key] = healthStatus.components[key as keyof typeof healthStatus.components].status;
          return acc;
        }, {} as Record<string, string>),
      });
    }
  } catch (error: any) {
    res.status(503).json({
      status: 'not ready',
      reason: 'Health check failed',
      error: error.message,
    });
  }
});

// PHASE 3: Redis health endpoint
app.get('/health/redis', async (_req: Request, res: Response) => {
  try {
    const { isRedisHealthy, getCircuitBreakerStatus, getRecoveryService } = await import('./config/redis');
    
    const isHealthy = isRedisHealthy();
    const circuitBreaker = getCircuitBreakerStatus();
    const recoveryService = getRecoveryService();
    
    const health = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      redis: {
        connected: isHealthy,
        circuitBreaker: {
          state: circuitBreaker.state,
          errorRate: circuitBreaker.errorRate,
          errors: circuitBreaker.errors,
          successes: circuitBreaker.successes,
          lastError: circuitBreaker.lastError,
          openedAt: circuitBreaker.openedAt,
        },
      },
      recovery: recoveryService ? recoveryService.getStatus() : null,
    };
    
    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      message: 'Redis health check failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// PHASE 3: Worker health endpoint
app.get('/health/workers', async (_req: Request, res: Response) => {
  try {
    const { WorkerManager } = await import('./services/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    
    const workerStatuses = workerManager.getStatus();
    const isHealthy = workerManager.isHealthy();
    const redisHealth = workerManager.getRedisHealth();
    
    const health = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      workers: workerStatuses,
      redis: redisHealth,
      summary: {
        total: workerStatuses.length,
        enabled: workerStatuses.filter(w => w.isEnabled).length,
        running: workerStatuses.filter(w => w.isRunning).length,
        healthy: isHealthy,
      },
    };
    
    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      message: 'Worker health check failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// PHASE 3: Queue health endpoint
app.get('/health/queues', async (_req: Request, res: Response) => {
  try {
    const { queueMonitoringService } = await import('./services/QueueMonitoringService');
    
    const queueStats = await queueMonitoringService.getAllQueueStats();
    const monitoringStatus = queueMonitoringService.getStatus();
    
    // Determine overall health
    const unhealthyQueues = queueStats.filter(q => q.health === 'unhealthy');
    const degradedQueues = queueStats.filter(q => q.health === 'degraded');
    
    let overallStatus = 'healthy';
    if (unhealthyQueues.length > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedQueues.length > 0) {
      overallStatus = 'degraded';
    }
    
    const health = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      monitoring: monitoringStatus,
      queues: queueStats,
      summary: {
        total: queueStats.length,
        healthy: queueStats.filter(q => q.health === 'healthy').length,
        degraded: degradedQueues.length,
        unhealthy: unhealthyQueues.length,
      },
    };
    
    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      message: 'Queue health check failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Social Media Scheduler API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/v1/docs',
    health: '/health',
  });
});

// PHASE 6.3: Publishing system health endpoint
app.get('/internal/publishing-health', async (_req: Request, res: Response) => {
  try {
    const { publishingHealthService } = await import('./services/PublishingHealthService');
    const healthStatus = await publishingHealthService.getPublishingHealth();
    
    // Set appropriate HTTP status code
    let statusCode = 200;
    if (healthStatus.status === 'unhealthy') {
      statusCode = 503;
    } else if (healthStatus.status === 'degraded') {
      statusCode = 200; // Still serving traffic, but degraded
    }
    
    res.status(statusCode).json(healthStatus);
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Publishing health check failed',
      details: {
        error: error.message,
      },
    });
  }
});

// API v1 routes
app.use('/api/v1', apiV1Routes);

// Public API v1 routes (external integrations)
app.use('/api/public/v1', publicApiV1Routes);

// Metrics endpoint placeholder (must be BEFORE 404 handler)
// Will be set by server.ts during startup
let metricsHandler: ((req: Request, res: Response) => void) | null = null;

app.get('/metrics', (req: Request, res: Response) => {
  if (metricsHandler) {
    metricsHandler(req, res);
  } else {
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Metrics service not initialized yet',
    });
  }
});

// Export function to set metrics handler
export const setMetricsHandler = (handler: (req: Request, res: Response) => void) => {
  metricsHandler = handler;
};

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist',
  });
});

// Sentry error handler (must be after routes but before global error handler)
import { sentryErrorHandler } from './monitoring/sentry';
app.use(sentryErrorHandler());

// Global error handler (must be last)
app.use(errorHandler);

export default app;
