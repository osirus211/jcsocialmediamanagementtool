/**
 * Twitter OAuth Integration Tests
 * 
 * Tests real-world scenarios with simulated Twitter API responses:
 * - Token revocation detection
 * - Scope downgrade detection
 * - Concurrent refresh race prevention
 * - Token corruption detection
 * - Error classification and recovery
 */

import { TwitterOAuthService } from '../../services/oauth/TwitterOAuthService';
import { TwitterOAuthProvider } from '../../services/oauth/TwitterOAuthProvider';
import { SocialAccount, AccountStatus, SocialPlatform } from '../../models/SocialAccount';
import { tokenSafetyService } from '../../services/TokenSafetyService';
import { securityAuditService } from '../../services/SecurityAuditService';
import { tokenLifecycleService } from '../../services/TokenLifecycleService';
import mongoose from 'mongoose';

jest.mock('../../services/oauth/TwitterOAuthProvider');

describe('Twitter OAuth Integration Tests', () => {
  let service: TwitterOAuthService;
  let mockProvider: jest.Mocked<TwitterOAuthProvider>;

  const mockWorkspaceId = new mongoose.Types.ObjectId();
  const mockUserId = new mongoose.Types.ObjectId();
  const mockAccountId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    service = new TwitterOAuthService('client-id', 'client-secret', 'http://localhost/callback');
    mockProvider = (service as any).provider as jest.Mocked<TwitterOAuthProvider>;
    jest.clearAllMocks();
  });

  describe('Simulated Token Revocation', () => {
    it('should detect revoked token and mark account for reconnect', async () => {
      // Setup: Account with valid token
      const mockAccount = {
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        provider: SocialPlatform.TWITTER,
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
        status: AccountStatus.ACTIVE,
        getDecryptedAccessToken: jest.fn().mockReturnValue('decrypted-token'),
        getDecryptedRefreshToken: jest.fn().mockReturnValue('decrypted-refresh'),
        save: jest.fn().mockResolvedValue(true),
      };

      (SocialAccount.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAccount),
      });

      // Simulate: Twitter returns 401 (token revoked)
      const revokedError = {
        response: {
          status: 401,
          data: {
            errors: [
              {
                code: 89,
                message: 'Invalid or expired token',
              },
            ],
          },
        },
      };

      mockProvider.refreshAccessToken.mockRejectedValue(revokedError);

      // Mock token safety service
      jest.spyOn(tokenSafetyService, 'acquireRefreshLock').mockResolvedValue('lock-id');
      jest.spyOn(tokenSafetyService, 'releaseRefreshLock').mockResolvedValue(undefined);
      jest.spyOn(tokenSafetyService, 'verifyTokenIntegrity').mockResolvedValue({
        valid: true,
      });

      // Mock lifecycle service
      const markReconnectSpy = jest
        .spyOn(tokenLifecycleService, 'markReconnectRequired')
        .mockResolvedValue(true);

      // Mock audit service
      const logEventSpy = jest
        .spyOn(securityAuditService, 'logEvent')
        .mockResolvedValue(null as any);

      // Execute: Attempt token refresh
      const result = await service.refreshToken(mockAccountId);

      // Verify: Should fail and mark for reconnect
      expect(result.success).toBe(false);
      expect(result.shouldReconnect).toBe(true);
      expect(result.error).toContain('expired');

      // Verify: Account marked for reconnect
      expect(markReconnectSpy).toHaveBeenCalledWith(
        mockAccountId,
        expect.stringContaining('401')
      );

      // Verify: Security event logged
      expect(logEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'token_refresh_failure',
          success: false,
        })
      );

      // Verify: Lock released
      expect(tokenSafetyService.releaseRefreshLock).toHaveBeenCalledWith(
        mockAccountId.toString(),
        'lock-id'
      );
    });

    it('should handle revoked token during publish attempt', async () => {
      // Simulate: Publishing with revoked token
      const revokedError = {
        response: {
          status: 403,
          data: {
            errors: [
              {
                code: 89,
                message: 'Your credentials do not allow access to this resource',
              },
            ],
          },
        },
      };

      // This would be called by publishing worker
      // We're testing the error classification
      const { oauthErrorClassifier } = require('../../services/OAuthErrorClassifier');
      const classified = oauthErrorClassifier.classify(SocialPlatform.TWITTER, revokedError);

      expect(classified.category).toBe('token_revoked');
      expect(classified.shouldReconnect).toBe(true);
      expect(classified.shouldRetry).toBe(false);
      expect(classified.userMessage).toContain('revoked');
    });
  });

  describe('Simulated Scope Downgrade', () => {
    it('should detect scope downgrade during connection', async () => {
      const mockConnectParams = {
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
        code: 'auth-code',
        state: 'state',
        codeVerifier: 'verifier',
        ipAddress: '192.168.1.1',
      };

      // Simulate: User grants only partial scopes
      mockProvider.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 7200,
        expiresAt: new Date(Date.now() + 7200 * 1000),
        scope: ['tweet.read', 'users.read'], // Missing tweet.write and offline.access
      });

      mockProvider.getUserProfile.mockResolvedValue({
        id: 'user-id',
        username: 'testuser',
        displayName: 'Test User',
        profileUrl: 'https://twitter.com/testuser',
      });

      (SocialAccount.findOne as jest.Mock).mockResolvedValue(null);

      // Mock audit service
      const logEventSpy = jest
        .spyOn(securityAuditService, 'logEvent')
        .mockResolvedValue(null as any);

      // Execute: Attempt connection
      await expect(service.connectAccount(mockConnectParams)).rejects.toThrow(
        /Missing required permissions/
      );

      // Verify: Security event logged with scope details
      expect(logEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'oauth_connect_failure',
          success: false,
          errorMessage: expect.stringContaining('Scope downgrade'),
          metadata: expect.objectContaining({
            expectedScopes: expect.arrayContaining([
              'tweet.read',
              'tweet.write',
              'users.read',
              'offline.access',
            ]),
            receivedScopes: ['tweet.read', 'users.read'],
          }),
        })
      );
    });

    it('should detect scope downgrade during token refresh', async () => {
      const mockAccount = {
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
        status: AccountStatus.ACTIVE,
        getDecryptedAccessToken: jest.fn().mockReturnValue('decrypted-token'),
        getDecryptedRefreshToken: jest.fn().mockReturnValue('decrypted-refresh'),
        save: jest.fn().mockResolvedValue(true),
      };

      (SocialAccount.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAccount),
      });

      // Simulate: Twitter returns tokens with reduced scopes
      mockProvider.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        expiresIn: 7200,
        expiresAt: new Date(Date.now() + 7200 * 1000),
        scope: ['tweet.read', 'users.read'], // Missing tweet.write and offline.access
      });

      jest.spyOn(tokenSafetyService, 'acquireRefreshLock').mockResolvedValue('lock-id');
      jest.spyOn(tokenSafetyService, 'releaseRefreshLock').mockResolvedValue(undefined);
      jest.spyOn(tokenSafetyService, 'verifyTokenIntegrity').mockResolvedValue({
        valid: true,
      });

      const markReconnectSpy = jest
        .spyOn(tokenLifecycleService, 'markReconnectRequired')
        .mockResolvedValue(true);

      const logEventSpy = jest
        .spyOn(securityAuditService, 'logEvent')
        .mockResolvedValue(null as any);

      // Execute: Attempt refresh
      const result = await service.refreshToken(mockAccountId);

      // Verify: Should fail and mark for reconnect
      expect(result.success).toBe(false);
      expect(result.shouldReconnect).toBe(true);
      expect(result.error).toContain('Scope downgrade');

      // Verify: Account marked for reconnect with reason
      expect(markReconnectSpy).toHaveBeenCalledWith(
        mockAccountId,
        expect.stringContaining('Scope downgrade')
      );

      // Verify: Security event logged
      expect(logEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'token_refresh_failure',
          success: false,
          errorMessage: 'Scope downgrade detected',
        })
      );
    });
  });

  describe('Concurrent Refresh Race Prevention', () => {
    it('should prevent duplicate refresh when multiple workers attempt simultaneously', async () => {
      const mockAccount = {
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(Date.now() + 100 * 1000), // Expires soon
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
        status: AccountStatus.ACTIVE,
        getDecryptedAccessToken: jest.fn().mockReturnValue('decrypted-token'),
        getDecryptedRefreshToken: jest.fn().mockReturnValue('decrypted-refresh'),
        save: jest.fn().mockResolvedValue(true),
      };

      (SocialAccount.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAccount),
      });

      mockProvider.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        expiresIn: 7200,
        expiresAt: new Date(Date.now() + 7200 * 1000),
        scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      });

      // Simulate: First worker acquires lock, second worker fails
      let lockAcquired = false;
      jest.spyOn(tokenSafetyService, 'acquireRefreshLock').mockImplementation(async () => {
        if (!lockAcquired) {
          lockAcquired = true;
          return 'lock-id-1';
        }
        return null; // Second attempt fails
      });

      jest.spyOn(tokenSafetyService, 'releaseRefreshLock').mockResolvedValue(undefined);
      jest.spyOn(tokenSafetyService, 'verifyTokenIntegrity').mockResolvedValue({
        valid: true,
      });
      jest.spyOn(tokenSafetyService, 'getTokenMetadata').mockResolvedValue({
        version: 1,
        accountId: mockAccountId.toString(),
        provider: SocialPlatform.TWITTER,
        encryptionKeyVersion: 1,
        checksum: 'checksum',
        lastRefreshedAt: new Date(),
        refreshCount: 0,
      });
      jest.spyOn(tokenSafetyService, 'atomicTokenWrite').mockImplementation(
        async (accountId, provider, tokenData, version, callback) => {
          await callback(version);
          return { success: true, newVersion: 2 };
        }
      );
      jest.spyOn(securityAuditService, 'logEvent').mockResolvedValue(null as any);

      // Execute: Simulate 3 concurrent refresh attempts
      const results = await Promise.all([
        service.refreshToken(mockAccountId),
        service.refreshToken(mockAccountId),
        service.refreshToken(mockAccountId),
      ]);

      // Verify: Only one succeeded
      const successCount = results.filter((r) => r.success).length;
      const blockedCount = results.filter(
        (r) => !r.success && r.error === 'Token refresh already in progress'
      ).length;

      expect(successCount).toBe(1);
      expect(blockedCount).toBe(2);

      // Verify: Twitter API called only once
      expect(mockProvider.refreshAccessToken).toHaveBeenCalledTimes(1);

      // Verify: Lock released
      expect(tokenSafetyService.releaseRefreshLock).toHaveBeenCalledWith(
        mockAccountId.toString(),
        'lock-id-1'
      );
    });

    it('should handle lock expiry and allow retry', async () => {
      const mockAccount = {
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(Date.now() + 100 * 1000),
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
        status: AccountStatus.ACTIVE,
        getDecryptedAccessToken: jest.fn().mockReturnValue('decrypted-token'),
        getDecryptedRefreshToken: jest.fn().mockReturnValue('decrypted-refresh'),
        save: jest.fn().mockResolvedValue(true),
      };

      (SocialAccount.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAccount),
      });

      mockProvider.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        expiresIn: 7200,
        expiresAt: new Date(Date.now() + 7200 * 1000),
        scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      });

      // Simulate: First attempt acquires lock, second attempt after lock expires
      jest
        .spyOn(tokenSafetyService, 'acquireRefreshLock')
        .mockResolvedValueOnce('lock-1')
        .mockResolvedValueOnce('lock-2');

      jest.spyOn(tokenSafetyService, 'releaseRefreshLock').mockResolvedValue(undefined);
      jest.spyOn(tokenSafetyService, 'verifyTokenIntegrity').mockResolvedValue({
        valid: true,
      });
      jest.spyOn(tokenSafetyService, 'getTokenMetadata').mockResolvedValue({
        version: 1,
        accountId: mockAccountId.toString(),
        provider: SocialPlatform.TWITTER,
        encryptionKeyVersion: 1,
        checksum: 'checksum',
        lastRefreshedAt: new Date(),
        refreshCount: 0,
      });
      jest.spyOn(tokenSafetyService, 'atomicTokenWrite').mockImplementation(
        async (accountId, provider, tokenData, version, callback) => {
          await callback(version);
          return { success: true, newVersion: version + 1 };
        }
      );
      jest.spyOn(securityAuditService, 'logEvent').mockResolvedValue(null as any);

      // Execute: Two sequential refresh attempts (simulating lock expiry)
      const result1 = await service.refreshToken(mockAccountId);
      const result2 = await service.refreshToken(mockAccountId);

      // Verify: Both succeeded (lock expired between attempts)
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify: Both locks released
      expect(tokenSafetyService.releaseRefreshLock).toHaveBeenCalledWith(
        mockAccountId.toString(),
        'lock-1'
      );
      expect(tokenSafetyService.releaseRefreshLock).toHaveBeenCalledWith(
        mockAccountId.toString(),
        'lock-2'
      );
    });
  });

  describe('Token Corruption Detection', () => {
    it('should detect corrupted token and mark for reconnect', async () => {
      const mockAccount = {
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
        status: AccountStatus.ACTIVE,
        getDecryptedAccessToken: jest.fn().mockReturnValue('decrypted-token'),
        getDecryptedRefreshToken: jest.fn().mockReturnValue('decrypted-refresh'),
        save: jest.fn().mockResolvedValue(true),
      };

      (SocialAccount.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAccount),
      });

      jest.spyOn(tokenSafetyService, 'acquireRefreshLock').mockResolvedValue('lock-id');
      jest.spyOn(tokenSafetyService, 'releaseRefreshLock').mockResolvedValue(undefined);

      // Simulate: Token corruption detected
      jest.spyOn(tokenSafetyService, 'verifyTokenIntegrity').mockResolvedValue({
        valid: false,
        reason: 'Checksum mismatch - token corrupted',
      });

      const markReconnectSpy = jest
        .spyOn(tokenLifecycleService, 'markReconnectRequired')
        .mockResolvedValue(true);

      // Execute: Attempt refresh
      const result = await service.refreshToken(mockAccountId);

      // Verify: Should fail and mark for reconnect
      expect(result.success).toBe(false);
      expect(result.shouldReconnect).toBe(true);
      expect(result.error).toContain('corrupted');

      // Verify: Account marked for reconnect
      expect(markReconnectSpy).toHaveBeenCalledWith(
        mockAccountId,
        expect.stringContaining('Token corruption')
      );

      // Verify: Twitter API not called (corruption detected before API call)
      expect(mockProvider.refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('Error Classification and Recovery', () => {
    it('should classify rate limit error and suggest retry', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: {
            'x-rate-limit-reset': Math.floor(Date.now() / 1000) + 900, // 15 minutes
          },
          data: {
            errors: [
              {
                message: 'Rate limit exceeded',
              },
            ],
          },
        },
      };

      const { oauthErrorClassifier } = require('../../services/OAuthErrorClassifier');
      const classified = oauthErrorClassifier.classify(SocialPlatform.TWITTER, rateLimitError);

      expect(classified.category).toBe('rate_limited');
      expect(classified.shouldRetry).toBe(true);
      expect(classified.shouldReconnect).toBe(false);
      expect(classified.retryAfterSeconds).toBeGreaterThan(0);
      expect(classified.userMessage).toContain('rate limit');
    });

    it('should classify server error and suggest retry', async () => {
      const serverError = {
        response: {
          status: 503,
          data: {
            errors: [
              {
                message: 'Service unavailable',
              },
            ],
          },
        },
      };

      const { oauthErrorClassifier } = require('../../services/OAuthErrorClassifier');
      const classified = oauthErrorClassifier.classify(SocialPlatform.TWITTER, serverError);

      expect(classified.category).toBe('server_error');
      expect(classified.shouldRetry).toBe(true);
      expect(classified.shouldReconnect).toBe(false);
      expect(classified.userMessage).toContain('experiencing issues');
    });

    it('should classify invalid request and not retry', async () => {
      const invalidError = {
        response: {
          status: 400,
          data: {
            errors: [
              {
                message: 'Invalid request parameters',
              },
            ],
          },
        },
      };

      const { oauthErrorClassifier } = require('../../services/OAuthErrorClassifier');
      const classified = oauthErrorClassifier.classify(SocialPlatform.TWITTER, invalidError);

      expect(classified.category).toBe('invalid_request');
      expect(classified.shouldRetry).toBe(false);
      expect(classified.shouldReconnect).toBe(false);
      expect(classified.userMessage).toContain('invalid content');
    });
  });
});
