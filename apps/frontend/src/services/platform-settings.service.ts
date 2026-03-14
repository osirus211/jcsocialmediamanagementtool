import { apiClient } from '@/lib/api-client';
import { 
  PlatformSettings, 
  PlatformSettingsResponse, 
  AllPlatformSettingsResponse,
  ApplyDefaultsInput,
  ApplyDefaultsResponse
} from '@/types/platform-settings.types';
import { SocialPlatform } from '@/types/social.types';

export class PlatformSettingsService {
  private baseUrl = '/platform-settings';

  /**
   * Get all platform settings for the workspace
   */
  async getAllSettings(): Promise<PlatformSettings[]> {
    const response = await apiClient.get<AllPlatformSettingsResponse>(this.baseUrl);
    return response.settings;
  }

  /**
   * Get settings for a specific platform
   */
  async getSettings(platform: SocialPlatform, accountId?: string): Promise<PlatformSettings> {
    const params = accountId ? { accountId } : {};
    const response = await apiClient.get<PlatformSettingsResponse>(
      `${this.baseUrl}/${platform}`,
      { params }
    );
    return response.settings;
  }

  /**
   * Update settings for a specific platform
   */
  async updateSettings(
    platform: SocialPlatform, 
    settings: Partial<PlatformSettings>,
    accountId?: string
  ): Promise<PlatformSettings> {
    const params = accountId ? { accountId } : {};
    const response = await apiClient.put<PlatformSettingsResponse>(
      `${this.baseUrl}/${platform}`,
      settings,
      { params }
    );
    return response.settings;
  }

  /**
   * Reset settings for a specific platform to defaults
   */
  async resetSettings(platform: SocialPlatform, accountId?: string): Promise<void> {
    const params = accountId ? { accountId } : {};
    await apiClient.delete(`${this.baseUrl}/${platform}`, { params });
  }

  /**
   * Apply platform defaults to a post
   */
  async applyDefaults(input: ApplyDefaultsInput): Promise<ApplyDefaultsResponse> {
    const response = await apiClient.post<ApplyDefaultsResponse>(
      `${this.baseUrl}/apply-defaults`,
      input
    );
    return response;
  }

  /**
   * Get default settings template for a platform
   */
  async getDefaultTemplate(platform: SocialPlatform): Promise<Partial<PlatformSettings>> {
    const response = await apiClient.get<{ success: boolean; template: Partial<PlatformSettings> }>(
      `${this.baseUrl}/${platform}/template`
    );
    return response.template;
  }

  /**
   * Get platform-specific configuration options
   */
  getPlatformConfigOptions(platform: SocialPlatform) {
    const commonOptions = {
      watermarkPositions: [
        { value: 'top-left', label: 'Top Left' },
        { value: 'top-right', label: 'Top Right' },
        { value: 'bottom-left', label: 'Bottom Left' },
        { value: 'bottom-right', label: 'Bottom Right' },
        { value: 'center', label: 'Center' }
      ],
      visibilityOptions: [
        { value: 'public', label: 'Public' },
        { value: 'private', label: 'Private' }
      ]
    };

    switch (platform) {
      case SocialPlatform.TWITTER:
        return {
          ...commonOptions,
          pollDurations: [
            { value: 1, label: '1 hour' },
            { value: 24, label: '1 day' },
            { value: 168, label: '1 week' },
            { value: 8760, label: '1 year' }
          ],
          replySettings: [
            { value: 'everyone', label: 'Everyone' },
            { value: 'following', label: 'People you follow' },
            { value: 'mentioned', label: 'Only mentioned users' }
          ]
        };

      case SocialPlatform.INSTAGRAM:
        return {
          ...commonOptions,
          aspectRatios: [
            { value: 'original', label: 'Original' },
            { value: 'square', label: 'Square (1:1)' },
            { value: 'portrait', label: 'Portrait (4:5)' },
            { value: 'landscape', label: 'Landscape (16:9)' }
          ]
        };

      case SocialPlatform.LINKEDIN:
        return {
          ...commonOptions,
          targetAudiences: [
            { value: 'public', label: 'Public' },
            { value: 'connections', label: 'Connections only' },
            { value: 'logged-in', label: 'Logged-in members' }
          ],
          contentTypes: [
            { value: 'post', label: 'Post' },
            { value: 'article', label: 'Article' },
            { value: 'video', label: 'Video' }
          ]
        };

      case SocialPlatform.TIKTOK:
        return {
          ...commonOptions,
          privacyOptions: [
            { value: 'public', label: 'Public' },
            { value: 'friends', label: 'Friends only' },
            { value: 'private', label: 'Private' }
          ]
        };

      case SocialPlatform.YOUTUBE:
        return {
          ...commonOptions,
          categories: [
            { value: 'Entertainment', label: 'Entertainment' },
            { value: 'Education', label: 'Education' },
            { value: 'Gaming', label: 'Gaming' },
            { value: 'Music', label: 'Music' },
            { value: 'News & Politics', label: 'News & Politics' },
            { value: 'Science & Technology', label: 'Science & Technology' },
            { value: 'Sports', label: 'Sports' }
          ],
          privacyOptions: [
            { value: 'public', label: 'Public' },
            { value: 'unlisted', label: 'Unlisted' },
            { value: 'private', label: 'Private' }
          ]
        };

      case SocialPlatform.FACEBOOK:
        return {
          ...commonOptions,
          targetingOptions: [
            { value: 'public', label: 'Public' },
            { value: 'friends', label: 'Friends' },
            { value: 'custom', label: 'Custom' }
          ]
        };

      case SocialPlatform.MASTODON:
        return {
          ...commonOptions,
          visibilityOptions: [
            { value: 'public', label: 'Public' },
            { value: 'unlisted', label: 'Unlisted' },
            { value: 'private', label: 'Followers only' },
            { value: 'direct', label: 'Direct message' }
          ]
        };

      case SocialPlatform.GOOGLE_BUSINESS:
        return {
          ...commonOptions,
          eventActions: [
            { value: 'learn_more', label: 'Learn More' },
            { value: 'book', label: 'Book' },
            { value: 'order', label: 'Order' },
            { value: 'shop', label: 'Shop' },
            { value: 'sign_up', label: 'Sign Up' }
          ]
        };

      default:
        return commonOptions;
    }
  }

  /**
   * Get platform display name
   */
  getPlatformDisplayName(platform: SocialPlatform): string {
    const names: Record<SocialPlatform, string> = {
      [SocialPlatform.TWITTER]: 'Twitter/X',
      [SocialPlatform.LINKEDIN]: 'LinkedIn',
      [SocialPlatform.FACEBOOK]: 'Facebook',
      [SocialPlatform.INSTAGRAM]: 'Instagram',
      [SocialPlatform.YOUTUBE]: 'YouTube',
      [SocialPlatform.THREADS]: 'Threads',
      [SocialPlatform.BLUESKY]: 'Bluesky',
      [SocialPlatform.MASTODON]: 'Mastodon',
      [SocialPlatform.REDDIT]: 'Reddit',
      [SocialPlatform.GOOGLE_BUSINESS]: 'Google Business',
      [SocialPlatform.PINTEREST]: 'Pinterest',
      [SocialPlatform.TIKTOK]: 'TikTok'
    };
    return names[platform] || platform;
  }

  /**
   * Get platform icon
   */
  getPlatformIcon(platform: SocialPlatform): string {
    const icons: Record<SocialPlatform, string> = {
      [SocialPlatform.TWITTER]: '𝕏',
      [SocialPlatform.LINKEDIN]: '💼',
      [SocialPlatform.FACEBOOK]: '📘',
      [SocialPlatform.INSTAGRAM]: '📷',
      [SocialPlatform.YOUTUBE]: '📺',
      [SocialPlatform.THREADS]: '🧵',
      [SocialPlatform.BLUESKY]: '🦋',
      [SocialPlatform.MASTODON]: '🐘',
      [SocialPlatform.REDDIT]: '🤖',
      [SocialPlatform.GOOGLE_BUSINESS]: '🏢',
      [SocialPlatform.PINTEREST]: '📌',
      [SocialPlatform.TIKTOK]: '🎵'
    };
    return icons[platform] || '📱';
  }
}

export const platformSettingsService = new PlatformSettingsService();