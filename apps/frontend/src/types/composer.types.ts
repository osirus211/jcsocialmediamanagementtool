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

export type SocialPlatform = 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'threads' | 'bluesky' | 'youtube' | 'google-business';

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
  type: 'image' | 'video';
  size: number;
  filename: string;
  mimeType: string;
  uploadProgress?: number; // 0-100
  uploadStatus: UploadStatus;
  errorMessage?: string;
  thumbnailUrl?: string;
}

export interface Media {
  _id: string;
  workspaceId: string;
  type: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl?: string;
  filename: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  metadata?: any;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
};

// File Validation Rules
export const FILE_VALIDATION = {
  image: {
    types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 10 * 1024 * 1024, // 10MB
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
  video: {
    types: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    maxSize: 100 * 1024 * 1024, // 100MB
    extensions: ['.mp4', '.mov', '.avi'],
  },
};
