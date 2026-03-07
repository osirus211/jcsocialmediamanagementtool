/**
 * Post Publish Attempt Model
 * 
 * Tracks all publishing attempts for scheduled posts
 * Used for debugging, analytics, and retry logic
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export enum AttemptStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

export interface IPostPublishAttempt extends Document {
  _id: mongoose.Types.ObjectId;
  postId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  platform: string;
  socialAccountId: mongoose.Types.ObjectId;
  attemptNumber: number;
  status: AttemptStatus;
  error?: string;
  errorCode?: string;
  platformResponse?: Record<string, any>;
  duration?: number; // milliseconds
  publishedAt?: Date;
  createdAt: Date;
}

export interface IPostPublishAttemptModel extends Model<IPostPublishAttempt> {
  recordAttempt(data: {
    postId: mongoose.Types.ObjectId | string;
    workspaceId: mongoose.Types.ObjectId | string;
    platform: string;
    socialAccountId: mongoose.Types.ObjectId | string;
    attemptNumber: number;
    status: AttemptStatus;
    error?: string;
    errorCode?: string;
    platformResponse?: Record<string, any>;
    duration?: number;
    publishedAt?: Date;
  }): Promise<IPostPublishAttempt>;

  getAttemptHistory(postId: mongoose.Types.ObjectId | string): Promise<IPostPublishAttempt[]>;
  getLatestAttempt(postId: mongoose.Types.ObjectId | string): Promise<IPostPublishAttempt | null>;
  getFailureRate(platform: string, since: Date): Promise<number>;
}

const PostPublishAttemptSchema = new Schema<IPostPublishAttempt>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'ScheduledPost',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      index: true,
    },
    socialAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'SocialAccount',
      required: true,
      index: true,
    },
    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(AttemptStatus),
      required: true,
      index: true,
    },
    error: {
      type: String,
    },
    errorCode: {
      type: String,
      index: true,
    },
    platformResponse: {
      type: Schema.Types.Mixed,
    },
    duration: {
      type: Number,
      min: 0,
    },
    publishedAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
  },
  {
    timestamps: false, // Only need createdAt
  }
);

// Compound indexes
PostPublishAttemptSchema.index({ postId: 1, platform: 1 }); // For attempt history by post and platform
PostPublishAttemptSchema.index({ workspaceId: 1, createdAt: -1 }); // For workspace analytics
PostPublishAttemptSchema.index({ postId: 1, attemptNumber: 1 }); // For attempt history
PostPublishAttemptSchema.index({ platform: 1, status: 1, createdAt: -1 }); // For analytics
PostPublishAttemptSchema.index({ status: 1, createdAt: -1 }); // For monitoring

/**
 * Static Methods
 */
PostPublishAttemptSchema.statics = {
  /**
   * Record a publish attempt
   */
  async recordAttempt(data: {
    postId: mongoose.Types.ObjectId | string;
    workspaceId: mongoose.Types.ObjectId | string;
    platform: string;
    socialAccountId: mongoose.Types.ObjectId | string;
    attemptNumber: number;
    status: AttemptStatus;
    error?: string;
    errorCode?: string;
    platformResponse?: Record<string, any>;
    duration?: number;
    publishedAt?: Date;
  }): Promise<IPostPublishAttempt> {
    return this.create({
      postId: data.postId,
      workspaceId: data.workspaceId,
      platform: data.platform,
      socialAccountId: data.socialAccountId,
      attemptNumber: data.attemptNumber,
      status: data.status,
      error: data.error,
      errorCode: data.errorCode,
      platformResponse: data.platformResponse,
      duration: data.duration,
      publishedAt: data.publishedAt,
      createdAt: new Date(),
    });
  },

  /**
   * Get attempt history for a post
   */
  async getAttemptHistory(postId: mongoose.Types.ObjectId | string): Promise<IPostPublishAttempt[]> {
    return this.find({ postId }).sort({ attemptNumber: 1 });
  },

  /**
   * Get latest attempt for a post
   */
  async getLatestAttempt(postId: mongoose.Types.ObjectId | string): Promise<IPostPublishAttempt | null> {
    return this.findOne({ postId }).sort({ attemptNumber: -1 });
  },

  /**
   * Get failure rate for platform
   */
  async getFailureRate(platform: string, since: Date): Promise<number> {
    const total = await this.countDocuments({
      platform,
      createdAt: { $gte: since },
    });

    if (total === 0) return 0;

    const failed = await this.countDocuments({
      platform,
      status: AttemptStatus.FAILED,
      createdAt: { $gte: since },
    });

    return (failed / total) * 100;
  },
};

/**
 * Instance Methods
 */
PostPublishAttemptSchema.methods = {
  /**
   * Convert to JSON for API responses
   */
  toJSON(): any {
    const obj = this.toObject();
    return {
      id: obj._id.toString(),
      postId: obj.postId.toString(),
      workspaceId: obj.workspaceId.toString(),
      platform: obj.platform,
      socialAccountId: obj.socialAccountId.toString(),
      attemptNumber: obj.attemptNumber,
      status: obj.status,
      error: obj.error,
      errorCode: obj.errorCode,
      platformResponse: obj.platformResponse,
      duration: obj.duration,
      publishedAt: obj.publishedAt,
      createdAt: obj.createdAt,
    };
  },
};

export const PostPublishAttempt = mongoose.model<IPostPublishAttempt, IPostPublishAttemptModel>(
  'PostPublishAttempt',
  PostPublishAttemptSchema
);
