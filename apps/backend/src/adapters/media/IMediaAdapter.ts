/**
 * Media Adapter Interface
 * 
 * Defines contract for platform-specific media upload adapters
 */

import { ISocialAccount } from '../../models/SocialAccount';

export interface MediaUploadOptions {
  fileUrl: string;
  mediaType: 'image' | 'video' | 'gif';
  caption?: string;
}

export interface MediaUploadResult {
  platformMediaId: string;
  uploadedAt: Date;
  metadata?: Record<string, any>;
}

export interface IMediaAdapter {
  readonly platform: string;
  
  /**
   * Upload media to platform
   */
  uploadMedia(account: ISocialAccount, options: MediaUploadOptions): Promise<MediaUploadResult>;
  
  /**
   * Check if media upload is required for this platform
   * Some platforms (like Twitter) require pre-upload, others don't
   */
  requiresPreUpload(): boolean;
}
