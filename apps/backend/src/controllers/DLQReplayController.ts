/**
 * DLQ Replay Controller
 * 
 * Admin-only API endpoints for DLQ replay operations
 * 
 * SECURITY:
 * - Admin authentication required
 * - Rate limited
 * - Audit logged
 */

import { Request, Response } from 'express';
import { DLQReplayService } from '../services/recovery/DLQReplayService';
import { logger } from '../utils/logger';

export class DLQReplayController {
  private replayService: DLQReplayService;

  constructor(replayService: DLQReplayService) {
    this.replayService = replayService;
  }

  /**
   * GET /api/admin/dlq/stats
   * Get DLQ and replay statistics
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.replayService.getStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Failed to get DLQ stats', {
        error: error.message,
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get DLQ stats',
      });
    }
  }

  /**
   * GET /api/admin/dlq/preview
   * Preview DLQ jobs without replaying
   */
  async preview(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      const preview = await this.replayService.preview(limit);

      res.json({
        success: true,
        data: preview,
      });
    } catch (error: any) {
      logger.error('Failed to preview DLQ jobs', {
        error: error.message,
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to preview DLQ jobs',
      });
    }
  }

  /**
   * POST /api/admin/dlq/replay/:jobId
   * Replay a single DLQ job
   */
  async replayOne(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      logger.info('Admin initiated DLQ replay', {
        jobId,
        userId: (req as any).user?.id,
      });

      const result = await this.replayService.replayJob(jobId);

      res.json({
        success: result.success,
        data: result,
      });
    } catch (error: any) {
      logger.error('Failed to replay DLQ job', {
        error: error.message,
        jobId: req.params.jobId,
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to replay DLQ job',
      });
    }
  }

  /**
   * POST /api/admin/dlq/replay-batch
   * Replay multiple DLQ jobs
   * 
   * Body: { jobIds: string[] }
   */
  async replayBatch(req: Request, res: Response): Promise<void> {
    try {
      const { jobIds } = req.body;

      if (!Array.isArray(jobIds) || jobIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'jobIds must be a non-empty array',
        });
        return;
      }

      logger.info('Admin initiated DLQ batch replay', {
        jobCount: jobIds.length,
        userId: (req as any).user?.id,
      });

      const summary = await this.replayService.replayBatch(jobIds);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      logger.error('Failed to replay DLQ batch', {
        error: error.message,
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to replay DLQ batch',
      });
    }
  }

  /**
   * POST /api/admin/dlq/replay-all
   * Replay all DLQ jobs (up to batch size limit)
   */
  async replayAll(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Admin initiated DLQ replay all', {
        userId: (req as any).user?.id,
      });

      const summary = await this.replayService.replayAll();

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      logger.error('Failed to replay all DLQ jobs', {
        error: error.message,
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to replay all DLQ jobs',
      });
    }
  }
}

