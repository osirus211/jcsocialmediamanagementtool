/**
 * Media Service
 * Frontend service for media API calls
 */

import { apiClient } from '@/lib/api-client';

export interface TrimVideoRequest {
  startTime: number;
  endTime: number;
}

export interface GenerateThumbnailRequest {
  timeOffset?: number;
}

export interface MediaResponse {
  _id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  mediaType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  storageUrl: string;
  cdnUrl?: string;
  thumbnailUrl?: string;
  uploadStatus: string;
  createdAt: string;
  updatedAt: string;
}

class MediaService {
  /**
   * Trim video
   */
  async trimVideo(mediaId: string, startTime: number, endTime: number): Promise<MediaResponse> {
    const response = await apiClient.post<{ success: boolean; data: MediaResponse }>(
      `/media/${mediaId}/trim`,
      { startTime, endTime }
    );

    return response.data;
  }

  /**
   * Generate thumbnail for video
   */
  async generateThumbnail(mediaId: string, timeOffset?: number): Promise<MediaResponse> {
    const response = await apiClient.post<{ success: boolean; data: MediaResponse }>(
      `/media/${mediaId}/thumbnail`,
      { timeOffset }
    );

    return response.data;
  }
}

export const mediaService = new MediaService();