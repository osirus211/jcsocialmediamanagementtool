/**
 * RSS Feed Controller
 * 
 * REST API endpoints for managing RSS feed subscriptions
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { RSSFeedService } from '../services/RSSFeedService';
import { logger } from '../utils/logger';
import {
  sendSuccess,
  sendValidationError,
  sendNotFound,
  sendError,
} from '../utils/apiResponse';

export class RSSFeedController {
  /**
   * POST /api/v1/rss-feeds
   * Create an RSS feed subscription
   */
  async createRSSFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { workspaceId, name, url, pollingInterval, enabled } = req.body;
      const userId = (req as any).user?.id || 'system'; // Get from auth middleware

      // Create RSS feed
      const feed = await RSSFeedService.createFeed({
        workspaceId,
        name,
        feedUrl: url,
        pollingInterval: pollingInterval || 60,
        enabled: enabled !== undefined ? enabled : true,
        createdBy: userId,
      });

      logger.info('RSS feed created via API', {
        feedId: feed._id.toString(),
        workspaceId,
        url,
      });

      sendSuccess(res, feed.toJSON(), 201);
    } catch (error: any) {
      logger.error('Failed to create RSS feed', {
        error: error.message,
        body: req.body,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/rss-feeds
   * Get RSS feeds with pagination
   */
  async getRSSFeeds(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { workspaceId, enabled, page, limit } = req.query;

      // Get feeds
      const result = await RSSFeedService.listFeeds(
        workspaceId as string,
        {
          enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 20,
        }
      );

      const totalPages = Math.ceil(result.total / result.limit);

      sendSuccess(
        res,
        {
          feeds: result.feeds.map((feed) => feed.toJSON()),
        },
        200,
        {
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages,
          },
        }
      );
    } catch (error: any) {
      logger.error('Failed to get RSS feeds', {
        error: error.message,
        query: req.query,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/rss-feeds/:id
   * Get RSS feed by ID
   */
  async getRSSFeedById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { workspaceId } = req.query;

      if (!workspaceId) {
        sendValidationError(res, [{ field: 'workspaceId', message: 'workspaceId is required' }]);
        return;
      }

      // Get feed
      const feed = await RSSFeedService.getFeed(id, workspaceId as string);

      if (!feed) {
        sendNotFound(res, 'RSS feed not found');
        return;
      }

      sendSuccess(res, feed.toJSON());
    } catch (error: any) {
      logger.error('Failed to get RSS feed', {
        error: error.message,
        feedId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * PUT /api/v1/rss-feeds/:id
   * Update RSS feed
   */
  async updateRSSFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.array().map(err => ({
          field: err.type === 'field' ? (err as any).path : undefined,
          message: err.msg,
        })));
        return;
      }

      const { id } = req.params;
      const { workspaceId, name, url, pollingInterval, enabled } = req.body;

      // Update feed
      const feed = await RSSFeedService.updateFeed(id, workspaceId, {
        name,
        feedUrl: url,
        pollingInterval,
        enabled,
      });

      if (!feed) {
        sendNotFound(res, 'RSS feed not found');
        return;
      }

      logger.info('RSS feed updated via API', {
        feedId: id,
        workspaceId,
      });

      sendSuccess(res, feed.toJSON());
    } catch (error: any) {
      logger.error('Failed to update RSS feed', {
        error: error.message,
        feedId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * DELETE /api/v1/rss-feeds/:id
   * Delete RSS feed and all items
   */
  async deleteRSSFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { workspaceId } = req.query;

      if (!workspaceId) {
        sendValidationError(res, [{ field: 'workspaceId', message: 'workspaceId is required' }]);
        return;
      }

      // Delete feed
      const deleted = await RSSFeedService.deleteFeed(id, workspaceId as string);

      if (!deleted) {
        sendNotFound(res, 'RSS feed not found');
        return;
      }

      logger.info('RSS feed deleted via API', {
        feedId: id,
        workspaceId,
      });

      sendSuccess(res, { message: 'RSS feed deleted successfully' });
    } catch (error: any) {
      logger.error('Failed to delete RSS feed', {
        error: error.message,
        feedId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/rss-feeds/:id/items
   * Get RSS feed items
   */
  async getRSSFeedItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { workspaceId, page, limit } = req.query;

      if (!workspaceId) {
        sendValidationError(res, [{ field: 'workspaceId', message: 'workspaceId is required' }]);
        return;
      }

      // Get feed items
      const result = await RSSFeedService.getFeedItems(
        id,
        workspaceId as string,
        {
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 20,
        }
      );

      const totalPages = Math.ceil(result.total / result.limit);

      sendSuccess(
        res,
        {
          items: result.items.map((item) => item.toJSON()),
        },
        200,
        {
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages,
          },
        }
      );
    } catch (error: any) {
      logger.error('Failed to get RSS feed items', {
        error: error.message,
        feedId: req.params.id,
      });

      next(error);
    }
  }
}

export const rssFeedController = new RSSFeedController();
