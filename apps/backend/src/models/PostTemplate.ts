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
  },
  {
    timestamps: true,
  }
);

// Compound indexes
PostTemplateSchema.index({ workspaceId: 1, name: 1 });
PostTemplateSchema.index({ workspaceId: 1, createdAt: -1 });
PostTemplateSchema.index({ workspaceId: 1, usageCount: -1 });

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
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  },
};

export const PostTemplate = mongoose.model<IPostTemplate>('PostTemplate', PostTemplateSchema);
