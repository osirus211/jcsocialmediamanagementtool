/**
 * Scheduled Post Model
 * 
 * Stores posts scheduled for publishing to social media platforms
 */

import mongoose, { Schema, Document } from 'mongoose';

export enum PostStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SCHEDULED = 'scheduled',
  QUEUED = 'queued',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
  REJECTED = 'rejected',
}

export enum SocialPlatform {
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  YOUTUBE = 'youtube',
  THREADS = 'threads',
  TIKTOK = 'tiktok',
}

export interface IScheduledPost extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  socialAccountId: mongoose.Types.ObjectId;
  platform: SocialPlatform;
  content: string;
  mediaUrls: string[];
  scheduledAt: Date;
  status: PostStatus;
  
  // Approval workflow
  createdBy: mongoose.Types.ObjectId;
  submittedForApprovalAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;
  
  queuedAt?: Date;
  publishingStartedAt?: Date;
  publishedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  platformPostId?: string;
  metadata?: Record<string, any>;
  
  // Content organization
  categoryId?: mongoose.Types.ObjectId;
  campaignId?: mongoose.Types.ObjectId;
  tags: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledPostSchema = new Schema<IScheduledPost>(
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
    platform: {
      type: String,
      enum: Object.values(SocialPlatform),
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    mediaUrls: {
      type: [String],
      default: [],
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(PostStatus),
      default: PostStatus.DRAFT,
      required: true,
      index: true,
    },
    
    // Approval workflow
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    submittedForApprovalAt: {
      type: Date,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
    
    queuedAt: {
      type: Date,
    },
    publishingStartedAt: {
      type: Date,
    },
    publishedAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
    platformPostId: {
      type: String,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function (tags: string[]) {
          return tags.length <= 10 && tags.every(tag => tag.length <= 30);
        },
        message: 'Maximum 10 tags allowed, each max 30 characters',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
ScheduledPostSchema.index({ status: 1, scheduledAt: 1 }); // For scheduler queries
ScheduledPostSchema.index({ workspaceId: 1, status: 1 }); // For workspace queries
ScheduledPostSchema.index({ workspaceId: 1, scheduledAt: -1 }); // For listing posts
ScheduledPostSchema.index({ socialAccountId: 1, status: 1 }); // For account queries
ScheduledPostSchema.index({ createdBy: 1, status: 1 }); // For user's posts
ScheduledPostSchema.index({ workspaceId: 1, status: 1, submittedForApprovalAt: -1 }); // For approval queue

// Indexes for content organization
ScheduledPostSchema.index({ workspaceId: 1, categoryId: 1 });
ScheduledPostSchema.index({ workspaceId: 1, campaignId: 1 });
ScheduledPostSchema.index({ workspaceId: 1, tags: 1 });

/**
 * Instance Methods
 */
ScheduledPostSchema.methods = {
  /**
   * Convert to safe object for API responses
   */
  toJSON(): any {
    const obj = this.toObject();
    return {
      id: obj._id.toString(),
      workspaceId: obj.workspaceId.toString(),
      socialAccountId: obj.socialAccountId.toString(),
      platform: obj.platform,
      content: obj.content,
      mediaUrls: obj.mediaUrls,
      scheduledAt: obj.scheduledAt,
      status: obj.status,
      createdBy: obj.createdBy?.toString(),
      submittedForApprovalAt: obj.submittedForApprovalAt,
      approvedBy: obj.approvedBy?.toString(),
      approvedAt: obj.approvedAt,
      rejectedBy: obj.rejectedBy?.toString(),
      rejectedAt: obj.rejectedAt,
      rejectionReason: obj.rejectionReason,
      queuedAt: obj.queuedAt,
      publishingStartedAt: obj.publishingStartedAt,
      publishedAt: obj.publishedAt,
      failedAt: obj.failedAt,
      failureReason: obj.failureReason,
      platformPostId: obj.platformPostId,
      metadata: obj.metadata,
      categoryId: obj.categoryId?.toString(),
      campaignId: obj.campaignId?.toString(),
      tags: obj.tags,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  },
};

export const ScheduledPost = mongoose.model<IScheduledPost>('ScheduledPost', ScheduledPostSchema);
