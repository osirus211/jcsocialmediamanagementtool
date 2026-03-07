// @ts-nocheck
/**
 * Unit Tests for PublishingWorkerWrapper.wrapTokenRefresh()
 * 
 * Tests:
 * - Successful token refresh
 * - Token refresh failure
 * - Circuit breaker protection
 * - Error handling
 * - Metrics emission
 * 
 * Requirements: 2.7
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import PublishingWorkerWrapper from '../../../../../.kiro/execution/reliability/PublishingWorkerWrapper';
import { CircuitState } from '../../../../../.kiro/execution/reliability/CircuitBreakerState';

// Mock the dependencies
const mockTokenService = {
  refreshAccessToken: jest.fn()
};

const mockSocialAccount = {
  findById: jest.fn()
};

jest.mock('../../../../../apps/backend/src/services/TokenService', () => ({
  tokenService: mockTokenService
}));

jest.mock('../../../../../apps/backend/src/models/SocialAccount', () => ({
  SocialAccount: mockSocialAccount
}));

describe('PublishingWorkerWrapper.wrapTokenRefresh()', () => {
  let wrapper: PublishingWorkerWrapper;

  beforeEach(() => {
    wrapper = new PublishingWorkerWrapper();
    jest.clearAllMocks();
  });

  afterEach(() => {
    wrapper.shutdown();
  });

  describe('Successful Token Refresh', () => {
    it('should successfully refresh token when circuit is CLOSED', async () => {
      const mockAccount = {
        _id: 'account-123',
        provider: 'twitter',
        accessToken: 'old-token',
        refreshToken: 'refresh-token'
      };
      
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      const result = await wrapper.wrapTokenRefresh(
        'account-123',
        'twitter',
        'refresh-token'
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockTokenService.refreshAccessToken).toHaveBeenCalledWith(mockAccount);
    });

    it('should return success result with no error', async () => {
      const mockAccount = { _id: 'account-456', provider: 'facebook' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      const result = await wrapper.wrapTokenRefresh(
        'account-456',
        'facebook',
        'refresh-token-456'
      );

      expect(result).toEqual({ success: true });
    });

    it('should log success when token refresh succeeds', async () => {
      const mockAccount = { _id: 'account-789', provider: 'linkedin' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      const loggerInfoSpy = jest.spyOn(wrapper['logger'], 'info');

      await wrapper.wrapTokenRefresh('account-789', 'linkedin', 'refresh-token-789');

      expect(loggerInfoSpy).toHaveBeenCalledWith(
        '[CIRCUIT_BREAKER] Token refresh succeeded',
        expect.objectContaining({
          accountId: 'account-789',
          provider: 'linkedin'
        })
      );

      loggerInfoSpy.mockRestore();
    });

    it('should record success in circuit breaker', async () => {
      const mockAccount = { _id: 'account-101', provider: 'twitter' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      const cbManager = wrapper['circuitBreakerManager'];
      const initialStats = cbManager.getServiceStats('oauth');
      const initialSuccesses = initialStats.successCount;

      await wrapper.wrapTokenRefresh('account-101', 'twitter', 'refresh-token-101');

      const finalStats = cbManager.getServiceStats('oauth');
      expect(finalStats.successCount).toBeGreaterThan(initialSuccesses);
    });
  });

  describe('Token Refresh Failure', () => {
    it('should return failure when token refresh fails', async () => {
      const mockAccount = { _id: 'account-202', provider: 'twitter' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(false);

      const result = await wrapper.wrapTokenRefresh(
        'account-202',
        'twitter',
        'refresh-token-202'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token refresh failed');
    });

    it('should return failure when account not found', async () => {
      mockSocialAccount.findById.mockResolvedValue(null);

      const result = await wrapper.wrapTokenRefresh(
        'account-303',
        'facebook',
        'refresh-token-303'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Social account not found');
    });

    it('should return failure when token service throws error', async () => {
      const mockAccount = { _id: 'account-404', provider: 'linkedin' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockRejectedValue(
        new Error('Token service unavailable')
      );

      const result = await wrapper.wrapTokenRefresh(
        'account-404',
        'linkedin',
        'refresh-token-404'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token service unavailable');
    });

    it('should log error when token refresh fails', async () => {
      const mockAccount = { _id: 'account-505', provider: 'twitter' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(false);

      const loggerErrorSpy = jest.spyOn(wrapper['logger'], 'error');

      await wrapper.wrapTokenRefresh('account-505', 'twitter', 'refresh-token-505');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        '[CIRCUIT_BREAKER] Token refresh failed',
        expect.objectContaining({
          accountId: 'account-505',
          provider: 'twitter',
          error: 'Token refresh failed'
        })
      );

      loggerErrorSpy.mockRestore();
    });

    it('should record failure in circuit breaker', async () => {
      const mockAccount = { _id: 'account-606', provider: 'facebook' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(false);

      const cbManager = wrapper['circuitBreakerManager'];
      const initialStats = cbManager.getServiceStats('oauth');
      const initialFailures = initialStats.failureCount;

      await wrapper.wrapTokenRefresh('account-606', 'facebook', 'refresh-token-606');

      const finalStats = cbManager.getServiceStats('oauth');
      expect(finalStats.failureCount).toBeGreaterThan(initialFailures);
    });
  });

  describe('Circuit Breaker Protection', () => {
    it('should fail-fast when circuit breaker is OPEN', async () => {
      // Force circuit breaker to OPEN state
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('oauth', CircuitState.OPEN);

      const result = await wrapper.wrapTokenRefresh(
        'account-707',
        'twitter',
        'refresh-token-707'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Circuit breaker OPEN for OAuth refresh');
    });

    it('should not call token service when circuit is OPEN', async () => {
      // Force circuit breaker to OPEN state
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('oauth', CircuitState.OPEN);

      await wrapper.wrapTokenRefresh('account-808', 'facebook', 'refresh-token-808');

      // Verify token service was NOT called (fail-fast)
      expect(mockTokenService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should log warning when circuit is OPEN', async () => {
      // Force circuit breaker to OPEN state
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('oauth', CircuitState.OPEN);

      const loggerWarnSpy = jest.spyOn(wrapper['logger'], 'warn');

      await wrapper.wrapTokenRefresh('account-909', 'linkedin', 'refresh-token-909');

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        '[CIRCUIT_BREAKER] OAuth circuit OPEN - fail-fast',
        expect.objectContaining({
          accountId: 'account-909',
          provider: 'linkedin',
          circuitState: 'OPEN'
        })
      );

      loggerWarnSpy.mockRestore();
    });

    it('should execute when circuit is CLOSED', async () => {
      const mockAccount = { _id: 'account-1010', provider: 'twitter' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      // Ensure circuit is CLOSED
      const cbManager = wrapper['circuitBreakerManager'];
      const stats = cbManager.getServiceStats('oauth');
      expect(stats.state).toBe(CircuitState.CLOSED);

      const result = await wrapper.wrapTokenRefresh(
        'account-1010',
        'twitter',
        'refresh-token-1010'
      );

      expect(result.success).toBe(true);
      expect(mockTokenService.refreshAccessToken).toHaveBeenCalled();
    });

    it('should execute when circuit is HALF_OPEN', async () => {
      // Force circuit breaker to HALF_OPEN state
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('oauth', CircuitState.HALF_OPEN);

      const mockAccount = { _id: 'account-1111', provider: 'facebook' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      const result = await wrapper.wrapTokenRefresh(
        'account-1111',
        'facebook',
        'refresh-token-1111'
      );

      expect(result.success).toBe(true);
      expect(mockTokenService.refreshAccessToken).toHaveBeenCalled();
    });

    it('should open circuit after threshold failures', async () => {
      const mockAccount = { _id: 'account-1212', provider: 'twitter' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(false);

      const cbManager = wrapper['circuitBreakerManager'];
      
      // Initial state should be CLOSED
      let stats = cbManager.getServiceStats('oauth');
      expect(stats.state).toBe(CircuitState.CLOSED);

      // Trigger multiple failures to open circuit
      const failureThreshold = 5; // Default threshold
      for (let i = 0; i < failureThreshold; i++) {
        await wrapper.wrapTokenRefresh('account-1212', 'twitter', 'refresh-token-1212');
      }

      // Verify circuit breaker is now OPEN
      stats = cbManager.getServiceStats('oauth');
      expect(stats.state).toBe(CircuitState.OPEN);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockAccount = { _id: 'account-1313', provider: 'linkedin' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockRejectedValue(
        new Error('Network timeout')
      );

      const result = await wrapper.wrapTokenRefresh(
        'account-1313',
        'linkedin',
        'refresh-token-1313'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    it('should handle database errors gracefully', async () => {
      mockSocialAccount.findById.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await wrapper.wrapTokenRefresh(
        'account-1414',
        'twitter',
        'refresh-token-1414'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('should handle invalid refresh token', async () => {
      const mockAccount = { _id: 'account-1515', provider: 'facebook' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockRejectedValue(
        new Error('Invalid refresh token')
      );

      const result = await wrapper.wrapTokenRefresh(
        'account-1515',
        'facebook',
        'invalid-token'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid refresh token');
    });

    it('should handle token revoked error', async () => {
      const mockAccount = { _id: 'account-1616', provider: 'twitter' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockRejectedValue(
        new Error('Token has been revoked')
      );

      const result = await wrapper.wrapTokenRefresh(
        'account-1616',
        'twitter',
        'revoked-token'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token has been revoked');
    });

    it('should log error with context when exception occurs', async () => {
      const mockAccount = { _id: 'account-1717', provider: 'linkedin' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockRejectedValue(
        new Error('Unexpected error')
      );

      const loggerErrorSpy = jest.spyOn(wrapper['logger'], 'error');

      await wrapper.wrapTokenRefresh('account-1717', 'linkedin', 'refresh-token-1717');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        '[CIRCUIT_BREAKER] Token refresh error',
        expect.objectContaining({
          accountId: 'account-1717',
          provider: 'linkedin',
          error: 'Unexpected error'
        })
      );

      loggerErrorSpy.mockRestore();
    });
  });

  describe('Metrics Emission', () => {
    it('should emit success metrics', async () => {
      const mockAccount = { _id: 'account-1818', provider: 'twitter' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      const cbManager = wrapper['circuitBreakerManager'];
      const initialStats = cbManager.getServiceStats('oauth');
      const initialSuccesses = initialStats.successCount;

      await wrapper.wrapTokenRefresh('account-1818', 'twitter', 'refresh-token-1818');

      const finalStats = cbManager.getServiceStats('oauth');
      expect(finalStats.successCount).toBe(initialSuccesses + 1);
    });

    it('should emit failure metrics', async () => {
      const mockAccount = { _id: 'account-1919', provider: 'facebook' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(false);

      const cbManager = wrapper['circuitBreakerManager'];
      const initialStats = cbManager.getServiceStats('oauth');
      const initialFailures = initialStats.failureCount;

      await wrapper.wrapTokenRefresh('account-1919', 'facebook', 'refresh-token-1919');

      const finalStats = cbManager.getServiceStats('oauth');
      expect(finalStats.failureCount).toBe(initialFailures + 1);
    });

    it('should track circuit breaker state transitions', async () => {
      const mockAccount = { _id: 'account-2020', provider: 'linkedin' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(false);

      const cbManager = wrapper['circuitBreakerManager'];
      
      // Initial state should be CLOSED
      let stats = cbManager.getServiceStats('oauth');
      expect(stats.state).toBe(CircuitState.CLOSED);

      // Trigger failures to open circuit
      const failureThreshold = 5;
      for (let i = 0; i < failureThreshold; i++) {
        await wrapper.wrapTokenRefresh('account-2020', 'linkedin', 'refresh-token-2020');
      }

      // Verify state transitioned to OPEN
      stats = cbManager.getServiceStats('oauth');
      expect(stats.state).toBe(CircuitState.OPEN);
    });

    it('should emit metrics for circuit breaker OPEN', async () => {
      // Force circuit breaker to OPEN state
      const cbManager = wrapper['circuitBreakerManager'];
      cbManager.forceCircuitState('oauth', CircuitState.OPEN);

      const result = await wrapper.wrapTokenRefresh(
        'account-2121',
        'twitter',
        'refresh-token-2121'
      );

      // Verify circuit breaker state is OPEN
      const stats = cbManager.getServiceStats('oauth');
      expect(stats.state).toBe(CircuitState.OPEN);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty accountId', async () => {
      const result = await wrapper.wrapTokenRefresh('', 'twitter', 'refresh-token');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty provider', async () => {
      const mockAccount = { _id: 'account-2222', provider: '' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      const result = await wrapper.wrapTokenRefresh('account-2222', '', 'refresh-token-2222');

      // Should still attempt refresh even with empty provider
      expect(result.success).toBe(true);
    });

    it('should handle multiple concurrent refresh attempts', async () => {
      const mockAccount = { _id: 'account-2424', provider: 'twitter' };
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      const calls = [
        wrapper.wrapTokenRefresh('account-2424', 'twitter', 'token-1'),
        wrapper.wrapTokenRefresh('account-2424', 'twitter', 'token-2'),
        wrapper.wrapTokenRefresh('account-2424', 'twitter', 'token-3')
      ];

      const results = await Promise.all(calls);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle account with missing fields', async () => {
      const mockAccount = { _id: 'account-2525' }; // Missing provider
      mockSocialAccount.findById.mockResolvedValue(mockAccount);
      mockTokenService.refreshAccessToken.mockResolvedValue(true);

      const result = await wrapper.wrapTokenRefresh('account-2525', 'linkedin', 'refresh-token');

      // Should still attempt refresh
      expect(result.success).toBe(true);
    });
  });
});
