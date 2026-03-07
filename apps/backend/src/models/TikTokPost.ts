import mongoose, { Schema, Document } from 'mongoose';

/**
 * TikTok Post Model
 * 
 * Stores TikTok post data including video information, publishing status, and analytics
 * 
 * Features:
 * - Multi-tenant (workspace-scoped)
 * - Video upload tracking
 * - Scheduling support
 * - Retry mechanism
 * - Analytics collection
 * - Privacy and content settings
 */

export enum TikTokPublishStatus {
  DRAFT = 'draft',
  UPLOADING = 'uploading',
  SCHEDULED = 'scheduled',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

export enum TikTokPrivacyLevel {
  PUBLIC_TO_EVERYONE = 'PUBLIC_TO_EVERYONE',
  MUTUAL_FOLLOW_FRIENDS = 'MUTUAL_FOLLOW_FRIENDS',
  SELF_ONLY = 'SELF_ONLY',
}

export interface ITikTokPost extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  socialAccountId: mongoose.Types.ObjectId;
  
  // Video information
  videoId?: string; // TikTok video ID after upload
  videoUrl?: string; // Local video file URL
  thumbnailUrl?: string; // Generated thumbnail URL
  
  // Post content
  caption: string;
  privacyLevel: TikTokPrivacyLevel;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  
  // Publishing
  publishStatus: TikTokPublishStatus;
  scheduledFor?: Date;
  publishedAt?: Date;
  tiktokPostId?: string; // TikTok post ID after publishing
  tiktokPostUrl?: string; // TikTok post URL
  
  // Error handling
  errorMessage?: string;
  retryCount: number;
  lastRetryAt?: Date;
  
  // Analytics
  analytics?: {
    viewCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    lastUpdatedAt: Date;
  };
  
  createdAt: Date;
  updatedAt: Date;

  // Methods
  canBeEdited(): boolean;
  canBeDeleted(): boolean;
  canBeScheduled(): boolean;
  canBePublished(): boolean;
}

const TikTokPostSchema = new Schema<ITikTokPost>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    socialAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'SocialAccount',
      required: true,
      index: true,
    },
    videoId: {
      type: String,
    },
    videoUrl: {
      type: String,
    },
    thumbnailUrl: {
      type: String,
    },
    caption: {
      type: String,
      required: true,
      maxlength: 2200, // TikTok's caption limit
    },
    privacyLevel: {
      type: String,
      enum: Object.values(TikTokPrivacyLevel),
      default: TikTokPrivacyLevel.PUBLIC_TO_EVERYONE,
    },
    disableComment: {
      type: Boolean,
      default: false,
    },
    disableDuet: {
      type: Boolean,
      default: false,
    },
    disableStitch: {
      type: Boolean,
      default: false,
    },
    publishStatus: {
      type: String,
      enum: Object.values(TikTokPublishStatus),
      default: TikTokPublishStatus.DRAFT,
      index: true,
    },
    scheduledFor: {
      type: Date,
      index: true,
    },
    publishedAt: {
      type: Date,
      index: true,
    },
    tiktokPostId: {
      type: String,
    },
    tiktokPostUrl: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastRetryAt: {
      type: Date,
    },
    analytics: {
      type: {
        viewCount: { type: Number, default: 0 },
        likeCount: { type: Number, default: 0 },
        commentCount: { type: Number, default: 0 },
        shareCount: { type: Number, default: 0 },
        lastUpdatedAt: { type: Date, required: true },
      },
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
TikTokPostSchema.index({ workspaceId: 1, socialAccountId: 1 });
TikTokPostSchema.index({ socialAccountId: 1, publishStatus: 1 });
TikTokPostSchema.index({ scheduledFor: 1, publishStatus: 1 }); // For scheduler polling
TikTokPostSchema.index({ workspaceId: 1, publishedAt: -1 }); // For listing published posts

/**
 * Check if post can be edited
 * Only drafts and scheduled posts can be edited
 */
TikTokPostSchema.methods.canBeEdited = function (): boolean {
  return [TikTokPublishStatus.DRAFT, TikTokPublishStatus.SCHEDULED].includes(this.publishStatus);
};

/**
 * Check if post can be deleted
 * Cannot delete posts that are publishing or published
 */
TikTokPostSchema.methods.canBeDeleted = function (): boolean {
  return ![TikTokPublishStatus.PUBLISHING, TikTokPublishStatus.PUBLISHED].includes(this.publishStatus);
};

/**
 * Check if post can be scheduled
 * Only drafts can be scheduled
 */
TikTokPostSchema.methods.canBeScheduled = function (): boolean {
  return this.publishStatus === TikTokPublishStatus.DRAFT;
};

/**
 * Check if post can be published immediately
 * Drafts and failed posts can be published
 */
TikTokPostSchema.methods.canBePublished = function (): boolean {
  return [TikTokPublishStatus.DRAFT, TikTokPublishStatus.FAILED].includes(this.publishStatus);
};

/**
 * Validate scheduledFor is in the future when scheduling
 */
TikTokPostSchema.pre('save', function (next) {
  if (this.isModified('scheduledFor') && this.scheduledFor) {
    if (this.publishStatus === TikTokPublishStatus.SCHEDULED && this.scheduledFor <= new Date()) {
      return next(new Error('Scheduled time must be in the future'));
    }
  }
  next();
});

export const TikTokPost = mongoose.model<ITikTokPost>('TikTokPost', TikTokPostSchema);
