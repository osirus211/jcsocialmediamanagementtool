/**
 * Post Analytics Model
 * 
 * Stores engagement metrics for published posts
 */

import mongoose, { Schema, Document } from 'mongoose';

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
  impressions: number;
  clicks: number;
  saves?: number; // Instagram, LinkedIn
  retweets?: number; // Twitter
  views?: number; // TikTok, YouTube
  
  // Computed metrics
  engagementRate: number; // (likes + comments + shares) / impressions * 100
  clickThroughRate?: number; // clicks / impressions * 100
  
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
    clickThroughRate: {
      type: Number,
      default: 0,
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

// Calculate engagement rate before saving
PostAnalyticsSchema.pre('save', function (next) {
  if (this.impressions > 0) {
    const totalEngagement = this.likes + this.comments + this.shares;
    this.engagementRate = (totalEngagement / this.impressions) * 100;
    
    if (this.clicks > 0) {
      this.clickThroughRate = (this.clicks / this.impressions) * 100;
    }
  }
  next();
});

export const PostAnalytics = mongoose.model<IPostAnalytics>('PostAnalytics', PostAnalyticsSchema);
