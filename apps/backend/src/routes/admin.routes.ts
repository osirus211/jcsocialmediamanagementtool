/**
 * Admin Routes
 * 
 * Admin-only API endpoints
 * 
 * SECURITY:
 * - Requires authentication
 * - Requires workspace owner role
 * - Rate limited
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireOwner } from '../middleware/rbac';
import { DLQReplayController } from '../controllers/DLQReplayController';
import { DLQReplayService } from '../services/recovery/DLQReplayService';
import { config } from '../config';

const router = Router();

// Lazy initialization of DLQ Replay Service (to avoid Redis dependency at module load time)
let dlqReplayService: DLQReplayService | null = null;
let dlqReplayController: DLQReplayController | null = null;

const getDLQReplayController = () => {
  if (!dlqReplayController) {
    dlqReplayService = new DLQReplayService({
      enabled: config.dlqReplay.enabled,
      batchSize: config.dlqReplay.batchSize,
      skipPublished: config.dlqReplay.skipPublished,
      dryRun: config.dlqReplay.dryRun,
    });
    dlqReplayController = new DLQReplayController(dlqReplayService);
  }
  return dlqReplayController;
};

// Middleware: Require authentication and workspace owner for all admin routes
router.use(requireAuth);
router.use(requireOwner);

/**
 * DLQ Replay Routes
 */

// GET /api/admin/dlq/stats - Get DLQ statistics
router.get('/dlq/stats', (req, res) => getDLQReplayController().getStats(req, res));

// GET /api/admin/dlq/preview - Preview DLQ jobs
router.get('/dlq/preview', (req, res) => getDLQReplayController().preview(req, res));

// POST /api/admin/dlq/replay/:jobId - Replay single job
router.post('/dlq/replay/:jobId', (req, res) => getDLQReplayController().replayOne(req, res));

// POST /api/admin/dlq/replay-batch - Replay multiple jobs
router.post('/dlq/replay-batch', (req, res) => getDLQReplayController().replayBatch(req, res));

// POST /api/admin/dlq/replay-all - Replay all jobs
router.post('/dlq/replay-all', (req, res) => getDLQReplayController().replayAll(req, res));

export default router;

