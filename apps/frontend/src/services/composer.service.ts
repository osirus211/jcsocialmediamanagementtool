import { apiClient } from '@/lib/api-client';
import {
  CreateDraftRequest,
  UpdateDraftRequest,
  PublishPostRequest,
  DraftResponse,
  PublishResponse,
  UploadMediaResponse,
  MediaLibraryResponse,
  QueueSlotsResponse,
  Media,
} from '@/types/composer.types';
import { platformSettingsService } from './platform-settings.service';
import { SocialPlatform } from '@/types/social.types';

/**
 * Composer Service
 * API integration for composer operations
 */
class ComposerService {
  /**
   * Create draft post
   */
  async createDraft(data: CreateDraftRequest): Promise<any> {
    const response = await apiClient.post<DraftResponse>('/composer/drafts', data);
    return response.post;
  }

  /**
   * Update draft post
   */
  async updateDraft(draftId: string, data: UpdateDraftRequest): Promise<any> {
    const response = await apiClient.patch<DraftResponse>(
      `/composer/drafts/${draftId}`,
      data
    );
    return response.post;
  }

  /**
   * Publish post (NOW, SCHEDULE, or QUEUE)
   */
  async publishPost(postId: string, data: PublishPostRequest): Promise<any> {
    const response = await apiClient.post<PublishResponse>(
      `/composer/posts/${postId}/publish`,
      data
    );
    return response.post;
  }

  /**
   * Duplicate post
   */
  async duplicatePost(postId: string): Promise<any> {
    const response = await apiClient.post<DraftResponse>(
      `/composer/posts/${postId}/duplicate`,
      {}
    );
    return response.post;
  }

  /**
   * Cancel scheduled/queued post
   */
  async cancelPost(postId: string): Promise<void> {
    await apiClient.post(`/composer/posts/${postId}/cancel`, {});
  }

  /**
   * Delete post
   */
  async deletePost(postId: string): Promise<void> {
    await apiClient.delete(`/composer/posts/${postId}`);
  }

  /**
   * Upload media file
   */
  async uploadMedia(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Media> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<UploadMediaResponse>(
      '/composer/media/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(progress);
          }
        },
      }
    );

    return response.media;
  }

  /**
   * Get media library with advanced filters
   */
  async getMediaLibrary(filters?: any): Promise<MediaLibraryResponse> {
    // Handle both old and new API calls
    if (typeof filters === 'number') {
      // Old API: getMediaLibrary(page, limit)
      const page = filters;
      const limit = arguments[1] || 20;
      const response = await apiClient.get<MediaLibraryResponse>(
        `/composer/media?page=${page}&limit=${limit}`
      );
      return response;
    }
    
    // New API: getMediaLibrary(filters)
    const params = new URLSearchParams();
    
    if (filters?.search) params.append('search', filters.search);
    if (filters?.type && filters.type !== 'all') params.append('type', filters.type);
    if (filters?.dateRange && filters.dateRange !== 'all') params.append('dateRange', filters.dateRange);
    if (filters?.customDateStart) params.append('customDateStart', filters.customDateStart);
    if (filters?.customDateEnd) params.append('customDateEnd', filters.customDateEnd);
    if (filters?.sizeRange && filters.sizeRange !== 'all') params.append('sizeRange', filters.sizeRange);
    if (filters?.platform) params.append('platform', filters.platform);
    if (filters?.folderId) params.append('folderId', filters.folderId);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    
    const response = await apiClient.get<MediaLibraryResponse>(
      `/composer/media?${params.toString()}`
    );
    return response;
  }

  /**
   * Get media folders
   */
  async getMediaFolders(): Promise<{ folders: any[] }> {
    const response = await apiClient.get('/composer/media/folders');
    return response;
  }

  /**
   * Create media folder
   */
  async createMediaFolder(name: string): Promise<any> {
    const response = await apiClient.post('/composer/media/folders', { name });
    return response;
  }

  /**
   * Rename media folder
   */
  async renameMediaFolder(folderId: string, name: string): Promise<any> {
    const response = await apiClient.put(`/composer/media/folders/${folderId}`, { name });
    return response;
  }

  /**
   * Delete media folder
   */
  async deleteMediaFolder(folderId: string): Promise<any> {
    const response = await apiClient.delete(`/composer/media/folders/${folderId}`);
    return response;
  }

  /**
   * Move media to folder
   */
  async moveMediaToFolder(mediaIds: string[], folderId?: string): Promise<any> {
    const response = await apiClient.post('/composer/media/move', { mediaIds, folderId });
    return response;
  }

  /**
   * Bulk delete media
   */
  async bulkDeleteMedia(mediaIds: string[]): Promise<any> {
    const response = await apiClient.post('/composer/media/bulk-delete', { mediaIds });
    return response;
  }

  /**
   * Bulk download media
   */
  async bulkDownloadMedia(mediaIds: string[]): Promise<any> {
    const response = await apiClient.post('/composer/media/bulk-download', { mediaIds });
    return response;
  }

  /**
   * Update media
   */
  async updateMedia(mediaId: string, updates: any): Promise<any> {
    const response = await apiClient.put(`/composer/media/${mediaId}`, updates);
    return response;
  }

  /**
   * Get recently used media
   */
  async getRecentlyUsedMedia(): Promise<{ media: any[] }> {
    const response = await apiClient.get('/composer/media/recent');
    return response;
  }

  /**
   * Get storage usage
   */
  async getStorageUsage(): Promise<{ used: number; total: number; images: number; videos: number }> {
    const response = await apiClient.get('/composer/storage-usage');
    return response;
  }

  /**
   * Delete media
   */
  async deleteMedia(mediaId: string): Promise<void> {
    await apiClient.delete(`/composer/media/${mediaId}`);
  }

  /**
   * Get available queue slots
   */
  async getQueueSlots(): Promise<QueueSlotsResponse> {
    const response = await apiClient.get<QueueSlotsResponse>('/composer/queue-slots');
    return response;
  }

  /**
   * Apply platform defaults to post content
   */
  async applyPlatformDefaults(
    platform: SocialPlatform,
    post: {
      content: string;
      hashtags?: string[];
      firstComment?: string;
      visibility?: string;
      location?: string;
      media?: any[];
    },
    accountId?: string
  ): Promise<any> {
    try {
      const response = await platformSettingsService.applyDefaults({
        platform,
        accountId,
        post
      });
      return response.post;
    } catch (error) {
      console.error('Error applying platform defaults:', error);
      // Return original post if defaults fail
      return {
        ...post,
        hashtags: post.hashtags || [],
        firstComment: post.firstComment || '',
        visibility: post.visibility || 'public',
        appliedDefaults: {
          hashtagsAdded: [],
          watermarkApplied: false
        }
      };
    }
  }

  /**
   * Get draft by ID
   */
  async getDraft(draftId: string): Promise<any> {
    const response = await apiClient.get<DraftResponse>(`/composer/drafts/${draftId}`);
    return response.post;
  }

  /**
   * Compress single media file
   */
  async compressMedia(mediaId: string, options: any): Promise<any> {
    const response = await apiClient.post(`/composer/media/${mediaId}/compress`, options);
    return response;
  }

  /**
   * Batch compress multiple media files
   */
  async batchCompressMedia(mediaIds: string[], compressionOptions: any): Promise<any> {
    const response = await apiClient.post('/composer/media/batch-compress', {
      mediaIds,
      compressionOptions,
    });
    return response;
  }

  /**
   * Get platform-specific compression recommendations
   */
  async getCompressionRecommendations(platform?: string): Promise<any> {
    const url = platform 
      ? `/composer/compression/recommendations/${platform}`
      : '/composer/compression/recommendations';
    const response = await apiClient.get(url);
    return response;
  }
}

export const composerService = new ComposerService();
