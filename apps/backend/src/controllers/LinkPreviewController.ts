/**
 * Link Preview Controller
 * 
 * Handles link preview operations
 */

import { Request, Response, NextFunction } from 'express';
import { linkPreviewService } from '../services/LinkPreviewService';
import { BadRequestError } from '../utils/errors';

export class LinkPreviewController {
  /**
   * Get link preview for a single URL
   * POST /link-preview
   */
  async getPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { url } = req.body;

      if (!url) {
        throw new BadRequestError('URL is required');
      }

      const preview = await linkPreviewService.fetchPreview(url);

      res.status(200).json({
        success: true,
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get link previews for multiple URLs
   * POST /link-preview/batch
   */
  async getBatchPreviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { urls } = req.body;

      if (!Array.isArray(urls) || urls.length === 0) {
        throw new BadRequestError('URLs array is required');
      }

      if (urls.length > 10) {
        throw new BadRequestError('Maximum 10 URLs allowed per batch');
      }

      const previews = await linkPreviewService.fetchMultiplePreviews(urls);

      res.status(200).json({
        success: true,
        data: previews,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Extract URLs from content
   * POST /link-preview/extract
   */
  async extractUrls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content } = req.body;

      if (!content) {
        throw new BadRequestError('Content is required');
      }

      const urls = linkPreviewService.extractUrls(content);

      res.status(200).json({
        success: true,
        data: { urls },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Clear preview cache
   * DELETE /link-preview/cache
   */
  async clearCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { url } = req.query;

      linkPreviewService.clearCache(url as string);

      res.status(200).json({
        success: true,
        message: url ? 'Cache cleared for URL' : 'All cache cleared',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const linkPreviewController = new LinkPreviewController();