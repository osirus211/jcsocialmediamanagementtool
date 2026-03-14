/**
 * Link Preview Service
 * 
 * Fetches Open Graph and Twitter Card metadata from URLs
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';
import { BadRequestError } from '../utils/errors';

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  type?: string;
  favicon?: string;
}

export class LinkPreviewService {
  private static instance: LinkPreviewService;
  private cache = new Map<string, { data: LinkPreviewData; timestamp: number }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {}

  static getInstance(): LinkPreviewService {
    if (!LinkPreviewService.instance) {
      LinkPreviewService.instance = new LinkPreviewService();
    }
    return LinkPreviewService.instance;
  }

  /**
   * Fetch link preview data for a URL
   */
  async fetchPreview(url: string): Promise<LinkPreviewData> {
    try {
      // Validate URL
      let validUrl: URL;
      try {
        validUrl = new URL(url);
      } catch {
        throw new BadRequestError('Invalid URL format');
      }

      // Check cache first
      const cached = this.cache.get(url);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      // Fetch HTML content
      const response = await axios.get(url, {
        timeout: 10000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SocialMediaBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        maxContentLength: 5 * 1024 * 1024, // 5MB limit
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Extract metadata
      const preview: LinkPreviewData = {
        url,
        title: this.extractTitle($),
        description: this.extractDescription($),
        image: this.extractImage($, validUrl),
        siteName: this.extractSiteName($, validUrl),
        type: this.extractType($),
        favicon: this.extractFavicon($, validUrl),
      };

      // Cache the result
      this.cache.set(url, {
        data: preview,
        timestamp: Date.now(),
      });

      logger.info('Link preview fetched', { url, title: preview.title });
      return preview;
    } catch (error: any) {
      logger.error('Failed to fetch link preview', {
        url,
        error: error.message,
      });

      // Return basic preview on error
      return {
        url,
        title: new URL(url).hostname,
        description: 'Unable to fetch preview',
        siteName: new URL(url).hostname,
      };
    }
  }

  /**
   * Fetch previews for multiple URLs
   */
  async fetchMultiplePreviews(urls: string[]): Promise<LinkPreviewData[]> {
    const promises = urls.map(url => this.fetchPreview(url));
    return Promise.all(promises);
  }

  /**
   * Extract URLs from text content
   */
  extractUrls(content: string): string[] {
    const urlRegex = /https?:\/\/[^\s]+/g;
    return content.match(urlRegex) || [];
  }

  /**
   * Clear cache for a specific URL or all URLs
   */
  clearCache(url?: string): void {
    if (url) {
      this.cache.delete(url);
    } else {
      this.cache.clear();
    }
  }

  private extractTitle($: cheerio.CheerioAPI): string | undefined {
    // Try Open Graph title first
    let title = $('meta[property="og:title"]').attr('content');
    
    // Try Twitter card title
    if (!title) {
      title = $('meta[name="twitter:title"]').attr('content');
    }
    
    // Fall back to page title
    if (!title) {
      title = $('title').text();
    }

    return title?.trim();
  }

  private extractDescription($: cheerio.CheerioAPI): string | undefined {
    // Try Open Graph description first
    let description = $('meta[property="og:description"]').attr('content');
    
    // Try Twitter card description
    if (!description) {
      description = $('meta[name="twitter:description"]').attr('content');
    }
    
    // Fall back to meta description
    if (!description) {
      description = $('meta[name="description"]').attr('content');
    }

    return description?.trim();
  }

  private extractImage($: cheerio.CheerioAPI, baseUrl: URL): string | undefined {
    // Try Open Graph image first
    let image = $('meta[property="og:image"]').attr('content');
    
    // Try Twitter card image
    if (!image) {
      image = $('meta[name="twitter:image"]').attr('content');
    }

    // Try to resolve relative URLs
    if (image && !image.startsWith('http')) {
      try {
        image = new URL(image, baseUrl.origin).href;
      } catch {
        // Invalid URL, ignore
        image = undefined;
      }
    }

    return image;
  }

  private extractSiteName($: cheerio.CheerioAPI, baseUrl: URL): string | undefined {
    // Try Open Graph site name first
    let siteName = $('meta[property="og:site_name"]').attr('content');
    
    // Try Twitter site
    if (!siteName) {
      siteName = $('meta[name="twitter:site"]').attr('content');
    }
    
    // Fall back to hostname
    if (!siteName) {
      siteName = baseUrl.hostname;
    }

    return siteName?.trim();
  }

  private extractType($: cheerio.CheerioAPI): string | undefined {
    return $('meta[property="og:type"]').attr('content')?.trim();
  }

  private extractFavicon($: cheerio.CheerioAPI, baseUrl: URL): string | undefined {
    // Try various favicon selectors
    const selectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
    ];

    for (const selector of selectors) {
      const href = $(selector).attr('href');
      if (href) {
        try {
          return new URL(href, baseUrl.origin).href;
        } catch {
          // Invalid URL, continue
        }
      }
    }

    // Default favicon location
    return `${baseUrl.origin}/favicon.ico`;
  }
}

export const linkPreviewService = LinkPreviewService.getInstance();