/**
 * OAuth Provider Factory
 * 
 * Centralized factory for creating and managing OAuth provider instances.
 * Eliminates hardcoded conditionals in controllers and services.
 * 
 * Supported Providers:
 * - INSTAGRAM_BUSINESS: Instagram Business/Creator accounts via Facebook
 * - INSTAGRAM_BASIC: Instagram Personal accounts via Basic Display API
 * - GOOGLE_BUSINESS: Google Business Profile accounts via Google OAuth
 * 
 * Security:
 * - Validates environment variables at initialization
 * - Fails fast on missing configuration
 * - Singleton pattern for provider instances
 */

import { OAuthProvider } from './OAuthProvider';
import { InstagramBusinessProvider } from './InstagramBusinessProvider';
import { InstagramBasicDisplayProvider } from './InstagramBasicDisplayProvider';
import { GoogleBusinessProvider } from './GoogleBusinessProvider';
import { logger } from '../../utils/logger';

export enum ProviderType {
  INSTAGRAM_BUSINESS = 'INSTAGRAM_BUSINESS',
  INSTAGRAM_BASIC = 'INSTAGRAM_BASIC',
  GOOGLE_BUSINESS = 'GOOGLE_BUSINESS',
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class OAuthProviderFactory {
  private static instance: OAuthProviderFactory;
  private providers: Map<ProviderType, OAuthProvider> = new Map();

  private constructor() {
    this.initializeProviders();
  }

  static getInstance(): OAuthProviderFactory {
    if (!OAuthProviderFactory.instance) {
      OAuthProviderFactory.instance = new OAuthProviderFactory();
    }
    return OAuthProviderFactory.instance;
  }

  /**
   * Initialize all OAuth providers
   * Validates environment variables and creates provider instances
   */
  private initializeProviders(): void {
    // Initialize Instagram Business Provider (via Facebook)
    try {
      const businessClientId = process.env.INSTAGRAM_CLIENT_ID || process.env.FACEBOOK_APP_ID;
      const businessClientSecret = process.env.INSTAGRAM_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET;
      const businessRedirectUri = process.env.INSTAGRAM_REDIRECT_URI || process.env.FACEBOOK_CALLBACK_URL;

      if (!businessClientId || !businessClientSecret || !businessRedirectUri) {
        logger.warn('Instagram Business provider not configured', {
          clientIdSet: !!businessClientId,
          clientSecretSet: !!businessClientSecret,
          redirectUriSet: !!businessRedirectUri,
        });
      } else {
        const businessProvider = new InstagramBusinessProvider(
          businessClientId,
          businessClientSecret,
          businessRedirectUri
        );
        this.providers.set(ProviderType.INSTAGRAM_BUSINESS, businessProvider);
        logger.info('Instagram Business provider initialized');
      }
    } catch (error: any) {
      logger.error('Failed to initialize Instagram Business provider', {
        error: error.message,
      });
    }

    // Initialize Instagram Basic Display Provider
    try {
      const basicClientId = process.env.INSTAGRAM_BASIC_APP_ID;
      const basicClientSecret = process.env.INSTAGRAM_BASIC_APP_SECRET;
      const basicRedirectUri = process.env.INSTAGRAM_BASIC_REDIRECT_URI;

      if (!basicClientId || !basicClientSecret || !basicRedirectUri) {
        logger.warn('Instagram Basic Display provider not configured', {
          appIdSet: !!basicClientId,
          appSecretSet: !!basicClientSecret,
          redirectUriSet: !!basicRedirectUri,
        });
      } else {
        const basicProvider = new InstagramBasicDisplayProvider(
          basicClientId,
          basicClientSecret,
          basicRedirectUri
        );
        this.providers.set(ProviderType.INSTAGRAM_BASIC, basicProvider);
        logger.info('Instagram Basic Display provider initialized');
      }
    } catch (error: any) {
      logger.error('Failed to initialize Instagram Basic Display provider', {
        error: error.message,
      });
    }

    // Initialize Google Business Profile Provider
    try {
      const gbpClientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
      const gbpClientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
      const gbpRedirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI;

      if (!gbpClientId || !gbpClientSecret || !gbpRedirectUri) {
        logger.warn('Google Business Profile provider not configured', {
          clientIdSet: !!gbpClientId,
          clientSecretSet: !!gbpClientSecret,
          redirectUriSet: !!gbpRedirectUri,
        });
      } else {
        const gbpProvider = new GoogleBusinessProvider(
          gbpClientId,
          gbpClientSecret,
          gbpRedirectUri
        );
        this.providers.set(ProviderType.GOOGLE_BUSINESS, gbpProvider);
        logger.info('Google Business Profile provider initialized');
      }
    } catch (error: any) {
      logger.error('Failed to initialize Google Business Profile provider', {
        error: error.message,
      });
    }

    logger.info('OAuth Provider Factory initialized', {
      availableProviders: Array.from(this.providers.keys()),
    });
  }

  /**
   * Get OAuth provider by type
   * 
   * @throws ConfigurationError if provider not configured
   */
  getProvider(providerType: ProviderType): OAuthProvider {
    const provider = this.providers.get(providerType);

    if (!provider) {
      const availableProviders = Array.from(this.providers.keys()).join(', ');
      throw new ConfigurationError(
        `OAuth provider "${providerType}" is not configured. ` +
        `Available providers: ${availableProviders || 'none'}`
      );
    }

    return provider;
  }

  /**
   * Check if provider is available
   */
  hasProvider(providerType: ProviderType): boolean {
    return this.providers.has(providerType);
  }

  /**
   * Get all available provider types
   */
  getAvailableProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Validate that required providers are configured
   * 
   * @throws ConfigurationError if required providers missing
   */
  validateRequiredProviders(requiredProviders: ProviderType[]): void {
    const missing = requiredProviders.filter(type => !this.hasProvider(type));

    if (missing.length > 0) {
      throw new ConfigurationError(
        `Required OAuth providers not configured: ${missing.join(', ')}`
      );
    }
  }
}

// Export singleton instance
export const oauthProviderFactory = OAuthProviderFactory.getInstance();
