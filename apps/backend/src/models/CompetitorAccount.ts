/**
 * Competitor Account Model
 * 
 * Stores competitor accounts that users want to track
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ICompetitorAccount extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  platform: string;
  handle: string;
  displayName?: string;
  profileUrl?: string;
  platformAccountId?: string; // Platform-specific ID if available
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  lastCollectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CompetitorAccountSchema = new Schema<ICompetitorAccount>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube', 'threads'],
      index: true,
    },
    handle: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
    },
    profileUrl: {
      type: String,
    },
    platformAccountId: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastCollectedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
CompetitorAccountSchema.index({ workspaceId: 1, platform: 1 });
CompetitorAccountSchema.index({ workspaceId: 1, isActive: 1 });

// Prevent duplicate competitors per workspace
CompetitorAccountSchema.index(
  { workspaceId: 1, platform: 1, handle: 1 },
  { unique: true }
);

export const CompetitorAccount = mongoose.model<ICompetitorAccount>('CompetitorAccount', CompetitorAccountSchema);
