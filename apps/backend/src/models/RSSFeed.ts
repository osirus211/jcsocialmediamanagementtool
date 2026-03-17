import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * RSSFeed Document Interface
 */
export interface IRSSFeed extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  feedUrl: string;
  pollingInterval: number; // minutes (15-1440)
  lastFetchedAt?: Date;
  enabled: boolean;
  failureCount: number;
  lastError?: string;
  keywordsInclude: string[]; // Articles must contain at least one
  keywordsExclude: string[]; // Articles skipped if they contain any
  targetPlatforms: string[]; // Default platforms for drafts
  createdAt: Date;
  updatedAt: Date;
  createdBy: mongoose.Types.ObjectId;
}

/**
 * RSSFeed Schema
 */
const RSSFeedSchema = new Schema<IRSSFeed>(
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
      maxlength: 100,
    },
    feedUrl: {
      type: String,
      required: true,
      trim: true,
    },
    pollingInterval: {
      type: Number,
      required: true,
      min: 15, // 15 minutes minimum
      max: 1440, // 24 hours maximum
    },
    lastFetchedAt: {
      type: Date,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    failureCount: {
      type: Number,
      required: true,
      default: 0,
    },
    lastError: {
      type: String,
    },
    keywordsInclude: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    keywordsExclude: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    targetPlatforms: [{
      type: String,
      enum: ['linkedin', 'twitter', 'facebook', 'instagram'],
    }],
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

/**
 * Indexes
 */
// Query enabled feeds by workspace
RSSFeedSchema.index({ workspaceId: 1, enabled: 1 });

// Prevent duplicate feed URLs per workspace
RSSFeedSchema.index({ workspaceId: 1, feedUrl: 1 }, { unique: true });

// Polling scheduler - find feeds that need polling
RSSFeedSchema.index({ enabled: 1, lastFetchedAt: 1 });

/**
 * Validation
 */
RSSFeedSchema.pre('validate', function (next) {
  // Validate polling interval range
  if (this.pollingInterval < 15 || this.pollingInterval > 1440) {
    return next(new Error('Polling interval must be between 15 and 1440 minutes'));
  }

  // Validate feed URL format
  try {
    new URL(this.feedUrl);
  } catch (error) {
    return next(new Error('Invalid feed URL format'));
  }

  next();
});

/**
 * RSSFeed Model
 */
export const RSSFeed: Model<IRSSFeed> = mongoose.model<IRSSFeed>('RSSFeed', RSSFeedSchema);
