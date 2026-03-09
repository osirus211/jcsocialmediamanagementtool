import { SocialPlatformProvider } from './SocialPlatformProvider';
import { config } from '../config';
import { TwitterProvider } from './TwitterProvider';
import { SocialPlatform } from '../models/SocialAccount';
import { logger } from '../utils/logger';

/**
 * Provider Factory
 * 
 * Manages provider instances and provides unified access
 * 
 * Features:
 * - Singleton provider instances per platform
 * - Lazy initialization
 * - Configuration management
 * - Provider registration
 * 
 * Usage:
 * ```typescript
 * const provider = providerFactory.getProvider(SocialPlatform.TWITTER);
 * const result = await provider.publish(request);
 * ```
 */

export class ProviderFactory {
  private static instance: ProviderFactory;
  private providers: Map<string, SocialPlatformProvider> = new Map();
  private config: Map<string, any> = new Map();

  private constructor() {
    // Initialize with environment variables
    this.loadConfiguration();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ProviderFactory {
    if (!ProviderFactory.instance) {
      ProviderFactory.instance = new ProviderFactory();
    }
    return ProviderFactory.instance;
  }

  /**
   * Load provider configuration from environment
   */
  private loadConfiguration(): void {
    // Twitter/X configuration
    this.config.set(SocialPlatform.TWITTER, {
      clientId: config.oauth.twitter.clientId || '',
      clientSecret: config.oauth.twitter.clientSecret || '',
      redirectUri: config.oauth.twitter.redirectUri || '',
    });

    // LinkedIn configuration (placeholder)
    this.config.set(SocialPlatform.LINKEDIN, {
      clientId: config.oauth.linkedin.clientId || '',
      clientSecret: config.oauth.linkedin.clientSecret || '',
      redirectUri: config.oauth.linkedin.redirectUri || '',
    });

    // Facebook configuration (placeholder)
    this.config.set(SocialPlatform.FACEBOOK, {
      clientId: config.oauth.facebook.appId || '',
      clientSecret: config.oauth.facebook.appSecret || '',
      redirectUri: config.oauth.facebook.callbackUrl || '',
    });

    // Instagram configuration (placeholder)
    this.config.set(SocialPlatform.INSTAGRAM, {
      clientId: config.oauth.instagram.clientId || '',
      clientSecret: config.oauth.instagram.clientSecret || '',
      redirectUri: config.oauth.instagram.redirectUri || '',
    });

    logger.info('Provider configuration loaded', {
      platforms: Array.from(this.config.keys()),
    });
  }

  /**
   * Get provider for platform
   * 
   * Returns singleton provider instance, creating it if necessary
   */
  getProvider(platform: string): SocialPlatformProvider {
    // Check if provider already exists
    if (this.providers.has(platform)) {
      return this.providers.get(platform)!;
    }

    // Create new provider instance
    const provider = this.createProvider(platform);
    this.providers.set(platform, provider);

    logger.info('Provider created', { platform });

    return provider;
  }

  /**
   * Create provider instance for platform
   */
  private createProvider(platform: string): SocialPlatformProvider {
    const config = this.config.get(platform);

    if (!config) {
      throw new Error(`No configuration found for platform: ${platform}`);
    }

    switch (platform) {
      case SocialPlatform.TWITTER:
        return new TwitterProvider(
          config.clientId,
          config.clientSecret,
          config.redirectUri
        );

      // TODO: Add other platforms
      case SocialPlatform.LINKEDIN:
      case SocialPlatform.FACEBOOK:
      case SocialPlatform.INSTAGRAM:
        throw new Error(`Provider not implemented for platform: ${platform}`);

      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }

  /**
   * Register custom provider
   * 
   * Allows registering custom provider implementations
   */
  registerProvider(platform: string, provider: SocialPlatformProvider): void {
    this.providers.set(platform, provider);
    logger.info('Custom provider registered', { platform });
  }

  /**
   * Get all registered platforms
   */
  getRegisteredPlatforms(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if platform is supported
   */
  isSupported(platform: string): boolean {
    return this.config.has(platform);
  }

  /**
   * Get provider configuration
   */
  getConfiguration(platform: string): any {
    return this.config.get(platform);
  }

  /**
   * Update provider configuration
   */
  updateConfiguration(platform: string, config: any): void {
    this.config.set(platform, config);

    // If provider already exists, recreate it with new config
    if (this.providers.has(platform)) {
      this.providers.delete(platform);
      logger.info('Provider configuration updated, instance will be recreated', { platform });
    }
  }

  /**
   * Clear all providers (for testing)
   */
  clearProviders(): void {
    this.providers.clear();
    logger.info('All providers cleared');
  }
}

// Export singleton instance
export const providerFactory = ProviderFactory.getInstance();

