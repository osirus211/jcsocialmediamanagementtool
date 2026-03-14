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
      const { 
        name, 
        content, 
        hashtags, 
        platforms, 
        mediaIds,
        category,
        variables,
        isPrebuilt,
        industry,
        rating,
        isFavorite,
        isPersonal,
        tags,
        description,
        previewImage
      } = req.body;
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
        category,
        variables,
        isPrebuilt,
        industry,
        rating,
        isFavorite,
        isPersonal,
        tags,
        description,
        previewImage,
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

      // Parse query filters
      const filters: any = {};
      
      if (req.query.category) {
        filters.category = req.query.category as string;
      }
      
      if (req.query.industry) {
        filters.industry = req.query.industry as string;
      }
      
      if (req.query.platforms) {
        const platforms = Array.isArray(req.query.platforms) 
          ? req.query.platforms 
          : [req.query.platforms];
        filters.platforms = platforms;
      }
      
      if (req.query.isPrebuilt !== undefined) {
        filters.isPrebuilt = req.query.isPrebuilt === 'true';
      }
      
      if (req.query.isFavorite !== undefined) {
        filters.isFavorite = req.query.isFavorite === 'true';
      }
      
      if (req.query.isPersonal !== undefined) {
        filters.isPersonal = req.query.isPersonal === 'true';
      }
      
      if (req.query.search) {
        filters.search = req.query.search as string;
      }
      
      if (req.query.tags) {
        const tags = Array.isArray(req.query.tags) 
          ? req.query.tags 
          : [req.query.tags];
        filters.tags = tags;
      }

      const templates = await postTemplateService.getTemplates(workspaceId, filters);

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
      const { 
        name, 
        content, 
        hashtags, 
        platforms, 
        mediaIds,
        category,
        rating,
        isFavorite,
        isPersonal,
        tags,
        description,
        previewImage
      } = req.body;
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
        category,
        rating,
        isFavorite,
        isPersonal,
        tags,
        description,
        previewImage,
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
      const { variables } = req.body; // Optional variable substitutions
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (variables && typeof variables === 'object') {
        // Apply template with variable substitution
        const result = await postTemplateService.applyTemplateWithVariables(id, workspaceId, variables);
        
        res.status(200).json({
          success: true,
          data: {
            ...result.template.toJSON(),
            processedContent: result.processedContent,
          },
        });
      } else {
        // Apply template without variable substitution
        const template = await postTemplateService.applyTemplate(id, workspaceId);

        res.status(200).json({
          success: true,
          data: template.toJSON(),
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get template categories
   * GET /templates/categories
   */
  async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const categories = await postTemplateService.getCategories(workspaceId);

      res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get template tags
   * GET /templates/tags
   */
  async getTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const tags = await postTemplateService.getTags(workspaceId);

      res.status(200).json({
        success: true,
        data: tags,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Duplicate template
   * POST /templates/:id/duplicate
   */
  async duplicateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (!name) {
        throw new BadRequestError('Name is required for duplicated template');
      }

      const template = await postTemplateService.duplicateTemplate(id, workspaceId, name);

      res.status(201).json({
        success: true,
        data: template.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get AI template suggestions
   * POST /templates/suggestions
   */
  async getAISuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, limit = 5 } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (!content) {
        throw new BadRequestError('Content is required for AI suggestions');
      }

      const suggestions = await postTemplateService.getAISuggestions(workspaceId, content, limit);

      res.status(200).json({
        success: true,
        data: suggestions.map(t => t.toJSON()),
      });
    } catch (error) {
      next(error);
    }
  }
}

export const postTemplateController = new PostTemplateController();
