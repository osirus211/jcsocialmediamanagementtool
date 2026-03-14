import { HttpClientService } from './HttpClientService';
import { logger } from '../utils/logger';

export interface GiphyResult {
  id: string;
  title: string;
  url: string;
  images: {
    original: {
      url: string;
      width: string;
      height: string;
      size: string;
    };
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    fixed_width: {
      url: string;
      width: string;
      height: string;
    };
    preview_gif: {
      url: string;
      width: string;
      height: string;
    };
  };
  type: 'gif' | 'sticker';
  rating: string;
  username?: string;
  source?: string;
}

export interface GiphySearchResponse {
  data: GiphyResult[];
  pagination: {
    total_count: number;
    count: number;
    offset: number;
  };
}

export class GiphyService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.giphy.com/v1';
  private readonly httpClient: HttpClientService;

  constructor() {
    this.apiKey = process.env.GIPHY_API_KEY || '';
    this.httpClient = new HttpClientService();
    
    if (!this.apiKey) {
      logger.warn('GIPHY_API_KEY not configured - GIF search will not work');
    }
  }

  /**
   * Search for GIFs
   */
  async searchGifs(
    query: string,
    limit: number = 20,
    offset: number = 0,
    rating: string = 'g'
  ): Promise<GiphySearchResponse> {
    if (!this.apiKey) {
      throw new Error('Giphy API key not configured');
    }

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        q: query,
        limit: limit.toString(),
        offset: offset.toString(),
        rating,
        lang: 'en'
      });

      const response = await this.httpClient.get<GiphySearchResponse>(
        `${this.baseUrl}/gifs/search?${params}`
      );

      return {
        data: response.data.data.map(gif => ({ ...gif, type: 'gif' as const })),
        pagination: response.data.pagination
      };
    } catch (error) {
      logger.error('Failed to search GIFs', { error, query, limit, offset });
      throw new Error('Failed to search GIFs');
    }
  }

  /**
   * Get trending GIFs
   */
  async getTrending(
    limit: number = 20,
    rating: string = 'g'
  ): Promise<GiphySearchResponse> {
    if (!this.apiKey) {
      throw new Error('Giphy API key not configured');
    }

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        limit: limit.toString(),
        rating
      });

      const response = await this.httpClient.get<GiphySearchResponse>(
        `${this.baseUrl}/gifs/trending?${params}`
      );

      return {
        data: response.data.data.map(gif => ({ ...gif, type: 'gif' as const })),
        pagination: response.data.pagination
      };
    } catch (error) {
      logger.error('Failed to get trending GIFs', { error, limit });
      throw new Error('Failed to get trending GIFs');
    }
  }

  /**
   * Get GIF by ID
   */
  async getById(id: string): Promise<GiphyResult> {
    if (!this.apiKey) {
      throw new Error('Giphy API key not configured');
    }

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey
      });

      const response = await this.httpClient.get<{ data: GiphyResult }>(
        `${this.baseUrl}/gifs/${id}?${params}`
      );

      return { ...response.data.data, type: 'gif' as const };
    } catch (error) {
      logger.error('Failed to get GIF by ID', { error, id });
      throw new Error('Failed to get GIF');
    }
  }

  /**
   * Get GIF categories
   */
  async getCategories(): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('Giphy API key not configured');
    }

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey
      });

      const response = await this.httpClient.get<{ data: Array<{ name: string }> }>(
        `${this.baseUrl}/gifs/categories?${params}`
      );

      return response.data.data.map(category => category.name);
    } catch (error) {
      logger.error('Failed to get GIF categories', { error });
      throw new Error('Failed to get GIF categories');
    }
  }

  /**
   * Search for stickers
   */
  async searchStickers(
    query: string,
    limit: number = 20,
    offset: number = 0,
    rating: string = 'g'
  ): Promise<GiphySearchResponse> {
    if (!this.apiKey) {
      throw new Error('Giphy API key not configured');
    }

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        q: query,
        limit: limit.toString(),
        offset: offset.toString(),
        rating,
        lang: 'en'
      });

      const response = await this.httpClient.get<GiphySearchResponse>(
        `${this.baseUrl}/stickers/search?${params}`
      );

      return {
        data: response.data.data.map(sticker => ({ ...sticker, type: 'sticker' as const })),
        pagination: response.data.pagination
      };
    } catch (error) {
      logger.error('Failed to search stickers', { error, query, limit, offset });
      throw new Error('Failed to search stickers');
    }
  }

  /**
   * Get trending stickers
   */
  async getTrendingStickers(
    limit: number = 20,
    rating: string = 'g'
  ): Promise<GiphySearchResponse> {
    if (!this.apiKey) {
      throw new Error('Giphy API key not configured');
    }

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        limit: limit.toString(),
        rating
      });

      const response = await this.httpClient.get<GiphySearchResponse>(
        `${this.baseUrl}/stickers/trending?${params}`
      );

      return {
        data: response.data.data.map(sticker => ({ ...sticker, type: 'sticker' as const })),
        pagination: response.data.pagination
      };
    } catch (error) {
      logger.error('Failed to get trending stickers', { error, limit });
      throw new Error('Failed to get trending stickers');
    }
  }

  /**
   * Download GIF as buffer for processing
   */
  async downloadGif(url: string): Promise<Buffer> {
    try {
      const response = await this.httpClient.get(url, {
        responseType: 'arraybuffer'
      });
      
      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to download GIF', { error, url });
      throw new Error('Failed to download GIF');
    }
  }
}