/**
 * PostTemplate Controller
 * 
 * Handles post template operations
 */

import { Request, Response, NextFunction } from 'express';
import { postTemplateService } from '../services/PostTemplateService';
import { logger } from '../utils/logger';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

export class PostTemplateController {
  /**
   * Create template
   * POST /templates
   */
  async createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, content, hashtags, platforms, mediaIds } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId;

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (!userId) {
        throw new UnauthorizedError('User authentication required');
      }

      if (!name || !content) {
        throw new BadRequestError('Name and content are required');
      }

      const template = await postTemplateService.createTemplate({
        workspaceId,
        userId,
        name,
        content,
        hashtags,
        platforms,
        mediaIds,
      });

      res.status(201).json({
        success: true,
        data: template.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get templates
   * GET /templates
   */
  async getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const templates = await postTemplateService.getTemplates(workspaceId);

      res.status(200).json({
        success: true,
        data: templates.map(t => t.toJSON()),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get template by ID
   * GET /templates/:id
   */
  async getTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const template = await postTemplateService.getTemplateById(id, workspaceId);

      if (!template) {
        throw new BadRequestError('Template not found');
      }

      res.status(200).json({
        success: true,
        data: template.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update template
   * PATCH /templates/:id
   */
  async updateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { name, content, hashtags, platforms, mediaIds } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const template = await postTemplateService.updateTemplate(id, workspaceId, {
        name,
        content,
        hashtags,
        platforms,
        mediaIds,
      });

      res.status(200).json({
        success: true,
        data: template.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete template
   * DELETE /templates/:id
   */
  async deleteTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      await postTemplateService.deleteTemplate(id, workspaceId);

      res.status(200).json({
        success: true,
        message: 'Template deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Apply template
   * POST /templates/:id/apply
   */
  async applyTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const template = await postTemplateService.applyTemplate(id, workspaceId);

      res.status(200).json({
        success: true,
        data: template.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
}

export const postTemplateController = new PostTemplateController();
