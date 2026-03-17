/**
 * Competitor Analytics Model
 * 
 * Stores daily snapshots of competitor account metrics
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ICompetitorAnalytics extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  competitorName: string;
  platform: string;
  accountHandle: string; // @username or account identifier
  accountUrl?: string;
  
  // Follower metrics
  followerCount: number;
  followingCount: number;
  followerGrowth: number; // change since last snapshot
  followerGrowthRate: number; // percentage change
  
  // Content metrics
  postsCount: number;
  postsToday: number; // posts published today
  avgPostsPerDay: number; // rolling 30-day average
  
  // Engagement metrics
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgEngagementRate: number;
  
  // Top content analysis
  topPostId?: string; // platform-specific post ID
  topPostEngagement?: number;
  topPostType?: string; // image, video, carousel, etc.
  
  // Hashtag analysis
  topHashtags: string[]; // most used hashtags (last 30 days)
  hashtagCount: number; // average hashtags per post
  
  // Posting patterns
  bestPostingHour?: number; // 0-23, when they get most engagement
  bestPostingDay?: number; // 0-6, Sunday = 0
  postingFrequency: string; // daily, weekly, etc.
  
  // Snapshot metadata
  snapshotDate: Date;
  dataCollectedAt: Date;
  
  // Comparison metrics (vs our account)
  followerRatio?: number; // their followers / our followers
  engagementRatio?: number; // their engagement / our engagement
  
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // soft delete
}

const CompetitorAnalyticsSchema = new Schema<ICompetitorAnalytics>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    competitorName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube', 'threads'],
      index: true,
    },
    accountHandle: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    accountUrl: {
      type: String,
      trim: true,
    },
    
    // Follower metrics
    followerCount: {
      type: Number,
      required: true,
      min: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    followerGrowth: {
      type: Number,
      default: 0,
    },
    followerGrowthRate: {
      type: Number,
      default: 0,
    },
    
    // Content metrics
    postsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    postsToday: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgPostsPerDay: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Engagement metrics
    avgLikes: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgComments: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgShares: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgEngagementRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Top content analysis
    topPostId: {
      type: String,
    },
    topPostEngagement: {
      type: Number,
      min: 0,
    },
    topPostType: {
      type: String,
      enum: ['image', 'video', 'carousel', 'text', 'story', 'reel', 'live'],
    },
    
    // Hashtag analysis
    topHashtags: {
      type: [String],
      default: [],
    },
    hashtagCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Posting patterns
    bestPostingHour: {
      type: Number,
      min: 0,
      max: 23,
    },
    bestPostingDay: {
      type: Number,
      min: 0,
      max: 6,
    },
    postingFrequency: {
      type: String,
      enum: ['multiple_daily', 'daily', 'few_times_week', 'weekly', 'few_times_month', 'monthly', 'irregular'],
      default: 'irregular',
    },
    
    // Snapshot metadata
    snapshotDate: {
      type: Date,
      required: true,
      index: true,
    },
    dataCollectedAt: {
      type: Date,
      default: Date.now,
    },
    
    // Comparison metrics
    followerRatio: {
      type: Number,
      min: 0,
    },
    engagementRatio: {
      type: Number,
      min: 0,
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
CompetitorAnalyticsSchema.index({ workspaceId: 1, competitorName: 1, platform: 1, snapshotDate: -1 });
CompetitorAnalyticsSchema.index({ workspaceId: 1, platform: 1, followerCount: -1 }); // Top competitors by followers
CompetitorAnalyticsSchema.index({ workspaceId: 1, platform: 1, avgEngagementRate: -1 }); // Top competitors by engagement
CompetitorAnalyticsSchema.index({ workspaceId: 1, snapshotDate: -1 }); // Latest snapshots
CompetitorAnalyticsSchema.index({ competitorName: 1, platform: 1, snapshotDate: -1 }); // Competitor history
CompetitorAnalyticsSchema.index({ deletedAt: 1 }); // Soft delete queries

// Unique constraint to prevent duplicate snapshots for same competitor on same date
CompetitorAnalyticsSchema.index(
  { workspaceId: 1, competitorName: 1, platform: 1, snapshotDate: 1 },
  { unique: true }
);

export const CompetitorAnalytics = mongoose.model<ICompetitorAnalytics>('CompetitorAnalytics', CompetitorAnalyticsSchema);
