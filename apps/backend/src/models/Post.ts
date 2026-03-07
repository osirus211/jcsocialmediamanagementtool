import mongoose, { Schema, Document } from 'mongoose';

/**
 * Post Model
 * 
 * Stores social media posts with scheduling and publishing status
 * 
 * Features:
 * - Multi-tenant (workspace-scoped)
 * - Multiple status states
 * - Scheduling support
 * - Retry mechanism
 * - Idempotency-safe
 */

export enum PostStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  QUEUED = 'queued',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum PublishMode {
  NOW = 'now',
  SCHEDULE = 'schedule',
  QUEUE = 'queue',
}

export interface PlatformContent {
  platform: string;
  text?: string;
  mediaIds?: string[];
  enabled: boolean;
}

export interface IPost extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  socialAccountId: mongoose.Types.ObjectId;
  socialAccountIds: mongoose.Types.ObjectId[]; // NEW: Support multiple accounts
  content: string;
  platformContent: PlatformContent[]; // NEW: Per-platform content
  mediaUrls: string[];
  mediaIds: mongoose.Types.ObjectId[]; // NEW: Reference to Media model
  status: PostStatus;
  publishMode?: PublishMode; // NEW: How post should be published
  /**
   * Scheduled publish time (ALWAYS stored in UTC)
   * 
   * IMPORTANT: This field MUST be stored in UTC timezone.
   * - Frontend should send ISO 8601 string with timezone (e.g., "2024-01-15T14:00:00-08:00")
   * - Backend converts to UTC before storage (e.g., "2024-01-15T22:00:00Z")
   * - All comparisons MUST use UTC (new Date() returns UTC internally)
   * 
   * Example:
   * ```typescript
   * // Convert user input to UTC
   * const scheduledAtUTC = new Date(userInput.toISOString());
   * 
   * // Compare with current UTC time
   * const nowUTC = new Date();
   * if (scheduledAtUTC <= nowUTC) {
   *   throw new Error('Scheduled time must be in the future');
   * }
   * ```
   */
  scheduledAt?: Date;
  /**
   * BullMQ job ID for scheduled posts
   * 
   * When a post is scheduled, a delayed BullMQ job is created.
   * This field stores the job ID for:
   * - Rescheduling (remove old job, create new job)
   * - Cancelling (remove job from queue)
   * - Status tracking (check if job exists)
   */
  queueJobId?: string;
  queueSlot?: string; // NEW: Queue slot identifier
  publishedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  metadata: {
    platformPostId?: string; // ID from social platform after publishing
    publishHash?: string; // Hash of content + account for external idempotency
    publishAttemptedAt?: Date; // When external publish was attempted
    characterCount?: number;
    hashtags?: string[];
    mentions?: string[];
    [key: string]: any;
  };
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  version: number; // For optimistic locking

  // Methods
  canBeEdited(): boolean;
  canBeDeleted(): boolean;
  canBeScheduled(): boolean;
  canBePublished(): boolean;
  isEligibleForQueue(): boolean;
}

const PostSchema = new Schema<IPost>(
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
    socialAccountIds: {
      type: [Schema.Types.ObjectId],
      ref: 'SocialAccount',
      default: [],
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000, // Max length across all platforms
    },
    platformContent: {
      type: [
        {
          platform: { type: String, required: true },
          text: { type: String },
          mediaIds: { type: [String] },
          enabled: { type: Boolean, default: true },
        },
      ],
      default: [],
    },
    mediaUrls: {
      type: [String],
      default: [],
      validate: {
        validator: function (urls: string[]) {
          return urls.length <= 10; // Max 10 media files
        },
        message: 'Maximum 10 media files allowed',
      },
    },
    mediaIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Media',
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(PostStatus),
      default: PostStatus.DRAFT,
      index: true,
    },
    publishMode: {
      type: String,
      enum: Object.values(PublishMode),
    },
    scheduledAt: {
      type: Date,
      index: true,
    },
    queueJobId: {
      type: String,
      index: true,
    },
    queueSlot: {
      type: String,
      index: true,
    },
    publishedAt: {
      type: Date,
      index: true,
    },
    errorMessage: {
      type: String,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    version: {
      type: Number,
      default: 1,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
PostSchema.index({ workspaceId: 1, status: 1 });
PostSchema.index({ workspaceId: 1, createdAt: -1 });
PostSchema.index({ workspaceId: 1, scheduledAt: 1 });
PostSchema.index({ status: 1, scheduledAt: 1 }); // For scheduler polling
PostSchema.index({ socialAccountId: 1, status: 1 });

// Index for calendar view queries
PostSchema.index({ workspaceId: 1, scheduledAt: 1, status: 1 });

/**
 * Check if post can be edited
 * Only drafts and scheduled posts can be edited
 */
PostSchema.methods.canBeEdited = function (): boolean {
  return [PostStatus.DRAFT, PostStatus.SCHEDULED].includes(this.status);
};

/**
 * Check if post can be deleted
 * Cannot delete posts that are publishing or published
 */
PostSchema.methods.canBeDeleted = function (): boolean {
  return ![PostStatus.PUBLISHING, PostStatus.PUBLISHED].includes(this.status);
};

/**
 * Check if post can be scheduled
 * Only drafts can be scheduled
 */
PostSchema.methods.canBeScheduled = function (): boolean {
  return this.status === PostStatus.DRAFT;
};

/**
 * Check if post can be published immediately
 * Drafts and failed posts can be published
 */
PostSchema.methods.canBePublished = function (): boolean {
  return [PostStatus.DRAFT, PostStatus.FAILED].includes(this.status);
};

/**
 * Check if post is eligible to be moved to queue
 * Scheduled posts with scheduledAt <= now
 */
PostSchema.methods.isEligibleForQueue = function (): boolean {
  if (this.status !== PostStatus.SCHEDULED) {
    return false;
  }
  
  if (!this.scheduledAt) {
    return false;
  }
  
  return this.scheduledAt <= new Date();
};

/**
 * Validate scheduledAt is in the future when scheduling
 */
PostSchema.pre('save', function (next) {
  if (this.isModified('scheduledAt') && this.scheduledAt) {
    if (this.status === PostStatus.SCHEDULED && this.scheduledAt <= new Date()) {
      return next(new Error('Scheduled time must be in the future'));
    }
  }
  next();
});

/**
 * Auto-calculate metadata on save
 */
PostSchema.pre('save', function (next) {
  if (this.isModified('content')) {
    // Calculate character count
    this.metadata.characterCount = this.content.length;
    
    // Extract hashtags
    const hashtagRegex = /#[\w]+/g;
    const hashtags = this.content.match(hashtagRegex) || [];
    this.metadata.hashtags = hashtags;
    
    // Extract mentions
    const mentionRegex = /@[\w]+/g;
    const mentions = this.content.match(mentionRegex) || [];
    this.metadata.mentions = mentions;
  }
  next();
});

export const Post = mongoose.model<IPost>('Post', PostSchema);
