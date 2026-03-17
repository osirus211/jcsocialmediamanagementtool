/**
 * RSS Feed Controller
 * 
 * REST API endpoints for managing RSS feed subscriptions
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { RSSFeedService } from '../services/RSSFeedService';
import { RSSFeedItem } from '../models/RSSFeedItem';
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

  /**
   * POST /api/v1/rss-feeds/:id/fetch
   * Trigger immediate feed refresh
   */
  async refreshRSSFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        sendError(res, 'MISSING_WORKSPACE', 'Workspace required', 400);
        return;
      }

      const result = await RSSFeedService.refreshFeed(id, workspaceId);

      logger.info('RSS feed refreshed via API', {
        feedId: id,
        workspaceId,
        newItems: result.newItems,
      });

      sendSuccess(res, {
        message: `Feed refreshed successfully. ${result.newItems} new items found.`,
        newItems: result.newItems,
      });
    } catch (error: any) {
      logger.error('Failed to refresh RSS feed', {
        error: error.message,
        feedId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/rss/articles
   * Get pending articles across workspace
   */
  async getPendingArticles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { page, limit, status } = req.query;

      if (!workspaceId) {
        sendError(res, 'MISSING_WORKSPACE', 'Workspace required', 400);
        return;
      }

      const result = await RSSFeedService.getPendingArticles(workspaceId, {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      });

      const totalPages = Math.ceil(result.total / result.limit);

      sendSuccess(
        res,
        {
          articles: result.items,
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
      logger.error('Failed to get pending articles', {
        error: error.message,
      });

      next(error);
    }
  }

  /**
   * PATCH /api/v1/rss/articles/:id
   * Update article status (approve/reject)
   */
  async updateArticleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId.toString();

      if (!workspaceId || !userId) {
        sendError(res, 'MISSING_REQUIRED_FIELDS', 'Workspace and user required', 400);
        return;
      }

      if (!['approved', 'rejected'].includes(status)) {
        sendValidationError(res, [{ field: 'status', message: 'Status must be approved or rejected' }]);
        return;
      }

      const article = await RSSFeedService.updateArticleStatus(id, workspaceId, status);

      if (!article) {
        sendNotFound(res, 'Article not found');
        return;
      }

      // If approved, convert to draft
      if (status === 'approved') {
        try {
          const draft = await RSSFeedService.convertItemToDraft(
            article,
            workspaceId,
            userId,
            { aiEnhance: false }
          );

          logger.info('Article approved and converted to draft', {
            articleId: id,
            draftId: draft._id,
            workspaceId,
          });

          sendSuccess(res, {
            article: article.toJSON(),
            draft: draft.toJSON(),
            message: 'Article approved and draft created',
          });
        } catch (draftError: any) {
          logger.error('Failed to create draft after approval', {
            articleId: id,
            error: draftError.message,
          });

          sendSuccess(res, {
            article: article.toJSON(),
            message: 'Article approved but draft creation failed',
            error: draftError.message,
          });
        }
      } else {
        sendSuccess(res, {
          article: article.toJSON(),
          message: 'Article rejected',
        });
      }
    } catch (error: any) {
      logger.error('Failed to update article status', {
        error: error.message,
        articleId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * POST /api/v1/rss/articles/bulk
   * Bulk approve or reject articles
   */
  async bulkUpdateArticleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ids, status } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId.toString();

      if (!workspaceId || !userId) {
        sendError(res, 'MISSING_REQUIRED_FIELDS', 'Workspace and user required', 400);
        return;
      }

      if (!Array.isArray(ids) || ids.length === 0) {
        sendValidationError(res, [{ field: 'ids', message: 'IDs array is required' }]);
        return;
      }

      if (!['approved', 'rejected'].includes(status)) {
        sendValidationError(res, [{ field: 'status', message: 'Status must be approved or rejected' }]);
        return;
      }

      const updatedCount = await RSSFeedService.bulkUpdateArticleStatus(ids, workspaceId, status);

      // If approved, convert all to drafts
      let draftsCreated = 0;
      if (status === 'approved') {
        for (const articleId of ids) {
          try {
            const article = await RSSFeedItem.findOne({
              _id: articleId,
              workspaceId,
              status: 'approved',
            });

            if (article) {
              await RSSFeedService.convertItemToDraft(
                article,
                workspaceId,
                userId,
                { aiEnhance: false }
              );
              draftsCreated++;
            }
          } catch (draftError: any) {
            logger.error('Failed to create draft in bulk operation', {
              articleId,
              error: draftError.message,
            });
          }
        }
      }

      logger.info('Bulk article status update completed', {
        workspaceId,
        status,
        updatedCount,
        draftsCreated,
      });

      sendSuccess(res, {
        message: `${updatedCount} articles ${status}${status === 'approved' ? `, ${draftsCreated} drafts created` : ''}`,
        updatedCount,
        draftsCreated,
      });
    } catch (error: any) {
      logger.error('Failed to bulk update article status', {
        error: error.message,
      });

      next(error);
    }
  }

  /**
   * POST /api/v1/rss-feeds/items/:itemId/convert-to-draft
   * Convert RSS item to draft post
   */
  async convertItemToDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { itemId } = req.params;
      const { platforms, aiEnhance, tone } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId.toString();

      if (!workspaceId || !userId) {
        sendError(res, 'MISSING_REQUIRED_FIELDS', 'Workspace and user required', 400);
        return;
      }

      // Get the RSS feed item
      const feedItem = await RSSFeedItem.findOne({
        _id: itemId,
        workspaceId,
      });

      if (!feedItem) {
        sendNotFound(res, 'RSS feed item not found');
        return;
      }

      // Convert to draft
      const draft = await RSSFeedService.convertItemToDraft(
        feedItem,
        workspaceId,
        userId,
        {
          aiEnhance: aiEnhance || false,
          platforms: platforms || [],
          tone: tone || 'professional',
        }
      );

      logger.info('RSS item converted to draft via API', {
        itemId,
        draftId: draft._id,
        workspaceId,
        userId,
        aiEnhance,
      });

      sendSuccess(res, {
        draft: draft.toJSON(),
        message: 'RSS item converted to draft successfully',
      }, 201);
    } catch (error: any) {
      logger.error('Failed to convert RSS item to draft', {
        error: error.message,
        itemId: req.params.itemId,
      });

      next(error);
    }
  }
}

export const rssFeedController = new RSSFeedController();
