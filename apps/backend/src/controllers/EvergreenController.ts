/**
 * Evergreen Controller
 * 
 * REST API endpoints for managing evergreen content republishing rules
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { EvergreenService } from '../services/EvergreenService';
import { logger } from '../utils/logger';
import {
  sendSuccess,
  sendValidationError,
  sendNotFound,
  sendError,
} from '../utils/apiResponse';

export class EvergreenController {
  /**
   * POST /api/v1/evergreen-rules
   * Create an evergreen rule
   */
  async createEvergreenRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { 
        workspaceId, 
        postId, 
        repostInterval, 
        maxReposts, 
        contentModification, 
        enabled,
        paused,
        recyclingSchedule,
        minDaysBetweenRecycles,
        autoStopAfterPosts
      } = req.body;
      const userId = (req as any).user?.id || 'system'; // Get from auth middleware

      // Default recycling schedule if not provided
      const defaultRecyclingSchedule = recyclingSchedule || {
        type: 'custom',
        interval: repostInterval || 7,
        timeOfDay: '09:00'
      };

      // Create evergreen rule
      const rule = await EvergreenService.createRule({
        workspaceId,
        postId,
        repostInterval,
        maxReposts: maxReposts !== undefined ? maxReposts : -1,
        enabled: enabled !== undefined ? enabled : true,
        paused: paused || false,
        recyclingSchedule: defaultRecyclingSchedule,
        minDaysBetweenRecycles: minDaysBetweenRecycles || 30,
        autoStopAfterPosts,
        contentModification,
        createdBy: userId,
      });

      logger.info('Evergreen rule created via API', {
        ruleId: rule._id.toString(),
        workspaceId,
        postId,
      });

      sendSuccess(res, rule.toJSON(), 201);
    } catch (error: any) {
      logger.error('Failed to create evergreen rule', {
        error: error.message,
        body: req.body,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/evergreen-rules
   * Get evergreen rules with pagination
   */
  async getEvergreenRules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { workspaceId, enabled, page, limit } = req.query;

      // Get rules
      const result = await EvergreenService.listRules(
        workspaceId as string,
        {
          enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 20,
        }
      );

      const totalPages = Math.ceil(result.total / result.limit);

      sendSuccess(
        res,
        {
          rules: result.rules.map((rule) => rule.toJSON()),
        },
        200,
        {
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages,
          },
        }
      );
    } catch (error: any) {
      logger.error('Failed to get evergreen rules', {
        error: error.message,
        query: req.query,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/evergreen-rules/:id
   * Get evergreen rule by ID
   */
  async getEvergreenRuleById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { workspaceId } = req.query;

      if (!workspaceId) {
        sendValidationError(res, [{ field: 'workspaceId', message: 'workspaceId is required' }]);
        return;
      }

      // Get rule
      const rule = await EvergreenService.getRule(id, workspaceId as string);

      if (!rule) {
        sendNotFound(res, 'Evergreen rule not found');
        return;
      }

      sendSuccess(res, rule.toJSON());
    } catch (error: any) {
      logger.error('Failed to get evergreen rule', {
        error: error.message,
        ruleId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * PUT /api/v1/evergreen-rules/:id
   * Update evergreen rule
   */
  async updateEvergreenRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { id } = req.params;
      const { 
        workspaceId, 
        repostInterval, 
        maxReposts, 
        contentModification, 
        enabled,
        paused,
        recyclingSchedule,
        minDaysBetweenRecycles,
        autoStopAfterPosts
      } = req.body;

      // Update rule
      const rule = await EvergreenService.updateRule(id, workspaceId, {
        repostInterval,
        maxReposts,
        enabled,
        paused,
        recyclingSchedule,
        minDaysBetweenRecycles,
        autoStopAfterPosts,
        contentModification,
      });

      if (!rule) {
        sendNotFound(res, 'Evergreen rule not found');
        return;
      }

      logger.info('Evergreen rule updated via API', {
        ruleId: id,
        workspaceId,
      });

      sendSuccess(res, rule.toJSON());
    } catch (error: any) {
      logger.error('Failed to update evergreen rule', {
        error: error.message,
        ruleId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * DELETE /api/v1/evergreen-rules/:id
   * Delete evergreen rule
   */
  async deleteEvergreenRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { workspaceId } = req.query;

      if (!workspaceId) {
        sendValidationError(res, [{ field: 'workspaceId', message: 'workspaceId is required' }]);
        return;
      }

      // Delete rule
      const deleted = await EvergreenService.deleteRule(id, workspaceId as string);

      if (!deleted) {
        sendNotFound(res, 'Evergreen rule not found');
        return;
      }

      logger.info('Evergreen rule deleted via API', {
        ruleId: id,
        workspaceId,
      });

      sendSuccess(res, { message: 'Evergreen rule deleted successfully' });
    } catch (error: any) {
      logger.error('Failed to delete evergreen rule', {
        error: error.message,
        ruleId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * POST /api/v1/evergreen-rules/:id/pause
   * Pause recycling for a specific rule
   */
  async pauseEvergreenRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { workspaceId } = req.body;

      if (!workspaceId) {
        sendValidationError(res, [{ field: 'workspaceId', message: 'workspaceId is required' }]);
        return;
      }

      const paused = await EvergreenService.pauseRule(id, workspaceId);

      if (!paused) {
        sendNotFound(res, 'Evergreen rule not found');
        return;
      }

      logger.info('Evergreen rule paused via API', { ruleId: id, workspaceId });
      sendSuccess(res, { message: 'Evergreen rule paused successfully' });
    } catch (error: any) {
      logger.error('Failed to pause evergreen rule', {
        error: error.message,
        ruleId: req.params.id,
      });
      next(error);
    }
  }

  /**
   * POST /api/v1/evergreen-rules/:id/resume
   * Resume recycling for a specific rule
   */
  async resumeEvergreenRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { workspaceId } = req.body;

      if (!workspaceId) {
        sendValidationError(res, [{ field: 'workspaceId', message: 'workspaceId is required' }]);
        return;
      }

      const resumed = await EvergreenService.resumeRule(id, workspaceId);

      if (!resumed) {
        sendNotFound(res, 'Evergreen rule not found');
        return;
      }

      logger.info('Evergreen rule resumed via API', { ruleId: id, workspaceId });
      sendSuccess(res, { message: 'Evergreen rule resumed successfully' });
    } catch (error: any) {
      logger.error('Failed to resume evergreen rule', {
        error: error.message,
        ruleId: req.params.id,
      });
      next(error);
    }
  }

  /**
   * GET /api/v1/evergreen-rules/:id/history
   * Get recycling history for a specific rule
   */
  async getRecyclingHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { workspaceId, page, limit } = req.query;

      if (!workspaceId) {
        sendValidationError(res, [{ field: 'workspaceId', message: 'workspaceId is required' }]);
        return;
      }

      const result = await EvergreenService.getRecyclingHistory(
        id,
        workspaceId as string,
        page ? parseInt(page as string) : 1,
        limit ? parseInt(limit as string) : 20
      );

      const totalPages = Math.ceil(result.total / result.limit);

      sendSuccess(
        res,
        { history: result.history },
        200,
        {
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages,
          },
        }
      );
    } catch (error: any) {
      logger.error('Failed to get recycling history', {
        error: error.message,
        ruleId: req.params.id,
      });
      next(error);
    }
  }

  /**
   * GET /api/v1/evergreen-library
   * Get evergreen content library view with performance metrics
   */
  async getEvergreenLibrary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId, page, limit, sortBy, sortOrder, performanceThreshold } = req.query;

      if (!workspaceId) {
        sendValidationError(res, [{ field: 'workspaceId', message: 'workspaceId is required' }]);
        return;
      }

      const result = await EvergreenService.getEvergreenLibrary(workspaceId as string, {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
        performanceThreshold: performanceThreshold ? parseFloat(performanceThreshold as string) : undefined,
      });

      const totalPages = Math.ceil(result.total / result.limit);

      sendSuccess(
        res,
        {
          rules: result.rules,
          topPerformers: result.topPerformers,
        },
        200,
        {
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages,
          },
        }
      );
    } catch (error: any) {
      logger.error('Failed to get evergreen library', {
        error: error.message,
        query: req.query,
      });
      next(error);
    }
  }

  /**
   * PUT /api/v1/evergreen-rules/:id/performance
   * Update performance metrics for a recycled post
   */
  async updatePerformanceMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { workspaceId, repostId, metrics } = req.body;

      if (!workspaceId) {
        sendValidationError(res, [{ field: 'workspaceId', message: 'workspaceId is required' }]);
        return;
      }

      if (!repostId) {
        sendValidationError(res, [{ field: 'repostId', message: 'repostId is required' }]);
        return;
      }

      if (!metrics) {
        sendValidationError(res, [{ field: 'metrics', message: 'metrics is required' }]);
        return;
      }

      const updated = await EvergreenService.updatePerformanceMetrics(id, workspaceId, repostId, metrics);

      if (!updated) {
        sendNotFound(res, 'Evergreen rule or repost not found');
        return;
      }

      logger.info('Performance metrics updated via API', { ruleId: id, workspaceId, repostId });
      sendSuccess(res, { message: 'Performance metrics updated successfully' });
    } catch (error: any) {
      logger.error('Failed to update performance metrics', {
        error: error.message,
        ruleId: req.params.id,
      });
      next(error);
    }
  }
}

export const evergreenController = new EvergreenController();
