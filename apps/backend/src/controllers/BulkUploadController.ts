/**
 * BulkUpload Controller
 * 
 * Handles CSV bulk post upload operations
 */

import { Request, Response, NextFunction } from 'express';
import { bulkUploadService } from '../services/BulkUploadService';
import { logger } from '../utils/logger';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

export class BulkUploadController {
  /**
   * Upload CSV file
   * POST /posts/bulk-upload
   */
  async uploadCSV(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId;

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (!userId) {
        throw new UnauthorizedError('User authentication required');
      }

      if (!req.file) {
        throw new BadRequestError('CSV file is required');
      }

      const job = await bulkUploadService.uploadCSV(
        req.file.buffer,
        req.file.originalname,
        workspaceId,
        userId
      );

      res.status(201).json({
        success: true,
        data: job.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get upload job status
   * GET /posts/bulk-upload/:id
   */
  async getUploadStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const job = await bulkUploadService.getUploadStatus(id, workspaceId);

      if (!job) {
        throw new BadRequestError('Upload job not found');
      }

      res.status(200).json({
        success: true,
        data: job.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List upload jobs
   * GET /posts/bulk-upload
   */
  async listUploadJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const jobs = await bulkUploadService.listUploadJobs(workspaceId);

      res.status(200).json({
        success: true,
        data: jobs.map(j => j.toJSON()),
      });
    } catch (error) {
      next(error);
    }
  }
}

export const bulkUploadController = new BulkUploadController();
