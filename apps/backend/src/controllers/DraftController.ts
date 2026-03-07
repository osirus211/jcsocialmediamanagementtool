/**
 * Draft Controller
 * 
 * REST API endpoints for draft post management
 */

import { Request, Response, NextFunction } from 'express';
import { draftService } from '../services/DraftService';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { logger } from '../utils/logger';

export class DraftController {
  /**
   * POST /api/v1/drafts
   * Create a new draft
   */
  async createDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId.toString();

      if (!workspaceId || !userId) {
        sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
        return;
      }

      const draft = await draftService.createDraft({
        workspaceId,
        userId,
        ...req.body,
      });

      sendSuccess(res, { draft }, 201);
    } catch (error: any) {
      logger.error('Failed to create draft', {
        error: error.message,
      });
      next(error);
    }
  }

  /**
   * GET /api/v1/drafts
   * List drafts with pagination
   */
  async getDrafts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
        return;
      }

      const { userId, page, limit, sortBy, sortOrder } = req.query;

      const result = await draftService.getDrafts(workspaceId, {
        userId: userId as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sortBy: sortBy as 'createdAt' | 'updatedAt',
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      sendSuccess(
        res,
        { drafts: result.drafts },
        200,
        {
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
          },
        }
      );
    } catch (error: any) {
      logger.error('Failed to get drafts', {
        error: error.message,
      });
      next(error);
    }
  }

  /**
   * GET /api/v1/drafts/:id
   * Get draft by ID
   */
  async getDraftById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
        return;
      }

      const draft = await draftService.getDraftById(id, workspaceId);

      sendSuccess(res, { draft }, 200);
    } catch (error: any) {
      logger.error('Failed to get draft', {
        error: error.message,
        draftId: req.params.id,
      });
      next(error);
    }
  }

  /**
   * PATCH /api/v1/drafts/:id
   * Update draft
   */
  async updateDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
        return;
      }

      const draft = await draftService.updateDraft(id, workspaceId, req.body);

      sendSuccess(res, { draft }, 200);
    } catch (error: any) {
      logger.error('Failed to update draft', {
        error: error.message,
        draftId: req.params.id,
      });
      next(error);
    }
  }

  /**
   * DELETE /api/v1/drafts/:id
   * Delete draft
   */
  async deleteDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
        return;
      }

      await draftService.deleteDraft(id, workspaceId);

      sendSuccess(res, { message: 'Draft deleted successfully' }, 200);
    } catch (error: any) {
      logger.error('Failed to delete draft', {
        error: error.message,
        draftId: req.params.id,
      });
      next(error);
    }
  }

  /**
   * POST /api/v1/drafts/:id/schedule
   * Convert draft to scheduled post
   */
  async scheduleFromDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { scheduledAt } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
        return;
      }

      if (!scheduledAt) {
        sendError(res, 'VALIDATION_ERROR', 'scheduledAt is required', 400);
        return;
      }

      const posts = await draftService.scheduleFromDraft(
        id,
        workspaceId,
        new Date(scheduledAt)
      );

      sendSuccess(
        res,
        {
          posts,
          message: `Draft scheduled successfully. Created ${posts.length} post(s).`,
        },
        201
      );
    } catch (error: any) {
      logger.error('Failed to schedule draft', {
        error: error.message,
        draftId: req.params.id,
      });
      next(error);
    }
  }
}

export const draftController = new DraftController();
