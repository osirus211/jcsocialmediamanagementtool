/**
 * Metrics Routes
 * 
 * Exposes Prometheus metrics endpoint
 */

import { Router, Request, Response } from 'express';
import { metricsRegistry } from '../../config/metrics';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /metrics
 * 
 * Prometheus metrics endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', metricsRegistry.contentType);
    const metrics = await metricsRegistry.metrics();
    res.send(metrics);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to generate metrics', {
      error: errorMessage,
    });
    res.status(500).send('Failed to generate metrics');
  }
});

export default router;

