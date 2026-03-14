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

export enum ContentType {
  POST = 'post',
  STORY = 'story',
  REEL = 'reel',
}

export interface StoryOptions {
  expiresAt?: Date;
  link?: string;
}

export interface ReelOptions {
  audioName?: string;
  shareToFeed?: boolean;
}

export interface CarouselItem {
  order: number;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string; // Per-slide caption
  altText?: string;
  link?: string; // LinkedIn only
  userTags?: Array<{
    username: string;
    x: number;
    y: number;
  }>;
}

export interface InstagramOptions {
  useFirstComment?: boolean;
  altText?: string;
  locationId?: string;
  locationName?: string;
  userTags?: Array<{
    username: string;
    x: number;
    y: number;
  }>;
  collaborators?: string[];
  aspectRatio?: string;
  coverImageUrl?: string;
  coverImageOffset?: number;
  carouselItems?: Array<{
    altText?: string;
    userTags?: Array<{
      username: string;
      x: number;
      y: number;
    }>;
  }>;
}

export interface PlatformContent {
  platform: string;
  text?: string;
  mediaIds?: string[];
  altTexts?: string[]; // Alt text for each media item
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
  
  // Carousel fields
  isCarousel?: boolean;
  carouselItems?: CarouselItem[];
  coverSlideIndex?: number; // Which slide to use as cover/thumbnail
  
  status: PostStatus;
  publishMode?: PublishMode; // NEW: How post should be published
  contentType?: ContentType; // NEW: Post type (post/story/reel)
  storyOptions?: StoryOptions; // NEW: Story-specific options
  reelOptions?: ReelOptions; // NEW: Reel-specific options
  instagramOptions?: InstagramOptions; // NEW: Instagram-specific options
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

  // First comment fields
  firstComment?: {
    enabled: boolean;
    content: string;
    platforms: string[]; // Which platforms to post first comment on
    delay?: number; // Delay in seconds (0 = immediate)
  };
  firstCommentId?: string; // Platform post ID after posting first comment
  firstCommentPostedAt?: Date;
  firstCommentStatus?: 'pending' | 'posted' | 'failed';
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  version: number; // For optimistic locking

  // Draft collaboration fields
  lockedBy?: mongoose.Types.ObjectId;
  lockedAt?: Date;
  lockExpiresAt?: Date;
  lockedReason?: string;
  lastEditedBy?: mongoose.Types.ObjectId;
  lastEditedAt?: Date;

  // Content organization
  categoryId?: mongoose.Types.ObjectId;
  campaignId?: mongoose.Types.ObjectId;
  tags: string[];

  // Methods
  canBeEdited(): boolean;
  canBeDeleted(): boolean;
  canBeScheduled(): boolean;
  canBePublished(): boolean;
  isEligibleForQueue(): boolean;
  isEditLocked(): boolean;
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
          altTexts: { type: [String] }, // Alt text for each media item
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
          return urls.length <= 35; // Max 35 media files (TikTok limit)
        },
        message: 'Maximum 35 media files allowed',
      },
    },
    mediaIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Media',
      default: [],
    },
    
    // Carousel fields
    isCarousel: {
      type: Boolean,
      default: false,
    },
    carouselItems: {
      type: [
        {
          order: { type: Number, required: true },
          mediaUrl: { type: String, required: true },
          mediaType: { type: String, enum: ['image', 'video'], required: true },
          caption: { type: String, maxlength: 2200 },
          altText: { type: String, maxlength: 100 },
          link: { type: String }, // LinkedIn only
          userTags: [{
            username: { type: String, required: true },
            x: { type: Number, required: true, min: 0, max: 1 },
            y: { type: Number, required: true, min: 0, max: 1 },
          }],
        },
      ],
      default: [],
      validate: {
        validator: function (items: any[]) {
          return items.length <= 35; // Max 35 slides (TikTok limit)
        },
        message: 'Maximum 35 carousel items allowed',
      },
    },
    coverSlideIndex: {
      type: Number,
      default: 0,
      min: 0,
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
    contentType: {
      type: String,
      enum: Object.values(ContentType),
      default: ContentType.POST,
    },
    storyOptions: {
      type: {
        expiresAt: { type: Date },
        link: { type: String },
      },
      required: false,
    },
    reelOptions: {
      type: {
        audioName: { type: String },
        shareToFeed: { type: Boolean, default: true },
      },
      required: false,
    },
    instagramOptions: {
      type: {
        useFirstComment: { type: Boolean, default: false },
        altText: { type: String, maxlength: 100 },
        locationId: { type: String },
        locationName: { type: String },
        userTags: [{
          username: { type: String, required: true },
          x: { type: Number, required: true, min: 0, max: 1 },
          y: { type: Number, required: true, min: 0, max: 1 },
        }],
        collaborators: [{ type: String }],
        aspectRatio: { type: String },
        coverImageUrl: { type: String },
        coverImageOffset: { type: Number, min: 0, max: 100 },
        carouselItems: [{
          altText: { type: String, maxlength: 100 },
          userTags: [{
            username: { type: String, required: true },
            x: { type: Number, required: true, min: 0, max: 1 },
            y: { type: Number, required: true, min: 0, max: 1 },
          }],
        }],
      },
      required: false,
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
    lockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    lockedAt: {
      type: Date,
    },
    lockExpiresAt: {
      type: Date,
      index: true,
    },
    lockedReason: {
      type: String,
    },
    lastEditedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    lastEditedAt: {
      type: Date,
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
PostSchema.index({ workspaceId: 1, status: 1 });
PostSchema.index({ workspaceId: 1, createdAt: -1 });
PostSchema.index({ workspaceId: 1, scheduledAt: 1 });
PostSchema.index({ status: 1, scheduledAt: 1 }); // For scheduler polling
PostSchema.index({ socialAccountId: 1, status: 1 });

// Index for calendar view queries
PostSchema.index({ workspaceId: 1, scheduledAt: 1, status: 1 });

// Indexes for content organization
PostSchema.index({ workspaceId: 1, categoryId: 1 });
PostSchema.index({ workspaceId: 1, campaignId: 1 });
PostSchema.index({ workspaceId: 1, tags: 1 });

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
 * Check if post is edit locked by another user
 */
PostSchema.methods.isEditLocked = function (): boolean {
  // Permanent lock: lockedBy exists and lockExpiresAt is null
  if (this.lockedBy && !this.lockExpiresAt) {
    return true;
  }
  // Temporary lock: lockExpiresAt exists and hasn't expired
  return !!(this.lockExpiresAt && this.lockExpiresAt > new Date() && this.lockedBy);
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
