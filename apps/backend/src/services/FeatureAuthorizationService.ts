/**
 * Feature Authorization Service
 * 
 * Enforces feature limitations based on Instagram connection type.
 * 
 * Rules:
 * - INSTAGRAM_BUSINESS: All features allowed
 * - INSTAGRAM_BASIC: Only read-only features (media, profile)
 * 
 * Security:
 * - Throws 403 Forbidden for restricted features
 * - Provides clear error messages with upgrade guidance
 * - Logs authorization attempts for analytics
 */

import { ISocialAccount, ProviderType } from '../models/SocialAccount';
import { logger } from '../utils/logger';

export enum Feature {
  PUBLISH = 'publish',
  INSIGHTS = 'insights',
  COMMENTS = 'comments',
  MEDIA = 'media',
  PROFILE = 'profile',
}

export class FeatureLimitationError extends Error {
  public readonly statusCode: number = 403;
  public readonly feature: string;
  public readonly providerType: string;

  constructor(feature: string, providerType: string) {
    const message = 
      `The "${feature}" feature requires an Instagram Business account. ` +
      `Your account is connected via Instagram Basic Display, which only supports ` +
      `read-only access to profile and media. To use ${feature}, please:\n` +
      `1. Convert your Instagram account to a Business or Creator account\n` +
      `2. Connect it to a Facebook Page\n` +
      `3. Reconnect using "Instagram Business (via Facebook)" option`;
    
    super(message);
    this.name = 'FeatureLimitationError';
    this.feature = feature;
    this.providerType = providerType;
  }
}

export class FeatureAuthorizationService {
  private static instance: FeatureAuthorizationService;

  /**
   * Feature matrix: Maps provider type to allowed features
   */
  private readonly featureMatrix: Record<string, Feature[]> = {
    [ProviderType.INSTAGRAM_BUSINESS]: [
      Feature.PUBLISH,
      Feature.INSIGHTS,
      Feature.COMMENTS,
      Feature.MEDIA,
      Feature.PROFILE,
    ],
    [ProviderType.INSTAGRAM_BASIC]: [
      Feature.MEDIA,
      Feature.PROFILE,
    ],
  };

  static getInstance(): FeatureAuthorizationService {
    if (!FeatureAuthorizationService.instance) {
      FeatureAuthorizationService.instance = new FeatureAuthorizationService();
    }
    return FeatureAuthorizationService.instance;
  }

  /**
   * Assert that a feature is allowed for the given account
   * 
   * @throws FeatureLimitationError if feature is not allowed
   */
  assertFeatureAllowed(account: ISocialAccount, feature: Feature): void {
    // If account doesn't have providerType, assume it's allowed (backward compatibility)
    if (!account.providerType) {
      logger.debug('Feature authorization skipped - no providerType', {
        accountId: account._id.toString(),
        feature,
        provider: account.provider,
      });
      return;
    }

    // Get allowed features for this provider type
    const allowedFeatures = this.featureMatrix[account.providerType];

    if (!allowedFeatures) {
      logger.warn('Unknown provider type in feature authorization', {
        accountId: account._id.toString(),
        providerType: account.providerType,
        feature,
      });
      // Unknown provider type - allow by default (fail open for extensibility)
      return;
    }

    // Check if feature is allowed
    if (!allowedFeatures.includes(feature)) {
      logger.warn('Feature authorization denied', {
        accountId: account._id.toString(),
        providerType: account.providerType,
        feature,
        allowedFeatures,
      });

      throw new FeatureLimitationError(feature, account.providerType);
    }

    logger.debug('Feature authorization granted', {
      accountId: account._id.toString(),
      providerType: account.providerType,
      feature,
    });
  }

  /**
   * Check if a feature is allowed (non-throwing version)
   */
  isFeatureAllowed(account: ISocialAccount, feature: Feature): boolean {
    try {
      this.assertFeatureAllowed(account, feature);
      return true;
    } catch (error) {
      if (error instanceof FeatureLimitationError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get all allowed features for an account
   */
  getAllowedFeatures(account: ISocialAccount): Feature[] {
    if (!account.providerType) {
      // Backward compatibility: return all features
      return Object.values(Feature);
    }

    const allowedFeatures = this.featureMatrix[account.providerType];
    
    if (!allowedFeatures) {
      // Unknown provider type: return all features (fail open)
      return Object.values(Feature);
    }

    return allowedFeatures;
  }

  /**
   * Get restricted features for an account
   */
  getRestrictedFeatures(account: ISocialAccount): Feature[] {
    const allowedFeatures = this.getAllowedFeatures(account);
    const allFeatures = Object.values(Feature);
    
    return allFeatures.filter(feature => !allowedFeatures.includes(feature));
  }
}

// Export singleton instance
export const featureAuthorizationService = FeatureAuthorizationService.getInstance();
