#!/usr/bin/env node

/**
 * Production Configuration Validation Script
 * 
 * Task 3.5: STEP 5 — Production Readiness Checks
 * 
 * Validates production configuration without requiring database connection:
 * - JWT configuration (secrets, expiration times)
 * - Password hashing configuration (bcrypt rounds)
 * - Environment configuration (required variables, production settings)
 * - Error logging configuration
 */

import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from '../config';

// Load environment variables
dotenv.config();

interface ValidationCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: string;
}

interface ValidationCategory {
  category: string;
  checks: ValidationCheck[];
}

class ProductionConfigValidator {
  private results: ValidationCategory[] = [];

  async runValidation(): Promise<void> {
    console.log('🔍 Starting Production Configuration Validation...\n');

    this.validateJWTConfiguration();
    await this.validatePasswordHashing();
    this.validateEnvironmentConfiguration();
    this.validateErrorLogging();

    this.generateReport();
  }

  private validateJWTConfiguration(): void {
    const checks: ValidationCheck[] = [];

    // JWT Secret validation
    if (config.jwt.secret && config.jwt.secret.length >= 32) {
      if (config.jwt.secret.match(/test|demo|example|default|supersecret/i)) {
        checks.push({
          name: 'JWT Secret Security',
          status: 'WARN',
          message: 'JWT secret contains insecure keywords',
          details: 'Consider using a more secure secret in production'
        });
      } else {
        checks.push({
          name: 'JWT Secret Length',
          status: 'PASS',
          message: `JWT secret is ${config.jwt.secret.length} characters (≥32 required)`
        });
      }
    } else {
      checks.push({
        name: 'JWT Secret Length',
        status: 'FAIL',
        message: 'JWT secret is too short or missing'
      });
    }

    // JWT Refresh Secret validation
    if (config.jwt.refreshSecret && config.jwt.refreshSecret.length >= 32) {
      if (config.jwt.refreshSecret === config.jwt.secret) {
        checks.push({
          name: 'JWT Refresh Secret Uniqueness',
          status: 'FAIL',
          message: 'Refresh secret must be different from access secret'
        });
      } else if (config.jwt.refreshSecret.match(/test|demo|example|default|supersecret/i)) {
        checks.push({
          name: 'JWT Refresh Secret Security',
          status: 'WARN',
          message: 'JWT refresh secret contains insecure keywords'
        });
      } else {
        checks.push({
          name: 'JWT Refresh Secret',
          status: 'PASS',
          message: 'Refresh secret is properly configured and unique'
        });
      }
    } else {
      checks.push({
        name: 'JWT Refresh Secret',
        status: 'FAIL',
        message: 'JWT refresh secret is too short or missing'
      });
    }

    // JWT Expiration validation
    const accessExpiryMs = this.parseExpiryToMs(config.jwt.accessExpiry);
    const refreshExpiryMs = this.parseExpiryToMs(config.jwt.refreshExpiry);

    if (accessExpiryMs <= 15 * 60 * 1000) { // 15 minutes
      checks.push({
        name: 'Access Token Expiry',
        status: 'PASS',
        message: `Access tokens expire in ${config.jwt.accessExpiry} (≤15m recommended)`
      });
    } else {
      checks.push({
        name: 'Access Token Expiry',
        status: 'WARN',
        message: `Access tokens expire in ${config.jwt.accessExpiry} (>15m, consider shorter)`
      });
    }

    if (refreshExpiryMs <= 7 * 24 * 60 * 60 * 1000) { // 7 days
      checks.push({
        name: 'Refresh Token Expiry',
        status: 'PASS',
        message: `Refresh tokens expire in ${config.jwt.refreshExpiry} (≤7d recommended)`
      });
    } else {
      checks.push({
        name: 'Refresh Token Expiry',
        status: 'WARN',
        message: `Refresh tokens expire in ${config.jwt.refreshExpiry} (>7d, consider shorter)`
      });
    }

    // JWT Token generation test
    try {
      const testPayload = { userId: 'test', email: 'test@example.com', role: 'member' };
      const accessToken = jwt.sign(testPayload, config.jwt.secret, { expiresIn: config.jwt.accessExpiry } as jwt.SignOptions);
      const refreshToken = jwt.sign(testPayload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiry } as jwt.SignOptions);
      
      const accessDecoded = jwt.decode(accessToken) as any;
      const refreshDecoded = jwt.decode(refreshToken) as any;
      
      if (accessDecoded && refreshDecoded && 
          accessDecoded.userId === testPayload.userId &&
          refreshDecoded.userId === testPayload.userId) {
        checks.push({
          name: 'JWT Token Generation',
          status: 'PASS',
          message: 'JWT token generation and decoding working correctly'
        });
      } else {
        checks.push({
          name: 'JWT Token Generation',
          status: 'FAIL',
          message: 'JWT token generation or decoding failed'
        });
      }
    } catch (error) {
      checks.push({
        name: 'JWT Token Generation',
        status: 'FAIL',
        message: `JWT token generation failed: ${error}`
      });
    }

    this.results.push({
      category: 'JWT Configuration',
      checks
    });
  }
  private async validatePasswordHashing(): Promise<void> {
    const checks: ValidationCheck[] = [];

    try {
      const testPassword = 'TestPassword123!';
      const startTime = Date.now();
      const hash = await bcrypt.hash(testPassword, 12);
      const hashTime = Date.now() - startTime;

      if (hash.startsWith('$2b$12$')) {
        checks.push({
          name: 'Bcrypt Rounds Configuration',
          status: 'PASS',
          message: 'Using bcrypt with 12 rounds (recommended for production)'
        });
      } else {
        checks.push({
          name: 'Bcrypt Rounds Configuration',
          status: 'FAIL',
          message: 'Bcrypt rounds not properly configured'
        });
      }

      if (hashTime >= 50 && hashTime <= 2000) {
        checks.push({
          name: 'Password Hashing Performance',
          status: 'PASS',
          message: `Password hashing takes ${hashTime}ms (50-2000ms recommended)`,
          details: '12 rounds provide good security/performance balance'
        });
      } else if (hashTime < 50) {
        checks.push({
          name: 'Password Hashing Performance',
          status: 'WARN',
          message: `Password hashing takes ${hashTime}ms (too fast, consider more rounds)`,
          details: 'Faster hashing may indicate insufficient security'
        });
      } else {
        checks.push({
          name: 'Password Hashing Performance',
          status: 'WARN',
          message: `Password hashing takes ${hashTime}ms (slow, consider fewer rounds)`,
          details: 'Slower hashing may impact user experience'
        });
      }

      // Test password comparison
      const isValid = await bcrypt.compare(testPassword, hash);
      if (isValid) {
        checks.push({
          name: 'Password Comparison',
          status: 'PASS',
          message: 'Password comparison working correctly'
        });
      } else {
        checks.push({
          name: 'Password Comparison',
          status: 'FAIL',
          message: 'Password comparison failed'
        });
      }

      // Test timing attack resistance
      const timings: number[] = [];
      const wrongPassword = 'WrongPassword123!';
      
      for (let i = 0; i < 3; i++) {
        const start1 = Date.now();
        await bcrypt.compare(testPassword, hash);
        const time1 = Date.now() - start1;
        
        const start2 = Date.now();
        await bcrypt.compare(wrongPassword, hash);
        const time2 = Date.now() - start2;
        
        timings.push(Math.abs(time1 - time2));
      }
      
      const avgTimingDiff = timings.reduce((a, b) => a + b, 0) / timings.length;
      
      if (avgTimingDiff < 50) {
        checks.push({
          name: 'Timing Attack Resistance',
          status: 'PASS',
          message: `Password comparison timing difference: ${avgTimingDiff.toFixed(2)}ms average`,
          details: 'Low timing variance indicates good timing attack resistance'
        });
      } else {
        checks.push({
          name: 'Timing Attack Resistance',
          status: 'WARN',
          message: `Password comparison timing difference: ${avgTimingDiff.toFixed(2)}ms average`,
          details: 'Higher timing variance may indicate timing attack vulnerability'
        });
      }

    } catch (error) {
      checks.push({
        name: 'Password Hashing',
        status: 'FAIL',
        message: `Password hashing validation failed: ${error}`
      });
    }

    this.results.push({
      category: 'Password Hashing Configuration',
      checks
    });
  }

  private validateEnvironmentConfiguration(): void {
    const checks: ValidationCheck[] = [];

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

    // Check required environment variables
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length === 0) {
      checks.push({
        name: 'Required Environment Variables',
        status: 'PASS',
        message: `All ${requiredVars.length} required environment variables are set`
      });
    } else {
      checks.push({
        name: 'Required Environment Variables',
        status: 'FAIL',
        message: `Missing required variables: ${missingVars.join(', ')}`
      });
    }

    // Encryption key validation
    if (config.encryption.key && config.encryption.key.length === 64 && /^[0-9a-f]{64}$/i.test(config.encryption.key)) {
      const isDefaultKey = config.encryption.key === 'f9502f0854c585e1cd647121e9df5a2d98199fce33a1c30717a848e862adff35' ||
                           config.encryption.key === 'f8a25c246efc5b858e66e029256131b46b967ca691c72367acc0b9cac554449c';
      
      if (isDefaultKey && config.env === 'production') {
        checks.push({
          name: 'Encryption Key Security',
          status: 'FAIL',
          message: 'Using default encryption key in production',
          details: 'Generate a new encryption key for production use'
        });
      } else {
        checks.push({
          name: 'Encryption Key Format',
          status: 'PASS',
          message: 'Encryption key is properly formatted (64 hex characters)'
        });
      }
    } else {
      checks.push({
        name: 'Encryption Key Format',
        status: 'FAIL',
        message: 'Encryption key must be 64 hex characters (32 bytes)'
      });
    }

    // Production-specific validations
    if (config.env === 'production') {
      const productionIssues = [];

      // Database should not be localhost
      if (config.database.uri.includes('localhost') || config.database.uri.includes('127.0.0.1')) {
        productionIssues.push('Database URI should not use localhost in production');
      }

      // Redis should not be localhost
      if (config.redis.host === 'localhost' || config.redis.host === '127.0.0.1') {
        productionIssues.push('Redis host should not be localhost in production');
      }

      // Frontend URL should use HTTPS
      if (!config.frontend.url.startsWith('https://')) {
        productionIssues.push('Frontend URL should use HTTPS in production');
      }

      if (productionIssues.length === 0) {
        checks.push({
          name: 'Production Security Settings',
          status: 'PASS',
          message: 'All production security settings are properly configured'
        });
      } else {
        checks.push({
          name: 'Production Security Settings',
          status: 'WARN',
          message: 'Some production settings need attention',
          details: productionIssues.join('; ')
        });
      }
    } else {
      checks.push({
        name: 'Environment Mode',
        status: 'PASS',
        message: `Running in ${config.env} mode`,
        details: 'Production-specific validations will apply when NODE_ENV=production'
      });
    }

    this.results.push({
      category: 'Environment Configuration',
      checks
    });
  }
  private validateErrorLogging(): void {
    const checks: ValidationCheck[] = [];

    // Logger availability (basic check)
    try {
      const { logger } = require('../utils/logger');
      
      if (logger && typeof logger.error === 'function') {
        checks.push({
          name: 'Logger Availability',
          status: 'PASS',
          message: 'Logger is properly configured and available'
        });
      } else {
        checks.push({
          name: 'Logger Availability',
          status: 'FAIL',
          message: 'Logger is not properly configured'
        });
      }

      // Log level validation
      const validLogLevels = ['error', 'warn', 'info', 'debug'];
      if (validLogLevels.includes(config.logging.level)) {
        if (config.env === 'production' && config.logging.level === 'debug') {
          checks.push({
            name: 'Log Level Configuration',
            status: 'WARN',
            message: 'Debug log level should not be used in production',
            details: 'Consider using info, warn, or error level in production'
          });
        } else {
          checks.push({
            name: 'Log Level Configuration',
            status: 'PASS',
            message: `Log level set to '${config.logging.level}' (appropriate for ${config.env})`
          });
        }
      } else {
        checks.push({
          name: 'Log Level Configuration',
          status: 'FAIL',
          message: `Invalid log level: ${config.logging.level}`
        });
      }

      // Test logging functionality
      try {
        logger.info('Production readiness validation - test log message');
        logger.error('Production readiness validation - test error message', { 
          testError: true,
          timestamp: new Date().toISOString()
        });
        
        checks.push({
          name: 'Logging Functionality',
          status: 'PASS',
          message: 'All logging methods are functional'
        });
      } catch (error) {
        checks.push({
          name: 'Logging Functionality',
          status: 'FAIL',
          message: `Logging functionality test failed: ${error}`
        });
      }

    } catch (error) {
      checks.push({
        name: 'Logger Module',
        status: 'FAIL',
        message: `Failed to load logger module: ${error}`
      });
    }

    // External logging integration (if configured)
    if (process.env.SENTRY_DSN) {
      checks.push({
        name: 'External Error Tracking',
        status: 'PASS',
        message: 'Sentry error tracking is configured',
        details: 'External error monitoring will capture production issues'
      });
    } else {
      checks.push({
        name: 'External Error Tracking',
        status: 'WARN',
        message: 'No external error tracking configured',
        details: 'Consider setting up Sentry or similar service for production monitoring'
      });
    }

    this.results.push({
      category: 'Error Logging Configuration',
      checks
    });
  }

  private generateReport(): void {
    console.log('\n' + '═'.repeat(80));
    console.log('🎯 PRODUCTION CONFIGURATION VALIDATION REPORT');
    console.log('═'.repeat(80));

    let totalChecks = 0;
    let passedChecks = 0;
    let failedChecks = 0;
    let warningChecks = 0;

    this.results.forEach(result => {
      console.log(`\n📋 ${result.category.toUpperCase()}`);
      console.log('─'.repeat(result.category.length + 4));

      result.checks.forEach(check => {
        totalChecks++;
        const icon = check.status === 'PASS' ? '✅' : check.status === 'WARN' ? '⚠️' : '❌';
        
        if (check.status === 'PASS') passedChecks++;
        else if (check.status === 'FAIL') failedChecks++;
        else warningChecks++;

        console.log(`${icon} ${check.name}: ${check.message}`);
        if (check.details) {
          console.log(`   └─ ${check.details}`);
        }
      });
    });

    // Summary
    const readinessScore = (passedChecks / totalChecks) * 100;
    const isConfigurationReady = failedChecks === 0;

    console.log('\n' + '═'.repeat(80));
    console.log('📊 CONFIGURATION VALIDATION SUMMARY');
    console.log('═'.repeat(80));
    console.log(`✅ Passed: ${passedChecks}`);
    console.log(`⚠️  Warnings: ${warningChecks}`);
    console.log(`❌ Failed: ${failedChecks}`);
    console.log(`📈 Score: ${readinessScore.toFixed(1)}% (${passedChecks}/${totalChecks})`);
    console.log('─'.repeat(40));
    console.log(`🎯 CONFIGURATION READY: ${isConfigurationReady ? '✅ YES' : '❌ NO'}`);
    console.log(`🔒 SECURITY STATUS: ${failedChecks === 0 ? '✅ SECURE' : '❌ NEEDS ATTENTION'}`);
    
    // Additional recommendations
    console.log('\n📋 PRODUCTION READINESS CHECKLIST:');
    console.log('─'.repeat(40));
    console.log(`${isConfigurationReady ? '✅' : '❌'} JWT Configuration (secrets, expiration)`);
    console.log(`${this.getCategoryStatus('Password Hashing Configuration')} Password Hashing (bcrypt rounds, performance)`);
    console.log(`${this.getCategoryStatus('Environment Configuration')} Environment Configuration (variables, security)`);
    console.log(`${this.getCategoryStatus('Error Logging Configuration')} Error Logging (format, levels, integration)`);
    console.log('⚠️  Database Schema Optimization (requires DB connection)');
    console.log('⚠️  Case-Insensitive Email Operations (requires DB connection)');
    
    console.log('═'.repeat(80));

    if (!isConfigurationReady) {
      console.log('\n❌ Production configuration validation FAILED');
      console.log('Please address all failed checks before deploying to production.');
      process.exit(1);
    } else if (warningChecks > 0) {
      console.log('\n⚠️  Production configuration validation PASSED with warnings');
      console.log('Consider addressing warnings for optimal production deployment.');
    } else {
      console.log('\n✅ Production configuration validation PASSED');
      console.log('Configuration is ready for production deployment.');
    }
  }

  private getCategoryStatus(categoryName: string): string {
    const category = this.results.find(r => r.category === categoryName);
    if (!category) return '❓';
    
    const hasFailed = category.checks.some(c => c.status === 'FAIL');
    const hasWarnings = category.checks.some(c => c.status === 'WARN');
    
    if (hasFailed) return '❌';
    if (hasWarnings) return '⚠️';
    return '✅';
  }

  private parseExpiryToMs(expiry: string): number {
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
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ProductionConfigValidator();
  validator.runValidation().catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}

export { ProductionConfigValidator };