/**
 * Automation Service
 * 
 * Shared logic for Zapier and Make.com integrations
 */

import axios from 'axios';
import { ScheduledPost, PostStatus } from '../models/ScheduledPost';
import { Media } from '../models/Media';
import { Webhook } from '../models/Webhook';
import { PostService } from './PostService';
import { MediaUploadService } from './MediaUploadService';
import { logger } from '../utils/logger';

export class AutomationService {
  private static postService = new PostService();
  private static mediaUploadService = new MediaUploadService();

  /**
   * Get recent published posts for Zapier polling
   */
  static async getRecentPublishedPosts(workspaceId: string, limit = 3): Promise<any[]> {
    try {
      const posts = await ScheduledPost.find({
        workspaceId,
        status: PostStatus.PUBLISHED,
      })
        .sort({ publishedAt: -1 })
        .limit(limit)
        .populate('socialAccountId')
        .lean();

      return posts || [];
    } catch (error) {
      logger.error('Failed to get recent published posts', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get recent scheduled posts
   */
  static async getRecentScheduledPosts(workspaceId: string, limit = 3): Promise<any[]> {
    try {
      const posts = await ScheduledPost.find({
        workspaceId,
        status: PostStatus.SCHEDULED,
      })
        .sort({ scheduledAt: -1 })
        .limit(limit)
        .populate('socialAccountId')
        .lean();

      return posts || [];
    } catch (error) {
      logger.error('Failed to get recent scheduled posts', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get recent milestone events (placeholder)
   */
  static async getRecentMilestones(workspaceId: string, limit = 3): Promise<any[]> {
    try {
      // Placeholder - would integrate with analytics service
      // For now, return empty array
      return [];
    } catch (error) {
      logger.error('Failed to get recent milestones', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Create post from automation platform
   */
  static async createPostFromAutomation(
    workspaceId: string,
    data: {
      platform: string;
      content: string;
      scheduledAt?: Date;
      mediaUrl?: string;
      categoryId?: string;
      campaignId?: string;
    }
  ): Promise<any> {
    try {
      // Get first available social account for the platform
      const { SocialAccount } = await import('../models/SocialAccount');
      const socialAccount = await SocialAccount.findOne({
        workspaceId,
        platform: data.platform,
        status: 'active',
      });

      if (!socialAccount) {
        throw new Error(`No active ${data.platform} account found`);
      }

      let mediaIds: string[] = [];

      // Download and save media if URL provided
      if (data.mediaUrl) {
        try {
          const media = await this.downloadAndSaveMedia(
            workspaceId,
            data.mediaUrl,
            `automation-media-${Date.now()}`
          );
          mediaIds = [media._id.toString()];
        } catch (mediaError) {
          logger.warn('Failed to download media for automation post', {
            workspaceId,
            mediaUrl: data.mediaUrl,
            error: mediaError instanceof Error ? mediaError.message : 'Unknown error',
          });
          // Continue without media rather than failing the entire post
        }
      }

      // Create post
      const post = await this.postService.createPost({
        workspaceId,
        socialAccountId: socialAccount._id.toString(),
        platform: data.platform as any,
        content: data.content,
        mediaIds,
        scheduledAt: data.scheduledAt || new Date(),
      } as any);

      return post;
    } catch (error) {
      logger.error('Failed to create post from automation', {
        workspaceId,
        platform: data.platform,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Schedule existing post
   */
  static async scheduleExistingPost(
    workspaceId: string,
    postId: string,
    scheduledAt: Date
  ): Promise<any | null> {
    try {
      const post = await this.postService.updatePost(postId, workspaceId, {
        scheduledAt,
      } as any);

      return post;
    } catch (error) {
      logger.error('Failed to schedule existing post', {
        workspaceId,
        postId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Download media from URL and save to media library
   */
  static async downloadAndSaveMedia(
    workspaceId: string,
    url: string,
    filename: string
  ): Promise<any> {
    try {
      // Download file
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
        maxContentLength: 50 * 1024 * 1024, // 50MB limit
      });

      // Determine MIME type from response or filename
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      
      // Create buffer
      const buffer = Buffer.from(response.data);

      // Upload to media service
      const media = await (this.mediaUploadService as any).uploadFile({
        workspaceId,
        file: {
          buffer,
          originalname: filename,
          mimetype: contentType,
          size: buffer.length,
        },
        uploadedBy: 'automation',
      });

      return media;
    } catch (error) {
      logger.error('Failed to download and save media', {
        workspaceId,
        url,
        filename,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Register automation webhook
   */
  static async registerAutomationWebhook(
    workspaceId: string,
    hookUrl: string,
    events: string[],
    source: 'zapier' | 'make'
  ): Promise<any> {
    try {
      // Check if webhook already exists
      const existingWebhook = await Webhook.findOne({
        workspaceId,
        url: hookUrl,
      });

      if (existingWebhook) {
        // Update events if webhook exists
        existingWebhook.events = [...new Set([...existingWebhook.events, ...events])];
        await existingWebhook.save();
        return existingWebhook;
      }

      // Create new webhook
      const webhook = await Webhook.create({
        workspaceId,
        url: hookUrl,
        events,
        enabled: true,
        secret: require('crypto').randomBytes(32).toString('hex'),
        createdBy: `automation-${source}`,
      });

      return webhook;
    } catch (error) {
      logger.error('Failed to register automation webhook', {
        workspaceId,
        hookUrl,
        events,
        source,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Unregister automation webhook
   */
  static async unregisterAutomationWebhook(
    workspaceId: string,
    hookUrl: string
  ): Promise<void> {
    try {
      await Webhook.deleteOne({
        workspaceId,
        url: hookUrl,
      });
    } catch (error) {
      logger.error('Failed to unregister automation webhook', {
        workspaceId,
        hookUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Approve a pending post
   */
  static async approvePost(workspaceId: string, postId: string): Promise<any | null> {
    try {
      const post = await this.postService.updatePost(postId, workspaceId, {
      } as any);

      return post;
    } catch (error) {
      logger.error('Failed to approve post', {
        workspaceId,
        postId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Format post for Zapier (includes all fields for dynamic dropdowns)
   */
  static formatPostForZapier(post: any): any {
    return {
      id: post._id.toString(),
      content: post.content,
      platform: post.platform,
      status: post.status,
      scheduledAt: post.scheduledAt?.toISOString(),
      publishedAt: post.publishedAt?.toISOString(),
      createdAt: post.createdAt?.toISOString(),
      updatedAt: post.updatedAt?.toISOString(),
      url: post.metadata?.platformPostUrl || null,
      socialAccountId: post.socialAccountId?.toString(),
      mediaIds: post.mediaIds || [],
      categoryId: post.categoryId?.toString() || null,
      campaignId: post.campaignId?.toString() || null,
      workspaceId: post.workspaceId.toString(),
    };
  }

  /**
   * Format post for Make.com (same shape as Zapier)
   */
  static formatPostForMake(post: any): any {
    return this.formatPostForZapier(post);
  }
}