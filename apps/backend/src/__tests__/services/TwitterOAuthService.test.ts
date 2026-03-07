import { TwitterOAuthService } from '../../services/oauth/TwitterOAuthService';
import { TwitterOAuthProvider } from '../../services/oauth/TwitterOAuthProvider';
import { SocialAccount, AccountStatus, SocialPlatform } from '../../models/SocialAccount';
import { tokenSafetyService } from '../../services/TokenSafetyService';
import { securityAuditService } from '../../services/SecurityAuditService';
import { oauthErrorClassifier } from '../../services/OAuthErrorClassifier';
import { tokenLifecycleService } from '../../services/TokenLifecycleService';
import mongoose from 'mongoose';

jest.mock('../../services/oauth/TwitterOAuthProvider');
jest.mock('../../services/TokenSafetyService');
jest.mock('../../services/SecurityAuditService');
jest.mock('../../services/OAuthErrorClassifier');
jest.mock('../../services/TokenLifecycleService');
jest.mock('../../models/SocialAccount');

describe('TwitterOAuthService', () => {
  let service: TwitterOAuthService;
  let mockProvider: jest.Mocked<TwitterOAuthProvider>;

  const mockWorkspaceId = new mongoose.Types.ObjectId();
  const mockUserId = new mongoose.Types.ObjectId();
  const mockAccountId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    service = new TwitterOAuthService('client-id', 'client-secret', 'http://localhost/callback');
    mockProvider = (service as any).provider as jest.Mocked<TwitterOAuthProvider>;

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('initiateOAuth', () => {
    it('should generate authorization URL with PKCE', async () => {
      mockProvider.getAuthorizationUrl.mockResolvedValue({
        url: 'https://twitter.com/oauth/authorize?...',
        state: 'random-state',
        codeVerifier: 'random-verifier',
      });

      const result = await service.initiateOAuth();

      expect(result).toEqual({
        url: 'https://twitter.com/oauth/authorize?...',
        state: 'random-state',
        codeVerifier: 'random-verifier',
      });
      expect(mockProvider.getAuthorizationUrl).toHaveBeenCalled();
    });
  });

  describe('connectAccount', () => {
    const mockTokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 7200,
      expiresAt: new Date(Date.now() + 7200 * 1000),
      scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    };

    const mockProfile = {
      id: 'twitter-user-id',
      username: 'testuser',
      displayName: 'Test User',
      profileUrl: 'https://twitter.com/testuser',
      avatarUrl: 'https://pbs.twimg.com/profile_images/...',
      followerCount: 1000,
      metadata: {},
    };

    const mockConnectParams = {
      workspaceId: mockWorkspaceId,
      userId: mockUserId,
      code: 'auth-code',
      state: 'state',
      codeVerifier: 'verifier',
      ipAddress: '192.168.1.1',
    };

    beforeEach(() => {
      mockProvider.exchangeCodeForToken.mockResolvedValue(mockTokens);
      mockProvider.getUserProfile.mockResolvedValue(mockProfile);
      (SocialAccount.findOne as jest.Mock).mockResolvedValue(null);
      (SocialAccount.create as jest.Mock).mockResolvedValue({
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        provider: SocialPlatform.TWITTER,
        providerUserId: mockProfile.id,
        accountName: mockProfile.displayName,
        accessToken: 'encrypted-access-token',
        refreshToken: 'encrypted-refresh-token',
        tokenExpiresAt: mockTokens.expiresAt,
        scopes: mockTokens.scope,
        status: AccountStatus.ACTIVE,
        metadata: {},
      });
      (tokenSafetyService.storeTokenMetadata as jest.Mock).mockResolvedValue(undefined);
      (securityAuditService.logEvent as jest.Mock).mockResolvedValue(undefined);
    });

    it('should connect new Twitter account successfully', async () => {
      const account = await service.connectAccount(mockConnectParams);

      expect(account._id).toEqual(mockAccountId);
      expect(mockProvider.exchangeCodeForToken).toHaveBeenCalledWith({
        code: 'auth-code',
        state: 'state',
        codeVerifier: 'verifier',
      });
      expect(mockProvider.getUserProfile).toHaveBeenCalledWith('access-token');
      expect(SocialAccount.create).toHaveBeenCalled();
      expect(tokenSafetyService.storeTokenMetadata).toHaveBeenCalled();
      expect(securityAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'oauth_connect_success',
          success: true,
        })
      );
    });

    it('should detect scope downgrade and reject connection', async () => {
      mockProvider.exchangeCodeForToken.mockResolvedValue({
        ...mockTokens,
        scope: ['tweet.read', 'users.read'], // Missing tweet.write and offline.access
      });

      await expect(service.connectAccount(mockConnectParams)).rejects.toThrow(
        /Missing required permissions/
      );

      expect(securityAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'oauth_connect_failure',
          success: false,
          errorMessage: expect.stringContaining('Scope downgrade'),
        })
      );
    });

    it('should update existing account during reconnect', async () => {
      const existingAccount = {
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        provider: SocialPlatform.TWITTER,
        providerUserId: mockProfile.id,
        accessToken: 'old-encrypted-token',
        refreshToken: 'old-encrypted-refresh',
        tokenExpiresAt: new Date(),
        scopes: mockTokens.scope,
        status: AccountStatus.EXPIRED,
        metadata: {},
        save: jest.fn().mockResolvedValue(true),
      };

      (SocialAccount.findOne as jest.Mock).mockResolvedValue(existingAccount);
      (tokenSafetyService.getTokenMetadata as jest.Mock).mockResolvedValue({
        version: 5,
      });
      (tokenLifecycleService.clearReconnectFlag as jest.Mock).mockResolvedValue(true);

      const account = await service.connectAccount(mockConnectParams);

      expect(existingAccount.save).toHaveBeenCalled();
      expect(tokenSafetyService.storeTokenMetadata).toHaveBeenCalledWith(
        mockAccountId.toString(),
        SocialPlatform.TWITTER,
        expect.any(Object),
        6 // Version incremented
      );
      expect(tokenLifecycleService.clearReconnectFlag).toHaveBeenCalledWith(mockAccountId);
    });

    it('should handle OAuth errors with classification', async () => {
      const mockError = new Error('OAuth failed');
      mockProvider.exchangeCodeForToken.mockRejectedValue(mockError);

      (oauthErrorClassifier.classify as jest.Mock).mockReturnValue({
        category: 'invalid_request',
        userMessage: 'Invalid OAuth request',
        technicalMessage: 'OAuth failed',
        shouldRetry: false,
        shouldReconnect: false,
      });

      await expect(service.connectAccount(mockConnectParams)).rejects.toThrow(
        'Invalid OAuth request'
      );

      expect(oauthErrorClassifier.classify).toHaveBeenCalledWith(
        SocialPlatform.TWITTER,
        mockError
      );
      expect(securityAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'oauth_connect_failure',
          success: false,
        })
      );
    });
  });

  describe('refreshToken', () => {
    const mockAccount = {
      _id: mockAccountId,
      workspaceId: mockWorkspaceId,
      provider: SocialPlatform.TWITTER,
      accessToken: 'encrypted-access-token',
      refreshToken: 'encrypted-refresh-token',
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
      scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      status: AccountStatus.ACTIVE,
      lastRefreshedAt: new Date(),
      getDecryptedAccessToken: jest.fn().mockReturnValue('decrypted-access-token'),
      getDecryptedRefreshToken: jest.fn().mockReturnValue('decrypted-refresh-token'),
      save: jest.fn().mockResolvedValue(true),
    };

    const mockNewTokens = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 7200,
      expiresAt: new Date(Date.now() + 7200 * 1000),
      scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    };

    beforeEach(() => {
      (tokenSafetyService.acquireRefreshLock as jest.Mock).mockResolvedValue('lock-id');
      (tokenSafetyService.releaseRefreshLock as jest.Mock).mockResolvedValue(undefined);
      (SocialAccount.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAccount),
      });
      (tokenSafetyService.verifyTokenIntegrity as jest.Mock).mockResolvedValue({
        valid: true,
      });
      mockProvider.refreshAccessToken.mockResolvedValue(mockNewTokens);
      (tokenSafetyService.getTokenMetadata as jest.Mock).mockResolvedValue({
        version: 3,
      });
      (tokenSafetyService.atomicTokenWrite as jest.Mock).mockImplementation(
        async (accountId, provider, tokenData, version, callback) => {
          await callback(version);
          return { success: true, newVersion: version + 1 };
        }
      );
      (securityAuditService.logEvent as jest.Mock).mockResolvedValue(undefined);
    });

    it('should refresh token successfully with distributed lock', async () => {
      const result = await service.refreshToken(mockAccountId);

      expect(result.success).toBe(true);
      expect(tokenSafetyService.acquireRefreshLock).toHaveBeenCalledWith(
        mockAccountId.toString()
      );
      expect(mockProvider.refreshAccessToken).toHaveBeenCalledWith({
        refreshToken: 'decrypted-refresh-token',
      });
      expect(tokenSafetyService.atomicTokenWrite).toHaveBeenCalled();
      expect(tokenSafetyService.releaseRefreshLock).toHaveBeenCalledWith(
        mockAccountId.toString(),
        'lock-id'
      );
      expect(securityAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'token_refresh_success',
          success: true,
        })
      );
    });

    it('should prevent concurrent refresh attempts', async () => {
      (tokenSafetyService.acquireRefreshLock as jest.Mock).mockResolvedValue(null);

      const result = await service.refreshToken(mockAccountId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token refresh already in progress');
      expect(mockProvider.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should detect token corruption and mark for reconnect', async () => {
      (tokenSafetyService.verifyTokenIntegrity as jest.Mock).mockResolvedValue({
        valid: false,
        reason: 'Checksum mismatch',
      });
      (tokenLifecycleService.markReconnectRequired as jest.Mock).mockResolvedValue(true);

      const result = await service.refreshToken(mockAccountId);

      expect(result.success).toBe(false);
      expect(result.shouldReconnect).toBe(true);
      expect(tokenLifecycleService.markReconnectRequired).toHaveBeenCalledWith(
        mockAccountId,
        'Token corruption: Checksum mismatch'
      );
    });

    it('should detect scope downgrade during refresh', async () => {
      mockProvider.refreshAccessToken.mockResolvedValue({
        ...mockNewTokens,
        scope: ['tweet.read', 'users.read'], // Missing scopes
      });
      (tokenLifecycleService.markReconnectRequired as jest.Mock).mockResolvedValue(true);

      const result = await service.refreshToken(mockAccountId);

      expect(result.success).toBe(false);
      expect(result.shouldReconnect).toBe(true);
      expect(tokenLifecycleService.markReconnectRequired).toHaveBeenCalledWith(
        mockAccountId,
        expect.stringContaining('Scope downgrade')
      );
    });

    it('should handle version mismatch during atomic write', async () => {
      (tokenSafetyService.atomicTokenWrite as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Version mismatch',
      });

      const result = await service.refreshToken(mockAccountId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Version mismatch');
    });

    it('should handle refresh errors with classification', async () => {
      const mockError = new Error('Token expired');
      mockProvider.refreshAccessToken.mockRejectedValue(mockError);

      (oauthErrorClassifier.classify as jest.Mock).mockReturnValue({
        category: 'token_expired',
        userMessage: 'Token expired, please reconnect',
        technicalMessage: 'Token expired',
        shouldRetry: false,
        shouldReconnect: true,
      });
      (tokenLifecycleService.markReconnectRequired as jest.Mock).mockResolvedValue(true);

      const result = await service.refreshToken(mockAccountId);

      expect(result.success).toBe(false);
      expect(result.shouldReconnect).toBe(true);
      expect(tokenLifecycleService.markReconnectRequired).toHaveBeenCalled();
      expect(securityAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'token_refresh_failure',
          success: false,
        })
      );
    });

    it('should always release lock even on error', async () => {
      mockProvider.refreshAccessToken.mockRejectedValue(new Error('API error'));
      (oauthErrorClassifier.classify as jest.Mock).mockReturnValue({
        category: 'server_error',
        userMessage: 'Server error',
        technicalMessage: 'API error',
        shouldRetry: true,
        shouldReconnect: false,
      });

      await service.refreshToken(mockAccountId);

      expect(tokenSafetyService.releaseRefreshLock).toHaveBeenCalledWith(
        mockAccountId.toString(),
        'lock-id'
      );
    });
  });

  describe('Concurrent Refresh Race Prevention', () => {
    it('should prevent multiple concurrent refresh attempts', async () => {
      const mockAccount = {
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(),
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
        status: AccountStatus.ACTIVE,
        getDecryptedAccessToken: jest.fn().mockReturnValue('decrypted-token'),
        getDecryptedRefreshToken: jest.fn().mockReturnValue('decrypted-refresh'),
        save: jest.fn().mockResolvedValue(true),
      };

      (SocialAccount.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAccount),
      });

      // First call acquires lock
      (tokenSafetyService.acquireRefreshLock as jest.Mock)
        .mockResolvedValueOnce('lock-1')
        .mockResolvedValueOnce(null); // Second call fails to acquire

      (tokenSafetyService.verifyTokenIntegrity as jest.Mock).mockResolvedValue({
        valid: true,
      });
      mockProvider.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        expiresAt: new Date(),
        scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      });
      (tokenSafetyService.getTokenMetadata as jest.Mock).mockResolvedValue({
        version: 1,
      });
      (tokenSafetyService.atomicTokenWrite as jest.Mock).mockImplementation(
        async (accountId, provider, tokenData, version, callback) => {
          await callback(version);
          return { success: true, newVersion: 2 };
        }
      );

      // Simulate concurrent refresh attempts
      const [result1, result2] = await Promise.all([
        service.refreshToken(mockAccountId),
        service.refreshToken(mockAccountId),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Token refresh already in progress');
      expect(mockProvider.refreshAccessToken).toHaveBeenCalledTimes(1); // Only first call
    });
  });

  describe('revokeAccess', () => {
    it('should revoke Twitter access successfully', async () => {
      const mockAccount = {
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        accessToken: 'encrypted-token',
        status: AccountStatus.ACTIVE,
        getDecryptedAccessToken: jest.fn().mockReturnValue('decrypted-token'),
        save: jest.fn().mockResolvedValue(true),
      };

      (SocialAccount.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAccount),
      });
      mockProvider.revokeToken.mockResolvedValue(undefined);
      (tokenLifecycleService.markReconnectRequired as jest.Mock).mockResolvedValue(true);
      (securityAuditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      await service.revokeAccess(mockAccountId, mockUserId, '192.168.1.1');

      expect(mockProvider.revokeToken).toHaveBeenCalledWith('decrypted-token');
      expect(mockAccount.status).toBe(AccountStatus.REVOKED);
      expect(mockAccount.save).toHaveBeenCalled();
      expect(tokenLifecycleService.markReconnectRequired).toHaveBeenCalledWith(
        mockAccountId,
        'User revoked access'
      );
      expect(securityAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'token_revoked',
          success: true,
        })
      );
    });
  });

  describe('needsRefresh', () => {
    it('should return true if token expires within 5 minutes', async () => {
      const expiresAt = new Date(Date.now() + 4 * 60 * 1000); // 4 minutes
      (SocialAccount.findById as jest.Mock).mockResolvedValue({
        tokenExpiresAt: expiresAt,
      });

      const result = await service.needsRefresh(mockAccountId);

      expect(result).toBe(true);
    });

    it('should return false if token expires after 5 minutes', async () => {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      (SocialAccount.findById as jest.Mock).mockResolvedValue({
        tokenExpiresAt: expiresAt,
      });

      const result = await service.needsRefresh(mockAccountId);

      expect(result).toBe(false);
    });

    it('should return false if no expiry date', async () => {
      (SocialAccount.findById as jest.Mock).mockResolvedValue({
        tokenExpiresAt: null,
      });

      const result = await service.needsRefresh(mockAccountId);

      expect(result).toBe(false);
    });
  });
});
