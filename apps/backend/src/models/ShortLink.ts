/**
 * ShortLink Model
 * 
 * Shortened URLs with click tracking
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IShortLink extends Document {
  _id: mongoose.Types.ObjectId;
  originalUrl: string;
  shortCode: string;
  workspaceId: mongoose.Types.ObjectId;
  postId?: mongoose.Types.ObjectId;
  platform?: string;
  clicks: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  expiresAt?: Date;
}

const ShortLinkSchema = new Schema<IShortLink>(
  {
    originalUrl: {
      type: String,
      required: true,
      trim: true,
    },
    shortCode: {
      type: String,
      required: true,
      unique: true,
      length: 8,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    platform: {
      type: String,
      enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'threads', 'google-business'],
    },
    clicks: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for workspace queries
ShortLinkSchema.index({ workspaceId: 1, createdAt: -1 });

// TTL index for expiration
ShortLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ShortLink = mongoose.model<IShortLink>('ShortLink', ShortLinkSchema);
