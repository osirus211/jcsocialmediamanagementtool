/**
 * Listening Collector Service
 * 
 * Collects mentions from social platforms based on listening rules
 * Reuses existing platform adapters and analytics infrastructure
 */

import { ListeningRule, ListeningRuleType } from '../models/ListeningRule';
import { Mention, IMention } from '../models/Mention';
import { logger } from '../utils/logger';

export interface MentionData {
  author: {
    username: string;
    displayName?: string;
    profileUrl?: string;
    followerCount?: number;
  };
  text: string;
  sourcePostId: string;
  sourceUrl?: string;
  engagementMetrics: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
  };
  collectedAt: Date;
  platformData?: Record<string, any>;
}

export class ListeningCollectorService {
  /**
   * Collect keyword mentions for a workspace
   */
  static async collectKeywordMentions(workspaceId: string, platform: string): Promise<number> {
    try {
      // Get active keyword rules for workspace and platform
      const rules = await ListeningRule.find({
        workspaceId,
        platform,
        type: ListeningRuleType.KEYWORD,
        active: true,
      });

      if (rules.length === 0) {
        logger.debug('No active keyword rules found', { workspaceId, platform });
        return 0;
      }

      let totalMentions = 0;

      for (const rule of rules) {
        try {
          const mentions = await this.collectMentionsForRule(rule);
          totalMentions += mentions;

          // Update lastCollectedAt
          await ListeningRule.findByIdAndUpdate(rule._id, {
            lastCollectedAt: new Date(),
          });
        } catch (error: any) {
          logger.error('Failed to collect mentions for rule', {
            ruleId: rule._id,
            keyword: rule.value,
            error: error.message,
          });
          // Continue with next rule
        }
      }

      logger.info('Keyword mentions collected', {
        workspaceId,
        platform,
        rulesProcessed: rules.length,
        totalMentions,
      });

      return totalMentions;
    } catch (error: any) {
      logger.error('Collect keyword mentions error:', {
        workspaceId,
        platform,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Collect hashtag mentions for a workspace
   */
  static async collectHashtagMentions(workspaceId: string, platform: string): Promise<number> {
    try {
      // Get active hashtag rules for workspace and platform
      const rules = await ListeningRule.find({
        workspaceId,
        platform,
        type: ListeningRuleType.HASHTAG,
        active: true,
      });

      if (rules.length === 0) {
        logger.debug('No active hashtag rules found', { workspaceId, platform });
        return 0;
      }

      let totalMentions = 0;

      for (const rule of rules) {
        try {
          const mentions = await this.collectMentionsForRule(rule);
          totalMentions += mentions;

          // Update lastCollectedAt
          await ListeningRule.findByIdAndUpdate(rule._id, {
            lastCollectedAt: new Date(),
          });
        } catch (error: any) {
          logger.error('Failed to collect mentions for rule', {
            ruleId: rule._id,
            hashtag: rule.value,
            error: error.message,
          });
          // Continue with next rule
        }
      }

      logger.info('Hashtag mentions collected', {
        workspaceId,
        platform,
        rulesProcessed: rules.length,
        totalMentions,
      });

      return totalMentions;
    } catch (error: any) {
      logger.error('Collect hashtag mentions error:', {
        workspaceId,
        platform,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Collect competitor mentions for a workspace
   */
  static async collectCompetitorMentions(workspaceId: string, platform: string): Promise<number> {
    try {
      // Get active competitor rules for workspace and platform
      const rules = await ListeningRule.find({
        workspaceId,
        platform,
        type: ListeningRuleType.COMPETITOR,
        active: true,
      });

      if (rules.length === 0) {
        logger.debug('No active competitor rules found', { workspaceId, platform });
        return 0;
      }

      let totalMentions = 0;

      for (const rule of rules) {
        try {
          const mentions = await this.collectMentionsForRule(rule);
          totalMentions += mentions;

          // Update lastCollectedAt
          await ListeningRule.findByIdAndUpdate(rule._id, {
            lastCollectedAt: new Date(),
          });
        } catch (error: any) {
          logger.error('Failed to collect mentions for rule', {
            ruleId: rule._id,
            competitor: rule.value,
            error: error.message,
          });
          // Continue with next rule
        }
      }

      logger.info('Competitor mentions collected', {
        workspaceId,
        platform,
        rulesProcessed: rules.length,
        totalMentions,
      });

      return totalMentions;
    } catch (error: any) {
      logger.error('Collect competitor mentions error:', {
        workspaceId,
        platform,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Collect mentions for a specific listening rule
   */
  private static async collectMentionsForRule(rule: any): Promise<number> {
    try {
      // Get platform adapter
      const adapter = await this.getListeningAdapter(rule.platform);

      // Collect mentions from platform
      const mentionData = await adapter.searchMentions({
        type: rule.type,
        value: rule.value,
        since: rule.lastCollectedAt || new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours if never collected
      });

      // Store mentions
      let storedCount = 0;
      for (const data of mentionData) {
        try {
          await this.storeMention(rule, data);
          storedCount++;
        } catch (error: any) {
          // Skip duplicate mentions (unique constraint violation)
          if (error.code === 11000) {
            logger.debug('Duplicate mention skipped', {
              sourcePostId: data.sourcePostId,
            });
          } else {
            logger.error('Failed to store mention', {
              sourcePostId: data.sourcePostId,
              error: error.message,
            });
          }
        }
      }

      logger.debug('Mentions collected for rule', {
        ruleId: rule._id,
        value: rule.value,
        collected: mentionData.length,
        stored: storedCount,
      });

      return storedCount;
    } catch (error: any) {
      logger.error('Collect mentions for rule error:', {
        ruleId: rule._id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Store mention in database
   */
  private static async storeMention(rule: any, data: MentionData): Promise<IMention> {
    const mention = new Mention({
      workspaceId: rule.workspaceId,
      listeningRuleId: rule._id,
      platform: rule.platform,
      keyword: rule.value,
      author: data.author,
      text: data.text,
      sourcePostId: data.sourcePostId,
      sourceUrl: data.sourceUrl,
      engagementMetrics: data.engagementMetrics,
      collectedAt: data.collectedAt,
      platformData: data.platformData,
    });

    await mention.save();

    // Emit mention.detected event for workflow automation
    try {
      const { EventDispatcherService } = await import('./EventDispatcherService');
      await EventDispatcherService.handleEvent({
        eventId: `mention-detected-${mention._id}-${Date.now()}`,
        eventType: 'mention.detected',
        workspaceId: rule.workspaceId.toString(),
        timestamp: new Date(),
        data: {
          mentionId: mention._id.toString(),
          platform: rule.platform,
          author: data.author.username,
          content: data.text,
          sentiment: mention.sentiment, // If sentiment analysis is available
          detectedAt: data.collectedAt,
          keyword: rule.value,
          sourcePostId: data.sourcePostId,
          sourceUrl: data.sourceUrl,
        },
      });
      logger.debug('mention.detected event emitted', { mentionId: mention._id });
    } catch (eventError: any) {
      // Event emission failure should NOT block mention storage
      logger.warn('Failed to emit mention.detected event (non-blocking)', {
        mentionId: mention._id,
        error: eventError.message,
      });
    }

    return mention;
  }

  /**
   * Get listening adapter for platform
   * Reuses existing platform API infrastructure
   */
  private static async getListeningAdapter(platform: string): Promise<any> {
    // For now, return a mock adapter
    // In production, implement actual platform search APIs
    return {
      searchMentions: async (params: any) => {
        logger.warn('Using mock listening adapter', { platform, params });
        
        // Mock data - replace with actual platform API calls
        const mockMentions: MentionData[] = [];
        const count = Math.floor(Math.random() * 10);
        
        for (let i = 0; i < count; i++) {
          mockMentions.push({
            author: {
              username: `user${i}`,
              displayName: `User ${i}`,
              followerCount: Math.floor(Math.random() * 10000),
            },
            text: `Mock mention containing ${params.value}`,
            sourcePostId: `${platform}-${Date.now()}-${i}`,
            sourceUrl: `https://${platform}.com/post/${i}`,
            engagementMetrics: {
              likes: Math.floor(Math.random() * 100),
              comments: Math.floor(Math.random() * 20),
              shares: Math.floor(Math.random() * 10),
              views: Math.floor(Math.random() * 1000),
            },
            collectedAt: new Date(),
          });
        }
        
        return mockMentions;
      },
    };

    // TODO: Implement actual platform adapters
    // switch (platform.toLowerCase()) {
    //   case 'twitter':
    //     const { TwitterListeningAdapter } = await import('../adapters/listening/TwitterListeningAdapter');
    //     return new TwitterListeningAdapter();
    //   case 'instagram':
    //     const { InstagramListeningAdapter } = await import('../adapters/listening/InstagramListeningAdapter');
    //     return new InstagramListeningAdapter();
    //   // ... other platforms
    //   default:
    //     throw new Error(`Unsupported platform: ${platform}`);
    // }
  }
}
