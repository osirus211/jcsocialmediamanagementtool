/**
 * Publishing Health Routes
 * 
 * Internal endpoint for monitoring publishing system health
 * Used by monitoring systems and ops teams
 */

import { Router } from 'express';
import { publishingHealthService } from '../../services/PublishingHealthService';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /internal/publishing-health
 * 
 * Returns comprehensive health status of the publishing system
 * Includes scheduler, queue, and worker metrics
 */
router.get('/publishing-health', async (req, res) => {
  try {
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
    logger.error('Publishing health endpoint error', { error: error.message });
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

export default router;
