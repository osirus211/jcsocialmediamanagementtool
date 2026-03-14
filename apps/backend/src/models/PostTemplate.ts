/**
 * PostTemplate Model
 * 
 * Stores reusable post templates for content creation
 */

import mongoose, { Schema, Document } from 'mongoose';
import { SocialPlatform } from './ScheduledPost';

export interface IPostTemplate extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  content: string;
  hashtags?: string[];
  platforms: SocialPlatform[];
  mediaIds?: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  usageCount: number;
  lastUsedAt?: Date;
  // New competitive features
  category: string;
  variables: string[]; // Array of variable names like ['brand_name', 'product', 'cta']
  isPrebuilt: boolean; // Pre-built template library
  industry?: string; // ecommerce, saas, agency, etc.
  rating: number; // 0-5 star rating
  isFavorite: boolean; // User favorite
  isPersonal: boolean; // Personal vs workspace-wide
  tags: string[]; // Search tags
  description?: string; // Template description
  previewImage?: string; // Template preview
  createdAt: Date;
  updatedAt: Date;
}

const PostTemplateSchema = new Schema<IPostTemplate>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    hashtags: {
      type: [String],
      default: [],
    },
    platforms: {
      type: [String],
      enum: Object.values(SocialPlatform),
      default: [],
    },
    mediaIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Media',
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
    },
    // New competitive features
    category: {
      type: String,
      required: true,
      default: 'general',
      index: true,
    },
    variables: {
      type: [String],
      default: [],
    },
    isPrebuilt: {
      type: Boolean,
      default: false,
      index: true,
    },
    industry: {
      type: String,
      enum: ['ecommerce', 'saas', 'agency', 'healthcare', 'education', 'finance', 'real-estate', 'restaurant', 'fitness', 'beauty', 'travel', 'nonprofit', 'general'],
      default: 'general',
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    isPersonal: {
      type: Boolean,
      default: false,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      maxlength: 500,
    },
    previewImage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
PostTemplateSchema.index({ workspaceId: 1, name: 1 });
PostTemplateSchema.index({ workspaceId: 1, createdAt: -1 });
PostTemplateSchema.index({ workspaceId: 1, usageCount: -1 });
PostTemplateSchema.index({ workspaceId: 1, category: 1 });
PostTemplateSchema.index({ workspaceId: 1, isPrebuilt: 1 });
PostTemplateSchema.index({ workspaceId: 1, industry: 1 });
PostTemplateSchema.index({ workspaceId: 1, rating: -1 });
PostTemplateSchema.index({ workspaceId: 1, isFavorite: 1 });
PostTemplateSchema.index({ workspaceId: 1, isPersonal: 1 });
PostTemplateSchema.index({ workspaceId: 1, tags: 1 });

/**
 * Instance Methods
 */
PostTemplateSchema.methods = {
  /**
   * Convert to safe object for API responses
   */
  toJSON(): any {
    const obj = this.toObject();
    return {
      id: obj._id.toString(),
      workspaceId: obj.workspaceId.toString(),
      name: obj.name,
      content: obj.content,
      hashtags: obj.hashtags || [],
      platforms: obj.platforms,
      mediaIds: obj.mediaIds?.map((id: mongoose.Types.ObjectId) => id.toString()) || [],
      createdBy: obj.createdBy.toString(),
      usageCount: obj.usageCount,
      lastUsedAt: obj.lastUsedAt,
      // New competitive features
      category: obj.category,
      variables: obj.variables || [],
      isPrebuilt: obj.isPrebuilt,
      industry: obj.industry,
      rating: obj.rating,
      isFavorite: obj.isFavorite,
      isPersonal: obj.isPersonal,
      tags: obj.tags || [],
      description: obj.description,
      previewImage: obj.previewImage,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  },
};

export const PostTemplate = mongoose.model<IPostTemplate>('PostTemplate', PostTemplateSchema);
