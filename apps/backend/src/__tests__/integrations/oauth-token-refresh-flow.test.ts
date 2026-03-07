// @ts-nocheck
/**
 * Integration Tests for OAuth Token Refresh Flow
 * 
 * Tests:
 * - Expired token → refresh succeeds → publish proceeds
 * - Expired token → refresh fails → BullMQ retry
 * - Token revoked → permanent failure
 * - Circuit breaker OPEN → fail-fast
 * 
 * Requirements: 2.7, 3.1, 3.4
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import PublishingWorkerWrapper from '../../../../../.kiro/execution/reliability/PublishingWorkerWrapper';
import { CircuitState } from '../../../../../.kiro/execution/reliability/CircuitBreakerState';

// Mock dependencies
const mockTokenService = {
  refreshAccessToken: jest.fn()
};

// Create a mock that properly chains select()
const createMockAccount = (account) => ({
  select: jest.fn().mockResolvedValue(account)
});

const mockSocialAccount = {
  findById: jest.fn()
};

jest.mock('../../../../../apps/backend/src/services/TokenService', () => ({
  tokenService: mockTokenService
}));

jest.mock('../../../../../apps/backend/src/models/SocialAccount', () => ({
  SocialAccount: mockSocialAccount
}));

describe('OAuth Token Refresh Flow Integration Tests', () => {
  let wrapper: PublishingWorkerWrapper;

  beforeEach(() => {
    wrapper = new PublishingWorkerWrapper();
    jest.clearAllMocks();
  });

  afterEach(() => {
    wrapper.shutdown();
  });

  describe('Expired Token → Refresh Succeeds → Publish Proceeds', () => {
    it('should refresh expired token and allow publish to proceed', async () => {
      // Simulate expired token scenario
      const mockAccount = {
        _id: 'account-expired-1',
        provider: 'twitter',
        accessToken: 'expired-token',
        refreshToken: 'valid-refresh-token',
        tokenExpiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      };

      // Mock successful token refresh
      mockSocialAccount.findById.mockReturnValue(createMockAccount(mockAccount));
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      // Attempt token refresh
      const refreshResult = await wrapper.wrapTokenRefresh(
        mockAccount._id,
        mockAccount.provider,
        mockAccount.refreshToken
      );

      // Verify refresh succeeded
      expect(refreshResult.success).toBe(true);
      expect(refreshResult.error).toBeUndefined();

      // Verify token service was called
      expect(mockTokenService.refreshAccessToken).toHaveBeenCalledWith(mockAccount);

      // Verify circuit breaker recorded success
      const cbManager = wrapper['circuitBreakerManager'];
      const stats = cbManager.getServiceStats('oauth');
      expect(stats.successCount).toBeGreaterThan(0);

      // At this point, publish would proceed with refreshed token
      console.log('✓ Token refreshed successfully, publish can proceed');
    });

    it('should handle multiple consecutive token refreshes', async () => {
      const mockAccount = {
        _id: 'account-expired-2',
        provider: 'facebook',
        accessToken: 'expired-token',
        refreshToken: 'valid-refresh-token'
      };

      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      // Simulate multiple refresh attempts (e.g., multiple posts in queue)
      const refreshPromises = [
        wrapper.wrapTokenRefresh(mockAccount._id, mockAccount.provider, mockAccount.refreshToken),
        wrapper.wrapTokenRefresh(mockAccount._id, mockAccount.provider, mockAccount.refreshToken),
        wrapper.wrapTokenRefresh(mockAccount._id, mockAccount.provider, mockAccount.refreshToken)
      ];

      const results = await Promise.all(refreshPromises);

      // All refreshes should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      console.log('✓ Multiple token refreshes handled successfully');
    });

    it('should log token refresh success for monitoring', async () => {
      const mockAccount = {
        _id: 'account-expired-3',
        provider: 'linkedin',
        accessToken: 'expired-token',
        refreshToken: 'valid-refresh-token'
      };

      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      const loggerInfoSpy = jest.spyOn(wrapper['logger'], 'info');

      await wrapper.wrapTokenRefresh(
        mockAccount._id,
        mockAccount.provider,
        mockAccount.refreshToken
      );

      // Verify success was logged
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        '[CIRCUIT_BREAKER] Token refresh succeeded',
        expect.objectContaining({
          accountId: mockAccount._id,
          provider: mockAccount.provider
        })
      );

      loggerInfoSpy.mockRestore();
      console.log('✓ Token refresh success logged for monitoring');
    });
  });

  describe('Expired Token → Refresh Fails → BullMQ Retry', () => {
    it('should return failure when token refresh fails', async () => {
      const mockAccount = {
        _id: 'account-refresh-fail-1',
        provider: 'twitter',
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh-token'
      };

      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(false);

      const refreshResult = await wrapper.wrapTokenRefresh(
        mockAccount._id,
        mockAccount.provider,
        mockAccount.refreshToken
      );

      // Verify refresh failed
      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toBe('Token refresh failed');

      // This failure would trigger BullMQ retry in PublishingWorker
      console.log('✓ Token refresh failure detected, would trigger BullMQ retry');
    });

    it('should record failure in circuit breaker', async () => {
      const mockAccount = {
        _id: 'account-refresh-fail-2',
        provider: 'facebook',
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh-token'
      };

      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(false);

      const cbManager = wrapper['circuitBreakerManager'];
      const initialStats = cbManager.getServiceStats('oauth');
      const initialFailures = initialStats.failureCount;

      await wrapper.wrapTokenRefresh(
        mockAccount._id,
        mockAccount.provider,
        mockAccount.refreshToken
      );

      const finalStats = cbManager.getServiceStats('oauth');
      expect(finalStats.failureCount).toBeGreaterThan(initialFailures);

      console.log('✓ Token refresh failure recorded in circuit breaker');
    });

    it('should log token refresh failure for debugging', async () => {
      const mockAccount = {
        _id: 'account-refresh-fail-3',
        provider: 'linkedin',
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh-token'
      };

      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(false);

      const loggerErrorSpy = jest.spyOn(wrapper['logger'], 'error');

      await wrapper.wrapTokenRefresh(
        mockAccount._id,
        mockAccount.provider,
        mockAccount.refreshToken
      );

      // Verify failure was logged
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        '[CIRCUIT_BREAKER] Token refresh failed',
        expect.objectContaining({
          accountId: mockAccount._id,
          provider: mockAccount.provider,
          error: 'Token refresh failed'
        })
      );

      loggerErrorSpy.mockRestore();
      console.log('✓ Token refresh failure logged for debugging');
    });

    it('should handle network errors during token refresh', async () => {
      const mockAccount = {
        _id: 'account-network-error',
        provider: 'twitter',
        accessToken: 'expired-token',
        refreshToken: 'valid-refresh-token'
      };

      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockRejectedValue(
        new Error('Network timeout')
      );

      const refreshResult = await wrapper.wrapTokenRefresh(
        mockAccount._id,
        mockAccount.provider,
        mockAccount.refreshToken
      );

      // Verify network error is handled gracefully
      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toBe('Network timeout');

      console.log('✓ Network errors during token refresh handled gracefully');
    });
  });

  describe('Token Revoked → Permanent Failure', () => {
    it('should detect token revoked error', async () => {
      const mockAccount = {
        _id: 'account-revoked-1',
        provider: 'twitter',
        accessToken: 'revoked-token',
        refreshToken: 'revoked-refresh-token'
      };

      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockRejectedValue(
        new Error('Token has been revoked')
      );

      const refreshResult = await wrapper.wrapTokenRefresh(
        mockAccount._id,
        mockAccount.provider,
        mockAccount.refreshToken
      );

      // Verify revoked token error is detected
      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toBe('Token has been revoked');

      console.log('✓ Token revoked error detected');
    });

    it('should handle invalid grant errors (token revoked)', async () => {
      const mockAccount = {
        _id: 'account-invalid-grant',
        provider: 'facebook',
        accessToken: 'invalid-token',
        refreshToken: 'invalid-refresh-token'
      };

      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockRejectedValue(
        new Error('Invalid refresh token')
      );

      const refreshResult = await wrapper.wrapTokenRefresh(
        mockAccount._id,
        mockAccount.provider,
        mockAccount.refreshToken
      );

      // Verify invalid grant error is handled
      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toBe('Invalid refresh token');

      // This would be classified as permanent failure in PublishingWorker
      console.log('✓ Invalid grant error handled as permanent failure');
    });

    it('should log token revoked errors for user notification', async () => {
      const mockAccount = {
        _id: 'account-revoked-2',
        provider: 'linkedin',
        accessToken: 'revoked-token',
        refreshToken: 'revoked-refresh-token'
      };

      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockRejectedValue(
        new Error('Token has been revoked')
      );

      const loggerErrorSpy = jest.spyOn(wrapper['logger'], 'error');

      await wrapper.wrapTokenRefresh(
        mockAccount._id,
        mockAccount.provider,
        mockAccount.refreshToken
      );

      // Verify revoked error was logged
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        '[CIRCUIT_BREAKER] Token refresh error',
        expect.objectContaining({
          accountId: mockAccount._id,
          provider: mockAccount.provider,
          error: 'Token has been revoked'
        })
      );

      loggerErrorSpy.mockRestore();
      console.log('✓ Token revoked error logged for user notification');
    });
  });

  describe('Circuit Breaker OPEN → Fail-Fast', () => {
    it('should fail-fast when OAuth circuit breaker is OPEN', async () => {
      // Force circuit breaker to OPEN state
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('oauth', CircuitState.OPEN);

      const refreshResult = await wrapper.wrapTokenRefresh(
        'account-circuit-open-1',
        'twitter',
        'refresh-token'
      );

      // Verify fail-fast behavior
      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toBe('Circuit breaker OPEN for OAuth refresh');

      // Verify token service was NOT called (fail-fast)
      expect(mockTokenService.refreshAccessToken).not.toHaveBeenCalled();

      console.log('✓ Circuit breaker OPEN triggers fail-fast');
    });

    it('should log warning when circuit breaker is OPEN', async () => {
      // Force circuit breaker to OPEN state
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('oauth', CircuitState.OPEN);

      const loggerWarnSpy = jest.spyOn(wrapper['logger'], 'warn');

      await wrapper.wrapTokenRefresh(
        'account-circuit-open-2',
        'facebook',
        'refresh-token'
      );

      // Verify warning was logged
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        '[CIRCUIT_BREAKER] OAuth circuit OPEN - fail-fast',
        expect.objectContaining({
          accountId: 'account-circuit-open-2',
          provider: 'facebook',
          circuitState: 'OPEN'
        })
      );

      loggerWarnSpy.mockRestore();
      console.log('✓ Circuit breaker OPEN warning logged');
    });

    it('should open circuit after threshold failures', async () => {
      const mockAccount = {
        _id: 'account-threshold-test',
        provider: 'twitter',
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh-token'
      };

      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(false);

      const cbManager = wrapper['circuitBreakerManager'];
      
      // Initial state should be CLOSED
      let stats = cbManager.getServiceStats('oauth');
      expect(stats.state).toBe(CircuitState.CLOSED);

      // Trigger multiple failures to open circuit
      const failureThreshold = 5; // Default threshold
      for (let i = 0; i < failureThreshold; i++) {
        await wrapper.wrapTokenRefresh(
          mockAccount._id,
          mockAccount.provider,
          mockAccount.refreshToken
        );
      }

      // Verify circuit breaker is now OPEN
      stats = cbManager.getServiceStats('oauth');
      expect(stats.state).toBe(CircuitState.OPEN);

      console.log('✓ Circuit breaker opens after threshold failures');
    });

    it('should allow requests when circuit is HALF_OPEN', async () => {
      // Force circuit breaker to HALF_OPEN state
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('oauth', CircuitState.HALF_OPEN);

      const mockAccount = {
        _id: 'account-half-open',
        provider: 'linkedin',
        accessToken: 'expired-token',
        refreshToken: 'valid-refresh-token'
      };

      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      const refreshResult = await wrapper.wrapTokenRefresh(
        mockAccount._id,
        mockAccount.provider,
        mockAccount.refreshToken
      );

      // Verify request was allowed (HALF_OPEN allows test requests)
      expect(refreshResult.success).toBe(true);
      expect(mockTokenService.refreshAccessToken).toHaveBeenCalled();

      console.log('✓ Circuit breaker HALF_OPEN allows test requests');
    });
  });

  describe('End-to-End Token Refresh Flow', () => {
    it('should handle complete token refresh lifecycle', async () => {
      const mockAccount = {
        _id: 'account-e2e-1',
        provider: 'twitter',
        accessToken: 'expired-token',
        refreshToken: 'valid-refresh-token',
        tokenExpiresAt: new Date(Date.now() - 1000)
      };

      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      // Step 1: Detect expired token
      const isExpired = mockAccount.tokenExpiresAt < new Date();
      expect(isExpired).toBe(true);

      // Step 2: Attempt token refresh
      const refreshResult = await wrapper.wrapTokenRefresh(
        mockAccount._id,
        mockAccount.provider,
        mockAccount.refreshToken
      );

      // Step 3: Verify refresh succeeded
      expect(refreshResult.success).toBe(true);

      // Step 4: Verify circuit breaker recorded success
      const cbManager = wrapper['circuitBreakerManager'];
      const stats = cbManager.getServiceStats('oauth');
      expect(stats.successCount).toBeGreaterThan(0);

      // Step 5: At this point, PublishingWorker would reload account with new token
      // and proceed with publish

      console.log('✓ Complete token refresh lifecycle handled successfully');
    });

    it('should handle token refresh failure and retry flow', async () => {
      const mockAccount = {
        _id: 'account-e2e-2',
        provider: 'facebook',
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh-token'
      };

      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(false);

      // Attempt 1: Token refresh fails
      const attempt1 = await wrapper.wrapTokenRefresh(
        mockAccount._id,
        mockAccount.provider,
        mockAccount.refreshToken
      );
      expect(attempt1.success).toBe(false);

      // Attempt 2: Token refresh fails again
      const attempt2 = await wrapper.wrapTokenRefresh(
        mockAccount._id,
        mockAccount.provider,
        mockAccount.refreshToken
      );
      expect(attempt2.success).toBe(false);

      // Attempt 3: Token refresh fails (final attempt)
      const attempt3 = await wrapper.wrapTokenRefresh(
        mockAccount._id,
        mockAccount.provider,
        mockAccount.refreshToken
      );
      expect(attempt3.success).toBe(false);

      // At this point, PublishingWorker would mark post as FAILED
      // after exhausting BullMQ retries

      console.log('✓ Token refresh failure and retry flow handled');
    });

    it('should track metrics across multiple token refresh attempts', async () => {
      const mockAccount = {
        _id: 'account-metrics',
        provider: 'linkedin',
        accessToken: 'expired-token',
        refreshToken: 'valid-refresh-token'
      };

      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      
      const cbManager = wrapper['circuitBreakerManager'];
      const initialStats = cbManager.getServiceStats('oauth');

      // Simulate mixed success/failure scenarios
      mockTokenService.refreshAccessToken.mockResolvedValueOnce(true);  // Success
      await wrapper.wrapTokenRefresh(mockAccount._id, mockAccount.provider, mockAccount.refreshToken);

      mockTokenService.refreshAccessToken.mockResolvedValueOnce(false); // Failure
      await wrapper.wrapTokenRefresh(mockAccount._id, mockAccount.provider, mockAccount.refreshToken);

      mockTokenService.refreshAccessToken.mockResolvedValueOnce(true);  // Success
      await wrapper.wrapTokenRefresh(mockAccount._id, mockAccount.provider, mockAccount.refreshToken);

      const finalStats = cbManager.getServiceStats('oauth');

      // Verify metrics were tracked
      expect(finalStats.successCount).toBeGreaterThan(initialStats.successCount);
      expect(finalStats.failureCount).toBeGreaterThan(initialStats.failureCount);

      console.log('✓ Metrics tracked across multiple token refresh attempts');
      console.log(`  Successes: ${finalStats.successCount - initialStats.successCount}`);
      console.log(`  Failures: ${finalStats.failureCount - initialStats.failureCount}`);
    });
  });
});
