/**
 * Mention Model
 * 
 * Stores social media mentions collected from listening rules
 * Retention: 90 days (auto-deleted after)
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IMention extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  listeningRuleId: mongoose.Types.ObjectId;
  platform: string;
  keyword: string; // The keyword/hashtag/competitor that triggered this mention
  
  // Author info
  author: {
    username: string;
    displayName?: string;
    profileUrl?: string;
    followerCount?: number;
  };
  
  // Content
  text: string;
  sourcePostId: string; // Platform-specific post ID
  sourceUrl?: string;
  
  // Engagement metrics
  engagementMetrics: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
  };
  
  // Sentiment (optional - can be added later)
  sentiment?: 'positive' | 'negative' | 'neutral';
  
  // Collection metadata
  collectedAt: Date;
  
  // Platform-specific data
  platformData?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const MentionSchema = new Schema<IMention>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    listeningRuleId: {
      type: Schema.Types.ObjectId,
      ref: 'ListeningRule',
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
    
    // Author info
    author: {
      username: {
        type: String,
        required: true,
      },
      displayName: String,
      profileUrl: String,
      followerCount: Number,
    },
    
    // Content
    text: {
      type: String,
      required: true,
    },
    sourcePostId: {
      type: String,
      required: true,
      index: true,
    },
    sourceUrl: String,
    
    // Engagement metrics
    engagementMetrics: {
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
      views: {
        type: Number,
        default: 0,
      },
    },
    
    // Sentiment
    sentiment: {
      type: String,
      enum: ['positive', 'negative', 'neutral'],
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
MentionSchema.index({ keyword: 1, platform: 1 });
MentionSchema.index({ workspaceId: 1, collectedAt: -1 });
MentionSchema.index({ listeningRuleId: 1, collectedAt: -1 });
MentionSchema.index({ collectedAt: -1 }); // For TTL cleanup

// Prevent duplicate mentions
MentionSchema.index(
  { platform: 1, sourcePostId: 1 },
  { unique: true }
);

// TTL index - automatically delete mentions older than 90 days
MentionSchema.index(
  { collectedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 } // 90 days in seconds
);

export const Mention = mongoose.model<IMention>('Mention', MentionSchema);
