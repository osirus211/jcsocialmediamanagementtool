/**
 * ShortLink Service
 * 
 * URL shortening and click tracking
 */

import { nanoid } from 'nanoid';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { ShortLink, IShortLink } from '../models/ShortLink';
import { LinkClick } from '../models/LinkClick';
import { logger } from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { config } from '../config';
import { BitlyService } from './BitlyService';
import { SSRF_BLOCKED_PATTERNS, SSRF_BLOCKED_CIDRS } from '../constants/platformLimits';

export interface CreateShortLinkOptions {
  postId?: string;
  platform?: string;
  expiresAt?: Date;
  customDomain?: string;
  title?: string;
  tags?: string[];
  password?: string;
  useBitly?: boolean;
  bitlyAccessToken?: string;
  utmParams?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}

export interface ClickMetadata {
  ip: string;
  userAgent?: string;
  referrer?: string;
}

export interface LinkStats {
  shortCode: string;
  originalUrl: string;
  clicks: number;
  clickHistory: Array<{
    clickedAt: Date;
    userAgent?: string;
    referrer?: string;
  }>;
  createdAt: Date;
}

export class ShortLinkService {
  private static instance: ShortLinkService;

  private constructor() {}

  static getInstance(): ShortLinkService {
    if (!ShortLinkService.instance) {
      ShortLinkService.instance = new ShortLinkService();
    }
    return ShortLinkService.instance;
  }

  /**
   * Generate unique short code
   */
  private async generateShortCode(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const code = nanoid(8);
      const existing = await ShortLink.findOne({ shortCode: code });
      
      if (!existing) {
        return code;
      }
      
      attempts++;
    }

    throw new Error('Failed to generate unique short code');
  }

  /**
   * Create shortened link
   */
  async createShortLink(
    originalUrl: string,
    workspaceId: string,
    userId: string,
    options?: CreateShortLinkOptions
  ): Promise<{ shortLink: IShortLink; shortUrl: string }> {
    try {
      // Validate URL
      let processedUrl = originalUrl;
      try {
        const urlObj = new URL(originalUrl);
        
        // SSRF protection
        const hostname = urlObj.hostname.toLowerCase();
        const protocol = urlObj.protocol;

        // Block dangerous protocols
        if (['file:', 'javascript:', 'data:'].includes(protocol)) {
          throw new BadRequestError('Invalid URL protocol');
        }

        // Block SSRF patterns
        for (const pattern of SSRF_BLOCKED_PATTERNS) {
          if (hostname.includes(pattern)) {
            throw new BadRequestError('URL not allowed');
          }
        }

        // Block private IP ranges
        for (const cidr of SSRF_BLOCKED_CIDRS) {
          if (cidr.test(hostname)) {
            throw new BadRequestError('Private IP addresses not allowed');
          }
        }
        
        // Add UTM parameters if provided
        if (options?.utmParams) {
          const params = new URLSearchParams(urlObj.search);
          
          if (options.utmParams.source) params.set('utm_source', options.utmParams.source);
          if (options.utmParams.medium) params.set('utm_medium', options.utmParams.medium);
          if (options.utmParams.campaign) params.set('utm_campaign', options.utmParams.campaign);
          if (options.utmParams.term) params.set('utm_term', options.utmParams.term);
          if (options.utmParams.content) params.set('utm_content', options.utmParams.content);
          
          urlObj.search = params.toString();
          processedUrl = urlObj.toString();
        }
      } catch (error) {
        if (error instanceof BadRequestError) throw error;
        throw new BadRequestError('Invalid URL format');
      }

      const shortCode = await this.generateShortCode();
      let bitlyUrl: string | undefined;
      let bitlyId: string | undefined;

      // Try Bitly if enabled and token provided
      if (options?.useBitly && options?.bitlyAccessToken) {
        try {
          const bitlyService = new BitlyService({ accessToken: options.bitlyAccessToken });
          const bitlink = await bitlyService.createBitlink(
            processedUrl,
            options.customDomain,
            options.title,
            options.tags
          );
          bitlyUrl = bitlink.link;
          bitlyId = bitlink.id;
          
          logger.info('Created Bitly link', { bitlyId, bitlyUrl });
        } catch (error) {
          logger.warn('Bitly creation failed, falling back to built-in shortener', error);
          // Continue with built-in shortener as fallback
        }
      }

      const shortLink = await ShortLink.create({
        originalUrl: processedUrl,
        shortCode,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        postId: options?.postId ? new mongoose.Types.ObjectId(options.postId) : undefined,
        platform: options?.platform,
        createdBy: new mongoose.Types.ObjectId(userId),
        expiresAt: options?.expiresAt,
        title: options?.title,
        tags: options?.tags,
        password: options?.password,
        bitlyId,
        bitlyUrl,
        useBitly: !!bitlyUrl,
        clicks: 0,
        isActive: true,
      });

      // Use Bitly URL if available, otherwise use custom domain or default
      let shortUrl: string;
      if (bitlyUrl) {
        shortUrl = bitlyUrl;
      } else {
        const domain = options?.customDomain || config.apiUrl;
        shortUrl = `${domain}/r/${shortCode}`;
      }

      logger.info('Short link created', {
        shortCode,
        originalUrl: processedUrl,
        workspaceId,
        useBitly: !!bitlyUrl,
        customDomain: options?.customDomain,
      });

      return { shortLink, shortUrl };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to create short link', {
        originalUrl,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Get short link by code
   */
  async getShortLink(shortCode: string): Promise<IShortLink | null> {
    try {
      const link = await ShortLink.findOne({ shortCode });
      
      // Check expiration
      if (link && link.expiresAt && link.expiresAt < new Date()) {
        return null;
      }
      
      return link;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to get short link', {
        shortCode,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Record click event
   */
  async recordClick(shortCode: string, metadata: ClickMetadata): Promise<void> {
    try {
      // Hash IP for privacy
      const hashedIp = crypto
        .createHash('sha256')
        .update(metadata.ip)
        .digest('hex');

      // Increment click count
      await ShortLink.findOneAndUpdate(
        { shortCode },
        { $inc: { clicks: 1 } }
      );

      // Record click event
      await LinkClick.create({
        shortCode,
        clickedAt: new Date(),
        ip: hashedIp,
        userAgent: metadata.userAgent,
        referrer: metadata.referrer,
      });

      logger.info('Click recorded', { shortCode });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to record click', {
        shortCode,
        error: err.message,
      });
      // Don't throw - click tracking failure shouldn't break redirect
    }
  }

  /**
   * Get links for workspace (paginated)
   */
  async getLinksForWorkspace(
    workspaceId: string,
    page: number = 1,
    limit: number = 20,
    filters?: any
  ): Promise<{ links: IShortLink[]; total: number; page: number; totalPages: number }> {
    try {
      const skip = (page - 1) * limit;

      // Default filter
      const query = filters || { workspaceId: new mongoose.Types.ObjectId(workspaceId) };

      const [links, total] = await Promise.all([
        ShortLink.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ShortLink.countDocuments(query),
      ]);

      return {
        links: links as unknown as IShortLink[],
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to get workspace links', {
        workspaceId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Get link statistics
   */
  async getLinkStats(shortCode: string, workspaceId: string): Promise<LinkStats> {
    try {
      const link = await ShortLink.findOne({
        shortCode,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!link) {
        throw new NotFoundError('Short link not found');
      }

      const clickHistory = await LinkClick.find({ shortCode })
        .sort({ clickedAt: -1 })
        .limit(100)
        .select('clickedAt userAgent referrer')
        .lean();

      return {
        shortCode: link.shortCode,
        originalUrl: link.originalUrl,
        clicks: link.clicks,
        clickHistory: clickHistory.map((click) => ({
          clickedAt: click.clickedAt,
          userAgent: click.userAgent,
          referrer: click.referrer,
        })),
        createdAt: link.createdAt,
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to get link stats', {
        shortCode,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Delete short link
   */
  async deleteLink(shortCode: string, workspaceId: string): Promise<void> {
    try {
      const result = await ShortLink.findOneAndDelete({
        shortCode,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!result) {
        throw new NotFoundError('Short link not found');
      }

      // Delete associated clicks
      await LinkClick.deleteMany({ shortCode });

      logger.info('Short link deleted', { shortCode, workspaceId });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to delete link', {
        shortCode,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Find and shorten all URLs in content
   */
  async expandUrlsInContent(
    content: string,
    workspaceId: string,
    userId: string
  ): Promise<string> {
    try {
      // URL regex pattern
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = content.match(urlRegex);

      if (!urls || urls.length === 0) {
        return content;
      }

      let modifiedContent = content;

      for (const url of urls) {
        const { shortUrl } = await this.createShortLink(url, workspaceId, userId);
        modifiedContent = modifiedContent.replace(url, shortUrl);
      }

      logger.info('URLs shortened in content', {
        urlCount: urls.length,
        workspaceId,
      });

      return modifiedContent;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to expand URLs in content', {
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Generate QR code for short URL
   */
  async generateQRCode(shortUrl: string, options?: { size?: number; margin?: number }): Promise<string> {
    try {
      const QRCode = require('qrcode');
      
      const qrOptions = {
        errorCorrectionLevel: 'M' as const,
        type: 'image/png' as const,
        quality: 0.92,
        margin: options?.margin || 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: options?.size || 256,
      };

      const qrCodeDataUrl = await QRCode.toDataURL(shortUrl, qrOptions);
      
      logger.info('Generated QR code for short URL', { shortUrl });
      return qrCodeDataUrl;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to generate QR code', {
        shortUrl,
        error: err.message,
      });
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate QR code as SVG
   */
  async generateQRCodeSVG(shortUrl: string, options?: { size?: number; margin?: number }): Promise<string> {
    try {
      const QRCode = require('qrcode');
      
      const qrOptions = {
        errorCorrectionLevel: 'M' as const,
        margin: options?.margin || 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: options?.size || 256,
      };

      const qrCodeSVG = await QRCode.toString(shortUrl, { ...qrOptions, type: 'svg' });
      
      logger.info('Generated QR code SVG for short URL', { shortUrl });
      return qrCodeSVG;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to generate QR code SVG', {
        shortUrl,
        error: err.message,
      });
      throw new Error('Failed to generate QR code SVG');
    }
  }

  /**
   * Update link destination and properties
   */
  async updateLink(
    shortCode: string,
    workspaceId: string,
    updates: {
      originalUrl?: string;
      title?: string;
      tags?: string[];
      password?: string;
      expiresAt?: Date;
      isActive?: boolean;
    }
  ): Promise<IShortLink> {
    try {
      const link = await ShortLink.findOneAndUpdate(
        {
          shortCode,
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        updates,
        { new: true }
      );

      if (!link) {
        throw new NotFoundError('Short link not found');
      }

      logger.info('Short link updated', { shortCode, updates });
      return link;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to update link', {
        shortCode,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Toggle link active status
   */
  async toggleLinkStatus(shortCode: string, workspaceId: string): Promise<IShortLink> {
    try {
      const link = await ShortLink.findOne({
        shortCode,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!link) {
        throw new NotFoundError('Short link not found');
      }

      link.isActive = !link.isActive;
      await link.save();

      logger.info('Short link status toggled', { shortCode, isActive: link.isActive });
      return link;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to toggle link status', {
        shortCode,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Bulk shorten URLs
   */
  async bulkShortenUrls(
    urls: string[],
    workspaceId: string,
    userId: string,
    options?: CreateShortLinkOptions
  ): Promise<Array<{ original: string; shortened: string; id: string; error?: string }>> {
    const results = [];

    for (const url of urls) {
      try {
        const { shortLink, shortUrl } = await this.createShortLink(url, workspaceId, userId, options);
        results.push({
          original: url,
          shortened: shortUrl,
          id: shortLink._id.toString(),
        });
      } catch (error: unknown) {
        const err = error as Error;
        results.push({
          original: url,
          shortened: '',
          id: '',
          error: err.message,
        });
      }
    }

    logger.info('Bulk URL shortening completed', {
      totalUrls: urls.length,
      successful: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length,
    });

    return results;
  }
}

export const shortLinkService = ShortLinkService.getInstance();
