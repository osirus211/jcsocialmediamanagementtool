/**
 * Unit Tests: Instagram Token Refresh Service
 * 
 * Tests token lifecycle management for Instagram accounts
 */

import { InstagramTokenRefreshService } from '../InstagramTokenRefreshService';
import { AccountStatus, ProviderType } from '../../../models/SocialAccount';
import { oauthProviderFactory } from '../OAuthProviderFactory';

// Mock dependencies
jest.mock('../OAuthProviderFactory');
jest.mock('../../../utils/logger');
jest.mock('../../../models/SocialAccount');

describe('InstagramTokenRefreshService', () => {
  let service: InstagramTokenRefreshService;
  let mockAccount: any;

  beforeEach(() => {
    service = new InstagramTokenRefreshService();

    // Create mock account
    mockAccount = {
      _id: 'test-account-id',
      accountName: 'test_user',
      providerType: ProviderType.INSTAGRAM_BUSINESS,
      tokenExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      connectionMetadata: {
        type: 'INSTAGRAM_BUSINESS',
        pageId: 'page-123',
        pageName: 'Test Page',
        tokenRefreshable: true,
        refreshFailureCount: 0,
      },
      getDecryptedAccessToken: jest.fn().mockReturnValue('current-token'),
      save: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshBusinessToken', () => {
    it('should refresh Instagram Business token successfully', async () => {
      // Mock provider
      const mockProvider = {
        refreshAccessToken: jest.fn().mockResolvedValue({
          accessToken: 'new-token',
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
          expiresIn: 60 * 24 * 60 * 60,
          tokenType: 'bearer',
        }),
      };

      (oauthProviderFactory.getProvider as jest.Mock).mockReturnValue(mockProvider);

      const result = await service.refreshBusinessToken(mockAccount);

      expect(result.success).toBe(true);
      expect(mockAccount.accessToken).toBe('new-token');
      expect(mockAccount.status).toBe(AccountStatus.ACTIVE);
      expect(mockAccount.connectionMetadata.refreshFailureCount).toBe(0);
      expect(mockAccount.save).toHaveBeenCalled();
    });

    it('should handle refresh failure and increment failure count', async () => {
      // Mock provider failure
      const mockProvider = {
        refreshAccessToken: jest.fn().mockRejectedValue(new Error('Token refresh failed')),
      };

      (oauthProviderFactory.getProvider as jest.Mock).mockReturnValue(mockProvider);

      const result = await service.refreshBusinessToken(mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token refresh failed');
      expect(mockAccount.connectionMetadata.refreshFailureCount).toBe(1);
      expect(mockAccount.status).toBe(AccountStatus.TOKEN_EXPIRING);
      expect(mockAccount.save).toHaveBeenCalled();
    });

    it('should disable account after max refresh failures', async () => {
      // Set failure count to 4 (next failure will be 5th)
      mockAccount.connectionMetadata.refreshFailureCount = 4;

      // Mock provider failure
      const mockProvider = {
        refreshAccessToken: jest.fn().mockRejectedValue(new Error('Token refresh failed')),
      };

      (oauthProviderFactory.getProvider as jest.Mock).mockReturnValue(mockProvider);

      const result = await service.refreshBusinessToken(mockAccount);

      expect(result.success).toBe(false);
      expect(mockAccount.connectionMetadata.refreshFailureCount).toBe(5);
      expect(mockAccount.status).toBe(AccountStatus.REAUTH_REQUIRED);
      expect(mockAccount.save).toHaveBeenCalled();
    });
  });

  describe('refreshBasicToken', () => {
    beforeEach(() => {
      mockAccount.providerType = ProviderType.INSTAGRAM_BASIC;
      mockAccount.connectionMetadata = {
        type: 'INSTAGRAM_BASIC',
        longLivedTokenExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        tokenRefreshable: true,
        refreshFailureCount: 0,
      };
    });

    it('should refresh Instagram Basic Display token successfully', async () => {
      // Mock provider
      const mockProvider = {
        refreshAccessToken: jest.fn().mockResolvedValue({
          accessToken: 'new-basic-token',
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
          expiresIn: 60 * 24 * 60 * 60,
          tokenType: 'bearer',
        }),
      };

      (oauthProviderFactory.getProvider as jest.Mock).mockReturnValue(mockProvider);

      const result = await service.refreshBasicToken(mockAccount);

      expect(result.success).toBe(true);
      expect(mockAccount.accessToken).toBe('new-basic-token');
      expect(mockAccount.status).toBe(AccountStatus.ACTIVE);
      expect(mockAccount.connectionMetadata.refreshFailureCount).toBe(0);
      expect(mockAccount.connectionMetadata.longLivedTokenExpiresAt).toBeDefined();
      expect(mockAccount.save).toHaveBeenCalled();
    });

    it('should handle refresh failure for Basic Display', async () => {
      // Mock provider failure
      const mockProvider = {
        refreshAccessToken: jest.fn().mockRejectedValue(new Error('Basic token refresh failed')),
      };

      (oauthProviderFactory.getProvider as jest.Mock).mockReturnValue(mockProvider);

      const result = await service.refreshBasicToken(mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Basic token refresh failed');
      expect(mockAccount.connectionMetadata.refreshFailureCount).toBe(1);
      expect(mockAccount.status).toBe(AccountStatus.TOKEN_EXPIRING);
    });
  });

  describe('refreshIfExpiringSoon', () => {
    it('should skip refresh if token not expiring soon', async () => {
      // Token expires in 30 days
      mockAccount.tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const result = await service.refreshIfExpiringSoon(mockAccount, 7);

      expect(result.success).toBe(true);
      expect(mockAccount.save).not.toHaveBeenCalled();
    });

    it('should refresh if token expiring within threshold', async () => {
      // Token expires in 5 days
      mockAccount.tokenExpiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

      // Mock provider
      const mockProvider = {
        refreshAccessToken: jest.fn().mockResolvedValue({
          accessToken: 'refreshed-token',
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          expiresIn: 60 * 24 * 60 * 60,
          tokenType: 'bearer',
        }),
      };

      (oauthProviderFactory.getProvider as jest.Mock).mockReturnValue(mockProvider);

      const result = await service.refreshIfExpiringSoon(mockAccount, 7);

      expect(result.success).toBe(true);
      expect(mockAccount.accessToken).toBe('refreshed-token');
      expect(mockAccount.save).toHaveBeenCalled();
    });

    it('should return error if no expiration date', async () => {
      mockAccount.tokenExpiresAt = undefined;

      const result = await service.refreshIfExpiringSoon(mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No token expiration date');
    });

    it('should route to correct provider based on providerType', async () => {
      // Test Business provider routing
      mockAccount.providerType = ProviderType.INSTAGRAM_BUSINESS;
      mockAccount.tokenExpiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

      const mockBusinessProvider = {
        refreshAccessToken: jest.fn().mockResolvedValue({
          accessToken: 'business-token',
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          expiresIn: 60 * 24 * 60 * 60,
          tokenType: 'bearer',
        }),
      };

      (oauthProviderFactory.getProvider as jest.Mock).mockReturnValue(mockBusinessProvider);

      await service.refreshIfExpiringSoon(mockAccount, 7);

      expect(oauthProviderFactory.getProvider).toHaveBeenCalledWith('INSTAGRAM_BUSINESS');
    });
  });

  describe('isTokenExpired', () => {
    it('should return false if no expiration date', () => {
      mockAccount.tokenExpiresAt = undefined;

      const result = service.isTokenExpired(mockAccount);

      expect(result).toBe(false);
    });

    it('should return true if token is expired', () => {
      // Token expired 1 day ago
      mockAccount.tokenExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const result = service.isTokenExpired(mockAccount);

      expect(result).toBe(true);
    });

    it('should return false if token not expired', () => {
      // Token expires in 30 days
      mockAccount.tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const result = service.isTokenExpired(mockAccount);

      expect(result).toBe(false);
    });

    it('should consider threshold when checking expiration', () => {
      // Token expires in 5 days
      mockAccount.tokenExpiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

      // With 7-day threshold, should be considered expired
      const result = service.isTokenExpired(mockAccount, 7);

      expect(result).toBe(true);
    });
  });

  describe('getDaysUntilExpiration', () => {
    it('should return null if no expiration date', () => {
      mockAccount.tokenExpiresAt = undefined;

      const result = service.getDaysUntilExpiration(mockAccount);

      expect(result).toBeNull();
    });

    it('should return correct days until expiration', () => {
      // Token expires in 30 days
      mockAccount.tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const result = service.getDaysUntilExpiration(mockAccount);

      expect(result).toBe(30);
    });

    it('should return negative days for expired tokens', () => {
      // Token expired 5 days ago
      mockAccount.tokenExpiresAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

      const result = service.getDaysUntilExpiration(mockAccount);

      expect(result).toBe(-5);
    });
  });
});
