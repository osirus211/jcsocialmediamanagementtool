/**
 * ClientPortal Model
 * 
 * Represents a client approval portal for post review
 */

import mongoose, { Schema, Document } from 'mongoose';

export enum ClientPortalStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
}

export enum PostApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMMENTED = 'commented',
}

export interface PostComment {
  postId: mongoose.Types.ObjectId;
  text: string;
  clientEmail: string;
  createdAt: Date;
}

export interface PostApproval {
  postId: mongoose.Types.ObjectId;
  status: PostApprovalStatus;
  feedback?: string;
  approvedAt?: Date;
}

export interface IClientPortal extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  slug: string; // URL-safe unique identifier
  clientEmail: string;
  clientName: string;
  clientCompany?: string;
  accessToken: string; // 256-bit secure token
  tokenExpiresAt: Date; // Token expiry date
  allowedActions: {
    view: boolean;
    approve: boolean;
    reject: boolean;
    comment: boolean;
  };
  branding: {
    logo?: string;
    primaryColor: string;
    accentColor: string;
    companyName: string;
    customMessage?: string;
  };
  posts: mongoose.Types.ObjectId[]; // linked post IDs for review
  postApprovals: PostApproval[]; // approval status per post
  comments: PostComment[]; // comments per post
  status: ClientPortalStatus;
  expiresAt?: Date;
  lastAccessedAt?: Date;
  accessCount: number;
  passwordProtected: boolean;
  passwordHash?: string;
  notifyOnAction: boolean;
  reminderSentAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Keep old interface for backward compatibility
export enum ClientReviewStatus {
  PENDING = 'pending',
  VIEWED = 'viewed',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CHANGES_REQUESTED = 'changes_requested',
}

export interface IClientReview extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  token: string;
  name: string;
  clientEmail?: string;
  clientName?: string;
  postIds: mongoose.Types.ObjectId[];
  status: ClientReviewStatus;
  clientFeedback?: string;
  reviewedAt?: Date;
  expiresAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ClientPortalSchema = new Schema<IClientPortal>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
    },
    clientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    clientCompany: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    accessToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      index: true,
    },
    allowedActions: {
      view: { type: Boolean, default: true },
      approve: { type: Boolean, default: true },
      reject: { type: Boolean, default: true },
      comment: { type: Boolean, default: true },
    },
    branding: {
      logo: { type: String },
      primaryColor: { type: String, default: '#3B82F6' },
      accentColor: { type: String, default: '#10B981' },
      companyName: { type: String, required: true, maxlength: 100 },
      customMessage: { type: String, maxlength: 500 },
    },
    posts: {
      type: [Schema.Types.ObjectId],
      ref: 'ScheduledPost',
      required: true,
      validate: {
        validator: function(v: mongoose.Types.ObjectId[]) {
          return v && v.length > 0;
        },
        message: 'At least one post is required',
      },
    },
    postApprovals: [{
      postId: { type: Schema.Types.ObjectId, ref: 'ScheduledPost', required: true },
      status: { 
        type: String, 
        enum: Object.values(PostApprovalStatus), 
        default: PostApprovalStatus.PENDING 
      },
      feedback: { type: String, maxlength: 1000 },
      approvedAt: { type: Date },
    }],
    comments: [{
      postId: { type: Schema.Types.ObjectId, ref: 'ScheduledPost', required: true },
      text: { type: String, required: true, maxlength: 1000 },
      clientEmail: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    }],
    status: {
      type: String,
      enum: Object.values(ClientPortalStatus),
      default: ClientPortalStatus.ACTIVE,
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    lastAccessedAt: {
      type: Date,
    },
    accessCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    passwordProtected: {
      type: Boolean,
      default: false,
    },
    passwordHash: {
      type: String,
    },
    notifyOnAction: {
      type: Boolean,
      default: true,
    },
    reminderSentAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for ClientPortal
ClientPortalSchema.index({ workspaceId: 1, status: 1 });
ClientPortalSchema.index({ workspaceId: 1, createdBy: 1 });
ClientPortalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
ClientPortalSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
ClientPortalSchema.index({ workspaceId: 1, createdAt: -1 });

// Pre-save middleware to update approval timestamps
ClientPortalSchema.pre('save', function (next) {
  // Update approvedAt for approved posts
  this.postApprovals.forEach(approval => {
    if (approval.status === PostApprovalStatus.APPROVED && !approval.approvedAt) {
      approval.approvedAt = new Date();
    }
  });
  next();
});

// Virtual for checking if token is expired
ClientPortalSchema.virtual('isExpired').get(function() {
  return this.tokenExpiresAt && this.tokenExpiresAt < new Date();
});

// Keep old ClientReview schema for backward compatibility
const ClientReviewSchema = new Schema<IClientReview>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    clientEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    clientName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    postIds: {
      type: [Schema.Types.ObjectId],
      ref: 'ScheduledPost',
      required: true,
      validate: {
        validator: function(v: mongoose.Types.ObjectId[]) {
          return v && v.length > 0;
        },
        message: 'At least one post is required',
      },
    },
    status: {
      type: String,
      enum: Object.values(ClientReviewStatus),
      default: ClientReviewStatus.PENDING,
      index: true,
    },
    clientFeedback: {
      type: String,
      maxlength: 2000,
    },
    reviewedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
ClientReviewSchema.index({ workspaceId: 1, status: 1 });
ClientReviewSchema.index({ workspaceId: 1, createdBy: 1 });
ClientReviewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
ClientReviewSchema.index({ workspaceId: 1, status: 1, createdAt: -1 }); // For filtered review lists
ClientReviewSchema.index({ workspaceId: 1, createdAt: -1 }); // For date-sorted lists

// Pre-save middleware to set reviewedAt when status changes
ClientReviewSchema.pre('save', function (next) {
  if (this.isModified('status') && 
      this.status !== ClientReviewStatus.PENDING && 
      this.status !== ClientReviewStatus.VIEWED && 
      !this.reviewedAt) {
    this.reviewedAt = new Date();
  }
  next();
});

export const ClientPortal = mongoose.model<IClientPortal>('ClientPortal', ClientPortalSchema);
export const ClientReview = mongoose.model<IClientReview>('ClientReview', ClientReviewSchema);