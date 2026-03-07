/**
 * Feature Authorization Service Tests
 * 
 * Tests feature limitation enforcement for Instagram accounts
 */

import { FeatureAuthorizationService, Feature, FeatureLimitationError } from '../FeatureAuthorizationService';
import { ISocialAccount, ProviderType, SocialPlatform, AccountStatus } from '../../models/SocialAccount';
import mongoose from 'mongoose';

describe('FeatureAuthorizationService', () => {
  let service: FeatureAuthorizationService;

  beforeEach(() => {
    service = FeatureAuthorizationService.getInstance();
  });

  // Helper to create mock account
  const createMockAccount = (providerType?: string): Partial<ISocialAccount> => ({
    _id: new mongoose.Types.ObjectId(),
    workspaceId: new mongoose.Types.ObjectId(),
    provider: SocialPlatform.INSTAGRAM,
    providerUserId: 'test123',
    accountName: 'testuser',
    providerType,
    status: AccountStatus.ACTIVE,
  } as Partial<ISocialAccount>);

  describe('Instagram Business Accounts', () => {
    it('should allow all features for INSTAGRAM_BUSINESS', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BUSINESS) as ISocialAccount;

      expect(() => service.assertFeatureAllowed(account, Feature.PUBLISH)).not.toThrow();
      expect(() => service.assertFeatureAllowed(account, Feature.INSIGHTS)).not.toThrow();
      expect(() => service.assertFeatureAllowed(account, Feature.COMMENTS)).not.toThrow();
      expect(() => service.assertFeatureAllowed(account, Feature.MEDIA)).not.toThrow();
      expect(() => service.assertFeatureAllowed(account, Feature.PROFILE)).not.toThrow();
    });

    it('should return all features as allowed for INSTAGRAM_BUSINESS', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BUSINESS) as ISocialAccount;
      const allowedFeatures = service.getAllowedFeatures(account);

      expect(allowedFeatures).toContain(Feature.PUBLISH);
      expect(allowedFeatures).toContain(Feature.INSIGHTS);
      expect(allowedFeatures).toContain(Feature.COMMENTS);
      expect(allowedFeatures).toContain(Feature.MEDIA);
      expect(allowedFeatures).toContain(Feature.PROFILE);
      expect(allowedFeatures).toHaveLength(5);
    });

    it('should return no restricted features for INSTAGRAM_BUSINESS', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BUSINESS) as ISocialAccount;
      const restrictedFeatures = service.getRestrictedFeatures(account);

      expect(restrictedFeatures).toHaveLength(0);
    });
  });

  describe('Instagram Basic Display Accounts', () => {
    it('should block publish for INSTAGRAM_BASIC', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BASIC) as ISocialAccount;

      expect(() => service.assertFeatureAllowed(account, Feature.PUBLISH))
        .toThrow(FeatureLimitationError);
    });

    it('should block insights for INSTAGRAM_BASIC', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BASIC) as ISocialAccount;

      expect(() => service.assertFeatureAllowed(account, Feature.INSIGHTS))
        .toThrow(FeatureLimitationError);
    });

    it('should block comments for INSTAGRAM_BASIC', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BASIC) as ISocialAccount;

      expect(() => service.assertFeatureAllowed(account, Feature.COMMENTS))
        .toThrow(FeatureLimitationError);
    });

    it('should allow media for INSTAGRAM_BASIC', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BASIC) as ISocialAccount;

      expect(() => service.assertFeatureAllowed(account, Feature.MEDIA)).not.toThrow();
    });

    it('should allow profile for INSTAGRAM_BASIC', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BASIC) as ISocialAccount;

      expect(() => service.assertFeatureAllowed(account, Feature.PROFILE)).not.toThrow();
    });

    it('should return only media and profile as allowed for INSTAGRAM_BASIC', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BASIC) as ISocialAccount;
      const allowedFeatures = service.getAllowedFeatures(account);

      expect(allowedFeatures).toContain(Feature.MEDIA);
      expect(allowedFeatures).toContain(Feature.PROFILE);
      expect(allowedFeatures).toHaveLength(2);
    });

    it('should return publish, insights, comments as restricted for INSTAGRAM_BASIC', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BASIC) as ISocialAccount;
      const restrictedFeatures = service.getRestrictedFeatures(account);

      expect(restrictedFeatures).toContain(Feature.PUBLISH);
      expect(restrictedFeatures).toContain(Feature.INSIGHTS);
      expect(restrictedFeatures).toContain(Feature.COMMENTS);
      expect(restrictedFeatures).toHaveLength(3);
    });
  });

  describe('Error Messages', () => {
    it('should include upgrade guidance in error message', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BASIC) as ISocialAccount;

      try {
        service.assertFeatureAllowed(account, Feature.PUBLISH);
        fail('Should have thrown FeatureLimitationError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(FeatureLimitationError);
        expect(error.message).toContain('Instagram Business account');
        expect(error.message).toContain('Convert your Instagram account');
        expect(error.message).toContain('Connect it to a Facebook Page');
        expect(error.message).toContain('Reconnect using');
      }
    });

    it('should include feature name in error', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BASIC) as ISocialAccount;

      try {
        service.assertFeatureAllowed(account, Feature.INSIGHTS);
        fail('Should have thrown FeatureLimitationError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(FeatureLimitationError);
        expect(error.feature).toBe(Feature.INSIGHTS);
        expect(error.message).toContain('insights');
      }
    });

    it('should have 403 status code', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BASIC) as ISocialAccount;

      try {
        service.assertFeatureAllowed(account, Feature.PUBLISH);
        fail('Should have thrown FeatureLimitationError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(FeatureLimitationError);
        expect(error.statusCode).toBe(403);
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should allow all features for accounts without providerType', () => {
      const account = createMockAccount(undefined) as ISocialAccount;

      expect(() => service.assertFeatureAllowed(account, Feature.PUBLISH)).not.toThrow();
      expect(() => service.assertFeatureAllowed(account, Feature.INSIGHTS)).not.toThrow();
      expect(() => service.assertFeatureAllowed(account, Feature.COMMENTS)).not.toThrow();
      expect(() => service.assertFeatureAllowed(account, Feature.MEDIA)).not.toThrow();
      expect(() => service.assertFeatureAllowed(account, Feature.PROFILE)).not.toThrow();
    });

    it('should return all features for accounts without providerType', () => {
      const account = createMockAccount(undefined) as ISocialAccount;
      const allowedFeatures = service.getAllowedFeatures(account);

      expect(allowedFeatures).toHaveLength(5);
    });
  });

  describe('isFeatureAllowed (non-throwing)', () => {
    it('should return true for allowed features', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BUSINESS) as ISocialAccount;

      expect(service.isFeatureAllowed(account, Feature.PUBLISH)).toBe(true);
    });

    it('should return false for blocked features', () => {
      const account = createMockAccount(ProviderType.INSTAGRAM_BASIC) as ISocialAccount;

      expect(service.isFeatureAllowed(account, Feature.PUBLISH)).toBe(false);
    });
  });
});
