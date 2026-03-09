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

export interface CreateShortLinkOptions {
  postId?: string;
  platform?: string;
  expiresAt?: Date;
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
      try {
        new URL(originalUrl);
      } catch {
        throw new BadRequestError('Invalid URL format');
      }

      const shortCode = await this.generateShortCode();

      const shortLink = await ShortLink.create({
        originalUrl,
        shortCode,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        postId: options?.postId ? new mongoose.Types.ObjectId(options.postId) : undefined,
        platform: options?.platform,
        createdBy: new mongoose.Types.ObjectId(userId),
        expiresAt: options?.expiresAt,
        clicks: 0,
      });

      const shortUrl = `${config.server.apiUrl}/r/${shortCode}`;

      logger.info('Short link created', {
        shortCode,
        originalUrl,
        workspaceId,
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
    limit: number = 20
  ): Promise<{ links: IShortLink[]; total: number; page: number; totalPages: number }> {
    try {
      const skip = (page - 1) * limit;

      const [links, total] = await Promise.all([
        ShortLink.find({ workspaceId: new mongoose.Types.ObjectId(workspaceId) })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ShortLink.countDocuments({ workspaceId: new mongoose.Types.ObjectId(workspaceId) }),
      ]);

      return {
        links: links as IShortLink[],
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
}

export const shortLinkService = ShortLinkService.getInstance();
