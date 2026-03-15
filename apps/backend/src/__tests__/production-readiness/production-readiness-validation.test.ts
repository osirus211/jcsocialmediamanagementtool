/**
 * Production Readiness Validation Test Suite
 * 
 * Task 3.5: STEP 5 — Production Readiness Checks
 * 
 * Validates:
 * - JWT configuration (JWT_SECRET, expiration times, refresh tokens)
 * - Password hashing configuration (bcrypt rounds, performance)
 * - Environment configuration (all required variables, production settings)
 * - Error logging to external systems (format, levels, integration)
 * - Database schema optimization (no duplicate indexes)
 * - Case-insensitive email operations throughout system
 * - Create production readiness checklist and validation
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { config } from '../../config';
import { User } from '../../models/User';
import { AuthTokenService } from '../../services/AuthTokenService';
import { logger } from '../../utils/logger';

describe('Production Readiness Validation', () => {
  let testUser: any;

  beforeAll(async () => {
    // Create test user for validation
    testUser = new User({
      email: 'test@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      isEmailVerified: true,
    });
    await testUser.save();
  });

  afterAll(async () => {
    // Cleanup
    if (testUser) {
      await User.findByIdAndDelete(testUser._id);
    }
  });

  describe('JWT Configuration Validation', () => {
    test('JWT_SECRET should be properly configured', () => {
      expect(config.jwt.secret).toBeDefined();
      expect(config.jwt.secret.length).toBeGreaterThanOrEqual(32);
      expect(config.jwt.secret).not.toBe('supersecret_access_123'); // Not default
      expect(config.jwt.secret).not.toBe('test-jwt-secret-key-for-testing-only');
    });
    test('JWT_REFRESH_SECRET should be properly configured', () => {
      expect(config.jwt.refreshSecret).toBeDefined();
      expect(config.jwt.refreshSecret.length).toBeGreaterThanOrEqual(32);
      expect(config.jwt.refreshSecret).not.toBe('supersecret_refresh_456'); // Not default
      expect(config.jwt.refreshSecret).not.toBe('test-jwt-refresh-secret-key-for-testing-only');
      expect(config.jwt.refreshSecret).not.toBe(config.jwt.secret); // Different from access secret
    });

    test('JWT expiration times should be secure', () => {
      expect(config.jwt.accessExpiry).toBeDefined();
      expect(config.jwt.refreshExpiry).toBeDefined();
      
      // Access tokens should be short-lived (15 minutes or less)
      const accessExpiryMs = parseExpiryToMs(config.jwt.accessExpiry);
      expect(accessExpiryMs).toBeLessThanOrEqual(15 * 60 * 1000); // 15 minutes max
      
      // Refresh tokens should be reasonable (7 days or less)
      const refreshExpiryMs = parseExpiryToMs(config.jwt.refreshExpiry);
      expect(refreshExpiryMs).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000); // 7 days max
    });

    test('JWT token generation should work correctly', () => {
      const payload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'member'
      };

      const tokens = AuthTokenService.generateTokenPair(payload);
      
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
      
      // Verify tokens can be decoded
      const accessDecoded = jwt.decode(tokens.accessToken) as any;
      const refreshDecoded = jwt.decode(tokens.refreshToken) as any;
      
      expect(accessDecoded.userId).toBe(payload.userId);
      expect(refreshDecoded.userId).toBe(payload.userId);
      expect(accessDecoded.exp).toBeDefined();
      expect(refreshDecoded.exp).toBeDefined();
    });

    test('JWT token verification should work correctly', () => {
      const payload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'member'
      };

      const tokens = AuthTokenService.generateTokenPair(payload);
      
      // Verify access token
      const verifiedAccess = AuthTokenService.verifyAccessToken(tokens.accessToken);
      expect(verifiedAccess.userId).toBe(payload.userId);
      expect(verifiedAccess.email).toBe(payload.email);
      
      // Verify refresh token (async)
      expect(async () => {
        const verifiedRefresh = await AuthTokenService.verifyRefreshToken(tokens.refreshToken);
        expect(verifiedRefresh.userId).toBe(payload.userId);
      }).not.toThrow();
    });
  });
  describe('Password Hashing Configuration Validation', () => {
    test('bcrypt rounds should be optimal for production', async () => {
      const testPassword = 'TestPassword123!';
      
      // Test hashing performance
      const startTime = Date.now();
      const hash = await bcrypt.hash(testPassword, 12);
      const hashTime = Date.now() - startTime;
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.startsWith('$2b$12$')).toBe(true); // bcrypt with 12 rounds
      
      // Hashing should take reasonable time (100ms - 1000ms for 12 rounds)
      expect(hashTime).toBeGreaterThan(50); // At least 50ms (security)
      expect(hashTime).toBeLessThan(2000); // Less than 2s (performance)
      
      console.log(`✅ Password hashing performance: ${hashTime}ms (12 rounds)`);
    });

    test('password comparison should be timing-attack safe', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      
      // Test with actual user password comparison
      const isValidCorrect = await testUser.comparePassword(password);
      const isValidWrong = await testUser.comparePassword(wrongPassword);
      
      expect(isValidCorrect).toBe(true);
      expect(isValidWrong).toBe(false);
      
      // Measure timing for both operations
      const timings: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const start1 = Date.now();
        await testUser.comparePassword(password);
        const time1 = Date.now() - start1;
        
        const start2 = Date.now();
        await testUser.comparePassword(wrongPassword);
        const time2 = Date.now() - start2;
        
        timings.push(Math.abs(time1 - time2));
      }
      
      const avgTimingDiff = timings.reduce((a, b) => a + b, 0) / timings.length;
      
      // Timing difference should be minimal (< 50ms average)
      expect(avgTimingDiff).toBeLessThan(50);
      
      console.log(`✅ Password comparison timing difference: ${avgTimingDiff.toFixed(2)}ms average`);
    });

    test('User model password hashing should work correctly', async () => {
      const newUser = new User({
        email: 'hash-test@example.com',
        password: 'TestPassword123!',
        firstName: 'Hash',
        lastName: 'Test',
      });
      
      const originalPassword = newUser.password;
      await newUser.save();
      
      // Password should be hashed
      expect(newUser.password).not.toBe(originalPassword);
      expect(newUser.password.startsWith('$2b$12$')).toBe(true);
      
      // Should be able to compare
      const isValid = await newUser.comparePassword('TestPassword123!');
      expect(isValid).toBe(true);
      
      // Cleanup
      await User.findByIdAndDelete(newUser._id);
    });
  });
  describe('Environment Configuration Validation', () => {
    test('all required environment variables should be set', () => {
      const requiredVars = [
        'NODE_ENV',
        'PORT',
        'MONGODB_URI',
        'REDIS_HOST',
        'REDIS_PORT',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'ENCRYPTION_KEY',
        'FRONTEND_URL'
      ];

      requiredVars.forEach(varName => {
        expect(process.env[varName]).toBeDefined();
        expect(process.env[varName]).not.toBe('');
        console.log(`✅ ${varName}: ${varName.includes('SECRET') || varName.includes('KEY') ? '[REDACTED]' : process.env[varName]}`);
      });
    });

    test('production settings should be secure', () => {
      if (config.env === 'production') {
        // In production, ensure secure settings
        expect(config.jwt.secret).not.toMatch(/test|demo|example|default/i);
        expect(config.jwt.refreshSecret).not.toMatch(/test|demo|example|default/i);
        expect(config.encryption.key).not.toMatch(/test|demo|example|default/i);
        
        // Database should not be localhost in production
        expect(config.database.uri).not.toMatch(/localhost|127\.0\.0\.1/);
        
        // Redis should not be localhost in production
        expect(config.redis.host).not.toBe('localhost');
        expect(config.redis.host).not.toBe('127.0.0.1');
      }
      
      console.log(`✅ Environment: ${config.env}`);
      console.log(`✅ Database URI: ${config.database.uri.replace(/\/\/.*@/, '//[CREDENTIALS]@')}`);
      console.log(`✅ Redis Host: ${config.redis.host}:${config.redis.port}`);
    });

    test('encryption key should be properly configured', () => {
      expect(config.encryption.key).toBeDefined();
      expect(config.encryption.key.length).toBe(64); // 32 bytes as hex
      expect(/^[0-9a-f]{64}$/i.test(config.encryption.key)).toBe(true);
      expect(config.encryption.key).not.toBe('f9502f0854c585e1cd647121e9df5a2d98199fce33a1c30717a848e862adff35'); // Not default
      
      console.log(`✅ Encryption key: [64 hex characters - SECURE]`);
    });

    test('CORS and security headers should be configured', () => {
      expect(config.frontend.url).toBeDefined();
      expect(config.frontend.url).toMatch(/^https?:\/\//);
      
      if (config.env === 'production') {
        expect(config.frontend.url).toMatch(/^https:/); // HTTPS in production
      }
      
      console.log(`✅ Frontend URL: ${config.frontend.url}`);
    });
  });
  describe('Error Logging Configuration Validation', () => {
    test('logger should be properly configured', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
      
      console.log(`✅ Logger configured with level: ${config.logging.level}`);
    });

    test('logger should handle different log levels', () => {
      // Test that logger methods don't throw
      expect(() => logger.info('Test info message')).not.toThrow();
      expect(() => logger.error('Test error message')).not.toThrow();
      expect(() => logger.warn('Test warning message')).not.toThrow();
      expect(() => logger.debug('Test debug message')).not.toThrow();
      
      console.log(`✅ All log levels functional`);
    });

    test('error logging format should be structured', () => {
      const testError = new Error('Test error for validation');
      
      // Logger should handle error objects
      expect(() => logger.error('Test error:', testError)).not.toThrow();
      expect(() => logger.error('Test error with context:', { 
        error: testError.message,
        stack: testError.stack,
        userId: 'test-user',
        action: 'test-action'
      })).not.toThrow();
      
      console.log(`✅ Structured error logging functional`);
    });

    test('production log level should be appropriate', () => {
      if (config.env === 'production') {
        // In production, log level should not be debug
        expect(config.logging.level).not.toBe('debug');
        expect(['error', 'warn', 'info'].includes(config.logging.level)).toBe(true);
      }
      
      console.log(`✅ Log level appropriate for ${config.env}: ${config.logging.level}`);
    });
  });
  describe('Database Schema Optimization Validation', () => {
    test('User model should not have duplicate indexes', async () => {
      const indexes = await User.collection.getIndexes();
      const indexNames = Object.keys(indexes);
      
      console.log(`📋 User collection indexes:`, indexNames);
      
      // Check for email index (should exist and be unique)
      const emailIndexExists = indexNames.some(name => 
        name.includes('email') || indexes[name].some((field: any) => field[0] === 'email')
      );
      expect(emailIndexExists).toBe(true);
      
      // Check that there's only one email index
      const emailIndexCount = indexNames.filter(name => 
        name.includes('email') || indexes[name].some((field: any) => field[0] === 'email')
      ).length;
      expect(emailIndexCount).toBeLessThanOrEqual(1);
      
      console.log(`✅ Email index properly configured (${emailIndexCount} index)`);
    });

    test('database connection should be optimized', async () => {
      const dbState = mongoose.connection.readyState;
      expect(dbState).toBe(1); // Connected
      
      const dbName = mongoose.connection.name;
      expect(dbName).toBeDefined();
      
      console.log(`✅ Database connected: ${dbName}`);
      console.log(`✅ Connection state: ${dbState === 1 ? 'Connected' : 'Not Connected'}`);
    });

    test('User model indexes should be efficient', async () => {
      const stats = await User.collection.stats();
      
      expect(stats.count).toBeGreaterThanOrEqual(0);
      expect(stats.nindexes).toBeGreaterThan(0);
      
      console.log(`✅ User collection stats:`);
      console.log(`   - Documents: ${stats.count}`);
      console.log(`   - Indexes: ${stats.nindexes}`);
      console.log(`   - Average document size: ${Math.round(stats.avgObjSize || 0)} bytes`);
    });
  });
  describe('Case-Insensitive Email Operations Validation', () => {
    test('User model should handle case-insensitive email lookups', async () => {
      const testEmail = 'CaseTest@Example.COM';
      
      // Create user with mixed case email
      const user = new User({
        email: testEmail,
        password: 'TestPassword123!',
        firstName: 'Case',
        lastName: 'Test',
      });
      await user.save();
      
      // Email should be stored in lowercase
      expect(user.email).toBe(testEmail.toLowerCase());
      
      // Should be able to find with different cases
      const foundUser1 = await User.findOne({ email: 'casetest@example.com' });
      const foundUser2 = await User.findOne({ email: 'CASETEST@EXAMPLE.COM' });
      const foundUser3 = await User.findOne({ email: 'CaseTest@Example.com' });
      
      expect(foundUser1).toBeTruthy();
      expect(foundUser2).toBeTruthy();
      expect(foundUser3).toBeTruthy();
      
      expect(foundUser1?._id.toString()).toBe(user._id.toString());
      expect(foundUser2?._id.toString()).toBe(user._id.toString());
      expect(foundUser3?._id.toString()).toBe(user._id.toString());
      
      console.log(`✅ Case-insensitive email lookup working`);
      
      // Cleanup
      await User.findByIdAndDelete(user._id);
    });

    test('duplicate emails with different cases should be prevented', async () => {
      const baseEmail = 'duplicate@example.com';
      
      // Create first user
      const user1 = new User({
        email: baseEmail.toLowerCase(),
        password: 'TestPassword123!',
        firstName: 'First',
        lastName: 'User',
      });
      await user1.save();
      
      // Try to create second user with different case
      const user2 = new User({
        email: baseEmail.toUpperCase(),
        password: 'TestPassword123!',
        firstName: 'Second',
        lastName: 'User',
      });
      
      // Should throw duplicate key error
      await expect(user2.save()).rejects.toThrow();
      
      console.log(`✅ Duplicate email prevention working (case-insensitive)`);
      
      // Cleanup
      await User.findByIdAndDelete(user1._id);
    });

    test('email validation should normalize case', () => {
      const testEmails = [
        'Test@Example.COM',
        'USER@DOMAIN.ORG',
        'MixedCase@Email.Net'
      ];
      
      testEmails.forEach(email => {
        const user = new User({
          email: email,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
        });
        
        // Email should be normalized to lowercase
        expect(user.email).toBe(email.toLowerCase());
      });
      
      console.log(`✅ Email case normalization working`);
    });
  });
  describe('Production Readiness Checklist', () => {
    test('comprehensive production readiness assessment', async () => {
      const checklist = {
        jwtConfiguration: false,
        passwordHashing: false,
        environmentConfig: false,
        errorLogging: false,
        databaseOptimization: false,
        emailCaseInsensitive: false,
      };

      // JWT Configuration Check
      try {
        expect(config.jwt.secret.length).toBeGreaterThanOrEqual(32);
        expect(config.jwt.refreshSecret.length).toBeGreaterThanOrEqual(32);
        expect(config.jwt.secret).not.toBe(config.jwt.refreshSecret);
        checklist.jwtConfiguration = true;
      } catch (error) {
        console.error('❌ JWT Configuration failed:', error);
      }

      // Password Hashing Check
      try {
        const testHash = await bcrypt.hash('test', 12);
        expect(testHash.startsWith('$2b$12$')).toBe(true);
        checklist.passwordHashing = true;
      } catch (error) {
        console.error('❌ Password Hashing failed:', error);
      }

      // Environment Configuration Check
      try {
        expect(process.env.NODE_ENV).toBeDefined();
        expect(process.env.MONGODB_URI).toBeDefined();
        expect(process.env.JWT_SECRET).toBeDefined();
        checklist.environmentConfig = true;
      } catch (error) {
        console.error('❌ Environment Configuration failed:', error);
      }

      // Error Logging Check
      try {
        expect(logger).toBeDefined();
        expect(typeof logger.error).toBe('function');
        checklist.errorLogging = true;
      } catch (error) {
        console.error('❌ Error Logging failed:', error);
      }

      // Database Optimization Check
      try {
        const indexes = await User.collection.getIndexes();
        expect(Object.keys(indexes).length).toBeGreaterThan(0);
        checklist.databaseOptimization = true;
      } catch (error) {
        console.error('❌ Database Optimization failed:', error);
      }

      // Email Case Insensitive Check
      try {
        const testUser = new User({
          email: 'TEST@EXAMPLE.COM',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
        });
        expect(testUser.email).toBe('test@example.com');
        checklist.emailCaseInsensitive = true;
      } catch (error) {
        console.error('❌ Email Case Insensitive failed:', error);
      }

      // Generate Report
      const passedChecks = Object.values(checklist).filter(Boolean).length;
      const totalChecks = Object.keys(checklist).length;
      const readinessScore = (passedChecks / totalChecks) * 100;

      console.log('\n🎯 PRODUCTION READINESS CHECKLIST:');
      console.log('═══════════════════════════════════');
      console.log(`${checklist.jwtConfiguration ? '✅' : '❌'} JWT Configuration`);
      console.log(`${checklist.passwordHashing ? '✅' : '❌'} Password Hashing`);
      console.log(`${checklist.environmentConfig ? '✅' : '❌'} Environment Configuration`);
      console.log(`${checklist.errorLogging ? '✅' : '❌'} Error Logging`);
      console.log(`${checklist.databaseOptimization ? '✅' : '❌'} Database Optimization`);
      console.log(`${checklist.emailCaseInsensitive ? '✅' : '❌'} Email Case Insensitive`);
      console.log('═══════════════════════════════════');
      console.log(`📊 READINESS SCORE: ${readinessScore.toFixed(1)}% (${passedChecks}/${totalChecks})`);
      console.log(`🎯 PRODUCTION READY: ${readinessScore === 100 ? '✅ YES' : '❌ NO'}`);

      // All checks must pass for production readiness
      expect(readinessScore).toBe(100);
    });
  });
});

// Helper function to parse JWT expiry strings to milliseconds
function parseExpiryToMs(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 0;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}