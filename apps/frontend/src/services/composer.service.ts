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
   * Get media library
   */
  async getMediaLibrary(page: number = 1, limit: number = 20): Promise<MediaLibraryResponse> {
    const response = await apiClient.get<MediaLibraryResponse>(
      `/composer/media?page=${page}&limit=${limit}`
    );
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
   * Get draft by ID
   */
  async getDraft(draftId: string): Promise<any> {
    const response = await apiClient.get<DraftResponse>(`/composer/drafts/${draftId}`);
    return response.post;
  }
}

export const composerService = new ComposerService();
