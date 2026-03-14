import { PlatformSettings, IPlatformSettings, SocialPlatform } from '../models/PlatformSettings';
import { logger } from '../utils/logger';

export interface ApplyDefaultsInput {
  workspaceId: string;
  platform: SocialPlatform;
  accountId?: string;
  post: {
    content: string;
    hashtags?: string[];
    firstComment?: string;
    visibility?: string;
    location?: string;
    media?: any[];
  };
}

export interface PostWithDefaults {
  content: string;
  hashtags: string[];
  firstComment: string;
  visibility: string;
  location?: string;
  media?: any[];
  appliedDefaults: {
    hashtagsAdded: string[];
    watermarkApplied: boolean;
    utmTracking?: {
      source: string;
      medium: string;
      campaign: string;
    };
  };
}

export class PlatformSettingsService {
  /**
   * Get platform settings for a workspace and platform
   */
  async getSettings(
    workspaceId: string, 
    platform: SocialPlatform, 
    accountId?: string
  ): Promise<IPlatformSettings | null> {
    try {
      // First try to find account-specific settings
      if (accountId) {
        const accountSettings = await PlatformSettings.findOne({
          workspaceId,
          platform,
          accountId
        });
        if (accountSettings) {
          return accountSettings;
        }
      }

      // Fall back to workspace-wide settings
      const workspaceSettings = await PlatformSettings.findOne({
        workspaceId,
        platform,
        accountId: { $exists: false }
      });

      return workspaceSettings;
    } catch (error) {
      logger.error('Error getting platform settings:', error);
      throw error;
    }
  }

  /**
   * Update platform settings
   */
  async updateSettings(
    workspaceId: string,
    platform: SocialPlatform,
    settings: Partial<IPlatformSettings>,
    accountId?: string
  ): Promise<IPlatformSettings> {
    try {
      const filter = {
        workspaceId,
        platform,
        ...(accountId ? { accountId } : { accountId: { $exists: false } })
      };

      const updatedSettings = await PlatformSettings.findOneAndUpdate(
        filter,
        {
          $set: {
            ...settings,
            workspaceId,
            platform,
            ...(accountId && { accountId })
          }
        },
        {
          new: true,
          upsert: true,
          runValidators: true
        }
      );

      logger.info(`Platform settings updated for ${platform} in workspace ${workspaceId}`);
      return updatedSettings;
    } catch (error) {
      logger.error('Error updating platform settings:', error);
      throw error;
    }
  }

  /**
   * Reset platform settings to defaults
   */
  async resetSettings(workspaceId: string, platform: SocialPlatform, accountId?: string): Promise<void> {
    try {
      const filter = {
        workspaceId,
        platform,
        ...(accountId ? { accountId } : { accountId: { $exists: false } })
      };

      await PlatformSettings.deleteOne(filter);
      logger.info(`Platform settings reset for ${platform} in workspace ${workspaceId}`);
    } catch (error) {
      logger.error('Error resetting platform settings:', error);
      throw error;
    }
  }

  /**
   * Apply platform defaults to a post
   */
  async applyDefaults(input: ApplyDefaultsInput): Promise<PostWithDefaults> {
    try {
      const settings = await this.getSettings(input.workspaceId, input.platform, input.accountId);
      
      if (!settings) {
        // Return post as-is if no settings found
        return {
          ...input.post,
          hashtags: input.post.hashtags || [],
          firstComment: input.post.firstComment || '',
          visibility: input.post.visibility || 'public',
          appliedDefaults: {
            hashtagsAdded: [],
            watermarkApplied: false
          }
        };
      }

      const result: PostWithDefaults = {
        content: input.post.content,
        hashtags: [...(input.post.hashtags || [])],
        firstComment: input.post.firstComment || '',
        visibility: input.post.visibility || settings.defaults.defaultVisibility,
        location: input.post.location || settings.defaults.defaultLocation,
        media: input.post.media || [],
        appliedDefaults: {
          hashtagsAdded: [],
          watermarkApplied: false
        }
      };

      // Apply default hashtags
      if (settings.defaults.defaultHashtags.length > 0) {
        const newHashtags = settings.defaults.defaultHashtags.filter(
          tag => !result.hashtags.includes(tag)
        );
        result.hashtags.push(...newHashtags);
        result.appliedDefaults.hashtagsAdded = newHashtags;
      }

      // Apply default first comment
      if (settings.defaults.defaultFirstComment && !result.firstComment) {
        result.firstComment = settings.defaults.defaultFirstComment;
      }

      // Apply UTM tracking if enabled
      if (settings.defaults.utmTracking.enabled) {
        result.appliedDefaults.utmTracking = {
          source: settings.defaults.utmTracking.source,
          medium: settings.defaults.utmTracking.medium,
          campaign: settings.defaults.utmTracking.campaign
        };
      }

      // Apply watermark if enabled
      if (settings.defaults.watermark.enabled) {
        result.appliedDefaults.watermarkApplied = true;
        // Note: Actual watermark application would happen in media processing
      }

      // Apply platform-specific defaults
      await this.applyPlatformSpecificDefaults(result, settings, input.platform);

      return result;
    } catch (error) {
      logger.error('Error applying platform defaults:', error);
      throw error;
    }
  }

  /**
   * Apply platform-specific defaults
   */
  private async applyPlatformSpecificDefaults(
    post: PostWithDefaults,
    settings: IPlatformSettings,
    platform: SocialPlatform
  ): Promise<void> {
    const platformConfig = settings.platformSpecific[platform];
    if (!platformConfig) return;

    switch (platform) {
      case SocialPlatform.INSTAGRAM:
        const instagramConfig = platformConfig as any;
        if (instagramConfig.firstCommentHashtags && post.hashtags.length > 0) {
          // Move hashtags to first comment for Instagram
          const hashtagString = post.hashtags.map(tag => `#${tag.replace('#', '')}`).join(' ');
          post.firstComment = post.firstComment 
            ? `${post.firstComment}\n\n${hashtagString}`
            : hashtagString;
          post.hashtags = []; // Remove from main content
        }
        break;

      case SocialPlatform.TWITTER:
        const twitterConfig = platformConfig as any;
        if (twitterConfig.threadByDefault && post.content.length > 280) {
          // Mark for thread creation (would be handled by posting service)
        }
        break;

      case SocialPlatform.LINKEDIN:
        const linkedinConfig = platformConfig as any;
        if (linkedinConfig.targetAudience !== 'public') {
          post.visibility = linkedinConfig.targetAudience;
        }
        break;

      // Add more platform-specific logic as needed
    }
  }

  /**
   * Get all platform settings for a workspace
   */
  async getWorkspaceSettings(workspaceId: string): Promise<IPlatformSettings[]> {
    try {
      const settings = await PlatformSettings.find({ workspaceId }).sort({ platform: 1 });
      return settings;
    } catch (error) {
      logger.error('Error getting workspace settings:', error);
      throw error;
    }
  }

  /**
   * Get default settings template for a platform
   */
  getDefaultSettingsTemplate(platform: SocialPlatform): Partial<IPlatformSettings> {
    const baseDefaults = {
      defaults: {
        defaultHashtags: [],
        defaultFirstComment: '',
        defaultVisibility: 'public',
        watermark: {
          enabled: false,
          text: '',
          position: 'bottom-right' as const,
          opacity: 80,
          fontSize: 16,
          color: '#FFFFFF'
        },
        autoTagging: {
          enabled: false,
          tags: []
        },
        crossPostingDefaults: {
          enabled: false,
          platforms: []
        },
        utmTracking: {
          enabled: false,
          source: '',
          medium: 'social',
          campaign: ''
        },
        postingTime: {
          timezone: 'UTC',
          preferredTimes: ['09:00', '12:00', '17:00']
        }
      },
      platformSpecific: {}
    };

    // Add platform-specific defaults
    switch (platform) {
      case SocialPlatform.TWITTER:
        baseDefaults.platformSpecific = {
          twitter: {
            threadByDefault: false,
            pollDuration: 24,
            replySettings: 'everyone'
          }
        };
        break;

      case SocialPlatform.INSTAGRAM:
        baseDefaults.platformSpecific = {
          instagram: {
            firstCommentHashtags: false,
            altTextEnabled: true,
            aspectRatio: 'original'
          }
        };
        break;

      case SocialPlatform.LINKEDIN:
        baseDefaults.platformSpecific = {
          linkedin: {
            targetAudience: 'public',
            contentType: 'post',
            boostEnabled: false
          }
        };
        break;

      case SocialPlatform.TIKTOK:
        baseDefaults.platformSpecific = {
          tiktok: {
            duetEnabled: true,
            stitchEnabled: true,
            commentEnabled: true,
            privacy: 'public'
          }
        };
        break;

      case SocialPlatform.YOUTUBE:
        baseDefaults.platformSpecific = {
          youtube: {
            defaultCategory: 'Entertainment',
            defaultPrivacy: 'public',
            madeForKids: false,
            tags: []
          }
        };
        break;

      // Add more platforms as needed
    }

    return baseDefaults;
  }
}

export const platformSettingsService = new PlatformSettingsService();