/**
 * RSS Feed Service
 * 
 * Manages RSS feed CRUD operations, parsing, and item storage
 * Enforces workspace isolation and deduplication
 */

import mongoose from 'mongoose';
import Parser from 'rss-parser';
import { RSSFeed, IRSSFeed } from '../models/RSSFeed';
import { RSSFeedItem, IRSSFeedItem } from '../models/RSSFeedItem';
import { logger } from '../utils/logger';

export interface CreateFeedInput {
  workspaceId: string;
  name: string;
  feedUrl: string;
  pollingInterval: number;
  enabled: boolean;
  createdBy: string;
}

export interface UpdateFeedInput {
  name?: string;
  feedUrl?: string;
  pollingInterval?: number;
  enabled?: boolean;
}

export interface ListFeedsOptions {
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export interface GetFeedItemsOptions {
  page?: number;
  limit?: number;
}

export interface ParsedFeedItem {
  guid: string;
  title: string;
  link: string;
  description?: string;
  pubDate?: Date;
  author?: string;
  content?: string;
  categories?: string[];
}

export class RSSFeedService {
  private static parser = new Parser({
    timeout: 30000, // 30 second timeout
    maxRedirects: 5,
  });

  /**
   * Create a new RSS feed
   */
  static async createFeed(input: CreateFeedInput): Promise<IRSSFeed> {
    try {
      // Validate feed URL
      this.validateFeedUrl(input.feedUrl);

      const feed = new RSSFeed({
        workspaceId: new mongoose.Types.ObjectId(input.workspaceId),
        name: input.name,
        feedUrl: input.feedUrl,
        pollingInterval: input.pollingInterval,
        enabled: input.enabled,
        failureCount: 0,
        createdBy: new mongoose.Types.ObjectId(input.createdBy),
      });

      await feed.save();

      logger.info('RSS feed created', {
        feedId: feed._id.toString(),
        workspaceId: input.workspaceId,
        name: input.name,
        feedUrl: input.feedUrl,
      });

      return feed;
    } catch (error: any) {
      logger.error('Create RSS feed error:', {
        workspaceId: input.workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update an existing RSS feed
   */
  static async updateFeed(
    feedId: string,
    workspaceId: string,
    input: UpdateFeedInput
  ): Promise<IRSSFeed | null> {
    try {
      // Validate feed URL if provided
      if (input.feedUrl) {
        this.validateFeedUrl(input.feedUrl);
      }

      const feed = await RSSFeed.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(feedId),
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        { $set: input },
        { new: true, runValidators: true }
      );

      if (feed) {
        logger.info('RSS feed updated', {
          feedId,
          workspaceId,
        });
      }

      return feed;
    } catch (error: any) {
      logger.error('Update RSS feed error:', {
        feedId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete an RSS feed and all its items
   */
  static async deleteFeed(feedId: string, workspaceId: string): Promise<boolean> {
    try {
      // Delete all feed items first
      await RSSFeedItem.deleteMany({
        feedId: new mongoose.Types.ObjectId(feedId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      // Delete the feed
      const result = await RSSFeed.deleteOne({
        _id: new mongoose.Types.ObjectId(feedId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (result.deletedCount > 0) {
        logger.info('RSS feed deleted', {
          feedId,
          workspaceId,
        });
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('Delete RSS feed error:', {
        feedId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get RSS feed by ID
   */
  static async getFeed(feedId: string, workspaceId: string): Promise<IRSSFeed | null> {
    try {
      return await RSSFeed.findOne({
        _id: new mongoose.Types.ObjectId(feedId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });
    } catch (error: any) {
      logger.error('Get RSS feed error:', {
        feedId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * List RSS feeds with pagination and filtering
   */
  static async listFeeds(
    workspaceId: string,
    options: ListFeedsOptions = {}
  ): Promise<{ feeds: IRSSFeed[]; total: number; page: number; limit: number }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      const query: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };

      if (options.enabled !== undefined) {
        query.enabled = options.enabled;
      }

      const [feeds, total] = await Promise.all([
        RSSFeed.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        RSSFeed.countDocuments(query),
      ]);

      return {
        feeds: feeds as any,
        total,
        page,
        limit,
      };
    } catch (error: any) {
      logger.error('List RSS feeds error:', {
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Parse RSS feed from URL
   * Supports RSS 2.0 and Atom 1.0 formats
   */
  static async parseFeed(feedUrl: string): Promise<ParsedFeedItem[]> {
    try {
      const feed = await this.parser.parseURL(feedUrl);
      
      const items: ParsedFeedItem[] = feed.items.map((item) => ({
        guid: item.guid || item.link || item.id || '',
        title: item.title || 'Untitled',
        link: item.link || '',
        description: item.contentSnippet || item.summary || '',
        pubDate: item.pubDate ? new Date(item.pubDate) : undefined,
        author: item.creator || item.author || undefined,
        content: item.content || item['content:encoded'] || undefined,
        categories: item.categories || [],
      }));

      logger.debug('RSS feed parsed', {
        feedUrl,
        itemCount: items.length,
      });

      return items;
    } catch (error: any) {
      logger.error('Parse RSS feed error:', {
        feedUrl,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Store feed items with deduplication
   * Returns count of new items stored
   */
  static async storeFeedItems(
    feedId: string,
    workspaceId: string,
    items: ParsedFeedItem[]
  ): Promise<number> {
    try {
      let newItemCount = 0;

      for (const item of items) {
        try {
          const feedItem = new RSSFeedItem({
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            feedId: new mongoose.Types.ObjectId(feedId),
            guid: item.guid,
            title: item.title,
            link: item.link,
            description: item.description,
            pubDate: item.pubDate,
            author: item.author,
            content: item.content,
            categories: item.categories,
          });

          await feedItem.save();
          newItemCount++;

          // Emit rss.item.fetched event for workflow automation
          try {
            const { EventDispatcherService } = await import('./EventDispatcherService');
            await EventDispatcherService.handleEvent({
              eventId: `rss-item-fetched-${feedItem._id}-${Date.now()}`,
              eventType: 'rss.item.fetched',
              workspaceId: workspaceId,
              timestamp: new Date(),
              data: {
                feedId: feedId,
                itemId: feedItem._id.toString(),
                title: item.title,
                link: item.link,
                description: item.description,
                author: item.author,
                categories: item.categories,
                pubDate: item.pubDate,
              },
            });
            logger.debug('rss.item.fetched event emitted', { itemId: feedItem._id });
          } catch (eventError: any) {
            // Event emission failure should NOT block item storage
            logger.warn('Failed to emit rss.item.fetched event (non-blocking)', {
              itemId: feedItem._id,
              error: eventError.message,
            });
          }

        } catch (error: any) {
          // Duplicate key error (E11000) - item already exists
          if (error.code === 11000) {
            logger.debug('RSS feed item already exists', {
              feedId,
              guid: item.guid,
            });
          } else {
            logger.error('Store RSS feed item error:', {
              feedId,
              guid: item.guid,
              error: error.message,
            });
          }
        }
      }

      logger.info('RSS feed items stored', {
        feedId,
        workspaceId,
        totalItems: items.length,
        newItems: newItemCount,
      });

      return newItemCount;
    } catch (error: any) {
      logger.error('Store RSS feed items error:', {
        feedId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get feed items with pagination
   */
  static async getFeedItems(
    feedId: string,
    workspaceId: string,
    options: GetFeedItemsOptions = {}
  ): Promise<{ items: IRSSFeedItem[]; total: number; page: number; limit: number }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      const query = {
        feedId: new mongoose.Types.ObjectId(feedId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };

      const [items, total] = await Promise.all([
        RSSFeedItem.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        RSSFeedItem.countDocuments(query),
      ]);

      return {
        items: items as any,
        total,
        page,
        limit,
      };
    } catch (error: any) {
      logger.error('Get RSS feed items error:', {
        feedId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Convert RSS feed item to draft post with optional AI enhancement
   */
  static async convertItemToDraft(
    feedItem: IRSSFeedItem,
    workspaceId: string,
    userId: string,
    options?: {
      aiEnhance?: boolean;
      platforms?: string[];
      tone?: string;
    }
  ): Promise<any> {
    try {
      logger.info('Converting RSS item to draft', {
        itemId: feedItem._id,
        workspaceId,
        userId,
        aiEnhance: options?.aiEnhance,
      });

      // Get the feed name for attribution
      const feed = await RSSFeed.findById(feedItem.feedId);
      const feedName = feed?.name || 'RSS Feed';

      let content = feedItem.title;

      // AI enhancement if requested
      if (options?.aiEnhance) {
        try {
          const { getAIModule } = await import('../ai/ai.module');
          const aiModule = getAIModule();

          // Use title + description as context for AI generation
          const context = [feedItem.title, feedItem.description].filter(Boolean).join('\n\n');
          
          const result = await aiModule.caption.generateCaption({
            topic: context,
            tone: (options.tone || 'professional') as any,
            platform: 'linkedin' as any,
            length: 'medium' as any,
            context: `RSS article: ${feedItem.title}`,
          });

          content = result.caption;
        } catch (aiError) {
          logger.warn('AI enhancement failed, using original title', {
            error: aiError.message,
            itemId: feedItem._id,
          });
          // Fall back to original title if AI fails
        }
      }

      // Add source attribution
      content += `\n\nVia ${feedName}: ${feedItem.link}`;

      // Import PostService to create draft
      const { PostService } = await import('./PostService');
      
      // Create draft post
      const draftInput = {
        workspaceId,
        socialAccountId: '', // Will be set when user selects platforms
        platform: 'draft', // Special platform for drafts
        content,
        scheduledAt: new Date(), // Immediate draft
        contentType: 'post' as const,
      };

      const draft = await PostService.prototype.createPost(draftInput as any);

      logger.info('RSS item converted to draft successfully', {
        itemId: feedItem._id,
        draftId: draft._id,
        workspaceId,
      });

      return draft;
    } catch (error: any) {
      logger.error('Failed to convert RSS item to draft', {
        error: error.message,
        itemId: feedItem._id,
        workspaceId,
      });
      throw error;
    }
  }

  /**
   * Validate feed URL format
   */
  static validateFeedUrl(feedUrl: string): void {
    try {
      const url = new URL(feedUrl);
      
      // Only allow HTTP and HTTPS protocols
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Feed URL must use HTTP or HTTPS protocol');
      }
    } catch (error: any) {
      throw new Error(`Invalid feed URL: ${error.message}`);
    }
  }
}
