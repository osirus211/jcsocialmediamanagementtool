import { SocialPlatform } from './social.types';

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
export interface PlatformSettings {
  _id?: string;
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
  
  createdAt?: string;
  updatedAt?: string;
}

// API Response types
export interface PlatformSettingsResponse {
  success: boolean;
  settings: PlatformSettings;
  isDefault?: boolean;
  message?: string;
}

export interface AllPlatformSettingsResponse {
  success: boolean;
  settings: PlatformSettings[];
  count: number;
}

export interface ApplyDefaultsInput {
  platform: SocialPlatform;
  accountId?: string;
  post: {
    content: string;
    hashtags?: string[];
    firstComment?: string;
    visibility?: string;
    location?: string;
    media?: any[];
  };
}

export interface PostWithDefaults {
  content: string;
  hashtags: string[];
  firstComment: string;
  visibility: string;
  location?: string;
  media?: any[];
  appliedDefaults: {
    hashtagsAdded: string[];
    watermarkApplied: boolean;
    utmTracking?: {
      source: string;
      medium: string;
      campaign: string;
    };
  };
}

export interface ApplyDefaultsResponse {
  success: boolean;
  post: PostWithDefaults;
  message?: string;
}