/**
 * Stock Photo Service
 * 
 * Handles Unsplash and Pexels API integration for stock photo search
 */

import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface StockPhoto {
  id: string;
  source: 'unsplash' | 'pexels';
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
}

export interface StockPhotoSearchResult {
  photos: StockPhoto[];
  total: number;
  totalPages: number;
}

export class StockPhotoService {
  private static readonly UNSPLASH_BASE_URL = 'https://api.unsplash.com';
  private static readonly PEXELS_BASE_URL = 'https://api.pexels.com/v1';

  /**
   * Search Unsplash photos
   */
  static async searchUnsplash(
    query: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<StockPhotoSearchResult> {
    try {
      if (!config.stockPhotos.unsplashAccessKey) {
        throw new Error('Unsplash API key not configured');
      }

      const response = await axios.get(`${this.UNSPLASH_BASE_URL}/search/photos`, {
        headers: {
          Authorization: `Client-ID ${config.stockPhotos.unsplashAccessKey}`,
        },
        params: {
          query,
          page,
          per_page: perPage,
        },
      });

      const photos = response.data.results.map((photo: any) => ({
        id: photo.id,
        source: 'unsplash' as const,
        url: {
          thumb: photo.urls.thumb,
          small: photo.urls.small,
          regular: photo.urls.regular,
          full: photo.urls.full,
        },
        photographer: photo.user.name,
        photographerUrl: photo.user.links.html,
        alt: photo.alt_description || photo.description || '',
        downloadLocation: photo.links.download_location,
      }));

      return {
        photos,
        total: response.data.total,
        totalPages: response.data.total_pages,
      };
    } catch (error: any) {
      logger.error('Failed to search Unsplash photos', {
        error: error.message,
        query,
        page,
        perPage,
      });
      throw new Error('Failed to search Unsplash photos');
    }
  }

  /**
   * Get single Unsplash photo
   */
  static async getUnsplashPhoto(id: string): Promise<StockPhoto> {
    try {
      if (!config.stockPhotos.unsplashAccessKey) {
        throw new Error('Unsplash API key not configured');
      }

      const response = await axios.get(`${this.UNSPLASH_BASE_URL}/photos/${id}`, {
        headers: {
          Authorization: `Client-ID ${config.stockPhotos.unsplashAccessKey}`,
        },
      });

      const photo = response.data;
      return {
        id: photo.id,
        source: 'unsplash',
        url: {
          thumb: photo.urls.thumb,
          small: photo.urls.small,
          regular: photo.urls.regular,
          full: photo.urls.full,
        },
        photographer: photo.user.name,
        photographerUrl: photo.user.links.html,
        alt: photo.alt_description || photo.description || '',
        downloadLocation: photo.links.download_location,
      };
    } catch (error: any) {
      logger.error('Failed to get Unsplash photo', {
        error: error.message,
        photoId: id,
      });
      throw new Error('Failed to get Unsplash photo');
    }
  }

  /**
   * Track Unsplash download (required by API terms)
   */
  static async trackUnsplashDownload(downloadLocation: string): Promise<void> {
    try {
      if (!config.stockPhotos.unsplashAccessKey) {
        throw new Error('Unsplash API key not configured');
      }

      await axios.get(downloadLocation, {
        headers: {
          Authorization: `Client-ID ${config.stockPhotos.unsplashAccessKey}`,
        },
      });

      logger.info('Unsplash download tracked', { downloadLocation });
    } catch (error: any) {
      logger.error('Failed to track Unsplash download', {
        error: error.message,
        downloadLocation,
      });
      // Don't throw error as this is just tracking
    }
  }

  /**
   * Search Pexels photos
   */
  static async searchPexels(
    query: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<StockPhotoSearchResult> {
    try {
      if (!config.stockPhotos.pexelsApiKey) {
        throw new Error('Pexels API key not configured');
      }

      const response = await axios.get(`${this.PEXELS_BASE_URL}/search`, {
        headers: {
          Authorization: config.stockPhotos.pexelsApiKey,
        },
        params: {
          query,
          page,
          per_page: perPage,
        },
      });

      const photos = response.data.photos.map((photo: any) => ({
        id: photo.id.toString(),
        source: 'pexels' as const,
        url: {
          thumb: photo.src.tiny,
          small: photo.src.small,
          regular: photo.src.medium,
          full: photo.src.original,
        },
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        alt: photo.alt || '',
      }));

      return {
        photos,
        total: response.data.total_results,
        totalPages: Math.ceil(response.data.total_results / perPage),
      };
    } catch (error: any) {
      logger.error('Failed to search Pexels photos', {
        error: error.message,
        query,
        page,
        perPage,
      });
      throw new Error('Failed to search Pexels photos');
    }
  }

  /**
   * Get single Pexels photo
   */
  static async getPexelsPhoto(id: string): Promise<StockPhoto> {
    try {
      if (!config.stockPhotos.pexelsApiKey) {
        throw new Error('Pexels API key not configured');
      }

      const response = await axios.get(`${this.PEXELS_BASE_URL}/photos/${id}`, {
        headers: {
          Authorization: config.stockPhotos.pexelsApiKey,
        },
      });

      const photo = response.data;
      return {
        id: photo.id.toString(),
        source: 'pexels',
        url: {
          thumb: photo.src.tiny,
          small: photo.src.small,
          regular: photo.src.medium,
          full: photo.src.original,
        },
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        alt: photo.alt || '',
      };
    } catch (error: any) {
      logger.error('Failed to get Pexels photo', {
        error: error.message,
        photoId: id,
      });
      throw new Error('Failed to get Pexels photo');
    }
  }

  /**
   * Get curated photos from both sources
   */
  static async getCuratedPhotos(
    page: number = 1,
    perPage: number = 20
  ): Promise<StockPhotoSearchResult> {
    try {
      const promises = [];

      // Get curated from Unsplash
      if (config.stockPhotos.unsplashAccessKey) {
        promises.push(
          axios.get(`${this.UNSPLASH_BASE_URL}/photos`, {
            headers: {
              Authorization: `Client-ID ${config.stockPhotos.unsplashAccessKey}`,
            },
            params: {
              page,
              per_page: Math.ceil(perPage / 2),
            },
          }).then(response => ({
            source: 'unsplash',
            photos: response.data.map((photo: any) => ({
              id: photo.id,
              source: 'unsplash' as const,
              url: {
                thumb: photo.urls.thumb,
                small: photo.urls.small,
                regular: photo.urls.regular,
                full: photo.urls.full,
              },
              photographer: photo.user.name,
              photographerUrl: photo.user.links.html,
              alt: photo.alt_description || photo.description || '',
              downloadLocation: photo.links.download_location,
            })),
          }))
        );
      }

      // Get curated from Pexels
      if (config.stockPhotos.pexelsApiKey) {
        promises.push(
          axios.get(`${this.PEXELS_BASE_URL}/curated`, {
            headers: {
              Authorization: config.stockPhotos.pexelsApiKey,
            },
            params: {
              page,
              per_page: Math.ceil(perPage / 2),
            },
          }).then(response => ({
            source: 'pexels',
            photos: response.data.photos.map((photo: any) => ({
              id: photo.id.toString(),
              source: 'pexels' as const,
              url: {
                thumb: photo.src.tiny,
                small: photo.src.small,
                regular: photo.src.medium,
                full: photo.src.original,
              },
              photographer: photo.photographer,
              photographerUrl: photo.photographer_url,
              alt: photo.alt || '',
            })),
          }))
        );
      }

      const results = await Promise.allSettled(promises);
      const allPhotos: StockPhoto[] = [];

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          allPhotos.push(...result.value.photos);
        }
      });

      // Shuffle photos to mix sources
      const shuffledPhotos = allPhotos.sort(() => Math.random() - 0.5);

      return {
        photos: shuffledPhotos.slice(0, perPage),
        total: shuffledPhotos.length,
        totalPages: Math.ceil(shuffledPhotos.length / perPage),
      };
    } catch (error: any) {
      logger.error('Failed to get curated photos', {
        error: error.message,
        page,
        perPage,
      });
      throw new Error('Failed to get curated photos');
    }
  }
}