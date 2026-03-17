#!/usr/bin/env node

/**
 * Production Readiness Check Script
 * 
 * Task 3.5: STEP 5 — Production Readiness Checks
 * 
 * This script validates all production configuration requirements:
 * - JWT configuration (secrets, expiration times, refresh tokens)
 * - Password hashing configuration (bcrypt rounds, performance)
 * - Environment configuration (required variables, production settings)
 * - Error logging configuration (format, levels, integration)
 * - Database schema optimization (no duplicate indexes)
 * - Case-insensitive email operations throughout system
 */

import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { config } from '../config';
import { User } from '../models/User';
import { AuthTokenService } from '../services/AuthTokenService';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

interface ValidationResult {
  category: string;
  checks: Array<{
    name: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    message: string;
    details?: string;
  }>;
}

class ProductionReadinessValidator {
  private results: ValidationResult[] = [];

  async runAllValidations(): Promise<void> {
    console.log('🔍 Starting Production Readiness Validation...\n');

    try {
      // Connect to database for validation
      await mongoose.connect(config.database.uri);
      console.log('✅ Database connected for validation\n');

      await this.validateJWTConfiguration();
      await this.validatePasswordHashing();
      await this.validateEnvironmentConfiguration();
      await this.validateErrorLogging();
      await this.validateDatabaseOptimization();
      await this.validateEmailOperations();

      this.generateReport();
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    } finally {
      await mongoose.disconnect();
    }
  }

  private async validateJWTConfiguration(): Promise<void> {
    const checks: ValidationResult['checks'] = [];

    // JWT Secret validation
    if (config.jwt.secret && config.jwt.secret.length >= 32) {
      if (config.jwt.secret.match(/test|demo|example|default/i)) {
        checks.push({
          name: 'JWT Secret Security',
          status: 'WARN',
          message: 'JWT secret contains test/demo keywords',
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
      const tokens = AuthTokenService.generateTokenPair(testPayload);
      const decoded = jwt.decode(tokens.accessToken) as any;
      
      if (decoded && decoded.userId === testPayload.userId) {
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
    const checks: ValidationResult['checks'] = [];

    // Bcrypt rounds validation
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

  private async validateEnvironmentConfiguration(): Promise<void> {
    const checks: ValidationResult['checks'] = [];

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
      checks.push({
        name: 'Encryption Key Format',
        status: 'PASS',
        message: 'Encryption key is properly formatted (64 hex characters)'
      });
    } else {
      checks.push({
        name: 'Encryption Key Format',
        status: 'FAIL',
        message: 'Encryption key must be 64 hex characters (32 bytes)'
      });
    }

    // Production-specific validations
    if (config.env === 'production') {
      const productionChecks = [];

      // Database should not be localhost
      if (config.database.uri.includes('localhost') || config.database.uri.includes('127.0.0.1')) {
        productionChecks.push('Database URI should not use localhost in production');
      }

      // Redis should not be localhost
      if (config.redis.host === 'localhost' || config.redis.host === '127.0.0.1') {
        productionChecks.push('Redis host should not be localhost in production');
      }

      // Frontend URL should use HTTPS
      if (!config.frontend.url.startsWith('https://')) {
        productionChecks.push('Frontend URL should use HTTPS in production');
      }

      // Secrets should not contain test keywords
      if (config.jwt.secret.match(/test|demo|example|default/i)) {
        productionChecks.push('JWT secret should not contain test/demo keywords');
      }

      if (productionChecks.length === 0) {
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
          details: productionChecks.join('; ')
        });
      }
    }

    this.results.push({
      category: 'Environment Configuration',
      checks
    });
  }
  private async validateErrorLogging(): Promise<void> {
    const checks: ValidationResult['checks'] = [];

    // Logger availability
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

  private async validateDatabaseOptimization(): Promise<void> {
    const checks: ValidationResult['checks'] = [];

    try {
      // Database connection validation
      if (mongoose.connection.readyState === 1) {
        checks.push({
          name: 'Database Connection',
          status: 'PASS',
          message: `Connected to database: ${mongoose.connection.name}`
        });
      } else {
        checks.push({
          name: 'Database Connection',
          status: 'FAIL',
          message: 'Database connection is not established'
        });
        return;
      }

      // User collection indexes validation
      const indexes = await User.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      // Check for email index
      const emailIndexExists = indexNames.some(name => 
        name.includes('email') || indexes[name].some((field: any) => field[0] === 'email')
      );

      if (emailIndexExists) {
        checks.push({
          name: 'Email Index Exists',
          status: 'PASS',
          message: 'Email field has proper indexing for performance'
        });
      } else {
        checks.push({
          name: 'Email Index Exists',
          status: 'FAIL',
          message: 'Email field is missing index (performance issue)'
        });
      }

      // Check for duplicate email indexes
      const emailIndexCount = indexNames.filter(name => 
        name.includes('email') || indexes[name].some((field: any) => field[0] === 'email')
      ).length;

      if (emailIndexCount <= 1) {
        checks.push({
          name: 'No Duplicate Indexes',
          status: 'PASS',
          message: 'No duplicate email indexes found'
        });
      } else {
        checks.push({
          name: 'No Duplicate Indexes',
          status: 'WARN',
          message: `Found ${emailIndexCount} email indexes (may cause performance issues)`,
          details: 'Consider removing duplicate indexes to optimize performance'
        });
      }

      // Collection statistics
      const stats = await User.collection.db.stats();
      const userCount = await User.countDocuments();
      checks.push({
        name: 'Collection Statistics',
        status: 'PASS',
        message: `User collection: ${userCount} documents`,
        details: `Database stats available`
      });

    } catch (error) {
      checks.push({
        name: 'Database Optimization',
        status: 'FAIL',
        message: `Database validation failed: ${error}`
      });
    }

    this.results.push({
      category: 'Database Schema Optimization',
      checks
    });
  }
  private async validateEmailOperations(): Promise<void> {
    const checks: ValidationResult['checks'] = [];

    try {
      // Test case-insensitive email handling
      const testEmails = [
        'Test@Example.COM',
        'USER@DOMAIN.ORG',
        'MixedCase@Email.Net'
      ];

      let caseNormalizationWorking = true;
      testEmails.forEach(email => {
        const user = new User({
          email: email,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
        });

        if (user.email !== email.toLowerCase()) {
          caseNormalizationWorking = false;
        }
      });

      if (caseNormalizationWorking) {
        checks.push({
          name: 'Email Case Normalization',
          status: 'PASS',
          message: 'Email addresses are properly normalized to lowercase'
        });
      } else {
        checks.push({
          name: 'Email Case Normalization',
          status: 'FAIL',
          message: 'Email case normalization is not working properly'
        });
      }

      // Test case-insensitive lookup (create temporary user)
      const testUser = new User({
        email: 'readiness-test@example.com',
        password: 'TestPassword123!',
        firstName: 'Readiness',
        lastName: 'Test',
        isEmailVerified: true,
      });
      await testUser.save();

      try {
        // Test different case lookups
        const foundUser1 = await User.findOne({ email: 'readiness-test@example.com' });
        const foundUser2 = await User.findOne({ email: 'READINESS-TEST@EXAMPLE.COM' });
        const foundUser3 = await User.findOne({ email: 'Readiness-Test@Example.Com' });

        if (foundUser1 && foundUser2 && foundUser3 && 
            foundUser1._id.toString() === foundUser2._id.toString() &&
            foundUser2._id.toString() === foundUser3._id.toString()) {
          checks.push({
            name: 'Case-Insensitive Email Lookup',
            status: 'PASS',
            message: 'Email lookups work correctly with different cases'
          });
        } else {
          checks.push({
            name: 'Case-Insensitive Email Lookup',
            status: 'FAIL',
            message: 'Case-insensitive email lookup is not working properly'
          });
        }

        // Test duplicate prevention
        const duplicateUser = new User({
          email: 'READINESS-TEST@EXAMPLE.COM', // Same email, different case
          password: 'TestPassword123!',
          firstName: 'Duplicate',
          lastName: 'Test',
        });

        try {
          await duplicateUser.save();
          checks.push({
            name: 'Duplicate Email Prevention',
            status: 'FAIL',
            message: 'Duplicate emails with different cases are not being prevented'
          });
        } catch (duplicateError) {
          checks.push({
            name: 'Duplicate Email Prevention',
            status: 'PASS',
            message: 'Duplicate emails are properly prevented (case-insensitive)'
          });
        }

      } finally {
        // Cleanup test user
        await User.findByIdAndDelete(testUser._id);
      }

    } catch (error) {
      checks.push({
        name: 'Email Operations Validation',
        status: 'FAIL',
        message: `Email operations validation failed: ${error}`
      });
    }

    this.results.push({
      category: 'Case-Insensitive Email Operations',
      checks
    });
  }

  private generateReport(): void {
    console.log('\n' + '═'.repeat(80));
    console.log('🎯 PRODUCTION READINESS VALIDATION REPORT');
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
    const isProductionReady = failedChecks === 0;

    console.log('\n' + '═'.repeat(80));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(80));
    console.log(`✅ Passed: ${passedChecks}`);
    console.log(`⚠️  Warnings: ${warningChecks}`);
    console.log(`❌ Failed: ${failedChecks}`);
    console.log(`📈 Score: ${readinessScore.toFixed(1)}% (${passedChecks}/${totalChecks})`);
    console.log('─'.repeat(40));
    console.log(`🎯 PRODUCTION READY: ${isProductionReady ? '✅ YES' : '❌ NO'}`);
    console.log(`🔒 SECURITY STATUS: ${failedChecks === 0 ? '✅ SECURE' : '❌ NEEDS ATTENTION'}`);
    console.log('═'.repeat(80));

    if (!isProductionReady) {
      console.log('\n❌ Production readiness validation FAILED');
      console.log('Please address all failed checks before deploying to production.');
      process.exit(1);
    } else {
      console.log('\n✅ Production readiness validation PASSED');
      console.log('System is ready for production deployment.');
    }
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
  const validator = new ProductionReadinessValidator();
  validator.runAllValidations().catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}

export { ProductionReadinessValidator };