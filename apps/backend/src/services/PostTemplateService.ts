/**
 * PostTemplate Service
 * 
 * Business logic for post template management
 */

import mongoose from 'mongoose';
import { PostTemplate, IPostTemplate } from '../models/PostTemplate';
import { SocialPlatform } from '../models/ScheduledPost';
import { logger } from '../utils/logger';
import { BadRequestError, NotFoundError } from '../utils/errors';

export interface CreateTemplateInput {
  workspaceId: string;
  userId: string;
  name: string;
  content: string;
  hashtags?: string[];
  platforms?: SocialPlatform[];
  mediaIds?: string[];
}

export interface UpdateTemplateInput {
  name?: string;
  content?: string;
  hashtags?: string[];
  platforms?: SocialPlatform[];
  mediaIds?: string[];
}

export class PostTemplateService {
  private static instance: PostTemplateService;

  private constructor() {}

  static getInstance(): PostTemplateService {
    if (!PostTemplateService.instance) {
      PostTemplateService.instance = new PostTemplateService();
    }
    return PostTemplateService.instance;
  }

  /**
   * Create a new template
   */
  async createTemplate(input: CreateTemplateInput): Promise<IPostTemplate> {
    try {
      const { workspaceId, userId, name, content, hashtags, platforms, mediaIds } = input;

      // Check for duplicate name
      const existingTemplate = await PostTemplate.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        name,
      });

      if (existingTemplate) {
        throw new BadRequestError('Template with this name already exists');
      }

      const template = await PostTemplate.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        name,
        content,
        hashtags: hashtags || [],
        platforms: platforms || [],
        mediaIds: mediaIds?.map(id => new mongoose.Types.ObjectId(id)) || [],
        createdBy: new mongoose.Types.ObjectId(userId),
        usageCount: 0,
      });

      logger.info('Post template created', {
        templateId: template._id.toString(),
        workspaceId,
        name,
      });

      return template;
    } catch (error: any) {
      logger.error('Failed to create post template', {
        workspaceId: input.workspaceId,
        name: input.name,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get templates for workspace
   */
  async getTemplates(workspaceId: string): Promise<IPostTemplate[]> {
    try {
      const templates = await PostTemplate.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      })
        .sort({ usageCount: -1, createdAt: -1 })
        .lean();

      return templates as unknown as IPostTemplate[];
    } catch (error: any) {
      logger.error('Failed to get post templates', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get post templates: ${error.message}`);
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string, workspaceId: string): Promise<IPostTemplate | null> {
    try {
      const template = await PostTemplate.findOne({
        _id: templateId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      return template;
    } catch (error: any) {
      logger.error('Failed to get template by ID', {
        templateId,
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get template: ${error.message}`);
    }
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    workspaceId: string,
    updates: UpdateTemplateInput
  ): Promise<IPostTemplate> {
    try {
      const template = await this.getTemplateById(templateId, workspaceId);

      if (!template) {
        throw new NotFoundError('Template not found');
      }

      // Check for duplicate name if changing
      if (updates.name && updates.name !== template.name) {
        const existingTemplate = await PostTemplate.findOne({
          _id: { $ne: templateId },
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          name: updates.name,
        });

        if (existingTemplate) {
          throw new BadRequestError('Template with this name already exists');
        }

        template.name = updates.name;
      }

      if (updates.content !== undefined) {
        template.content = updates.content;
      }

      if (updates.hashtags !== undefined) {
        template.hashtags = updates.hashtags;
      }

      if (updates.platforms !== undefined) {
        template.platforms = updates.platforms;
      }

      if (updates.mediaIds !== undefined) {
        template.mediaIds = updates.mediaIds.map(id => new mongoose.Types.ObjectId(id));
      }

      await template.save();

      logger.info('Post template updated', {
        templateId,
        workspaceId,
      });

      return template;
    } catch (error: any) {
      logger.error('Failed to update post template', {
        templateId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string, workspaceId: string): Promise<void> {
    try {
      const template = await this.getTemplateById(templateId, workspaceId);

      if (!template) {
        throw new NotFoundError('Template not found');
      }

      await PostTemplate.findByIdAndDelete(templateId);

      logger.info('Post template deleted', {
        templateId,
        workspaceId,
      });
    } catch (error: any) {
      logger.error('Failed to delete post template', {
        templateId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Apply template (increment usage count)
   */
  async applyTemplate(templateId: string, workspaceId: string): Promise<IPostTemplate> {
    try {
      const template = await PostTemplate.findOneAndUpdate(
        {
          _id: templateId,
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        {
          $inc: { usageCount: 1 },
          lastUsedAt: new Date(),
        },
        { new: true }
      );

      if (!template) {
        throw new NotFoundError('Template not found');
      }

      logger.info('Post template applied', {
        templateId,
        workspaceId,
        usageCount: template.usageCount,
      });

      return template;
    } catch (error: any) {
      logger.error('Failed to apply post template', {
        templateId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }
}

export const postTemplateService = PostTemplateService.getInstance();
