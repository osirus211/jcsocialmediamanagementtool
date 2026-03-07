import {
  encrypt,
  decrypt,
  isEncrypted,
  getKeyVersion,
  getCurrentKeyVersion,
  startKeyRotation,
  endKeyRotation,
  safeEncrypt,
  safeDecrypt,
} from '../../utils/encryption';

// Mock config
jest.mock('../../config', () => ({
  config: {
    encryption: {
      key: 'test-secret-key-that-is-at-least-32-characters-long-for-security',
    },
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Encryption Utils', () => {
  const testText = 'This is a test string to encrypt';

  beforeEach(() => {
    jest.clearAllMocks();
    endKeyRotation(); // Ensure clean state
  });

  afterEach(() => {
    endKeyRotation(); // Clean up after each test
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt text successfully', () => {
      const encrypted = encrypt(testText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(testText);
    });

    it('should produce different encrypted values for same input', () => {
      const encrypted1 = encrypt(testText);
      const encrypted2 = encrypt(testText);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(testText);
      expect(decrypt(encrypted2)).toBe(testText);
    });

    it('should include version in encrypted format', () => {
      const encrypted = encrypt(testText);
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(5); // version:salt:iv:authTag:encrypted
      expect(parts[0]).toBe('1'); // Current version
    });

    it('should encrypt with specific key version', () => {
      const encrypted = encrypt(testText, 1);
      const version = getKeyVersion(encrypted);

      expect(version).toBe(1);
      expect(decrypt(encrypted)).toBe(testText);
    });

    it('should throw error for empty text', () => {
      expect(() => encrypt('')).toThrow('Text to encrypt cannot be empty');
      expect(() => decrypt('')).toThrow('Encrypted data cannot be empty');
    });

    it('should throw error for invalid encrypted format', () => {
      expect(() => decrypt('invalid-format')).toThrow('Invalid encrypted data format');
      expect(() => decrypt('a:b:c')).toThrow('Invalid encrypted data format');
    });
  });

  describe('backward compatibility', () => {
    it('should decrypt old format (4 parts) as version 1', () => {
      // Simulate old format: salt:iv:authTag:encrypted
      const newFormatEncrypted = encrypt(testText, 1);
      const parts = newFormatEncrypted.split(':');
      const oldFormatEncrypted = parts.slice(1).join(':'); // Remove version

      const decrypted = decrypt(oldFormatEncrypted);
      expect(decrypted).toBe(testText);

      const version = getKeyVersion(oldFormatEncrypted);
      expect(version).toBe(1);
    });
  });

  describe('key versioning', () => {
    it('should get current key version', () => {
      const version = getCurrentKeyVersion();
      expect(version).toBe(1);
    });

    it('should get key version from encrypted data', () => {
      const encrypted = encrypt(testText, 1);
      const version = getKeyVersion(encrypted);
      expect(version).toBe(1);
    });

    it('should handle key rotation grace period', () => {
      // Start rotation from version 1
      startKeyRotation(1);

      // Should still be able to decrypt with previous version
      const encrypted = encrypt(testText, 1);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(testText);

      endKeyRotation();
    });
  });

  describe('isEncrypted', () => {
    it('should detect encrypted data', () => {
      const encrypted = encrypt(testText);
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should detect old format as encrypted', () => {
      const encrypted = encrypt(testText);
      const parts = encrypted.split(':');
      const oldFormat = parts.slice(1).join(':'); // Remove version
      expect(isEncrypted(oldFormat)).toBe(true);
    });

    it('should not detect plain text as encrypted', () => {
      expect(isEncrypted(testText)).toBe(false);
      expect(isEncrypted('')).toBe(false);
      expect(isEncrypted('not:encrypted:format')).toBe(false);
    });
  });

  describe('safe encrypt/decrypt', () => {
    it('should encrypt if not already encrypted', () => {
      const result = safeEncrypt(testText);
      expect(isEncrypted(result)).toBe(true);
      expect(decrypt(result)).toBe(testText);
    });

    it('should not re-encrypt already encrypted data', () => {
      const encrypted = encrypt(testText);
      const result = safeEncrypt(encrypted);
      expect(result).toBe(encrypted);
    });

    it('should decrypt if encrypted', () => {
      const encrypted = encrypt(testText);
      const result = safeDecrypt(encrypted);
      expect(result).toBe(testText);
    });

    it('should return plain text as-is', () => {
      const result = safeDecrypt(testText);
      expect(result).toBe(testText);
    });
  });

  describe('error handling', () => {
    it('should handle corrupted encrypted data', () => {
      const encrypted = encrypt(testText);
      const corrupted = encrypted.replace(/.$/, 'x'); // Change last character

      expect(() => decrypt(corrupted)).toThrow('Decryption failed');
    });

    it('should handle invalid hex in encrypted data', () => {
      const invalidHex = '1:gggg:aaaa:bbbb:cccc';
      expect(() => decrypt(invalidHex)).toThrow('Decryption failed');
    });
  });

  describe('security properties', () => {
    it('should use different salt for each encryption', () => {
      const encrypted1 = encrypt(testText);
      const encrypted2 = encrypt(testText);

      const parts1 = encrypted1.split(':');
      const parts2 = encrypted2.split(':');

      // Salt should be different (index 1)
      expect(parts1[1]).not.toBe(parts2[1]);
    });

    it('should use different IV for each encryption', () => {
      const encrypted1 = encrypt(testText);
      const encrypted2 = encrypt(testText);

      const parts1 = encrypted1.split(':');
      const parts2 = encrypted2.split(':');

      // IV should be different (index 2)
      expect(parts1[2]).not.toBe(parts2[2]);
    });

    it('should produce different auth tags for different encryptions', () => {
      const encrypted1 = encrypt(testText);
      const encrypted2 = encrypt(testText);

      const parts1 = encrypted1.split(':');
      const parts2 = encrypted2.split(':');

      // Auth tag should be different (index 3)
      expect(parts1[3]).not.toBe(parts2[3]);
    });
  });
});