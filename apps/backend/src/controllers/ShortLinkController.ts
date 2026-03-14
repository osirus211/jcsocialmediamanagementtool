/**
 * ShortLink Controller
 * 
 * Handles link shortening operations
 */

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { shortLinkService } from '../services/ShortLinkService';
import { linkAnalyticsService } from '../services/LinkAnalyticsService';
import { UnauthorizedError } from '../utils/errors';
import { getPaginationParams } from '../utils/pagination';

export class ShortLinkController {
  /**
   * Get workspace links
   * GET /links
   */
  async getLinks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const { page, limit } = getPaginationParams(req.query);
      const { search, platform, status, dateFrom, dateTo } = req.query;

      // Build filter object
      const filters: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };

      // Search filter
      if (search) {
        filters.$or = [
          { originalUrl: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search as string, 'i')] } },
        ];
      }

      // Platform filter
      if (platform) {
        filters.platform = platform;
      }

      // Status filter
      if (status === 'active') {
        filters.isActive = true;
        filters.$or = [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ];
      } else if (status === 'inactive') {
        filters.isActive = false;
      } else if (status === 'expired') {
        filters.expiresAt = { $lt: new Date() };
      }

      // Date range filter
      if (dateFrom || dateTo) {
        filters.createdAt = {};
        if (dateFrom) {
          filters.createdAt.$gte = new Date(dateFrom as string);
        }
        if (dateTo) {
          filters.createdAt.$lte = new Date(dateTo as string);
        }
      }

      const result = await shortLinkService.getLinksForWorkspace(
        workspaceId, 
        page, 
        limit,
        filters
      );

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Shorten URL
   * POST /links/shorten
   */
  async shortenUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId;

      if (!workspaceId || !userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const { 
        originalUrl, 
        postId, 
        platform, 
        expiresAt, 
        title, 
        tags, 
        password, 
        useBitly, 
        bitlyAccessToken,
        customDomain,
        utmParams 
      } = req.body;

      const { shortLink, shortUrl } = await shortLinkService.createShortLink(
        originalUrl,
        workspaceId,
        userId,
        {
          postId,
          platform,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          title,
          tags,
          password,
          useBitly,
          bitlyAccessToken,
          customDomain,
          utmParams,
        }
      );

      res.status(201).json({
        success: true,
        data: {
          shortCode: shortLink.shortCode,
          originalUrl: shortLink.originalUrl,
          shortUrl,
          clicks: shortLink.clicks,
          createdAt: shortLink.createdAt,
          title: shortLink.title,
          tags: shortLink.tags,
          isActive: shortLink.isActive,
          useBitly: shortLink.useBitly,
          bitlyUrl: shortLink.bitlyUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get link stats
   * GET /links/:shortCode/stats
   */
  async getLinkStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { shortCode } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const stats = await shortLinkService.getLinkStats(shortCode, workspaceId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete link
   * DELETE /links/:shortCode
   */
  async deleteLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { shortCode } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      await shortLinkService.deleteLink(shortCode, workspaceId);

      res.status(200).json({
        success: true,
        message: 'Link deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get QR code for link
   * GET /links/:shortCode/qr-code
   */
  async getQRCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { shortCode } = req.params;
      const { format = 'png', size = 256 } = req.query;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const link = await shortLinkService.getShortLink(shortCode);
      if (!link || link.workspaceId.toString() !== workspaceId) {
        res.status(404).json({
          success: false,
          message: 'Link not found',
        });
        return;
      }

      // Use Bitly URL if available, otherwise construct short URL
      const shortUrl = link.bitlyUrl || `${req.protocol}://${req.get('host')}/r/${shortCode}`;

      let qrCode: string;
      if (format === 'svg') {
        qrCode = await shortLinkService.generateQRCodeSVG(shortUrl, { size: Number(size) });
        res.setHeader('Content-Type', 'image/svg+xml');
      } else {
        qrCode = await shortLinkService.generateQRCode(shortUrl, { size: Number(size) });
        res.setHeader('Content-Type', 'image/png');
      }

      res.status(200).json({
        success: true,
        data: {
          qrCode,
          shortUrl,
          format,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update link
   * PATCH /links/:shortCode
   */
  async updateLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { shortCode } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const { originalUrl, title, tags, password, expiresAt, isActive } = req.body;

      const updatedLink = await shortLinkService.updateLink(shortCode, workspaceId, {
        originalUrl,
        title,
        tags,
        password,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        isActive,
      });

      res.status(200).json({
        success: true,
        data: updatedLink,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle link status
   * PATCH /links/:shortCode/toggle
   */
  async toggleLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { shortCode } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const updatedLink = await shortLinkService.toggleLinkStatus(shortCode, workspaceId);

      res.status(200).json({
        success: true,
        data: {
          shortCode: updatedLink.shortCode,
          isActive: updatedLink.isActive,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk shorten URLs
   * POST /links/bulk
   */
  async bulkShortenUrls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId;

      if (!workspaceId || !userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const { urls, ...options } = req.body;

      if (!Array.isArray(urls) || urls.length === 0) {
        res.status(400).json({
          success: false,
          message: 'URLs array is required',
        });
        return;
      }

      const results = await shortLinkService.bulkShortenUrls(urls, workspaceId, userId, options);

      res.status(200).json({
        success: true,
        data: {
          results,
          total: urls.length,
          successful: results.filter(r => !r.error).length,
          failed: results.filter(r => r.error).length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get link analytics
   * GET /links/:shortCode/analytics
   */
  async getLinkAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { shortCode } = req.params;
      const { dateFrom, dateTo } = req.query;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const analytics = await linkAnalyticsService.getLinkAnalytics(
        shortCode,
        workspaceId,
        dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo ? new Date(dateTo as string) : undefined
      );

      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const shortLinkController = new ShortLinkController();
