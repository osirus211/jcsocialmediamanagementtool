// Composer Types

export enum PublishMode {
  NOW = 'now',
  SCHEDULE = 'schedule',
  QUEUE = 'queue',
}

export enum ComposerStatus {
  IDLE = 'idle',
  SAVING = 'saving',
  SAVED = 'saved',
  PUBLISHING = 'publishing',
  SUCCESS = 'success',
  ERROR = 'error',
}

export type SocialPlatform = 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'threads' | 'bluesky' | 'youtube' | 'google-business' | 'pinterest' | 'tiktok';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error';

export interface PlatformContent {
  platform: SocialPlatform;
  text: string;
  enabled: boolean;
  mediaIds?: string[];
}

export interface MediaFile {
  id: string;
  url: string;
  type: 'image' | 'video' | 'gif';
  size: number;
  filename: string;
  mimeType: string;
  uploadProgress?: number; // 0-100
  uploadStatus: UploadStatus;
  errorMessage?: string;
  thumbnailUrl?: string;
  duration?: number; // Video duration in seconds
  width?: number; // Video/image width
  height?: number; // Video/image height
  fps?: number; // Video frame rate
  resolution?: string; // e.g., "1080p", "720p", "4K"
  bitrate?: number; // Video bitrate
  canCancel?: boolean; // Whether upload can be cancelled
  metadata?: {
    altText?: string;
    isThread?: boolean;
    tweets?: string[];
    isPoll?: boolean;
    options?: string[];
    duration?: string;
    // Video-specific metadata
    videoMetadata?: {
      codec?: string;
      profile?: string;
      level?: string;
      colorSpace?: string;
      hasAudio?: boolean;
      audioCodec?: string;
      audioBitrate?: number;
      audioChannels?: number;
    };
    // Thumbnail metadata
    thumbnails?: {
      auto?: string[]; // Auto-generated thumbnails at different times
      custom?: string; // Custom uploaded thumbnail
      selected?: string; // Currently selected thumbnail
      frames?: Array<{
        time: number;
        url: string;
        label: string; // e.g., "0s", "25%", "50%"
      }>;
    };
    // Platform validation
    platformCompatibility?: Record<SocialPlatform, {
      compatible: boolean;
      issues?: string[];
      warnings?: string[];
    }>;
    // Processing status
    processing?: {
      transcoding?: boolean;
      thumbnailGeneration?: boolean;
      compression?: boolean;
      validation?: boolean;
    };
    // GIF-specific metadata
    giphyId?: string;
    giphyTitle?: string;
    giphyUrl?: string;
    // YouTube-specific metadata
    youtubeTitle?: string;
    youtubeDescription?: string;
    youtubeTags?: string[];
    youtubeCategory?: string;
    youtubePrivacy?: 'public' | 'unlisted' | 'private';
    youtubeIsShort?: boolean;
    youtubeMadeForKids?: boolean;
    youtubeLanguage?: string;
    youtubeThumbnail?: string;
    [key: string]: any;
  };
}

export interface Media {
  _id: string;
  workspaceId: string;
  type: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl?: string;
  thumbnails?: {
    small?: string;
    medium?: string;
    large?: string;
  };
  compressionRatio?: number;
  isProcessed?: boolean;
  processingError?: string;
  filename: string;
  originalFilename?: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  metadata?: any;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // New fields for enhanced media library
  folderId?: string;
  tags?: string[];
  altText?: string;
  platformMediaIds?: Array<{
    platform: string;
    mediaId: string;
    uploadedAt?: Date;
  }>;
  usageCount?: number;
  lastUsedAt?: Date;
}

export interface QueueSlot {
  id: string;
  slotId: string;
  time: string; // "09:00", "11:00", etc.
  date: Date;
  scheduledAt: string;
  hour: number;
  isAvailable: boolean;
  isOccupied: boolean;
  isDefault: boolean; // Next available slot
}

// API Request types
export interface CreateDraftRequest {
  content: string;
  socialAccountIds?: string[];
  mediaIds?: string[];
  platformContent?: PlatformContent[];
}

export interface UpdateDraftRequest {
  content?: string;
  socialAccountIds?: string[];
  mediaIds?: string[];
  platformContent?: PlatformContent[];
}

export interface PublishPostRequest {
  publishMode: PublishMode;
  scheduledAt?: string;
  queueSlot?: string;
}

export interface UploadMediaResponse {
  success: boolean;
  media: Media;
  message?: string;
}

export interface MediaLibraryResponse {
  success: boolean;
  media: Media[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DraftResponse {
  success: boolean;
  post: any; // Post with draft status
  message?: string;
}

export interface PublishResponse {
  success: boolean;
  post: any;
  message?: string;
}

export interface QueueSlotsResponse {
  success: boolean;
  slots: QueueSlot[];
  nextAvailable?: QueueSlot;
}

// Composer State Interface
export interface ComposerState {
  // Draft metadata
  draftId: string | null;
  isNewDraft: boolean;
  
  // Content
  mainContent: string;
  platformContent: Record<SocialPlatform, string>;
  contentType: 'post' | 'story' | 'reel' | 'thread';
  
  // Thread-specific content
  threadTweets: Array<{
    id: string;
    content: string;
    mediaIds: string[];
    altTexts: string[];
  }>;
  threadOptions: {
    autoNumbering: boolean;
    numberingStyle: '1/n' | '1.' | 'none';
    delayBetweenTweets: number; // seconds
    connectToTweet?: string; // Tweet ID to reply to
  };
  
  // Media
  media: MediaFile[];
  uploadingFiles: Map<string, number>; // fileId -> progress
  
  // Accounts
  selectedAccounts: string[];
  
  // Publish settings
  publishMode: PublishMode;
  scheduledDate?: Date;
  selectedQueueSlot?: QueueSlot;
  
  // UI state
  activePlatformTab: SocialPlatform;
  activePreviewTab: SocialPlatform;
  
  // Auto-save state
  saveStatus: SaveStatus;
  lastSaved?: Date;
  saveError?: string;
  hasUnsavedChanges: boolean;
}

// Platform Character Limits
export const PLATFORM_LIMITS: Record<SocialPlatform, number> = {
  twitter: 280,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
  threads: 500,
  bluesky: 300,
  youtube: 5000,
  'google-business': 1500,
  pinterest: 500,
  tiktok: 2200,
};

// File Validation Rules
export const FILE_VALIDATION = {
  image: {
    types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 10 * 1024 * 1024, // 10MB
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
  video: {
    types: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'],
    maxSize: 512 * 1024 * 1024 * 1024, // 512GB for YouTube (but warn at 2GB)
    extensions: ['.mp4', '.mov', '.avi', '.webm', '.mkv'],
  },
  youtube: {
    video: {
      types: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-flv', 'video/3gpp'],
      maxSize: 512 * 1024 * 1024 * 1024, // 512GB for verified accounts
      extensions: ['.mp4', '.mov', '.avi', '.webm', '.flv', '.3gp'],
      maxDuration: 12 * 60 * 60, // 12 hours for verified accounts
    },
    thumbnail: {
      types: ['image/jpeg', 'image/png'],
      maxSize: 2 * 1024 * 1024, // 2MB
      extensions: ['.jpg', '.jpeg', '.png'],
      recommendedSize: '1280x720',
    },
  },
};

// Platform-Specific Video Requirements
export const PLATFORM_VIDEO_LIMITS: Record<SocialPlatform, {
  maxSize: number;
  maxDuration: number; // seconds
  supportedFormats: string[];
  aspectRatios: string[];
  maxResolution?: string;
}> = {
  instagram: {
    maxSize: 1 * 1024 * 1024 * 1024, // 1GB
    maxDuration: 90, // 90 seconds for Reels
    supportedFormats: ['video/mp4', 'video/quicktime'],
    aspectRatios: ['9:16', '1:1', '4:5'],
    maxResolution: '1080x1920',
  },
  tiktok: {
    maxSize: 4 * 1024 * 1024 * 1024, // 4GB
    maxDuration: 10 * 60, // 10 minutes
    supportedFormats: ['video/mp4', 'video/quicktime', 'video/webm'],
    aspectRatios: ['9:16'],
    maxResolution: '1080x1920',
  },
  youtube: {
    maxSize: 256 * 1024 * 1024 * 1024, // 256GB
    maxDuration: 12 * 60 * 60, // 12 hours
    supportedFormats: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    maxResolution: '3840x2160', // 4K
  },
  twitter: {
    maxSize: 512 * 1024 * 1024, // 512MB
    maxDuration: 2 * 60 + 20, // 2:20
    supportedFormats: ['video/mp4', 'video/quicktime'],
    aspectRatios: ['16:9', '1:1'],
    maxResolution: '1920x1080',
  },
  linkedin: {
    maxSize: 5 * 1024 * 1024 * 1024, // 5GB
    maxDuration: 10 * 60, // 10 minutes
    supportedFormats: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    aspectRatios: ['16:9', '1:1', '9:16'],
    maxResolution: '1920x1080',
  },
  facebook: {
    maxSize: 10 * 1024 * 1024 * 1024, // 10GB
    maxDuration: 240 * 60, // 240 minutes
    supportedFormats: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    aspectRatios: ['16:9', '1:1', '9:16'],
    maxResolution: '1920x1080',
  },
  threads: {
    maxSize: 1 * 1024 * 1024 * 1024, // 1GB
    maxDuration: 5 * 60, // 5 minutes
    supportedFormats: ['video/mp4', 'video/quicktime'],
    aspectRatios: ['9:16', '1:1', '4:5'],
    maxResolution: '1080x1920',
  },
  bluesky: {
    maxSize: 100 * 1024 * 1024, // 100MB
    maxDuration: 3 * 60, // 3 minutes
    supportedFormats: ['video/mp4', 'video/quicktime'],
    aspectRatios: ['16:9', '1:1', '9:16'],
    maxResolution: '1920x1080',
  },
  'google-business': {
    maxSize: 100 * 1024 * 1024, // 100MB
    maxDuration: 30, // 30 seconds
    supportedFormats: ['video/mp4', 'video/quicktime'],
    aspectRatios: ['16:9', '1:1'],
    maxResolution: '1920x1080',
  },
  pinterest: {
    maxSize: 2 * 1024 * 1024 * 1024, // 2GB
    maxDuration: 15 * 60, // 15 minutes
    supportedFormats: ['video/mp4', 'video/quicktime'],
    aspectRatios: ['1:1', '2:3', '4:5', '9:16'],
    maxResolution: '1080x1920',
  },
};
