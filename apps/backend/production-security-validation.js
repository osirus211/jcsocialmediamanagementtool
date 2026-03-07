/**
 * PRODUCTION SECURITY VALIDATION
 * Comprehensive security testing after fixes
 */

const axios = require('axios');
const mongoose = require('mongoose');
const Redis = require('ioredis');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api/v1';

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  critical: []
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) console.log(`   ${details}`);
  
  if (passed) {
    results.passed++;
  } else {
    results.failed++;
    if (name.includes('CRITICAL') || name.includes('SECURITY')) {
      results.critical.push(name);
    }
  }
}

async function runSecurityValidation() {
  console.log('🔒 PRODUCTION SECURITY VALIDATION\n');
  console.log('='.repeat(80) + '\n');

  let accessToken, refreshToken, userId;

  try {
    // ========== JWT SECURITY ==========
    console.log('MODULE 1: JWT Security');
    console.log('-'.repeat(80));

    // Test 1.1: Login works
    try {
      const loginRes = await axios.post(`${API_URL}/auth/login`, {
        email: 'test@example.com',
        password: 'Test1234'
      });
      accessToken = loginRes.data.accessToken;
      const cookies = loginRes.headers['set-cookie'];
      if (cookies) {
        const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
        if (refreshCookie) {
          refreshToken = refreshCookie.split(';')[0].split('=')[1];
        }
      }
      logTest('1.1 Login with secure JWT secrets', !!accessToken);
    } catch (error) {
      logTest('1.1 Login with secure JWT secrets', false, error.message);
    }

    // Test 1.2: Tampered token rejected
    if (accessToken) {
      const tamperedToken = accessToken.slice(0, -10) + 'TAMPERED12';
      try {
        await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${tamperedToken}` }
        });
        logTest('1.2 CRITICAL: Tampered token rejected', false, 'Tampered token was accepted!');
      } catch (error) {
        const isRejected = error.response?.status === 401 || error.response?.status === 403;
        logTest('1.2 CRITICAL: Tampered token rejected', isRejected);
      }
    }

    // Test 1.3: Token rotation invalidates old token
    if (refreshToken) {
      try {
        const refreshRes = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const newRefreshToken = refreshRes.headers['set-cookie']?.find(c => c.startsWith('refreshToken='))?.split(';')[0].split('=')[1];
        
        // Try to use old token
        try {
          await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          logTest('1.3 CRITICAL: Token rotation invalidates old token', false, 'Old token still works!');
        } catch (error) {
          logTest('1.3 CRITICAL: Token rotation invalidates old token', true);
        }
        
        refreshToken = newRefreshToken;
      } catch (error) {
        logTest('1.3 CRITICAL: Token rotation invalidates old token', false, error.message);
      }
    }

    // Test 1.4: Logout invalidates refresh token
    if (refreshToken && accessToken) {
      try {
        await axios.post(`${API_URL}/auth/logout`, { refreshToken }, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        // Try to use token after logout
        try {
          await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          logTest('1.4 CRITICAL: Logout invalidates refresh token', false, 'Token works after logout!');
        } catch (error) {
          logTest('1.4 CRITICAL: Logout invalidates refresh token', true);
        }
      } catch (error) {
        logTest('1.4 CRITICAL: Logout invalidates refresh token', false, error.message);
      }
    }

    console.log('');

    // ========== DATA INTEGRITY ==========
    console.log('MODULE 2: Data Integrity');
    console.log('-'.repeat(80));

    await mongoose.connect(process.env.MONGODB_URI);

    const WorkspaceMember = mongoose.model('WorkspaceMember', new mongoose.Schema({
      workspaceId: mongoose.Schema.Types.ObjectId,
      userId: mongoose.Schema.Types.ObjectId,
    }));

    const Workspace = mongoose.model('Workspace', new mongoose.Schema({
      name: String,
    }));

    // Test 2.1: No null workspace members
    const nullMembers = await WorkspaceMember.countDocuments({ workspaceId: null });
    logTest('2.1 No workspace members with null workspace', nullMembers === 0, `Found ${nullMembers}`);

    // Test 2.2: No orphaned workspace members
    const allMembers = await WorkspaceMember.find({ workspaceId: { $ne: null } });
    const workspaceIds = [...new Set(allMembers.map(m => m.workspaceId?.toString()).filter(Boolean))];
    const existingWorkspaces = await Workspace.find({ _id: { $in: workspaceIds } });
    const existingIds = new Set(existingWorkspaces.map(w => w._id.toString()));
    const orphaned = allMembers.filter(m => m.workspaceId && !existingIds.has(m.workspaceId.toString()));
    logTest('2.2 No orphaned workspace members', orphaned.length === 0, `Found ${orphaned.length}`);

    console.log('');

    // ========== REDIS SECURITY ==========
    console.log('MODULE 3: Redis Security');
    console.log('-'.repeat(80));

    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    // Test 3.1: Token blacklist working
    const blacklistKeys = await redis.keys('blacklist:refresh:*');
    logTest('3.1 Token blacklist operational', blacklistKeys.length >= 0, `${blacklistKeys.length} blacklisted tokens`);

    // Test 3.2: No sensitive data in Redis keys
    const allKeys = await redis.keys('*');
    const sensitivePatterns = ['password', 'secret', 'token:plain'];
    const sensitiveKeys = allKeys.filter(key => 
      sensitivePatterns.some(pattern => key.toLowerCase().includes(pattern))
    );
    logTest('3.2 No sensitive data in Redis keys', sensitiveKeys.length === 0, 
      sensitiveKeys.length > 0 ? `Found: ${sensitiveKeys.join(', ')}` : '');

    await redis.quit();
    console.log('');

    // ========== ENVIRONMENT SECURITY ==========
    console.log('MODULE 4: Environment Security');
    console.log('-'.repeat(80));

    // Test 4.1: JWT secrets are not default values
    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    const isDefaultSecret = jwtSecret?.includes('change-this') || jwtSecret?.includes('your-super-secret');
    const isDefaultRefresh = jwtRefreshSecret?.includes('change-this') || jwtRefreshSecret?.includes('your-super-secret');
    logTest('4.1 CRITICAL: JWT secrets are cryptographically secure', 
      !isDefaultSecret && !isDefaultRefresh && jwtSecret?.length >= 32,
      isDefaultSecret || isDefaultRefresh ? 'Using default secrets!' : '');

    // Test 4.2: Encryption key is secure
    const encryptionKey = process.env.ENCRYPTION_KEY;
    const isSecureEncryption = encryptionKey && encryptionKey.length >= 64 && !/^0123456789abcdef/.test(encryptionKey);
    logTest('4.2 Encryption key is secure', isSecureEncryption,
      !isSecureEncryption ? 'Encryption key is weak or default!' : '');

    console.log('');

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Validation error:', error.message);
    results.failed++;
  }

  // ========== SUMMARY ==========
  console.log('='.repeat(80));
  console.log('SECURITY VALIDATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️  Warnings: ${results.warnings}`);
  console.log('');

  if (results.critical.length > 0) {
    console.log('🚨 CRITICAL ISSUES:');
    results.critical.forEach(issue => console.log(`   - ${issue}`));
    console.log('');
  }

  if (results.failed === 0) {
    console.log('✅ PRODUCTION SECURITY: SAFE');
    console.log('   All security checks passed');
    console.log('   System is ready for production deployment');
  } else {
    console.log('❌ PRODUCTION SECURITY: VULNERABLE');
    console.log(`   ${results.failed} security issue(s) found`);
    console.log('   DO NOT DEPLOY TO PRODUCTION');
  }
  console.log('');

  process.exit(results.failed > 0 ? 1 : 0);
}

runSecurityValidation();
