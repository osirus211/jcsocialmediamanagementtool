/**
 * Trend Metric Model
 * 
 * Stores calculated trend scores for keywords/hashtags
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ITrendMetric extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  platform: string;
  keyword: string;
  
  // Volume metrics
  postVolume: number; // Number of mentions in period
  postVolumeGrowth: number; // Growth percentage compared to previous period
  
  // Engagement metrics
  totalEngagement: number; // Sum of all engagement
  avgEngagement: number; // Average engagement per mention
  engagementVelocity: number; // Rate of engagement increase
  
  // Calculated trend score
  trendScore: number; // postVolumeGrowth × engagementVelocity
  
  // Time period
  periodStart: Date;
  periodEnd: Date;
  
  // Recording metadata
  recordedAt: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const TrendMetricSchema = new Schema<ITrendMetric>(
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
    keyword: {
      type: String,
      required: true,
      index: true,
    },
    
    // Volume metrics
    postVolume: {
      type: Number,
      required: true,
      default: 0,
    },
    postVolumeGrowth: {
      type: Number,
      required: true,
      default: 0,
    },
    
    // Engagement metrics
    totalEngagement: {
      type: Number,
      required: true,
      default: 0,
    },
    avgEngagement: {
      type: Number,
      required: true,
      default: 0,
    },
    engagementVelocity: {
      type: Number,
      required: true,
      default: 0,
    },
    
    // Calculated trend score
    trendScore: {
      type: Number,
      required: true,
      default: 0,
      index: true, // For sorting by trend score
    },
    
    // Time period
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    
    // Recording metadata
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
TrendMetricSchema.index({ workspaceId: 1, recordedAt: -1 });
TrendMetricSchema.index({ platform: 1, trendScore: -1 });
TrendMetricSchema.index({ keyword: 1, platform: 1, recordedAt: -1 });
TrendMetricSchema.index({ workspaceId: 1, platform: 1, trendScore: -1 });

export const TrendMetric = mongoose.model<ITrendMetric>('TrendMetric', TrendMetricSchema);
