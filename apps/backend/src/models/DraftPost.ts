/**
 * Draft Post Model
 * 
 * Stores draft posts before they are scheduled
 */

import mongoose, { Schema, Document } from 'mongoose';
import { SocialPlatform } from './ScheduledPost';

export interface IDraftPost extends Document {
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title?: string;
  content: string;
  platforms: SocialPlatform[];
  socialAccountIds: mongoose.Types.ObjectId[];
  mediaUrls?: string[];
  mediaIds?: mongoose.Types.ObjectId[];
  scheduledAt?: Date;
  metadata?: {
    tags?: string[];
    notes?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DraftPostSchema = new Schema<IDraftPost>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    platforms: {
      type: [String],
      enum: Object.values(SocialPlatform),
      default: [],
    },
    socialAccountIds: {
      type: [Schema.Types.ObjectId],
      ref: 'SocialAccount',
      default: [],
    },
    mediaUrls: {
      type: [String],
      default: [],
    },
    mediaIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Media',
      default: [],
    },
    scheduledAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
DraftPostSchema.index({ workspaceId: 1, createdAt: -1 });
DraftPostSchema.index({ workspaceId: 1, userId: 1 });
DraftPostSchema.index({ userId: 1, updatedAt: -1 });

export const DraftPost = mongoose.model<IDraftPost>('DraftPost', DraftPostSchema);
