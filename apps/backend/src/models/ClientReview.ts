/**
 * ClientReview Model
 * 
 * Represents a client review session for post approval
 */

import mongoose, { Schema, Document } from 'mongoose';

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

export const ClientReview = mongoose.model<IClientReview>('ClientReview', ClientReviewSchema);