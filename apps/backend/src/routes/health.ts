import { Router } from 'express';
import { healthCheckService } from '../services/HealthCheckService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Simple health check endpoint
 * Returns 200 if healthy, 503 if unhealthy
 * Used by load balancers for basic health checks
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await healthCheckService.isHealthy();
    
    if (isHealthy) {
      res.status(200).json({ status: 'ok' });
    } else {
      res.status(503).json({ status: 'unhealthy' });
    }
  } catch (error: any) {
    logger.error('Health check endpoint error', { error: error.message });
    res.status(503).json({ 
      status: 'error',
      message: 'Health check failed',
    });
  }
});

/**
 * Detailed health status endpoint
 * Returns comprehensive health information
 * Used by monitoring systems and debugging
 */
router.get('/health/detailed', async (req, res) => {
  try {
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
    logger.error('Detailed health check endpoint error', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: '1.0.0',
      error: 'Health check failed',
      details: {
        error: error.message,
      },
    });
  }
});

/**
 * Readiness check endpoint
 * Returns 200 when system is ready to serve traffic
 * Used by Kubernetes readiness probes
 */
router.get('/ready', async (req, res) => {
  try {
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
    logger.error('Readiness check endpoint error', { error: error.message });
    res.status(503).json({ 
      status: 'not ready',
      reason: 'Health check failed',
      error: error.message,
    });
  }
});

/**
 * Liveness check endpoint
 * Returns 200 if process is alive
 * Used by Kubernetes liveness probes
 */
router.get('/live', (req, res) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({ 
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    pid: process.pid,
  });
});

export default router;