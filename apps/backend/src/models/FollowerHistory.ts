/**
 * Follower History Model
 * 
 * Stores historical follower count snapshots for social accounts
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IFollowerHistory extends Document {
  _id: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  platform: string;
  followerCount: number;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FollowerHistorySchema = new Schema<IFollowerHistory>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'SocialAccount',
      required: true,
      index: true,
    },
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
    followerCount: {
      type: Number,
      required: true,
      default: 0,
    },
    recordedAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
FollowerHistorySchema.index({ accountId: 1, recordedAt: -1 });
FollowerHistorySchema.index({ workspaceId: 1, recordedAt: -1 });
FollowerHistorySchema.index({ accountId: 1, platform: 1, recordedAt: -1 });
FollowerHistorySchema.index({ workspaceId: 1, platform: 1, recordedAt: -1 }); // For workspace analytics by platform
FollowerHistorySchema.index({ platform: 1, recordedAt: -1 }); // For cross-workspace analytics

// Prevent duplicate snapshots for same account at same time
FollowerHistorySchema.index(
  { accountId: 1, recordedAt: 1 },
  { unique: true }
);

export const FollowerHistory = mongoose.model<IFollowerHistory>('FollowerHistory', FollowerHistorySchema);
