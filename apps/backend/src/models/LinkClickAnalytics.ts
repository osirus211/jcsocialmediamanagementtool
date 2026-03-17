/**
 * Link Click Analytics Model
 * 
 * Tracks clicks on links in social media posts for attribution and ROI analysis
 */

import mongoose, { Schema, Document } from 'mongoose';

// Storage limits (RULE 15)
export const MAX_LINK_CLICKS_DAYS = 90;

export interface ILinkClickAnalytics extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  postId?: mongoose.Types.ObjectId; // optional, for post attribution
  campaignId?: mongoose.Types.ObjectId; // optional, for campaign attribution
  
  // Link details
  originalUrl: string; // the actual destination URL
  shortUrl?: string; // shortened URL used in post (bit.ly, etc.)
  linkId: string; // unique identifier for this link
  
  // Click data
  clickCount: number;
  uniqueClicks: number; // deduplicated by IP/user
  
  // Attribution data
  platform: string; // where the click originated
  referrer?: string; // referring domain/platform
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  
  // Geographic data
  country?: string;
  region?: string;
  city?: string;
  
  // Device data
  device?: string; // mobile, desktop, tablet
  browser?: string;
  os?: string;
  
  // Timing data
  clickedAt: Date;
  hourOfDay: number; // 0-23
  dayOfWeek: number; // 0-6, Sunday = 0
  
  // Conversion tracking
  conversionValue?: number; // revenue attributed to this click
  conversionType?: string; // purchase, signup, download, etc.
  convertedAt?: Date;
  
  // User data (anonymized)
  userAgent?: string;
  ipHash?: string; // hashed IP for privacy
  sessionId?: string;
  
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // soft delete
}

const LinkClickAnalyticsSchema = new Schema<ILinkClickAnalytics>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'ScheduledPost',
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true,
    },
    
    // Link details
    originalUrl: {
      type: String,
      required: true,
      trim: true,
    },
    shortUrl: {
      type: String,
      trim: true,
      index: true,
    },
    linkId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    
    // Click data
    clickCount: {
      type: Number,
      default: 1,
      min: 0,
    },
    uniqueClicks: {
      type: Number,
      default: 1,
      min: 0,
    },
    
    // Attribution data
    platform: {
      type: String,
      required: true,
      enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube', 'threads', 'direct', 'email', 'other'],
      index: true,
    },
    referrer: {
      type: String,
      trim: true,
    },
    utmSource: {
      type: String,
      trim: true,
      index: true,
    },
    utmMedium: {
      type: String,
      trim: true,
      index: true,
    },
    utmCampaign: {
      type: String,
      trim: true,
      index: true,
    },
    utmContent: {
      type: String,
      trim: true,
    },
    utmTerm: {
      type: String,
      trim: true,
    },
    
    // Geographic data
    country: {
      type: String,
      trim: true,
      index: true,
    },
    region: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    
    // Device data
    device: {
      type: String,
      enum: ['mobile', 'desktop', 'tablet', 'unknown'],
      default: 'unknown',
      index: true,
    },
    browser: {
      type: String,
      trim: true,
    },
    os: {
      type: String,
      trim: true,
    },
    
    // Timing data
    clickedAt: {
      type: Date,
      required: true,
      index: true,
    },
    hourOfDay: {
      type: Number,
      required: true,
      min: 0,
      max: 23,
      index: true,
    },
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
      index: true,
    },
    
    // Conversion tracking
    conversionValue: {
      type: Number,
      min: 0,
    },
    conversionType: {
      type: String,
      enum: ['purchase', 'signup', 'download', 'subscription', 'lead', 'view', 'other'],
    },
    convertedAt: {
      type: Date,
    },
    
    // User data (anonymized)
    userAgent: {
      type: String,
    },
    ipHash: {
      type: String,
      index: true,
    },
    sessionId: {
      type: String,
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

// Compound indexes for analytics queries
LinkClickAnalyticsSchema.index({ workspaceId: 1, clickedAt: -1 }); // Recent clicks
LinkClickAnalyticsSchema.index({ workspaceId: 1, postId: 1, clickedAt: -1 }); // Post attribution
LinkClickAnalyticsSchema.index({ workspaceId: 1, campaignId: 1, clickedAt: -1 }); // Campaign attribution
LinkClickAnalyticsSchema.index({ workspaceId: 1, platform: 1, clickedAt: -1 }); // Platform performance
LinkClickAnalyticsSchema.index({ workspaceId: 1, country: 1, clickedAt: -1 }); // Geographic analysis
LinkClickAnalyticsSchema.index({ workspaceId: 1, device: 1, clickedAt: -1 }); // Device analysis
LinkClickAnalyticsSchema.index({ linkId: 1, clickedAt: -1 }); // Link performance
LinkClickAnalyticsSchema.index({ workspaceId: 1, utmCampaign: 1, clickedAt: -1 }); // UTM campaign tracking
LinkClickAnalyticsSchema.index({ workspaceId: 1, conversionType: 1, convertedAt: -1 }); // Conversion analysis
LinkClickAnalyticsSchema.index({ deletedAt: 1 }); // Soft delete queries

// Pre-save middleware to calculate timing fields
LinkClickAnalyticsSchema.pre('save', function (next) {
  if (this.clickedAt) {
    const date = new Date(this.clickedAt);
    this.hourOfDay = date.getHours();
    this.dayOfWeek = date.getDay();
  }
  next();
});

// Cleanup method (RULE 15)
LinkClickAnalyticsSchema.statics.cleanup = async function() {
  try {
    const cutoffDate = new Date(Date.now() - MAX_LINK_CLICKS_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.deleteMany({
      clickedAt: { $lt: cutoffDate }
    });
    console.log(`Cleaned up ${result.deletedCount} old LinkClickAnalytics records`);
    return result;
  } catch (error) {
    console.error('LinkClickAnalytics cleanup failed:', error);
    throw error;
  }
};

export const LinkClickAnalytics = mongoose.model<ILinkClickAnalytics>('LinkClickAnalytics', LinkClickAnalyticsSchema);
