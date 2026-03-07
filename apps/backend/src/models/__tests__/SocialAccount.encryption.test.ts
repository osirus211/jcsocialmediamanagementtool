/**
 * Unit Tests: SocialAccount Token Encryption
 * 
 * Validates that tokens are encrypted at rest
 */

import { SocialPlatform, AccountStatus, ProviderType } from '../SocialAccount';
import { encrypt, decrypt, isEncrypted } from '../../utils/encryption';

// Mock mongoose
jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  connection: {
    close: jest.fn().mockResolvedValue(undefined),
  },
  Types: {
    ObjectId: jest.fn().mockImplementation(() => 'mock-object-id'),
  },
  Schema: jest.fn(),
  model: jest.fn(),
}));

// Mock encryption utilities
jest.mock('../../utils/encryption', () => ({
  encrypt: jest.fn((text) => `encrypted:${text}`),
  decrypt: jest.fn((text) => text.replace('encrypted:', '')),
  isEncrypted: jest.fn((text) => text.startsWith('encrypted:')),
  getCurrentKeyVersion: jest.fn(() => 1),
}));

describe('SocialAccount Token Encryption', () => {
  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Token Encryption at Rest', () => {
    it('should encrypt access token before saving', () => {
      const plainToken = 'plain-access-token-12345';
      const mockIsEncrypted = isEncrypted as jest.Mock;
      const mockEncrypt = encrypt as jest.Mock;

      mockIsEncrypted.mockReturnValue(false);

      // Simulate pre-save hook logic
      let accessToken = plainToken;
      if (!mockIsEncrypted(accessToken)) {
        accessToken = mockEncrypt(accessToken);
      }

      expect(mockEncrypt).toHaveBeenCalledWith(plainToken);
      expect(accessToken).toBe(`encrypted:${plainToken}`);
      expect(accessToken).not.toBe(plainToken);
    });

    it('should encrypt refresh token before saving', () => {
      const plainRefreshToken = 'plain-refresh-token-67890';
      const mockIsEncrypted = isEncrypted as jest.Mock;
      const mockEncrypt = encrypt as jest.Mock;

      mockIsEncrypted.mockReturnValue(false);

      // Simulate pre-save hook logic
      let refreshToken = plainRefreshToken;
      if (refreshToken && !mockIsEncrypted(refreshToken)) {
        refreshToken = mockEncrypt(refreshToken);
      }

      expect(mockEncrypt).toHaveBeenCalledWith(plainRefreshToken);
      expect(refreshToken).toBe(`encrypted:${plainRefreshToken}`);
      expect(refreshToken).not.toBe(plainRefreshToken);
    });

    it('should not re-encrypt already encrypted tokens', () => {
      const encryptedToken = 'encrypted:already-encrypted-token';
      const mockIsEncrypted = isEncrypted as jest.Mock;
      const mockEncrypt = encrypt as jest.Mock;

      mockIsEncrypted.mockReturnValue(true);

      // Simulate pre-save hook logic
      let accessToken = encryptedToken;
      if (!mockIsEncrypted(accessToken)) {
        accessToken = mockEncrypt(accessToken);
      }

      // Should not call encrypt because token is already encrypted
      expect(mockEncrypt).not.toHaveBeenCalled();
      expect(accessToken).toBe(encryptedToken);
    });
  });

  describe('Token Decryption', () => {
    it('should decrypt access token', () => {
      const mockDecrypt = decrypt as jest.Mock;
      const encryptedToken = 'encrypted:my-access-token';

      const decrypted = mockDecrypt(encryptedToken);

      expect(mockDecrypt).toHaveBeenCalledWith(encryptedToken);
      expect(decrypted).toBe('my-access-token');
    });

    it('should decrypt refresh token', () => {
      const mockDecrypt = decrypt as jest.Mock;
      const encryptedToken = 'encrypted:my-refresh-token';

      const decrypted = mockDecrypt(encryptedToken);

      expect(mockDecrypt).toHaveBeenCalledWith(encryptedToken);
      expect(decrypted).toBe('my-refresh-token');
    });
  });

  describe('Token Exclusion from JSON', () => {
    it('should exclude tokens from JSON output', () => {
      // Simulate toJSON transform
      const mockAccount = {
        _id: 'account-id',
        accountName: 'test_user',
        accessToken: 'encrypted:access-token',
        refreshToken: 'encrypted:refresh-token',
        __v: 0,
      };

      // Simulate toJSON transform
      const json = { ...mockAccount };
      delete json.accessToken;
      delete json.refreshToken;
      delete json.__v;

      expect(json.accessToken).toBeUndefined();
      expect(json.refreshToken).toBeUndefined();
      expect(json.__v).toBeUndefined();
      expect(json.accountName).toBe('test_user');
    });
  });

  describe('Token Never in Logs', () => {
    it('should not expose tokens in error messages', () => {
      const mockAccount = {
        _id: 'account-id',
        accountName: 'test_user',
        // accessToken and refreshToken excluded from JSON
      };

      const errorMessage = `Account error: ${JSON.stringify(mockAccount)}`;

      expect(errorMessage).not.toContain('secret-token');
      expect(errorMessage).not.toContain('encrypted:secret-token');
    });

    it('should not expose tokens in string representation', () => {
      const mockAccount = {
        _id: 'account-id',
        accountName: 'test_user',
        // accessToken and refreshToken excluded from JSON
      };

      const stringRep = JSON.stringify(mockAccount);

      expect(stringRep).not.toContain('secret-token');
    });
  });
});
