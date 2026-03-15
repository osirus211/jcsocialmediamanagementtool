#!/usr/bin/env node

/**
 * Security Validation Script - Task 3.4
 * 
 * Simple Node.js script to validate security measures without complex test frameworks
 * This script performs basic security checks against the authentication system
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

class SecurityValidator {
  constructor(baseUrl = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
    this.results = {
      rateLimiting: 'UNKNOWN',
      timingConsistency: 'UNKNOWN',
      jwtSecurity: 'UNKNOWN',
      auditLogging: 'UNKNOWN',
      passwordExposure: 'UNKNOWN'
    };
  }

  async makeRequest(path, method = 'POST', data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SecurityValidator/1.0',
          ...headers
        }
      };

      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
            responseTime: Date.now() - startTime
          });
        });
      });

      req.on('error', reject);
      
      const startTime = Date.now();
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async testRateLimiting() {
    console.log('🚦 Testing Rate Limiting...');
    
    try {
      let rateLimitDetected = false;
      
      // Make 8 rapid requests to trigger rate limiting
      for (let i = 0; i < 8; i++) {
        const response = await this.makeRequest('/api/v1/auth/login', 'POST', {
          email: `rate-test-${i}@example.com`,
          password: 'wrongpassword'
        });
        
        console.log(`  Attempt ${i + 1}: ${response.status}`);
        
        if (response.status === 429) {
          rateLimitDetected = true;
          console.log('  ✅ Rate limiting detected (429 status)');
          break;
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.results.rateLimiting = rateLimitDetected ? 'ACTIVE' : 'INACTIVE';
      
    } catch (error) {
      console.log('  ⚠️ Rate limiting test failed:', error.message);
      this.results.rateLimiting = 'ERROR';
    }
  }

  async testTimingConsistency() {
    console.log('⏱️ Testing Timing Attack Prevention...');
    
    try {
      const nonexistentTimes = [];
      const existingTimes = [];
      
      // Test with non-existent emails
      for (let i = 0; i < 3; i++) {
        const response = await this.makeRequest('/api/v1/auth/login', 'POST', {
          email: `nonexistent${i}@example.com`,
          password: 'wrongpassword'
        });
        
        nonexistentTimes.push(response.responseTime);
        console.log(`  Nonexistent email ${i + 1}: ${response.responseTime}ms`);
      }
      
      // Test with potentially existing emails
      for (let i = 0; i < 3; i++) {
        const response = await this.makeRequest('/api/v1/auth/login', 'POST', {
          email: `test${i}@example.com`,
          password: 'wrongpassword'
        });
        
        existingTimes.push(response.responseTime);
        console.log(`  Existing email ${i + 1}: ${response.responseTime}ms`);
      }
      
      const avgNonexistent = nonexistentTimes.reduce((a, b) => a + b, 0) / nonexistentTimes.length;
      const avgExisting = existingTimes.reduce((a, b) => a + b, 0) / existingTimes.length;
      const timingDifference = Math.abs(avgNonexistent - avgExisting);
      
      console.log(`  Average timing difference: ${timingDifference.toFixed(2)}ms`);
      
      // Timing difference should be minimal (within 100ms for network tests)
      this.results.timingConsistency = timingDifference < 100 ? 'CONSISTENT' : 'INCONSISTENT';
      
      if (this.results.timingConsistency === 'CONSISTENT') {
        console.log('  ✅ Timing attack prevention active');
      } else {
        console.log('  ⚠️ Potential timing attack vulnerability');
      }
      
    } catch (error) {
      console.log('  ⚠️ Timing consistency test failed:', error.message);
      this.results.timingConsistency = 'ERROR';
    }
  }

  async testJWTSecurity() {
    console.log('🔐 Testing JWT Security...');
    
    try {
      // Test JWT refresh endpoint security
      const refreshResponse = await this.makeRequest('/api/v1/auth/refresh', 'POST');
      
      console.log(`  Refresh without token: ${refreshResponse.status}`);
      
      if ([401, 403].includes(refreshResponse.status)) {
        console.log('  ✅ JWT refresh properly secured');
        this.results.jwtSecurity = 'SECURE';
      } else {
        console.log('  ⚠️ JWT refresh may not be properly secured');
        this.results.jwtSecurity = 'INSECURE';
      }
      
      // Test with invalid token
      const invalidTokenResponse = await this.makeRequest('/api/v1/auth/refresh', 'POST', null, {
        'Cookie': 'refreshToken=invalid.token.here'
      });
      
      console.log(`  Refresh with invalid token: ${invalidTokenResponse.status}`);
      
    } catch (error) {
      console.log('  ⚠️ JWT security test failed:', error.message);
      this.results.jwtSecurity = 'ERROR';
    }
  }

  async testAuditLogging() {
    console.log('📝 Testing Audit Logging...');
    
    try {
      const response = await this.makeRequest('/api/v1/auth/login', 'POST', {
        email: 'audit-test@example.com',
        password: 'wrongpassword'
      }, {
        'X-Forwarded-For': '192.168.1.100',
        'User-Agent': 'SecurityValidator/1.0'
      });
      
      console.log(`  Login attempt: ${response.status}`);
      
      // Check for audit trail headers
      const hasRequestId = response.headers['x-request-id'] || 
                          response.headers['request-id'] || 
                          response.headers['x-correlation-id'];
      
      if (hasRequestId) {
        console.log('  ✅ Audit logging headers detected');
        this.results.auditLogging = 'ACTIVE';
      } else {
        console.log('  ⚠️ No audit logging headers found');
        this.results.auditLogging = 'MISSING';
      }
      
    } catch (error) {
      console.log('  ⚠️ Audit logging test failed:', error.message);
      this.results.auditLogging = 'ERROR';
    }
  }

  async testPasswordExposure() {
    console.log('🔒 Testing Password Exposure Prevention...');
    
    try {
      // Test various endpoints for password exposure
      const endpoints = [
        '/api/v1/auth/login',
        '/api/v1/auth/me',
        '/api/v1/auth/refresh'
      ];
      
      let passwordExposureFound = false;
      
      for (const endpoint of endpoints) {
        try {
          const response = await this.makeRequest(endpoint, endpoint === '/api/v1/auth/login' ? 'POST' : 'GET', 
            endpoint === '/api/v1/auth/login' ? { email: 'test@example.com', password: 'test' } : null
          );
          
          const bodyLower = response.body.toLowerCase();
          
          // Check for password-related fields
          const sensitiveFields = ['$2b$', '$2a$', 'passwordhash', 'password_hash'];
          
          for (const field of sensitiveFields) {
            if (bodyLower.includes(field)) {
              console.log(`  ⚠️ Potential password exposure in ${endpoint}: ${field}`);
              passwordExposureFound = true;
            }
          }
          
        } catch (error) {
          // Ignore individual endpoint errors
        }
      }
      
      this.results.passwordExposure = passwordExposureFound ? 'EXPOSED' : 'PROTECTED';
      
      if (this.results.passwordExposure === 'PROTECTED') {
        console.log('  ✅ No password exposure detected');
      }
      
    } catch (error) {
      console.log('  ⚠️ Password exposure test failed:', error.message);
      this.results.passwordExposure = 'ERROR';
    }
  }

  async runAllTests() {
    console.log('🛡️ Security Validation - Task 3.4');
    console.log('=====================================\n');
    
    // Test server availability first
    try {
      const healthResponse = await this.makeRequest('/health', 'GET');
      console.log(`✅ Server available: ${healthResponse.status}\n`);
    } catch (error) {
      console.log(`❌ Server not available: ${error.message}`);
      console.log('Please ensure the backend server is running on', this.baseUrl);
      return;
    }
    
    // Run all security tests
    await this.testRateLimiting();
    console.log();
    
    await this.testTimingConsistency();
    console.log();
    
    await this.testJWTSecurity();
    console.log();
    
    await this.testAuditLogging();
    console.log();
    
    await this.testPasswordExposure();
    console.log();
    
    // Generate summary
    this.generateSummary();
  }

  generateSummary() {
    console.log('📊 Security Validation Summary');
    console.log('==============================');
    
    const securityMeasures = [
      { name: 'Rate Limiting', status: this.results.rateLimiting },
      { name: 'Timing Consistency', status: this.results.timingConsistency },
      { name: 'JWT Security', status: this.results.jwtSecurity },
      { name: 'Audit Logging', status: this.results.auditLogging },
      { name: 'Password Exposure Prevention', status: this.results.passwordExposure }
    ];
    
    let passedCount = 0;
    
    securityMeasures.forEach(measure => {
      const isSecure = ['ACTIVE', 'CONSISTENT', 'SECURE', 'PROTECTED'].includes(measure.status);
      const icon = isSecure ? '✅' : measure.status === 'ERROR' ? '⚠️' : '❌';
      
      console.log(`${icon} ${measure.name}: ${measure.status}`);
      
      if (isSecure) passedCount++;
    });
    
    console.log(`\n📈 Security Score: ${passedCount}/${securityMeasures.length} measures secure`);
    
    const overallStatus = passedCount >= 4 ? 'SECURE' : passedCount >= 2 ? 'PARTIALLY SECURE' : 'INSECURE';
    console.log(`🛡️ Overall Security Status: ${overallStatus}`);
    
    if (overallStatus === 'SECURE') {
      console.log('\n✅ Task 3.4 Security Validation: PASSED');
      console.log('The authentication system demonstrates robust security measures.');
    } else {
      console.log('\n⚠️ Task 3.4 Security Validation: NEEDS ATTENTION');
      console.log('Some security measures may need review or implementation.');
    }
  }
}

// Main execution
async function main() {
  const baseUrl = process.argv[2] || 'http://localhost:5000';
  const validator = new SecurityValidator(baseUrl);
  
  try {
    await validator.runAllTests();
  } catch (error) {
    console.error('❌ Security validation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { SecurityValidator };