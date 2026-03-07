/**
 * Unit Tests: Expiration Guard Utility
 * 
 * Tests token expiration validation and guards
 */

import {
  assertTokenNotExpired,
  assertTokenNotExpiringSoon,
  isAccountUsable,
  getDaysUntilExpiration,
  validateTokenExpiration,
  TokenExpiredError,
  TokenExpiringSoonError,
} from '../expirationGuard';
import { AccountStatus } from '../../models/SocialAccount';

// Mock logger
jest.mock('../logger');

describe('Expiration Guard Utility', () => {
  let mockAccount: any;

  beforeEach(() => {
    mockAccount = {
      _id: 'test-account-id',
      accountName: 'test_user',
      status: AccountStatus.ACTIVE,
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    };
  });

  describe('assertTokenNotExpired', () => {
    it('should not throw if token is not expired', () => {
      expect(() => assertTokenNotExpired(mockAccount)).not.toThrow();
    });

    it('should not throw if no expiration date', () => {
      mockAccount.tokenExpiresAt = undefined;

      expect(() => assertTokenNotExpired(mockAccount)).not.toThrow();
    });

    it('should throw TokenExpiredError if token is expired', () => {
      // Token expired 1 day ago
      mockAccount.tokenExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

      expect(() => assertTokenNotExpired(mockAccount)).toThrow(TokenExpiredError);
      expect(() => assertTokenNotExpired(mockAccount)).toThrow(
        'Access token has expired. Please reconnect your Instagram account.'
      );
    });

    it('should include account details in error', () => {
      mockAccount.tokenExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

      try {
        assertTokenNotExpired(mockAccount);
        fail('Should have thrown TokenExpiredError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(TokenExpiredError);
        expect(error.accountId).toBe('test-account-id');
        expect(error.accountName).toBe('test_user');
      }
    });
  });

  describe('assertTokenNotExpiringSoon', () => {
    it('should not throw if token not expiring soon', () => {
      // Token expires in 30 days
      mockAccount.tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      expect(() => assertTokenNotExpiringSoon(mockAccount, 7)).not.toThrow();
    });

    it('should not throw if no expiration date', () => {
      mockAccount.tokenExpiresAt = undefined;

      expect(() => assertTokenNotExpiringSoon(mockAccount)).not.toThrow();
    });

    it('should throw TokenExpiringSoonError if token expiring within threshold', () => {
      // Token expires in 5 days
      mockAccount.tokenExpiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

      expect(() => assertTokenNotExpiringSoon(mockAccount, 7)).toThrow(TokenExpiringSoonError);
    });

    it('should not throw if token already expired', () => {
      // Token expired 1 day ago
      mockAccount.tokenExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Should not throw because token is already expired (handled by assertTokenNotExpired)
      expect(() => assertTokenNotExpiringSoon(mockAccount, 7)).not.toThrow();
    });

    it('should include days until expiry in error', () => {
      // Token expires in 5 days
      mockAccount.tokenExpiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

      try {
        assertTokenNotExpiringSoon(mockAccount, 7);
        fail('Should have thrown TokenExpiringSoonError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(TokenExpiringSoonError);
        expect(error.daysUntilExpiry).toBe(5);
        expect(error.message).toContain('5 days');
      }
    });
  });

  describe('isAccountUsable', () => {
    it('should return true for active account with valid token', () => {
      expect(isAccountUsable(mockAccount)).toBe(true);
    });

    it('should return false for disconnected account', () => {
      mockAccount.status = AccountStatus.DISCONNECTED;

      expect(isAccountUsable(mockAccount)).toBe(false);
    });

    it('should return false for account requiring reauth', () => {
      mockAccount.status = AccountStatus.REAUTH_REQUIRED;

      expect(isAccountUsable(mockAccount)).toBe(false);
    });

    it('should return false for account with revoked permissions', () => {
      mockAccount.status = AccountStatus.PERMISSION_REVOKED;

      expect(isAccountUsable(mockAccount)).toBe(false);
    });

    it('should return false for expired token', () => {
      mockAccount.tokenExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

      expect(isAccountUsable(mockAccount)).toBe(false);
    });

    it('should return true for account with no expiration date', () => {
      mockAccount.tokenExpiresAt = undefined;

      expect(isAccountUsable(mockAccount)).toBe(true);
    });

    it('should return true for token expiring soon but not expired', () => {
      mockAccount.status = AccountStatus.TOKEN_EXPIRING;
      mockAccount.tokenExpiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

      expect(isAccountUsable(mockAccount)).toBe(true);
    });
  });

  describe('getDaysUntilExpiration', () => {
    it('should return null if no expiration date', () => {
      mockAccount.tokenExpiresAt = undefined;

      expect(getDaysUntilExpiration(mockAccount)).toBeNull();
    });

    it('should return correct days until expiration', () => {
      // Token expires in 30 days
      mockAccount.tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      expect(getDaysUntilExpiration(mockAccount)).toBe(30);
    });

    it('should return negative days for expired tokens', () => {
      // Token expired 5 days ago
      mockAccount.tokenExpiresAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

      expect(getDaysUntilExpiration(mockAccount)).toBe(-5);
    });

    it('should floor fractional days', () => {
      // Token expires in 5.9 days
      mockAccount.tokenExpiresAt = new Date(Date.now() + 5.9 * 24 * 60 * 60 * 1000);

      expect(getDaysUntilExpiration(mockAccount)).toBe(5);
    });
  });

  describe('validateTokenExpiration', () => {
    it('should not throw for valid expiration > 50 days', () => {
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      expect(() => validateTokenExpiration(expiresAt, 'test')).not.toThrow();
    });

    it('should not throw for undefined expiration', () => {
      expect(() => validateTokenExpiration(undefined, 'test')).not.toThrow();
    });

    it('should log warning for expiration < 50 days', () => {
      const expiresAt = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);

      // Should not throw, just log warning
      expect(() => validateTokenExpiration(expiresAt, 'test')).not.toThrow();
    });

    it('should log info for expiration >= 50 days', () => {
      const expiresAt = new Date(Date.now() + 55 * 24 * 60 * 60 * 1000);

      expect(() => validateTokenExpiration(expiresAt, 'test')).not.toThrow();
    });
  });
});
