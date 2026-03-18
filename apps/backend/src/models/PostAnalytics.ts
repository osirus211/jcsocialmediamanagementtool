/**
 * Post Analytics Model
 * 
 * Stores engagement metrics for published posts
 */

import mongoose, { Schema, Document } from 'mongoose';
import { calcEngagementRateWithSaves } from '../utils/engagementRate';

export interface IPostAnalytics extends Document {
  _id: mongoose.Types.ObjectId;
  postId: mongoose.Types.ObjectId;
  platform: string;
  socialAccountId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  
  // Engagement metrics
  likes: number;
  comments: number;
  shares: number;
  reach: number; // unique users reached
  impressions: number;
  saves?: number; // Instagram, LinkedIn
  retweets?: number; // Twitter
  views?: number; // TikTok, YouTube
  clicks: number;
  
  // Computed metrics
  engagementRate: number; // (likes + comments + shares + saves) / reach * 100
  performanceScore: number; // 0-100 weighted score vs account averages
  clickThroughRate?: number; // clicks / impressions * 100
  
  // Refresh tracking
  lastRefreshedAt?: Date;
  
  // ROI and attribution metrics
  linkClicks: number; // clicks from short links attributed to this post
  costPerClick?: number; // calculated: adSpend / linkClicks
  adSpend?: number; // manual input, cost of promoting this post
  estimatedRevenue?: number; // manual input or calculated from conversions
  roi?: number; // calculated: ((estimatedRevenue - adSpend) / adSpend) * 100
  
  // Collection metadata
  collectedAt: Date;
  collectionAttempt: number; // 1st, 2nd, 3rd collection
  
  // Platform-specific data
  platformData?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const PostAnalyticsSchema = new Schema<IPostAnalytics>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'ScheduledPost',
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube', 'threads'],
      index: true,
    },
    socialAccountId: {
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
    
    // Engagement metrics
    likes: {
      type: Number,
      default: 0,
    },
    comments: {
      type: Number,
      default: 0,
    },
    shares: {
      type: Number,
      default: 0,
    },
    reach: {
      type: Number,
      default: 0,
    },
    impressions: {
      type: Number,
      default: 0,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    saves: {
      type: Number,
      default: 0,
    },
    retweets: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    
    // Computed metrics
    engagementRate: {
      type: Number,
      default: 0,
    },
    performanceScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    clickThroughRate: {
      type: Number,
      default: 0,
    },
    
    // Refresh tracking
    lastRefreshedAt: {
      type: Date,
      index: true,
    },
    
    // ROI and attribution metrics
    linkClicks: {
      type: Number,
      default: 0,
    },
    costPerClick: {
      type: Number,
    },
    adSpend: {
      type: Number,
    },
    estimatedRevenue: {
      type: Number,
    },
    roi: {
      type: Number,
    },
    
    // Collection metadata
    collectedAt: {
      type: Date,
      required: true,
      index: true,
    },
    collectionAttempt: {
      type: Number,
      required: true,
      default: 1,
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

// Compound indexes
PostAnalyticsSchema.index({ postId: 1, collectedAt: -1 });
PostAnalyticsSchema.index({ workspaceId: 1, collectedAt: -1 });
PostAnalyticsSchema.index({ platform: 1, collectedAt: -1 });
PostAnalyticsSchema.index({ postId: 1, collectionAttempt: 1 }, { unique: true });
PostAnalyticsSchema.index({ workspaceId: 1, platform: 1, collectedAt: -1 }); // For platform-filtered analytics
PostAnalyticsSchema.index({ workspaceId: 1, postId: 1 }); // For post-level analytics lookup
PostAnalyticsSchema.index({ postId: 1, platform: 1 }); // For cross-platform post comparison

// Calculate engagement rate and performance score before saving
PostAnalyticsSchema.pre('save', function (next) {
  // Calculate engagement rate using reach (not impressions)
  if (this.reach > 0) {
    this.engagementRate = Number(calcEngagementRateWithSaves(
      this.likes, 
      this.comments, 
      this.shares, 
      this.saves || 0, 
      this.reach
    ).toFixed(2));
  } else {
    this.engagementRate = 0;
  }
  
  // Calculate click-through rate
  if (this.impressions > 0 && this.clicks > 0) {
    this.clickThroughRate = (this.clicks / this.impressions) * 100;
  }
  
  // Performance score will be calculated by service after account averages are known
  // This is just a placeholder - actual calculation happens in AnalyticsService
  
  // Calculate ROI metrics if data is available
  if (this.adSpend && this.adSpend > 0) {
    // Calculate cost per click
    if (this.linkClicks > 0) {
      this.costPerClick = this.adSpend / this.linkClicks;
    }
    
    // Calculate ROI if revenue is available
    if (this.estimatedRevenue !== undefined) {
      this.roi = ((this.estimatedRevenue - this.adSpend) / this.adSpend) * 100;
    }
  }
  
  next();
});

// Cleanup method (RULE 15)
PostAnalyticsSchema.statics.cleanup = async function() {
  try {
    const cutoffDate = new Date(Date.now() - MAX_POST_METRICS_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.deleteMany({
      collectedAt: { $lt: cutoffDate }
    });
    console.log(`Cleaned up ${result.deletedCount} old PostAnalytics records`);
    return result;
  } catch (error) {
    console.error('PostAnalytics cleanup failed:', error);
    throw error;
  }
};

export const PostAnalytics = mongoose.model<IPostAnalytics>('PostAnalytics', PostAnalyticsSchema);

// Storage limits
export const MAX_POST_METRICS_DAYS = 365;
