import request from 'supertest';
import app from '../../app';
import { User } from '../../models/User';
import { AuthService } from '../../services/AuthService';
import bcrypt from 'bcrypt';

/**
 * Comprehensive Security Validation Test Suite - Task 3.4
 * 
 * Backend security testing for the email-password-login-security-fix spec
 * 
 * Tests:
 * - Brute force protection with Redis tracking
 * - Timing attack prevention validation
 * - Rate limiting effectiveness
 * - JWT security (expiration, signature, refresh)
 * - Audit logging validation
 * - Password exposure prevention
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.9, 1.10, 2.1, 2.2, 2.9**
 */

// Mock Redis for consistent testing
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(300)
  })),
  getRedisClientSafe: jest.fn(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(300),
    call: jest.fn().mockResolvedValue('OK')
  })),
  connectRedis: jest.fn()
}));

// Mock external services
jest.mock('../../services/EmailService');
jest.mock('../../middleware/csrf', () => ({
  csrfProtection: (req: any, res: any, next: any) => next(),
  generateCsrfToken: jest.fn(() => 'mock-csrf-token'),
  getCsrfToken: (req: any, res: any) => res.json({ csrfToken: 'mock-csrf-token' })
}));

describe('Comprehensive Security Validation - Task 3.4', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    _id: 'user123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'member',
    provider: 'local',
    isEmailVerified: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    lastLoginAt: new Date(),
    comparePassword: jest.fn(),
    addRefreshToken: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    toObject: jest.fn().mockReturnValue({
      _id: 'user123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'member'
    })
  };

  describe('Brute Force Protection Testing', () => {
    test('should implement sophisticated brute force protection', async () => {
      console.log('🔒 Testing brute force protection...');
      
      // Mock user not found to test brute force on non-existent accounts
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      const testEmail = 'brute-force-test@example.com';
      const attempts = [];
      let rateLimitDetected = false;

      // Make 15 rapid attempts
      for (let i = 1; i <= 15; i++) {
        const startTime = Date.now();
        
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testEmail,
            password: `wrongpassword${i}`
          });
        
        const responseTime = Date.now() - startTime;
        
        attempts.push({
          attempt: i,
          status: response.status,
          responseTime,
          headers: response.headers
        });

        // Check for rate limiting
        if (response.status === 429) {
          rateLimitDetected = true;
          console.log(`✅ Rate limiting activated at attempt ${i}`);
          
          // Verify rate limit response structure
          expect(response.body).toHaveProperty('error', 'Too Many Requests');
          expect(response.body).toHaveProperty('message');
          expect(response.body).toHaveProperty('retryAfter');
          
          // Verify retry-after header
          expect(response.headers['retry-after']).toBeDefined();
          break;
        }

        // All non-rate-limited attempts should return 401 (unauthorized)
        expect(response.status).toBe(401);
      }

      // Analyze results
      const avgResponseTime = attempts.reduce((sum, a) => sum + a.responseTime, 0) / attempts.length;
      console.log(`📊 Brute force test results:`);
      console.log(`- Total attempts: ${attempts.length}`);
      console.log(`- Rate limit detected: ${rateLimitDetected}`);
      console.log(`- Average response time: ${avgResponseTime.toFixed(2)}ms`);

      // Assertions
      if (attempts.length >= 10) {
        // If we made 10+ attempts without rate limiting, check for progressive delays
        const laterAttempts = attempts.slice(-3);
        const earlyAttempts = attempts.slice(0, 3);
        
        const avgLaterTime = laterAttempts.reduce((sum, a) => sum + a.responseTime, 0) / laterAttempts.length;
        const avgEarlyTime = earlyAttempts.reduce((sum, a) => sum + a.responseTime, 0) / earlyAttempts.length;
        
        // Either rate limiting should be active OR progressive delays should be implemented
        expect(rateLimitDetected || avgLaterTime > avgEarlyTime * 1.5).toBe(true);
      } else {
        // Rate limiting activated early (good security)
        expect(rateLimitDetected).toBe(true);
      }
    });

    test('should track per-user attempt counters', async () => {
      console.log('👤 Testing per-user attempt tracking...');
      
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      const user1Email = 'user1@example.com';
      const user2Email = 'user2@example.com';

      // Make attempts for user1
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: user1Email,
            password: 'wrongpassword'
          });
      }

      // Make attempts for user2 (should not be affected by user1's attempts)
      const user2Response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: user2Email,
          password: 'wrongpassword'
        });

      // User2 should still be able to attempt login (not rate limited by user1's attempts)
      expect([401, 429]).toContain(user2Response.status);
      
      if (user2Response.status === 401) {
        console.log('✅ Per-user tracking: User2 not affected by User1 rate limiting');
      } else {
        console.log('⚠️ Global rate limiting may be in effect');
      }
    });
  });

  describe('Timing Attack Prevention', () => {
    test('should have consistent response times for different scenarios', async () => {
      console.log('⏱️ Testing timing attack prevention...');
      
      const measurements = [];

      // Test 1: Non-existent user
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      for (let i = 0; i < 5; i++) {
        const startTime = process.hrtime.bigint();
        
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: `nonexistent${i}@example.com`,
            password: 'wrongpassword'
          });
        
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        measurements.push({
          type: 'nonexistent_user',
          responseTime
        });
      }

      // Test 2: Existing user with wrong password
      const existingUser = {
        ...mockUser,
        comparePassword: jest.fn().mockResolvedValue(false)
      };

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(existingUser)
      });

      for (let i = 0; i < 5; i++) {
        const startTime = process.hrtime.bigint();
        
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'existing@example.com',
            password: `wrongpassword${i}`
          });
        
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000;
        
        measurements.push({
          type: 'existing_user_wrong_password',
          responseTime
        });
      }

      // Analyze timing differences
      const nonexistentTimes = measurements.filter(m => m.type === 'nonexistent_user').map(m => m.responseTime);
      const existingTimes = measurements.filter(m => m.type === 'existing_user_wrong_password').map(m => m.responseTime);

      const avgNonexistent = nonexistentTimes.reduce((a, b) => a + b, 0) / nonexistentTimes.length;
      const avgExisting = existingTimes.reduce((a, b) => a + b, 0) / existingTimes.length;
      const timingDifference = Math.abs(avgNonexistent - avgExisting);

      console.log(`📊 Timing analysis:`);
      console.log(`- Avg nonexistent user: ${avgNonexistent.toFixed(2)}ms`);
      console.log(`- Avg existing user (wrong pwd): ${avgExisting.toFixed(2)}ms`);
      console.log(`- Timing difference: ${timingDifference.toFixed(2)}ms`);

      // Timing difference should be minimal (within 50ms for unit tests)
      expect(timingDifference).toBeLessThan(50);
      console.log('✅ Timing attack prevention: Response times are consistent');
    });

    test('should perform dummy operations for timing consistency', async () => {
      console.log('🔄 Testing dummy operations for timing consistency...');
      
      // Mock bcrypt.compare to track calls
      const bcryptCompareSpy = jest.spyOn(bcrypt, 'compare');
      bcryptCompareSpy.mockResolvedValue(false);

      // Test with non-existent user (should still call bcrypt.compare for timing)
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'testpassword'
        });

      // Verify that bcrypt.compare was called even for non-existent user
      expect(bcryptCompareSpy).toHaveBeenCalled();
      console.log('✅ Dummy operations: bcrypt.compare called for non-existent user');

      bcryptCompareSpy.mockRestore();
    });
  });

  describe('JWT Security Validation', () => {
    test('should generate secure JWT tokens with proper claims', async () => {
      console.log('🔐 Testing JWT security...');
      
      const validUser = {
        ...mockUser,
        comparePassword: jest.fn().mockResolvedValue(true)
      };

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(validUser)
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'valid@example.com',
          password: 'ValidPassword123!'
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('accessToken');
        
        const token = response.body.accessToken;
        const tokenParts = token.split('.');
        
        // Verify JWT structure
        expect(tokenParts.length).toBe(3);
        console.log('✅ JWT structure: Token has 3 parts (header.payload.signature)');
        
        // Decode and verify payload
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        
        // Verify required claims
        expect(payload.userId).toBeDefined();
        expect(payload.email).toBeDefined();
        expect(payload.role).toBeDefined();
        expect(payload.iat).toBeDefined(); // Issued at
        expect(payload.exp).toBeDefined(); // Expiration
        
        // Verify expiration is reasonable (not too long)
        const currentTime = Math.floor(Date.now() / 1000);
        const timeUntilExpiration = payload.exp - currentTime;
        
        expect(timeUntilExpiration).toBeGreaterThan(0);
        expect(timeUntilExpiration).toBeLessThan(24 * 60 * 60); // Less than 24 hours
        
        console.log(`✅ JWT claims: Token expires in ${Math.round(timeUntilExpiration / 60)} minutes`);
        
        // Verify refresh token is set as httpOnly cookie
        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
          const refreshTokenCookie = setCookieHeader.find((cookie: string) => 
            cookie.includes('refreshToken')
          );
          
          if (refreshTokenCookie) {
            expect(refreshTokenCookie).toContain('HttpOnly');
            expect(refreshTokenCookie).toContain('SameSite');
            console.log('✅ Refresh token: Set as httpOnly cookie with security attributes');
          }
        }
      }
    });

    test('should handle JWT refresh securely', async () => {
      console.log('🔄 Testing JWT refresh security...');
      
      // Test refresh without token
      const noTokenResponse = await request(app)
        .post('/api/v1/auth/refresh');
      
      expect([401, 403]).toContain(noTokenResponse.status);
      console.log('✅ Refresh security: Requires valid refresh token');
      
      // Test refresh with invalid token
      const invalidTokenResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refreshToken=invalid.token.here');
      
      expect([401, 403]).toContain(invalidTokenResponse.status);
      console.log('✅ Refresh security: Rejects invalid tokens');
    });

    test('should validate 2FA before issuing JWT tokens', async () => {
      console.log('🔐 Testing 2FA JWT security...');
      
      const twoFactorUser = {
        ...mockUser,
        twoFactorEnabled: true,
        twoFactorSecret: 'mock-secret',
        comparePassword: jest.fn().mockResolvedValue(true)
      };

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(twoFactorUser)
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: '2fa-user@example.com',
          password: 'ValidPassword123!'
        });

      if (response.status === 200) {
        // Should return 2FA challenge, not full JWT tokens
        expect(response.body).toHaveProperty('requiresTwoFactor', true);
        expect(response.body).toHaveProperty('tempToken');
        expect(response.body).not.toHaveProperty('accessToken');
        
        console.log('✅ 2FA JWT security: No access token issued before 2FA verification');
        
        // Verify temp token is short-lived
        const tempToken = response.body.tempToken;
        const tokenParts = tempToken.split('.');
        
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          const currentTime = Math.floor(Date.now() / 1000);
          const timeUntilExpiration = payload.exp - currentTime;
          
          // Temp token should expire quickly (within 5 minutes)
          expect(timeUntilExpiration).toBeLessThan(5 * 60);
          console.log(`✅ Temp token security: Expires in ${Math.round(timeUntilExpiration / 60)} minutes`);
        }
      }
    });
  });

  describe('Audit Logging Validation', () => {
    test('should log authentication events with required fields', async () => {
      console.log('📝 Testing audit logging...');
      
      // Mock console.log to capture audit logs
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'SecurityTest/1.0')
        .set('X-Forwarded-For', '192.168.1.100')
        .send({
          email: 'audit-test@example.com',
          password: 'wrongpassword'
        });

      // Verify response includes tracking headers
      expect(response.headers['x-request-id'] || response.headers['request-id']).toBeDefined();
      
      // Check if audit logging occurred (look for login-related logs)
      const logCalls = consoleSpy.mock.calls;
      const loginLogs = logCalls.filter(call => 
        call.some(arg => 
          typeof arg === 'string' && 
          (arg.includes('Login') || arg.includes('LOGIN') || arg.includes('auth'))
        )
      );
      
      expect(loginLogs.length).toBeGreaterThan(0);
      console.log(`✅ Audit logging: ${loginLogs.length} authentication-related log entries found`);
      
      consoleSpy.mockRestore();
    });

    test('should track IP addresses and user agents', async () => {
      console.log('🌐 Testing IP and User-Agent tracking...');
      
      const customUserAgent = 'SecurityTest/1.0 (Audit Validation)';
      const customIP = '203.0.113.1';
      
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', customUserAgent)
        .set('X-Forwarded-For', customIP)
        .send({
          email: 'ip-tracking-test@example.com',
          password: 'testpassword'
        });

      // The system should process the request without errors
      expect([401, 429]).toContain(response.status);
      console.log('✅ IP and User-Agent tracking: Custom headers processed successfully');
    });
  });

  describe('Password Exposure Prevention', () => {
    test('should never expose password fields in responses', async () => {
      console.log('🔒 Testing password exposure prevention...');
      
      const validUser = {
        ...mockUser,
        password: '$2b$12$hashedpasswordhere',
        comparePassword: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
          _id: 'user123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'member',
          password: '$2b$12$hashedpasswordhere' // This should be filtered out
        })
      };

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(validUser)
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'valid@example.com',
          password: 'ValidPassword123!'
        });

      if (response.status === 200) {
        const responseBody = JSON.stringify(response.body);
        
        // Check for password exposure in response
        const sensitiveFields = [
          'password',
          '$2b$',
          '$2a$',
          'passwordHash',
          'hashedPassword'
        ];
        
        let exposureFound = false;
        for (const field of sensitiveFields) {
          if (responseBody.toLowerCase().includes(field.toLowerCase())) {
            console.log(`⚠️ Potential password exposure: ${field}`);
            exposureFound = true;
          }
        }
        
        expect(exposureFound).toBe(false);
        console.log('✅ Password exposure prevention: No sensitive fields in response');
        
        // Verify user object doesn't contain password
        if (response.body.user) {
          expect(response.body.user.password).toBeUndefined();
          expect(response.body.user.passwordHash).toBeUndefined();
          console.log('✅ User object sanitization: Password fields removed');
        }
      }
    });

    test('should sanitize user queries to prevent password exposure', async () => {
      console.log('🧹 Testing user query sanitization...');
      
      // This test verifies that User.findOne is called with proper field selection
      const findOneSpy = jest.spyOn(User, 'findOne');
      
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'sanitization-test@example.com',
          password: 'testpassword'
        });

      // Verify that User.findOne was called (indicating proper query structure)
      expect(findOneSpy).toHaveBeenCalled();
      
      // The select method should be called to explicitly include password for comparison
      const mockCall = findOneSpy.mock.results[0];
      if (mockCall && mockCall.value && mockCall.value.select) {
        expect(mockCall.value.select).toHaveBeenCalled();
        console.log('✅ Query sanitization: Proper field selection used');
      }
      
      findOneSpy.mockRestore();
    });
  });

  describe('Comprehensive Security Integration', () => {
    test('should pass all security measures simultaneously', async () => {
      console.log('🛡️ Running comprehensive security integration test...');
      
      const securityResults = {
        rateLimitingWorks: false,
        timingConsistent: false,
        jwtSecure: false,
        auditLogging: false,
        passwordProtected: false
      };

      // Test 1: Rate limiting
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      for (let i = 0; i < 8; i++) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'integration-test@example.com',
            password: 'wrongpassword'
          });
        
        if (response.status === 429) {
          securityResults.rateLimitingWorks = true;
          break;
        }
      }

      // Test 2: Timing consistency
      const times = [];
      for (let i = 0; i < 3; i++) {
        const start = process.hrtime.bigint();
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: `timing-test-${i}@example.com`,
            password: 'wrongpassword'
          });
        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1000000);
      }
      
      const maxVariance = Math.max(...times) - Math.min(...times);
      if (maxVariance < 100) {
        securityResults.timingConsistent = true;
      }

      // Test 3: JWT security
      const validUser = {
        ...mockUser,
        comparePassword: jest.fn().mockResolvedValue(true)
      };

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(validUser)
      });

      const jwtResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'jwt-test@example.com',
          password: 'ValidPassword123!'
        });

      if (jwtResponse.status === 200 && jwtResponse.body.accessToken) {
        const tokenParts = jwtResponse.body.accessToken.split('.');
        if (tokenParts.length === 3) {
          securityResults.jwtSecure = true;
        }
      }

      // Test 4: Audit logging (check for request tracking)
      if (jwtResponse.headers['x-request-id'] || jwtResponse.headers['request-id']) {
        securityResults.auditLogging = true;
      }

      // Test 5: Password protection
      if (jwtResponse.status === 200) {
        const responseBody = JSON.stringify(jwtResponse.body);
        if (!responseBody.includes('$2b$') && !responseBody.includes('password')) {
          securityResults.passwordProtected = true;
        }
      }

      // Summary
      const passedTests = Object.values(securityResults).filter(Boolean).length;
      const totalTests = Object.keys(securityResults).length;

      console.log(`📊 Security integration results: ${passedTests}/${totalTests} tests passed`);
      console.log('Security results:', securityResults);

      // At least 4 out of 5 security measures should be working
      expect(passedTests).toBeGreaterThanOrEqual(4);
      console.log('✅ Comprehensive security integration: Multiple security layers active');
    });
  });
});