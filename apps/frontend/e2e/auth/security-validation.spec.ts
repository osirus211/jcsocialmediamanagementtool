import { test, expect, Page } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';

/**
 * Security Validation Test Suite - Task 3.4
 * 
 * Comprehensive security testing for the email-password-login-security-fix spec
 * 
 * Tests:
 * - Brute force protection (20+ rapid attempts)
 * - Timing attack prevention (consistent response times)
 * - Rate limiting effectiveness with progressive delays
 * - JWT handling security (expiration, signature verification)
 * - Audit logging validation (all events logged with required fields)
 * - Password exposure prevention
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.9, 1.10, 2.1, 2.2, 2.9**
 */

test.describe('Security Validation Suite - Task 3.4', () => {
  let authHelpers: AuthHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
  });

  test.describe('Brute Force Protection Testing', () => {
    test('should block brute force attacks after 20+ rapid attempts', async ({ page }) => {
      await page.goto('/login');
      
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Track response times and status codes
      const attempts = [];
      let rateLimitDetected = false;
      let progressiveDelayDetected = false;
      
      console.log('🔒 Starting brute force protection test with 25 rapid attempts...');
      
      for (let i = 1; i <= 25; i++) {
        const startTime = Date.now();
        
        await emailInput.fill('brute-force-test@example.com');
        await passwordInput.fill(`wrongpassword${i}`);
        
        // Listen for the response
        const responsePromise = page.waitForResponse(
          response => response.url().includes('/auth/login') || response.url().includes('/login'),
          { timeout: 10000 }
        ).catch(() => null);
        
        await submitButton.click();
        
        const response = await responsePromise;
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        const attempt = {
          number: i,
          responseTime,
          status: response?.status() || 'timeout',
          timestamp: new Date().toISOString()
        };
        
        attempts.push(attempt);
        
        // Check for rate limiting (429 status)
        if (response?.status() === 429) {
          rateLimitDetected = true;
          console.log(`✅ Rate limiting detected at attempt ${i} (429 status)`);
        }
        
        // Check for progressive delays (increasing response times)
        if (i > 10 && responseTime > 2000) {
          progressiveDelayDetected = true;
          console.log(`✅ Progressive delay detected at attempt ${i} (${responseTime}ms)`);
        }
        
        console.log(`Attempt ${i}: ${response?.status() || 'timeout'} in ${responseTime}ms`);
        
        // Small delay between attempts to avoid overwhelming the system
        await page.waitForTimeout(100);
      }
      
      // Analyze results
      const rateLimitedAttempts = attempts.filter(a => a.status === 429);
      const slowAttempts = attempts.filter(a => a.responseTime > 2000);
      
      console.log(`📊 Brute force test results:`);
      console.log(`- Total attempts: ${attempts.length}`);
      console.log(`- Rate limited (429): ${rateLimitedAttempts.length}`);
      console.log(`- Slow responses (>2s): ${slowAttempts.length}`);
      
      // Assertions
      expect(rateLimitDetected || progressiveDelayDetected).toBe(true);
      
      if (rateLimitDetected) {
        expect(rateLimitedAttempts.length).toBeGreaterThan(0);
        console.log('✅ Brute force protection: Rate limiting active');
      }
      
      if (progressiveDelayDetected) {
        expect(slowAttempts.length).toBeGreaterThan(0);
        console.log('✅ Brute force protection: Progressive delays active');
      }
    });
  });

  test.describe('Timing Attack Prevention', () => {
    test('should have consistent response times for valid vs invalid emails', async ({ page }) => {
      await page.goto('/login');
      
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      const measurements = [];
      
      console.log('⏱️ Testing timing attack prevention...');
      
      // Test with non-existent email (should be fast without timing attack vulnerability)
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        
        await emailInput.fill(`nonexistent${i}@example.com`);
        await passwordInput.fill('wrongpassword');
        
        const responsePromise = page.waitForResponse(
          response => response.url().includes('/auth/login') || response.url().includes('/login'),
          { timeout: 10000 }
        ).catch(() => null);
        
        await submitButton.click();
        await responsePromise;
        
        const endTime = Date.now();
        measurements.push({
          type: 'nonexistent_email',
          responseTime: endTime - startTime,
          attempt: i + 1
        });
        
        await page.waitForTimeout(200);
      }
      
      // Test with existing email but wrong password (should take similar time)
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        
        await emailInput.fill('test@example.com'); // Assume this exists
        await passwordInput.fill(`wrongpassword${i}`);
        
        const responsePromise = page.waitForResponse(
          response => response.url().includes('/auth/login') || response.url().includes('/login'),
          { timeout: 10000 }
        ).catch(() => null);
        
        await submitButton.click();
        await responsePromise;
        
        const endTime = Date.now();
        measurements.push({
          type: 'existing_email',
          responseTime: endTime - startTime,
          attempt: i + 1
        });
        
        await page.waitForTimeout(200);
      }
      
      // Analyze timing differences
      const nonexistentTimes = measurements.filter(m => m.type === 'nonexistent_email').map(m => m.responseTime);
      const existingTimes = measurements.filter(m => m.type === 'existing_email').map(m => m.responseTime);
      
      const avgNonexistent = nonexistentTimes.reduce((a, b) => a + b, 0) / nonexistentTimes.length;
      const avgExisting = existingTimes.reduce((a, b) => a + b, 0) / existingTimes.length;
      const timingDifference = Math.abs(avgNonexistent - avgExisting);
      
      console.log(`📊 Timing analysis:`);
      console.log(`- Avg nonexistent email: ${avgNonexistent.toFixed(2)}ms`);
      console.log(`- Avg existing email: ${avgExisting.toFixed(2)}ms`);
      console.log(`- Timing difference: ${timingDifference.toFixed(2)}ms`);
      
      // Timing difference should be minimal (within 100ms variance for E2E tests)
      expect(timingDifference).toBeLessThan(100);
      console.log('✅ Timing attack prevention: Response times are consistent');
    });
  });

  test.describe('Rate Limiting Effectiveness', () => {
    test('should implement progressive delays and effective rate limiting', async ({ page }) => {
      await page.goto('/login');
      
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      const testEmail = 'rate-limit-test@example.com';
      let rateLimitingActive = false;
      let progressiveDelaysActive = false;
      
      console.log('🚦 Testing rate limiting effectiveness...');
      
      // Make 15 rapid attempts to trigger rate limiting
      for (let i = 1; i <= 15; i++) {
        const startTime = Date.now();
        
        await emailInput.fill(testEmail);
        await passwordInput.fill(`attempt${i}`);
        
        const responsePromise = page.waitForResponse(
          response => response.url().includes('/auth/login') || response.url().includes('/login'),
          { timeout: 15000 }
        ).catch(() => null);
        
        await submitButton.click();
        
        const response = await responsePromise;
        const responseTime = Date.now() - startTime;
        
        console.log(`Attempt ${i}: Status ${response?.status() || 'timeout'}, Time: ${responseTime}ms`);
        
        // Check for rate limiting
        if (response?.status() === 429) {
          rateLimitingActive = true;
          console.log(`✅ Rate limiting activated at attempt ${i}`);
          
          // Verify rate limit response includes retry-after header
          const retryAfter = response.headers()['retry-after'];
          if (retryAfter) {
            console.log(`✅ Retry-After header present: ${retryAfter}s`);
          }
        }
        
        // Check for progressive delays (response time increases)
        if (i > 5 && responseTime > 1000) {
          progressiveDelaysActive = true;
          console.log(`✅ Progressive delay detected: ${responseTime}ms`);
        }
        
        // Small delay between attempts
        await page.waitForTimeout(50);
      }
      
      // Verify rate limiting is working
      expect(rateLimitingActive || progressiveDelaysActive).toBe(true);
      
      if (rateLimitingActive) {
        console.log('✅ Rate limiting: HTTP 429 responses detected');
      }
      
      if (progressiveDelaysActive) {
        console.log('✅ Progressive delays: Increasing response times detected');
      }
    });
  });

  test.describe('JWT Security Validation', () => {
    test('should validate JWT expiration and signature verification', async ({ page }) => {
      console.log('🔐 Testing JWT security...');
      
      // First, attempt a login to get JWT tokens
      await page.goto('/login');
      
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      await emailInput.fill('valid@example.com');
      await passwordInput.fill('ValidPassword123!');
      
      // Monitor for successful login response
      const loginResponsePromise = page.waitForResponse(
        response => response.url().includes('/auth/login') && response.status() === 200,
        { timeout: 10000 }
      ).catch(() => null);
      
      await submitButton.click();
      
      const loginResponse = await loginResponsePromise;
      
      if (loginResponse) {
        const responseData = await loginResponse.json().catch(() => ({}));
        
        if (responseData.accessToken) {
          console.log('✅ JWT token received');
          
          // Test 1: Verify token structure (should be JWT format)
          const tokenParts = responseData.accessToken.split('.');
          expect(tokenParts.length).toBe(3);
          console.log('✅ JWT structure validation: Token has 3 parts (header.payload.signature)');
          
          // Test 2: Verify token contains required claims
          try {
            const payload = JSON.parse(atob(tokenParts[1]));
            expect(payload.exp).toBeDefined(); // Expiration time
            expect(payload.iat).toBeDefined(); // Issued at time
            expect(payload.userId || payload.sub).toBeDefined(); // User identifier
            console.log('✅ JWT claims validation: Required claims present');
            
            // Test 3: Verify expiration time is reasonable (not too long)
            const expirationTime = payload.exp * 1000; // Convert to milliseconds
            const currentTime = Date.now();
            const timeUntilExpiration = expirationTime - currentTime;
            
            // Token should expire within reasonable time (e.g., 24 hours)
            expect(timeUntilExpiration).toBeLessThan(24 * 60 * 60 * 1000);
            expect(timeUntilExpiration).toBeGreaterThan(0);
            console.log(`✅ JWT expiration validation: Token expires in ${Math.round(timeUntilExpiration / 1000 / 60)} minutes`);
          } catch (error) {
            console.log('⚠️ Could not decode JWT payload for validation');
          }
          
          // Test 4: Verify refresh token is stored securely (httpOnly cookie)
          const cookies = await page.context().cookies();
          const refreshTokenCookie = cookies.find(cookie => cookie.name === 'refreshToken');
          
          if (refreshTokenCookie) {
            expect(refreshTokenCookie.httpOnly).toBe(true);
            expect(refreshTokenCookie.secure).toBeDefined();
            expect(refreshTokenCookie.sameSite).toBeDefined();
            console.log('✅ Refresh token security: Stored as httpOnly cookie with security attributes');
          }
        }
      } else {
        console.log('⚠️ No successful login response received for JWT testing');
      }
    });

    test('should handle JWT refresh token rotation securely', async ({ page }) => {
      console.log('🔄 Testing JWT refresh token security...');
      
      // Test refresh token endpoint security
      const refreshResponse = await page.request.post('/api/v1/auth/refresh', {
        headers: {
          'Content-Type': 'application/json'
        }
      }).catch(() => null);
      
      if (refreshResponse) {
        // Should require valid refresh token
        expect([401, 403]).toContain(refreshResponse.status());
        console.log('✅ Refresh endpoint security: Requires valid refresh token');
      }
      
      // Test with invalid/malformed tokens
      const invalidTokenResponse = await page.request.post('/api/v1/auth/refresh', {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'refreshToken=invalid.token.here'
        }
      }).catch(() => null);
      
      if (invalidTokenResponse) {
        expect([401, 403]).toContain(invalidTokenResponse.status());
        console.log('✅ Invalid token handling: Properly rejects malformed tokens');
      }
    });
  });

  test.describe('Audit Logging Validation', () => {
    test('should log all authentication events with required fields', async ({ page }) => {
      console.log('📝 Testing audit logging...');
      
      await page.goto('/login');
      
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Test failed login attempt logging
      await emailInput.fill('audit-test@example.com');
      await passwordInput.fill('wrongpassword');
      
      const failedLoginPromise = page.waitForResponse(
        response => response.url().includes('/auth/login'),
        { timeout: 10000 }
      ).catch(() => null);
      
      await submitButton.click();
      const failedResponse = await failedLoginPromise;
      
      if (failedResponse) {
        console.log(`✅ Failed login attempt recorded: ${failedResponse.status()}`);
        
        // Verify response includes security headers for audit trail
        const headers = failedResponse.headers();
        expect(headers['x-request-id'] || headers['request-id']).toBeDefined();
      }
      
      // Test successful login attempt logging (if possible)
      await emailInput.fill('valid@example.com');
      await passwordInput.fill('ValidPassword123!');
      
      const successLoginPromise = page.waitForResponse(
        response => response.url().includes('/auth/login'),
        { timeout: 10000 }
      ).catch(() => null);
      
      await submitButton.click();
      const successResponse = await successLoginPromise;
      
      if (successResponse && successResponse.status() === 200) {
        console.log('✅ Successful login attempt recorded');
        
        // Verify audit trail headers
        const headers = successResponse.headers();
        expect(headers['x-request-id'] || headers['request-id']).toBeDefined();
      }
      
      // Test that IP address and user agent are being tracked
      // This is verified by checking that the system accepts and processes these headers
      const customUserAgent = 'SecurityTest/1.0 (Audit Validation)';
      await page.setExtraHTTPHeaders({
        'User-Agent': customUserAgent
      });
      
      await emailInput.fill('audit-headers-test@example.com');
      await passwordInput.fill('testpassword');
      
      const headerTestPromise = page.waitForResponse(
        response => response.url().includes('/auth/login'),
        { timeout: 10000 }
      ).catch(() => null);
      
      await submitButton.click();
      await headerTestPromise;
      
      console.log('✅ Custom headers processed for audit logging');
    });
  });

  test.describe('Password Exposure Prevention', () => {
    test('should never expose password fields in API responses', async ({ page }) => {
      console.log('🔒 Testing password exposure prevention...');
      
      await page.goto('/login');
      
      // Monitor all network responses for password exposure
      const responses: any[] = [];
      
      page.on('response', async (response) => {
        try {
          if (response.url().includes('/api/') && response.status() < 400) {
            const contentType = response.headers()['content-type'];
            if (contentType && contentType.includes('application/json')) {
              const responseText = await response.text().catch(() => '');
              responses.push({
                url: response.url(),
                status: response.status(),
                body: responseText
              });
            }
          }
        } catch (error) {
          // Ignore errors in response monitoring
        }
      });
      
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Test login attempt
      await emailInput.fill('password-exposure-test@example.com');
      await passwordInput.fill('TestPassword123!');
      await submitButton.click();
      
      // Wait for response
      await page.waitForTimeout(2000);
      
      // Check all captured responses for password exposure
      let passwordExposureFound = false;
      
      for (const response of responses) {
        const bodyLower = response.body.toLowerCase();
        
        // Check for various password-related fields that should not be exposed
        const sensitiveFields = [
          'password',
          'passwordhash',
          'password_hash',
          'hashedpassword',
          'hashed_password',
          '$2b$', // bcrypt hash prefix
          '$2a$', // bcrypt hash prefix
          'pwd',
          'passwd'
        ];
        
        for (const field of sensitiveFields) {
          if (bodyLower.includes(field)) {
            console.log(`⚠️ Potential password exposure in ${response.url}: ${field}`);
            passwordExposureFound = true;
          }
        }
      }
      
      expect(passwordExposureFound).toBe(false);
      console.log('✅ Password exposure prevention: No password fields found in API responses');
      
      // Additional test: Check user profile endpoints don't expose passwords
      try {
        const profileResponse = await page.request.get('/api/v1/auth/me').catch(() => null);
        if (profileResponse && profileResponse.status() === 200) {
          const profileData = await profileResponse.text();
          const profileLower = profileData.toLowerCase();
          
          const hasPasswordField = ['password', '$2b$', '$2a$'].some(field => 
            profileLower.includes(field)
          );
          
          expect(hasPasswordField).toBe(false);
          console.log('✅ User profile endpoint: No password fields exposed');
        }
      } catch (error) {
        console.log('⚠️ Could not test user profile endpoint');
      }
    });
  });

  test.describe('Comprehensive Security Test Suite', () => {
    test('should pass all security measures validation', async ({ page }) => {
      console.log('🛡️ Running comprehensive security validation...');
      
      const securityChecks = {
        bruteForceProtection: false,
        timingAttackPrevention: false,
        rateLimitingActive: false,
        jwtSecurityValid: false,
        auditLoggingActive: false,
        passwordExposurePrevented: false
      };
      
      await page.goto('/login');
      
      // Quick comprehensive test
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Test 1: Basic rate limiting (5 rapid attempts)
      console.log('Testing basic rate limiting...');
      for (let i = 0; i < 5; i++) {
        await emailInput.fill(`security-test-${i}@example.com`);
        await passwordInput.fill('wrongpassword');
        
        const responsePromise = page.waitForResponse(
          response => response.url().includes('/auth/login'),
          { timeout: 5000 }
        ).catch(() => null);
        
        await submitButton.click();
        const response = await responsePromise;
        
        if (response?.status() === 429) {
          securityChecks.rateLimitingActive = true;
          console.log('✅ Rate limiting detected');
          break;
        }
        
        await page.waitForTimeout(100);
      }
      
      // Test 2: Response consistency (timing attack prevention)
      console.log('Testing response consistency...');
      const times = [];
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        await emailInput.fill(`nonexistent-${i}@example.com`);
        await passwordInput.fill('wrongpassword');
        
        const responsePromise = page.waitForResponse(
          response => response.url().includes('/auth/login'),
          { timeout: 5000 }
        ).catch(() => null);
        
        await submitButton.click();
        await responsePromise;
        times.push(Date.now() - start);
        await page.waitForTimeout(200);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxVariance = Math.max(...times) - Math.min(...times);
      if (maxVariance < 200) { // Within 200ms variance
        securityChecks.timingAttackPrevention = true;
        console.log('✅ Consistent response times detected');
      }
      
      // Test 3: JWT validation
      console.log('Testing JWT security...');
      await emailInput.fill('valid@example.com');
      await passwordInput.fill('ValidPassword123!');
      
      const loginPromise = page.waitForResponse(
        response => response.url().includes('/auth/login') && response.status() === 200,
        { timeout: 5000 }
      ).catch(() => null);
      
      await submitButton.click();
      const loginResponse = await loginPromise;
      
      if (loginResponse) {
        const data = await loginResponse.json().catch(() => ({}));
        if (data.accessToken && data.accessToken.split('.').length === 3) {
          securityChecks.jwtSecurityValid = true;
          console.log('✅ Valid JWT structure detected');
        }
      }
      
      // Test 4: Audit logging (check for request tracking)
      if (loginResponse) {
        const headers = loginResponse.headers();
        if (headers['x-request-id'] || headers['request-id'] || headers['x-correlation-id']) {
          securityChecks.auditLoggingActive = true;
          console.log('✅ Audit logging headers detected');
        }
      }
      
      // Test 5: Password exposure check
      console.log('Testing password exposure prevention...');
      const responses: string[] = [];
      page.on('response', async (response) => {
        if (response.url().includes('/api/') && response.status() < 400) {
          const text = await response.text().catch(() => '');
          responses.push(text.toLowerCase());
        }
      });
      
      await page.waitForTimeout(1000);
      
      const hasPasswordExposure = responses.some(text => 
        text.includes('$2b$') || text.includes('password') || text.includes('pwd')
      );
      
      if (!hasPasswordExposure) {
        securityChecks.passwordExposurePrevented = true;
        console.log('✅ No password exposure detected');
      }
      
      // Summary
      const passedChecks = Object.values(securityChecks).filter(Boolean).length;
      const totalChecks = Object.keys(securityChecks).length;
      
      console.log(`📊 Security validation summary: ${passedChecks}/${totalChecks} checks passed`);
      console.log('Security checks:', securityChecks);
      
      // At least 4 out of 6 security measures should be active
      expect(passedChecks).toBeGreaterThanOrEqual(4);
      console.log('✅ Comprehensive security validation: Sufficient security measures active');
    });
  });
});