/**
 * Stock Photos Service
 * 
 * API integration for Unsplash and Pexels stock photo search
 */

import { apiClient } from '@/lib/api-client';

export interface StockPhoto {
  id: string;
  source: 'unsplash' | 'pexels' | 'pixabay';
  url: {
    thumb: string;
    small: string;
    regular: string;
    full: string;
  };
  photographer: string;
  photographerUrl: string;
  alt: string;
  downloadLocation?: string; // Unsplash only
  tags?: string; // Pixabay tags
  views?: number;
  downloads?: number;
  likes?: number;
}

export interface StockPhotoSearchResult {
  photos: StockPhoto[];
  total: number;
  totalPages: number;
}

export interface StockPhotoFilters {
  orientation?: 'all' | 'horizontal' | 'vertical';
  category?: string;
  colors?: string;
}

export const stockPhotosService = {
  /**
   * Search stock photos
   */
  async search(
    query: string,
    source: 'unsplash' | 'pexels' | 'pixabay' | 'all' = 'all',
    page: number = 1,
    perPage: number = 20,
    filters?: StockPhotoFilters
  ): Promise<StockPhotoSearchResult> {
    const params = new URLSearchParams({
      q: query,
      source,
      page: page.toString(),
      perPage: perPage.toString(),
    });

    if (filters?.orientation && filters.orientation !== 'all') {
      params.append('orientation', filters.orientation);
    }

    if (filters?.category) {
      params.append('category', filters.category);
    }

    if (filters?.colors) {
      params.append('colors', filters.colors);
    }

    const response = await apiClient.get(`/stock-photos/search?${params.toString()}`);
    return response.data;
  },

  /**
   * Get curated/trending photos
   */
  async getCurated(page: number = 1, perPage: number = 20): Promise<StockPhotoSearchResult> {
    const params = new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString(),
    });

    const response = await apiClient.get(`/stock-photos/curated?${params.toString()}`);
    return response.data;
  },

  /**
   * Track Unsplash download (required by API terms)
   */
  async trackDownload(downloadLocation: string): Promise<void> {
    await apiClient.post('/stock-photos/track-download', {
      downloadLocation,
    });
  },

  /**
   * Download image as File object
   */
  async downloadAsFile(photo: StockPhoto): Promise<File> {
    try {
      // Track download for Unsplash
      if (photo.source === 'unsplash' && photo.downloadLocation) {
        await this.trackDownload(photo.downloadLocation);
      }

      // Fetch image as blob
      const response = await fetch(photo.url.regular);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const blob = await response.blob();
      const filename = `${photo.id}.jpg`;
      
      return new File([blob], filename, { type: blob.type || 'image/jpeg' });
    } catch (error) {
      console.error('Failed to download stock photo:', error);
      throw new Error('Failed to download image');
    }
  },
};