/**
 * Workspace Member Blocklist Model
 * 
 * Tracks users who have been removed from workspaces
 * to immediately revoke their access
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkspaceMemberBlocklist extends Document {
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  removedAt: Date;
  removedBy: mongoose.Types.ObjectId;
  reason?: string;
}

const WorkspaceMemberBlocklistSchema = new Schema<IWorkspaceMemberBlocklist>(
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
    removedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    removedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast lookups
WorkspaceMemberBlocklistSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

// TTL index to auto-delete old entries after 90 days (optional)
WorkspaceMemberBlocklistSchema.index({ removedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const WorkspaceMemberBlocklist = mongoose.model<IWorkspaceMemberBlocklist>(
  'WorkspaceMemberBlocklist',
  WorkspaceMemberBlocklistSchema
);
