/**
 * Listening Rule Model
 * 
 * Stores social listening rules for keyword, hashtag, and competitor monitoring
 */

import mongoose, { Schema, Document } from 'mongoose';

export enum ListeningRuleType {
  KEYWORD = 'keyword',
  HASHTAG = 'hashtag',
  COMPETITOR = 'competitor',
}

export interface IListeningRule extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  platform: string;
  type: ListeningRuleType;
  value: string; // keyword, hashtag, or competitor handle
  createdBy: mongoose.Types.ObjectId;
  active: boolean;
  lastCollectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ListeningRuleSchema = new Schema<IListeningRule>(
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
    type: {
      type: String,
      required: true,
      enum: Object.values(ListeningRuleType),
      index: true,
    },
    value: {
      type: String,
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    active: {
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

// Compound indexes for efficient queries
ListeningRuleSchema.index({ workspaceId: 1, platform: 1 });
ListeningRuleSchema.index({ workspaceId: 1, active: 1 });
ListeningRuleSchema.index({ value: 1, platform: 1 });
ListeningRuleSchema.index({ platform: 1, type: 1, active: 1 });

// Prevent duplicate rules per workspace
ListeningRuleSchema.index(
  { workspaceId: 1, platform: 1, type: 1, value: 1 },
  { unique: true }
);

export const ListeningRule = mongoose.model<IListeningRule>('ListeningRule', ListeningRuleSchema);
