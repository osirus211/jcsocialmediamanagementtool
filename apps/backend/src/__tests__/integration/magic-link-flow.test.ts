/**
 * Magic Link / Passwordless Authentication Integration Tests
 * 
 * Tests the complete magic link flow from request to verification
 */

import request from 'supertest';
import { app } from '../../app';
import { User } from '../../models/User';
import { MagicLinkService } from '../../services/MagicLinkService';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/database';

describe('Magic Link Integration Flow', () => {
  let testUser: any;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    
    // Create test user
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User'
      });

    testUser = registerResponse.body.user;
  });

  describe('Magic Link Request Flow', () => {
    it('should accept magic link request for existing user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/magic-link/request')
        .send({
          email: 'test@example.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('magic link has been sent');

      // Verify token was created in database
      const user = await User.findById(testUser._id).select('+magicLinkToken +magicLinkExpiresAt');
      expect(user?.magicLinkToken).toBeDefined();
      expect(user?.magicLinkExpiresAt).toBeDefined();
      expect(user?.magicLinkExpiresAt).toBeInstanceOf(Date);
    });

    it('should return success even for non-existent email (security)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/magic-link/request')
        .send({
          email: 'nonexistent@example.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('magic link has been sent');
    });

    it('should reject invalid email format', async () => {
      await request(app)
        .post('/api/v1/auth/magic-link/request')
        .send({
          email: 'invalid-email'
        })
        .expect(400);
    });

    it('should reject missing email', async () => {
      await request(app)
        .post('/api/v1/auth/magic-link/request')
        .send({})
        .expect(400);
    });
  });

  describe('Magic Link Verification Flow', () => {
    let magicLinkToken: string;

    beforeEach(async () => {
      // Create magic link for test user
      const { token } = await MagicLinkService.createMagicLink('test@example.com');
      magicLinkToken = token;
    });

    it('should verify valid magic link and return auth tokens', async () => {
      const response = await request(app)
        .get(`/api/v1/auth/magic-link/verify?token=${magicLinkToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Authentication successful');
      expect(response.body.user).toBeDefined();
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');

      // Verify token was consumed (removed from database)
      const user = await User.findById(testUser._id).select('+magicLinkToken +magicLinkExpiresAt');
      expect(user?.magicLinkToken).toBeUndefined();
      expect(user?.magicLinkExpiresAt).toBeUndefined();
    });

    it('should reject invalid magic link token', async () => {
      const invalidToken = 'a'.repeat(64); // 64 character hex string but invalid

      await request(app)
        .get(`/api/v1/auth/magic-link/verify?token=${invalidToken}`)
        .expect(401);
    });

    it('should reject malformed token', async () => {
      await request(app)
        .get('/api/v1/auth/magic-link/verify?token=invalid')
        .expect(400);
    });

    it('should reject missing token', async () => {
      await request(app)
        .get('/api/v1/auth/magic-link/verify')
        .expect(400);
    });

    it('should reject expired magic link token', async () => {
      // Manually expire the token
      const user = await User.findById(testUser._id);
      user!.magicLinkExpiresAt = new Date(Date.now() - 1000); // 1 second ago
      await user!.save();

      await request(app)
        .get(`/api/v1/auth/magic-link/verify?token=${magicLinkToken}`)
        .expect(401);
    });

    it('should reject reused magic link token', async () => {
      // First use should succeed
      await request(app)
        .get(`/api/v1/auth/magic-link/verify?token=${magicLinkToken}`)
        .expect(200);

      // Second use should fail
      await request(app)
        .get(`/api/v1/auth/magic-link/verify?token=${magicLinkToken}`)
        .expect(401);
    });
  });

  describe('Magic Link Status Check', () => {
    let magicLinkToken: string;

    beforeEach(async () => {
      // Create magic link for test user
      const { token } = await MagicLinkService.createMagicLink('test@example.com');
      magicLinkToken = token;
    });

    it('should return valid status for valid token', async () => {
      const response = await request(app)
        .get(`/api/v1/auth/magic-link/status?token=${magicLinkToken}`)
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.message).toBe('Magic link is valid');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should return expired status for expired token', async () => {
      // Manually expire the token
      const user = await User.findById(testUser._id);
      user!.magicLinkExpiresAt = new Date(Date.now() - 1000); // 1 second ago
      await user!.save();

      const response = await request(app)
        .get(`/api/v1/auth/magic-link/status?token=${magicLinkToken}`)
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.expired).toBe(true);
      expect(response.body.message).toBe('Magic link has expired');
    });

    it('should return invalid status for invalid token', async () => {
      const invalidToken = 'a'.repeat(64);

      const response = await request(app)
        .get(`/api/v1/auth/magic-link/status?token=${invalidToken}`)
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.message).toBe('Invalid magic link');
    });

    it('should not consume token when checking status', async () => {
      // Check status
      await request(app)
        .get(`/api/v1/auth/magic-link/status?token=${magicLinkToken}`)
        .expect(200);

      // Token should still be valid for verification
      await request(app)
        .get(`/api/v1/auth/magic-link/verify?token=${magicLinkToken}`)
        .expect(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting on magic link requests', async () => {
      // Make multiple requests quickly (should hit rate limit)
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/magic-link/request')
          .send({ email: 'test@example.com' })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Features', () => {
    it('should hash tokens in database', async () => {
      const { token } = await MagicLinkService.createMagicLink('test@example.com');
      
      const user = await User.findById(testUser._id).select('+magicLinkToken');
      
      // Token in database should be hashed (different from original)
      expect(user?.magicLinkToken).toBeDefined();
      expect(user?.magicLinkToken).not.toBe(token);
      expect(user?.magicLinkToken).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate cryptographically secure tokens', async () => {
      const tokens = new Set();
      
      // Generate multiple tokens and ensure they're unique
      for (let i = 0; i < 100; i++) {
        const { token } = MagicLinkService.generateToken();
        expect(tokens.has(token)).toBe(false);
        tokens.add(token);
        expect(token).toHaveLength(64); // 32 bytes * 2 (hex)
        expect(token).toMatch(/^[a-f0-9]{64}$/); // Valid hex string
      }
    });

    it('should set appropriate token expiry', async () => {
      const { expiresAt } = MagicLinkService.generateToken();
      const now = new Date();
      const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
      
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(fifteenMinutesFromNow.getTime());
    });
  });

  describe('Cleanup Functionality', () => {
    it('should clean up expired tokens', async () => {
      // Create magic link
      await MagicLinkService.createMagicLink('test@example.com');
      
      // Manually expire the token
      const user = await User.findById(testUser._id);
      user!.magicLinkExpiresAt = new Date(Date.now() - 1000);
      await user!.save();
      
      // Run cleanup
      const cleanedCount = await MagicLinkService.cleanupExpiredTokens();
      expect(cleanedCount).toBe(1);
      
      // Verify token was removed
      const updatedUser = await User.findById(testUser._id).select('+magicLinkToken +magicLinkExpiresAt');
      expect(updatedUser?.magicLinkToken).toBeUndefined();
      expect(updatedUser?.magicLinkExpiresAt).toBeUndefined();
    });
  });
});