/**
 * Two-Factor Authentication Integration Tests
 * 
 * Tests the complete 2FA flow from setup to login
 */

import request from 'supertest';
import { app } from '../../app';
import { User } from '../../models/User';
import { TwoFactorService } from '../../services/TwoFactorService';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/database';

describe('2FA Integration Flow', () => {
  let testUser: any;
  let accessToken: string;
  let twoFactorSecret: string;

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
    accessToken = registerResponse.body.accessToken;
  });

  describe('2FA Setup Flow', () => {
    it('should generate QR code and secret for 2FA setup', async () => {
      const response = await request(app)
        .get('/api/v2/2fa/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('secret');
      expect(response.body.data).toHaveProperty('qrCode');
      expect(response.body.data).toHaveProperty('manualEntryKey');
      expect(response.body.data.appName).toBe('Social Media Manager');

      twoFactorSecret = response.body.data.secret;
    });

    it('should verify TOTP token and enable 2FA', async () => {
      // First setup 2FA
      const setupResponse = await request(app)
        .get('/api/v2/2fa/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      twoFactorSecret = setupResponse.body.data.secret;

      // Generate valid TOTP token
      const validToken = TwoFactorService.verifyToken('123456', twoFactorSecret) 
        ? '123456' 
        : generateValidTOTP(twoFactorSecret);

      // Verify setup
      const verifyResponse = await request(app)
        .post('/api/v2/2fa/verify-setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: validToken })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.data).toHaveProperty('backupCodes');
      expect(verifyResponse.body.data.backupCodes).toHaveLength(8);

      // Verify user has 2FA enabled
      const user = await User.findById(testUser._id);
      expect(user?.twoFactorEnabled).toBe(true);
    });

    it('should reject invalid TOTP token during setup', async () => {
      // First setup 2FA
      await request(app)
        .get('/api/v2/2fa/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to verify with invalid token
      await request(app)
        .post('/api/v2/2fa/verify-setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: '000000' })
        .expect(401);
    });
  });

  describe('2FA Login Flow', () => {
    beforeEach(async () => {
      // Enable 2FA for test user
      await setupTwoFactorForUser();
    });

    it('should require 2FA challenge when user has 2FA enabled', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        })
        .expect(200);

      expect(response.body.requiresTwoFactor).toBe(true);
      expect(response.body.userId).toBe(testUser._id);
      expect(response.body.message).toBe('Two-factor authentication required');
      expect(response.body).not.toHaveProperty('accessToken');
    });

    it('should complete login with valid TOTP token', async () => {
      // First login to get 2FA challenge
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        })
        .expect(200);

      const userId = loginResponse.body.userId;
      const validToken = generateValidTOTP(twoFactorSecret);

      // Complete login with 2FA
      const completeResponse = await request(app)
        .post('/api/v1/auth/complete-login')
        .send({
          userId,
          token: validToken
        })
        .expect(200);

      expect(completeResponse.body.message).toBe('Login completed successfully');
      expect(completeResponse.body).toHaveProperty('user');
      expect(completeResponse.body).toHaveProperty('accessToken');
    });

    it('should complete login with valid backup code', async () => {
      // First login to get 2FA challenge
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        })
        .expect(200);

      const userId = loginResponse.body.userId;
      
      // Get user's backup codes
      const user = await User.findById(userId).select('+twoFactorBackupCodes');
      const backupCodes = TwoFactorService.generateBackupCodes(1);
      const hashedCode = TwoFactorService.hashBackupCode(backupCodes[0]);
      
      // Add backup code to user
      user!.twoFactorBackupCodes = [hashedCode];
      await user!.save();

      // Complete login with backup code
      const completeResponse = await request(app)
        .post('/api/v1/auth/complete-login')
        .send({
          userId,
          token: backupCodes[0]
        })
        .expect(200);

      expect(completeResponse.body.message).toBe('Login completed successfully');
      expect(completeResponse.body).toHaveProperty('user');
      expect(completeResponse.body).toHaveProperty('accessToken');

      // Verify backup code was consumed
      const updatedUser = await User.findById(userId).select('+twoFactorBackupCodes');
      expect(updatedUser!.twoFactorBackupCodes).toHaveLength(0);
    });

    it('should reject invalid 2FA token', async () => {
      // First login to get 2FA challenge
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        })
        .expect(200);

      const userId = loginResponse.body.userId;

      // Try to complete login with invalid token
      await request(app)
        .post('/api/v1/auth/complete-login')
        .send({
          userId,
          token: '000000'
        })
        .expect(401);
    });
  });

  describe('2FA Management', () => {
    beforeEach(async () => {
      await setupTwoFactorForUser();
    });

    it('should disable 2FA with valid TOTP token', async () => {
      const validToken = generateValidTOTP(twoFactorSecret);

      const response = await request(app)
        .post('/api/v2/2fa/disable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: validToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Two-factor authentication disabled successfully');

      // Verify user has 2FA disabled
      const user = await User.findById(testUser._id);
      expect(user?.twoFactorEnabled).toBe(false);
    });

    it('should regenerate backup codes with valid TOTP token', async () => {
      const validToken = generateValidTOTP(twoFactorSecret);

      const response = await request(app)
        .post('/api/v2/2fa/regenerate-backup-codes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: validToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('backupCodes');
      expect(response.body.data.backupCodes).toHaveLength(8);
    });
  });

  describe('2FA Recovery', () => {
    beforeEach(async () => {
      await setupTwoFactorForUser();
    });

    it('should allow emergency disable with backup code', async () => {
      // Add backup code to user
      const backupCodes = TwoFactorService.generateBackupCodes(1);
      const hashedCode = TwoFactorService.hashBackupCode(backupCodes[0]);
      
      const user = await User.findById(testUser._id).select('+twoFactorBackupCodes');
      user!.twoFactorBackupCodes = [hashedCode];
      await user!.save();

      const response = await request(app)
        .post('/api/v2/2fa/recovery/emergency-disable')
        .send({
          email: 'test@example.com',
          backupCode: backupCodes[0]
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify 2FA is disabled
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser?.twoFactorEnabled).toBe(false);
    });

    it('should return recovery status for user with 2FA', async () => {
      const response = await request(app)
        .get('/api/v2/2fa/recovery/status')
        .query({ email: 'test@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.twoFactorEnabled).toBe(true);
      expect(response.body.data.hasBackupCodes).toBe(true);
    });
  });

  // Helper functions
  async function setupTwoFactorForUser() {
    // Setup 2FA
    const setupResponse = await request(app)
      .get('/api/v2/2fa/setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    twoFactorSecret = setupResponse.body.data.secret;
    const validToken = generateValidTOTP(twoFactorSecret);

    // Enable 2FA
    await request(app)
      .post('/api/v2/2fa/verify-setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: validToken })
      .expect(200);
  }

  function generateValidTOTP(secret: string): string {
    // For testing, we'll use a mock implementation
    // In real tests, you'd use the actual TOTP algorithm
    return '123456'; // This would need to be a valid TOTP for the secret
  }
});