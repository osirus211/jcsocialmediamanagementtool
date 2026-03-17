/**
 * Hashtag Analytics Model
 * 
 * Stores performance metrics for hashtags used in posts
 */

import mongoose, { Schema, Document } from 'mongoose';

// Storage limits (RULE 15)
export const MAX_HASHTAG_ANALYTICS_DAYS = 365;

export interface IHashtagAnalytics extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  hashtag: string; // without # symbol
  platform: string;
  
  // Usage metrics
  usageCount: number; // how many times used
  totalReach: number; // sum of reach from all posts using this hashtag
  totalImpressions: number;
  totalEngagement: number; // likes + comments + shares + saves
  
  // Performance metrics
  avgEngagementRate: number; // average across all posts using this hashtag
  avgReach: number;
  avgImpressions: number;
  bestPerformingPostId?: mongoose.Types.ObjectId;
  
  // Trend data
  trendScore: number; // 0-100, calculated based on recent performance
  isRising: boolean; // trending up or down
  
  // Time period
  periodStart: Date;
  periodEnd: Date;
  
  // Metadata
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // soft delete
}

const HashtagAnalyticsSchema = new Schema<IHashtagAnalytics>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    hashtag: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube', 'threads'],
      index: true,
    },
    
    // Usage metrics
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalReach: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalImpressions: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEngagement: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Performance metrics
    avgEngagementRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgReach: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgImpressions: {
      type: Number,
      default: 0,
      min: 0,
    },
    bestPerformingPostId: {
      type: Schema.Types.ObjectId,
      ref: 'ScheduledPost',
    },
    
    // Trend data
    trendScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isRising: {
      type: Boolean,
      default: false,
    },
    
    // Time period
    periodStart: {
      type: Date,
      required: true,
      index: true,
    },
    periodEnd: {
      type: Date,
      required: true,
      index: true,
    },
    
    // Metadata
    lastUpdated: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deletedAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
HashtagAnalyticsSchema.index({ workspaceId: 1, hashtag: 1, platform: 1, periodStart: -1 });
HashtagAnalyticsSchema.index({ workspaceId: 1, platform: 1, trendScore: -1 }); // Top hashtags by platform
HashtagAnalyticsSchema.index({ workspaceId: 1, avgEngagementRate: -1 }); // Best performing hashtags
HashtagAnalyticsSchema.index({ workspaceId: 1, usageCount: -1 }); // Most used hashtags
HashtagAnalyticsSchema.index({ hashtag: 1, platform: 1, periodStart: -1 }); // Cross-workspace hashtag trends
HashtagAnalyticsSchema.index({ deletedAt: 1 }); // Soft delete queries

// Unique constraint to prevent duplicate hashtag analytics for same period
HashtagAnalyticsSchema.index(
  { workspaceId: 1, hashtag: 1, platform: 1, periodStart: 1, periodEnd: 1 },
  { unique: true }
);

// Cleanup method (RULE 15)
HashtagAnalyticsSchema.statics.cleanup = async function() {
  try {
    const cutoffDate = new Date(Date.now() - MAX_HASHTAG_ANALYTICS_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.deleteMany({
      periodStart: { $lt: cutoffDate }
    });
    console.log(`Cleaned up ${result.deletedCount} old HashtagAnalytics records`);
    return result;
  } catch (error) {
    console.error('HashtagAnalytics cleanup failed:', error);
    throw error;
  }
};

export const HashtagAnalytics = mongoose.model<IHashtagAnalytics>('HashtagAnalytics', HashtagAnalyticsSchema);
