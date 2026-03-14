import mongoose, { Schema, Document } from 'mongoose';

export enum SocialPlatform {
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  YOUTUBE = 'youtube',
  THREADS = 'threads',
  BLUESKY = 'bluesky',
  MASTODON = 'mastodon',
  REDDIT = 'reddit',
  GOOGLE_BUSINESS = 'google-business',
  PINTEREST = 'pinterest',
  TIKTOK = 'tiktok'
}

// Watermark configuration
export interface WatermarkConfig {
  enabled: boolean;
  text?: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity: number; // 0-100
  fontSize: number; // 12-48
  color: string; // hex color
}

// Auto-tagging configuration
export interface AutoTaggingConfig {
  enabled: boolean;
  tags: string[];
}

// Cross-posting defaults
export interface CrossPostingDefaults {
  enabled: boolean;
  platforms: SocialPlatform[];
}

// UTM tracking configuration
export interface UTMTrackingConfig {
  enabled: boolean;
  source: string;
  medium: string;
  campaign: string;
}

// Posting time preferences
export interface PostingTimeConfig {
  timezone: string;
  preferredTimes: string[]; // Array of "HH:MM" format times
}

// Platform-specific configurations
export interface TwitterConfig {
  threadByDefault: boolean;
  pollDuration: number; // hours: 1, 24, 168 (1 week), 8760 (1 year)
  replySettings: 'everyone' | 'following' | 'mentioned';
}

export interface InstagramConfig {
  firstCommentHashtags: boolean;
  altTextEnabled: boolean;
  aspectRatio: 'original' | 'square' | 'portrait' | 'landscape';
  defaultLocation?: string;
}

export interface LinkedInConfig {
  targetAudience: 'public' | 'connections' | 'logged-in';
  contentType: 'article' | 'post' | 'video';
  boostEnabled: boolean;
}

export interface TikTokConfig {
  duetEnabled: boolean;
  stitchEnabled: boolean;
  commentEnabled: boolean;
  privacy: 'public' | 'friends' | 'private';
}

export interface YouTubeConfig {
  defaultCategory: string;
  defaultPrivacy: 'public' | 'unlisted' | 'private';
  madeForKids: boolean;
  tags: string[];
}

export interface PinterestConfig {
  defaultBoard: string;
  altTextEnabled: boolean;
}

export interface FacebookConfig {
  defaultTargeting: 'public' | 'friends' | 'custom';
  boostEnabled: boolean;
}

export interface RedditConfig {
  defaultSubreddit: string;
  flairId?: string;
  nsfw: boolean;
}

export interface BlueskyConfig {
  defaultLanguage: string;
  contentWarning: boolean;
}

export interface MastodonConfig {
  defaultVisibility: 'public' | 'unlisted' | 'private' | 'direct';
  contentWarning: boolean;
  language: string;
}

export interface ThreadsConfig {
  defaultVisibility: 'public' | 'private';
  allowReplies: boolean;
}

export interface GoogleBusinessConfig {
  defaultEventAction: 'learn_more' | 'book' | 'order' | 'shop' | 'sign_up';
  includeLocation: boolean;
}

// Main platform settings interface
export interface IPlatformSettings extends Document {
  workspaceId: string;
  platform: SocialPlatform;
  accountId?: string; // Optional - per account or workspace-wide
  
  // General defaults
  defaults: {
    defaultHashtags: string[];
    defaultFirstComment: string;
    defaultVisibility: string;
    defaultLocation?: string;
    watermark: WatermarkConfig;
    autoTagging: AutoTaggingConfig;
    crossPostingDefaults: CrossPostingDefaults;
    utmTracking: UTMTrackingConfig;
    postingTime: PostingTimeConfig;
  };
  
  // Platform-specific configurations
  platformSpecific: {
    twitter?: TwitterConfig;
    instagram?: InstagramConfig;
    linkedin?: LinkedInConfig;
    tiktok?: TikTokConfig;
    youtube?: YouTubeConfig;
    pinterest?: PinterestConfig;
    facebook?: FacebookConfig;
    reddit?: RedditConfig;
    bluesky?: BlueskyConfig;
    mastodon?: MastodonConfig;
    threads?: ThreadsConfig;
    'google-business'?: GoogleBusinessConfig;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const WatermarkSchema = new Schema({
  enabled: { type: Boolean, default: false },
  text: { type: String, default: '' },
  position: { 
    type: String, 
    enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'],
    default: 'bottom-right'
  },
  opacity: { type: Number, min: 0, max: 100, default: 80 },
  fontSize: { type: Number, min: 12, max: 48, default: 16 },
  color: { type: String, default: '#FFFFFF' }
});

const AutoTaggingSchema = new Schema({
  enabled: { type: Boolean, default: false },
  tags: [{ type: String }]
});

const CrossPostingSchema = new Schema({
  enabled: { type: Boolean, default: false },
  platforms: [{ type: String, enum: Object.values(SocialPlatform) }]
});

const UTMTrackingSchema = new Schema({
  enabled: { type: Boolean, default: false },
  source: { type: String, default: '' },
  medium: { type: String, default: 'social' },
  campaign: { type: String, default: '' }
});

const PostingTimeSchema = new Schema({
  timezone: { type: String, default: 'UTC' },
  preferredTimes: [{ type: String }] // "HH:MM" format
});

const PlatformSettingsSchema = new Schema<IPlatformSettings>({
  workspaceId: { type: String, required: true, index: true },
  platform: { type: String, enum: Object.values(SocialPlatform), required: true },
  accountId: { type: String, index: true }, // Optional for account-specific settings
  
  defaults: {
    defaultHashtags: [{ type: String }],
    defaultFirstComment: { type: String, default: '' },
    defaultVisibility: { type: String, default: 'public' },
    defaultLocation: { type: String },
    watermark: { type: WatermarkSchema, default: () => ({}) },
    autoTagging: { type: AutoTaggingSchema, default: () => ({}) },
    crossPostingDefaults: { type: CrossPostingSchema, default: () => ({}) },
    utmTracking: { type: UTMTrackingSchema, default: () => ({}) },
    postingTime: { type: PostingTimeSchema, default: () => ({}) }
  },
  
  platformSpecific: {
    twitter: {
      threadByDefault: { type: Boolean, default: false },
      pollDuration: { type: Number, enum: [1, 24, 168, 8760], default: 24 },
      replySettings: { type: String, enum: ['everyone', 'following', 'mentioned'], default: 'everyone' }
    },
    instagram: {
      firstCommentHashtags: { type: Boolean, default: false },
      altTextEnabled: { type: Boolean, default: true },
      aspectRatio: { type: String, enum: ['original', 'square', 'portrait', 'landscape'], default: 'original' },
      defaultLocation: { type: String }
    },
    linkedin: {
      targetAudience: { type: String, enum: ['public', 'connections', 'logged-in'], default: 'public' },
      contentType: { type: String, enum: ['article', 'post', 'video'], default: 'post' },
      boostEnabled: { type: Boolean, default: false }
    },
    tiktok: {
      duetEnabled: { type: Boolean, default: true },
      stitchEnabled: { type: Boolean, default: true },
      commentEnabled: { type: Boolean, default: true },
      privacy: { type: String, enum: ['public', 'friends', 'private'], default: 'public' }
    },
    youtube: {
      defaultCategory: { type: String, default: 'Entertainment' },
      defaultPrivacy: { type: String, enum: ['public', 'unlisted', 'private'], default: 'public' },
      madeForKids: { type: Boolean, default: false },
      tags: [{ type: String }]
    },
    pinterest: {
      defaultBoard: { type: String },
      altTextEnabled: { type: Boolean, default: true }
    },
    facebook: {
      defaultTargeting: { type: String, enum: ['public', 'friends', 'custom'], default: 'public' },
      boostEnabled: { type: Boolean, default: false }
    },
    reddit: {
      defaultSubreddit: { type: String },
      flairId: { type: String },
      nsfw: { type: Boolean, default: false }
    },
    bluesky: {
      defaultLanguage: { type: String, default: 'en' },
      contentWarning: { type: Boolean, default: false }
    },
    mastodon: {
      defaultVisibility: { type: String, enum: ['public', 'unlisted', 'private', 'direct'], default: 'public' },
      contentWarning: { type: Boolean, default: false },
      language: { type: String, default: 'en' }
    },
    threads: {
      defaultVisibility: { type: String, enum: ['public', 'private'], default: 'public' },
      allowReplies: { type: Boolean, default: true }
    },
    'google-business': {
      defaultEventAction: { 
        type: String, 
        enum: ['learn_more', 'book', 'order', 'shop', 'sign_up'], 
        default: 'learn_more' 
      },
      includeLocation: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
PlatformSettingsSchema.index({ workspaceId: 1, platform: 1, accountId: 1 }, { unique: true });

export const PlatformSettings = mongoose.model<IPlatformSettings>('PlatformSettings', PlatformSettingsSchema);