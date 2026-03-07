/**
 * OAuth Environment Validation Tests - Production Mode
 * 
 * Tests strict production validation requirements
 */

import { validateOAuthEnvironment } from '../validateOAuthEnv';

describe('OAuth Environment Validation - Production Mode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Instagram Basic Display - Production Requirements', () => {
    it('should FAIL when INSTAGRAM_BASIC_APP_ID missing in production', () => {
      // Set all other required variables
      process.env.FACEBOOK_APP_ID = '123456789';
      process.env.FACEBOOK_APP_SECRET = 'a'.repeat(32);
      process.env.INSTAGRAM_CLIENT_ID = '987654321';
      process.env.INSTAGRAM_CLIENT_SECRET = 'b'.repeat(32);
      process.env.INSTAGRAM_BASIC_APP_SECRET = 'c'.repeat(32);
      process.env.INSTAGRAM_BASIC_REDIRECT_URI = 'https://example.com/callback';

      const result = validateOAuthEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('INSTAGRAM_BASIC_APP_ID is required in production but not set');
    });

    it('should FAIL when INSTAGRAM_BASIC_APP_SECRET missing in production', () => {
      process.env.FACEBOOK_APP_ID = '123456789';
      process.env.FACEBOOK_APP_SECRET = 'a'.repeat(32);
      process.env.INSTAGRAM_CLIENT_ID = '987654321';
      process.env.INSTAGRAM_CLIENT_SECRET = 'b'.repeat(32);
      process.env.INSTAGRAM_BASIC_APP_ID = '111222333';
      process.env.INSTAGRAM_BASIC_REDIRECT_URI = 'https://example.com/callback';

      const result = validateOAuthEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('INSTAGRAM_BASIC_APP_SECRET is required in production but not set');
    });

    it('should FAIL when INSTAGRAM_BASIC_REDIRECT_URI missing in production', () => {
      process.env.FACEBOOK_APP_ID = '123456789';
      process.env.FACEBOOK_APP_SECRET = 'a'.repeat(32);
      process.env.INSTAGRAM_CLIENT_ID = '987654321';
      process.env.INSTAGRAM_CLIENT_SECRET = 'b'.repeat(32);
      process.env.INSTAGRAM_BASIC_APP_ID = '111222333';
      process.env.INSTAGRAM_BASIC_APP_SECRET = 'c'.repeat(32);

      const result = validateOAuthEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('INSTAGRAM_BASIC_REDIRECT_URI is required in production but not set');
    });

    it('should FAIL when INSTAGRAM_BASIC_REDIRECT_URI uses HTTP in production', () => {
      process.env.FACEBOOK_APP_ID = '123456789';
      process.env.FACEBOOK_APP_SECRET = 'a'.repeat(32);
      process.env.INSTAGRAM_CLIENT_ID = '987654321';
      process.env.INSTAGRAM_CLIENT_SECRET = 'b'.repeat(32);
      process.env.INSTAGRAM_BASIC_APP_ID = '111222333';
      process.env.INSTAGRAM_BASIC_APP_SECRET = 'c'.repeat(32);
      process.env.INSTAGRAM_BASIC_REDIRECT_URI = 'http://example.com/callback'; // HTTP not HTTPS

      const result = validateOAuthEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('must use HTTPS in production'));
    });

    it('should FAIL when INSTAGRAM_BASIC_APP_SECRET too short', () => {
      process.env.FACEBOOK_APP_ID = '123456789';
      process.env.FACEBOOK_APP_SECRET = 'a'.repeat(32);
      process.env.INSTAGRAM_CLIENT_ID = '987654321';
      process.env.INSTAGRAM_CLIENT_SECRET = 'b'.repeat(32);
      process.env.INSTAGRAM_BASIC_APP_ID = '111222333';
      process.env.INSTAGRAM_BASIC_APP_SECRET = 'short'; // Too short
      process.env.INSTAGRAM_BASIC_REDIRECT_URI = 'https://example.com/callback';

      const result = validateOAuthEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('minimum 32 characters'));
    });

    it('should FAIL when INSTAGRAM_BASIC_APP_ID not numeric', () => {
      process.env.FACEBOOK_APP_ID = '123456789';
      process.env.FACEBOOK_APP_SECRET = 'a'.repeat(32);
      process.env.INSTAGRAM_CLIENT_ID = '987654321';
      process.env.INSTAGRAM_CLIENT_SECRET = 'b'.repeat(32);
      process.env.INSTAGRAM_BASIC_APP_ID = 'not-numeric'; // Not numeric
      process.env.INSTAGRAM_BASIC_APP_SECRET = 'c'.repeat(32);
      process.env.INSTAGRAM_BASIC_REDIRECT_URI = 'https://example.com/callback';

      const result = validateOAuthEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('INSTAGRAM_BASIC_APP_ID must be a numeric string');
    });

    it('should PASS when all Instagram Basic credentials valid in production', () => {
      process.env.FACEBOOK_APP_ID = '123456789';
      process.env.FACEBOOK_APP_SECRET = 'a'.repeat(32);
      process.env.INSTAGRAM_CLIENT_ID = '987654321';
      process.env.INSTAGRAM_CLIENT_SECRET = 'b'.repeat(32);
      process.env.INSTAGRAM_BASIC_APP_ID = '111222333';
      process.env.INSTAGRAM_BASIC_APP_SECRET = 'c'.repeat(32);
      process.env.INSTAGRAM_BASIC_REDIRECT_URI = 'https://example.com/callback';

      const result = validateOAuthEnvironment();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Facebook - Production HTTPS Requirement', () => {
    it('should FAIL when FACEBOOK_CALLBACK_URL uses HTTP in production', () => {
      process.env.FACEBOOK_APP_ID = '123456789';
      process.env.FACEBOOK_APP_SECRET = 'a'.repeat(32);
      process.env.FACEBOOK_CALLBACK_URL = 'http://example.com/callback'; // HTTP not HTTPS
      process.env.INSTAGRAM_CLIENT_ID = '987654321';
      process.env.INSTAGRAM_CLIENT_SECRET = 'b'.repeat(32);
      process.env.INSTAGRAM_BASIC_APP_ID = '111222333';
      process.env.INSTAGRAM_BASIC_APP_SECRET = 'c'.repeat(32);
      process.env.INSTAGRAM_BASIC_REDIRECT_URI = 'https://example.com/callback';

      const result = validateOAuthEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('FACEBOOK_CALLBACK_URL must use HTTPS in production'));
    });
  });

  describe('Development Mode - Instagram Basic Optional', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should PASS when Instagram Basic credentials missing in development', () => {
      process.env.FACEBOOK_APP_ID = '123456789';
      process.env.FACEBOOK_APP_SECRET = 'a'.repeat(32);
      process.env.INSTAGRAM_CLIENT_ID = '987654321';
      process.env.INSTAGRAM_CLIENT_SECRET = 'b'.repeat(32);
      // Instagram Basic credentials NOT set

      const result = validateOAuthEnvironment();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow HTTP redirect URIs in development', () => {
      process.env.FACEBOOK_APP_ID = '123456789';
      process.env.FACEBOOK_APP_SECRET = 'a'.repeat(32);
      process.env.INSTAGRAM_CLIENT_ID = '987654321';
      process.env.INSTAGRAM_CLIENT_SECRET = 'b'.repeat(32);
      process.env.INSTAGRAM_BASIC_APP_ID = '111222333';
      process.env.INSTAGRAM_BASIC_APP_SECRET = 'c'.repeat(32);
      process.env.INSTAGRAM_BASIC_REDIRECT_URI = 'http://localhost:5000/callback'; // HTTP OK in dev

      const result = validateOAuthEnvironment();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
