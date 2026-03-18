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

/**
 * Security Dashboard
 */

// GET /api/admin/security/dashboard - Get security dashboard data
if (process.env.NODE_ENV !== 'test') {
  const { SecurityDashboardController } = require('../controllers/SecurityDashboardController');
  router.get('/security/dashboard', SecurityDashboardController.getSecurityDashboard);
}

/**
 * GDPR Breach Notification Routes
 */

// POST /api/admin/breach-report - Report a data breach (GDPR Article 33)
router.post('/breach-report', async (req, res, next): Promise<void> => {
  try {
    const { SecurityAuditService } = await import('../services/SecurityAuditService');
    const { description, affectedUserCount, dataTypes, discoveredAt, reportedBy } = req.body;

    // Validate required fields
    if (!description || !affectedUserCount || !dataTypes || !discoveredAt || !reportedBy) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: description, affectedUserCount, dataTypes, discoveredAt, reportedBy'
      });
      return;
    }

    await SecurityAuditService.reportBreach({
      description,
      affectedUserCount: Number(affectedUserCount),
      dataTypes: Array.isArray(dataTypes) ? dataTypes : [dataTypes],
      discoveredAt: new Date(discoveredAt),
      reportedBy,
    });

    const notificationDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000);

    res.json({
      success: true,
      message: 'Data breach reported successfully',
      notificationDeadline: notificationDeadline.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;

