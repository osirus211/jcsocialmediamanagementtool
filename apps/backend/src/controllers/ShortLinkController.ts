/**
 * ShortLink Controller
 * 
 * Handles link shortening operations
 */

import { Request, Response, NextFunction } from 'express';
import { shortLinkService } from '../services/ShortLinkService';
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

      const result = await shortLinkService.getLinksForWorkspace(workspaceId, page, limit);

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

      const { originalUrl, postId, platform, expiresAt } = req.body;

      const { shortLink, shortUrl } = await shortLinkService.createShortLink(
        originalUrl,
        workspaceId,
        userId,
        {
          postId,
          platform,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
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
}

export const shortLinkController = new ShortLinkController();
