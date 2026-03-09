/**
 * Competitor Metrics Model
 * 
 * Stores historical metrics snapshots for competitor accounts
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ICompetitorMetrics extends Document {
  _id: mongoose.Types.ObjectId;
  competitorId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  platform: string;
  
  // Metrics
  followerCount: number;
  followingCount?: number;
  postCount?: number;
  engagementRate?: number;
  avgLikes?: number;
  avgComments?: number;
  avgShares?: number;
  
  // Collection metadata
  collectedAt: Date;
  
  // Platform-specific data
  platformData?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const CompetitorMetricsSchema = new Schema<ICompetitorMetrics>(
  {
    competitorId: {
      type: Schema.Types.ObjectId,
      ref: 'CompetitorAccount',
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
    
    // Metrics
    followerCount: {
      type: Number,
      required: true,
      default: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
    },
    postCount: {
      type: Number,
      default: 0,
    },
    engagementRate: {
      type: Number,
      default: 0,
    },
    avgLikes: {
      type: Number,
      default: 0,
    },
    avgComments: {
      type: Number,
      default: 0,
    },
    avgShares: {
      type: Number,
      default: 0,
    },
    
    // Collection metadata
    collectedAt: {
      type: Date,
      required: true,
      index: true,
    },
    
    // Platform-specific data
    platformData: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
CompetitorMetricsSchema.index({ competitorId: 1, collectedAt: -1 });
CompetitorMetricsSchema.index({ workspaceId: 1, collectedAt: -1 });
CompetitorMetricsSchema.index({ competitorId: 1, platform: 1, collectedAt: -1 });

export const CompetitorMetrics = mongoose.model<ICompetitorMetrics>('CompetitorMetrics', CompetitorMetricsSchema);
