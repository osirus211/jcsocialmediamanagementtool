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
import { extractVariables, substituteVariables, VariableSubstitution } from '../utils/templateVariables';

export interface CreateTemplateInput {
  workspaceId: string;
  userId: string;
  name: string;
  content: string;
  hashtags?: string[];
  platforms?: SocialPlatform[];
  mediaIds?: string[];
  // New competitive features
  category?: string;
  variables?: string[];
  isPrebuilt?: boolean;
  industry?: string;
  rating?: number;
  isFavorite?: boolean;
  isPersonal?: boolean;
  tags?: string[];
  description?: string;
  previewImage?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  content?: string;
  hashtags?: string[];
  platforms?: SocialPlatform[];
  mediaIds?: string[];
  // New competitive features
  category?: string;
  variables?: string[];
  rating?: number;
  isFavorite?: boolean;
  isPersonal?: boolean;
  tags?: string[];
  description?: string;
  previewImage?: string;
}

export interface TemplateFilters {
  category?: string;
  industry?: string;
  platforms?: SocialPlatform[];
  isPrebuilt?: boolean;
  isFavorite?: boolean;
  isPersonal?: boolean;
  search?: string;
  tags?: string[];
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
      const { 
        workspaceId, 
        userId, 
        name, 
        content, 
        hashtags, 
        platforms, 
        mediaIds,
        category = 'general',
        variables,
        isPrebuilt = false,
        industry = 'general',
        rating = 0,
        isFavorite = false,
        isPersonal = false,
        tags = [],
        description,
        previewImage
      } = input;

      // Check for duplicate name
      const existingTemplate = await PostTemplate.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        name,
      });

      if (existingTemplate) {
        throw new BadRequestError('Template with this name already exists');
      }

      // Extract variables from content if not provided
      const extractedVariables = variables || extractVariables(content);

      const template = await PostTemplate.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        name,
        content,
        hashtags: hashtags || [],
        platforms: platforms || [],
        mediaIds: mediaIds?.map(id => new mongoose.Types.ObjectId(id)) || [],
        createdBy: new mongoose.Types.ObjectId(userId),
        usageCount: 0,
        // New competitive features
        category,
        variables: extractedVariables,
        isPrebuilt,
        industry,
        rating,
        isFavorite,
        isPersonal,
        tags,
        description,
        previewImage,
      });

      logger.info('Post template created', {
        templateId: template._id.toString(),
        workspaceId,
        name,
        category,
        variables: extractedVariables,
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
   * Get templates for workspace with advanced filtering
   */
  async getTemplates(workspaceId: string, filters?: TemplateFilters): Promise<IPostTemplate[]> {
    try {
      const query: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };

      // Apply filters
      if (filters) {
        if (filters.category) {
          query.category = filters.category;
        }
        if (filters.industry) {
          query.industry = filters.industry;
        }
        if (filters.platforms && filters.platforms.length > 0) {
          query.platforms = { $in: filters.platforms };
        }
        if (filters.isPrebuilt !== undefined) {
          query.isPrebuilt = filters.isPrebuilt;
        }
        if (filters.isFavorite !== undefined) {
          query.isFavorite = filters.isFavorite;
        }
        if (filters.isPersonal !== undefined) {
          query.isPersonal = filters.isPersonal;
        }
        if (filters.tags && filters.tags.length > 0) {
          query.tags = { $in: filters.tags };
        }
        if (filters.search) {
          query.$or = [
            { name: { $regex: filters.search, $options: 'i' } },
            { content: { $regex: filters.search, $options: 'i' } },
            { description: { $regex: filters.search, $options: 'i' } },
            { tags: { $in: [new RegExp(filters.search, 'i')] } },
          ];
        }
      }

      const templates = await PostTemplate.find(query)
        .sort({ 
          isFavorite: -1, // Favorites first
          rating: -1,     // Highest rated
          usageCount: -1, // Most used
          createdAt: -1   // Newest
        })
        .lean();

      return templates as unknown as IPostTemplate[];
    } catch (error: any) {
      logger.error('Failed to get post templates', {
        workspaceId,
        filters,
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
        // Re-extract variables when content changes
        template.variables = extractVariables(updates.content);
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

      // New competitive features
      if (updates.category !== undefined) {
        template.category = updates.category;
      }

      if (updates.rating !== undefined) {
        template.rating = updates.rating;
      }

      if (updates.isFavorite !== undefined) {
        template.isFavorite = updates.isFavorite;
      }

      if (updates.isPersonal !== undefined) {
        template.isPersonal = updates.isPersonal;
      }

      if (updates.tags !== undefined) {
        template.tags = updates.tags;
      }

      if (updates.description !== undefined) {
        template.description = updates.description;
      }

      if (updates.previewImage !== undefined) {
        template.previewImage = updates.previewImage;
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

  /**
   * Apply template with variable substitution
   */
  async applyTemplateWithVariables(
    templateId: string, 
    workspaceId: string, 
    substitutions: VariableSubstitution
  ): Promise<{ template: IPostTemplate; processedContent: string }> {
    try {
      const template = await this.applyTemplate(templateId, workspaceId);
      const processedContent = substituteVariables(template.content, substitutions);

      return {
        template,
        processedContent,
      };
    } catch (error: any) {
      logger.error('Failed to apply template with variables', {
        templateId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get template categories
   */
  async getCategories(workspaceId: string): Promise<string[]> {
    try {
      const categories = await PostTemplate.distinct('category', {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      return categories.filter(Boolean);
    } catch (error: any) {
      logger.error('Failed to get template categories', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get template categories: ${error.message}`);
    }
  }

  /**
   * Get template tags
   */
  async getTags(workspaceId: string): Promise<string[]> {
    try {
      const tags = await PostTemplate.distinct('tags', {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      return tags.filter(Boolean);
    } catch (error: any) {
      logger.error('Failed to get template tags', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get template tags: ${error.message}`);
    }
  }

  /**
   * Duplicate template
   */
  async duplicateTemplate(templateId: string, workspaceId: string, newName: string): Promise<IPostTemplate> {
    try {
      const originalTemplate = await this.getTemplateById(templateId, workspaceId);

      if (!originalTemplate) {
        throw new NotFoundError('Template not found');
      }

      const duplicatedTemplate = await PostTemplate.create({
        workspaceId: originalTemplate.workspaceId,
        name: newName,
        content: originalTemplate.content,
        hashtags: originalTemplate.hashtags,
        platforms: originalTemplate.platforms,
        mediaIds: originalTemplate.mediaIds,
        createdBy: originalTemplate.createdBy,
        category: originalTemplate.category,
        variables: originalTemplate.variables,
        isPrebuilt: false, // Duplicated templates are never pre-built
        industry: originalTemplate.industry,
        rating: 0, // Reset rating for duplicated template
        isFavorite: false, // Reset favorite status
        isPersonal: originalTemplate.isPersonal,
        tags: originalTemplate.tags,
        description: originalTemplate.description,
        previewImage: originalTemplate.previewImage,
        usageCount: 0,
      });

      logger.info('Post template duplicated', {
        originalTemplateId: templateId,
        newTemplateId: duplicatedTemplate._id.toString(),
        workspaceId,
        newName,
      });

      return duplicatedTemplate;
    } catch (error: any) {
      logger.error('Failed to duplicate post template', {
        templateId,
        workspaceId,
        newName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get AI template suggestions based on content
   */
  async getAISuggestions(workspaceId: string, content: string, limit: number = 5): Promise<IPostTemplate[]> {
    try {
      // Simple keyword-based matching for now
      // In production, this would use AI/ML for semantic similarity
      const keywords = content.toLowerCase().split(/\s+/).filter(word => word.length > 3);
      
      if (keywords.length === 0) {
        return [];
      }

      const suggestions = await PostTemplate.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        $or: [
          { content: { $regex: keywords.join('|'), $options: 'i' } },
          { tags: { $in: keywords } },
          { name: { $regex: keywords.join('|'), $options: 'i' } },
        ],
      })
        .sort({ usageCount: -1, rating: -1 })
        .limit(limit)
        .lean();

      return suggestions as unknown as IPostTemplate[];
    } catch (error: any) {
      logger.error('Failed to get AI template suggestions', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get AI template suggestions: ${error.message}`);
    }
  }
}

export const postTemplateService = PostTemplateService.getInstance();
