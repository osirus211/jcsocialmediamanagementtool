/**
 * OAuth System Test Script
 * 
 * Quick test to verify OAuth system is working
 * Run with: node test-oauth.js
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000';
const TEST_MODE = process.env.OAUTH_TEST_MODE !== 'false';

console.log('🧪 OAuth System Test');
console.log('===================');
console.log(`API URL: ${API_URL}`);
console.log(`Test Mode: ${TEST_MODE ? 'ENABLED' : 'DISABLED'}`);
console.log('');

async function testOAuthSystem() {
  try {
    // Test 1: Check if OAuth routes are accessible
    console.log('Test 1: Checking OAuth platforms endpoint...');
    try {
      const response = await axios.get(`${API_URL}/api/v1/oauth/platforms`, {
        headers: {
          'Authorization': 'Bearer test-token' // Will fail auth but route should exist
        },
        validateStatus: () => true // Don't throw on any status
      });
      
      if (response.status === 401) {
        console.log('✅ OAuth routes are registered (got 401 Unauthorized as expected)');
      } else if (response.status === 200) {
        console.log('✅ OAuth platforms endpoint accessible');
        console.log(`   Platforms: ${response.data.platforms?.join(', ') || 'none'}`);
        console.log(`   Test Mode: ${response.data.testMode}`);
      } else {
        console.log(`⚠️  Unexpected status: ${response.status}`);
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('❌ Backend is not running. Start with: npm run dev');
        return;
      }
      throw error;
    }

    console.log('');

    // Test 2: Check if OAuth providers are initialized
    console.log('Test 2: Checking OAuth provider initialization...');
    console.log('   This requires the backend to be running.');
    console.log('   Check backend logs for:');
    console.log('   - "OAuth Manager initialized in TEST MODE" (if OAUTH_TEST_MODE=true)');
    console.log('   - "OAuth Manager initialized in PRODUCTION MODE" (if OAUTH_TEST_MODE=false)');
    console.log('   - "Twitter OAuth provider initialized" (if credentials configured)');
    console.log('   - "LinkedIn OAuth provider initialized" (if credentials configured)');
    console.log('   - "Facebook OAuth provider initialized" (if credentials configured)');
    console.log('   - "Instagram OAuth provider initialized" (if credentials configured)');

    console.log('');

    // Test 3: Verify encryption is working
    console.log('Test 3: Checking encryption system...');
    const crypto = require('crypto');
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    
    if (!ENCRYPTION_KEY) {
      console.log('❌ ENCRYPTION_KEY not set in environment');
      console.log('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    } else if (ENCRYPTION_KEY.length !== 64) {
      console.log(`❌ ENCRYPTION_KEY must be 64 hex characters (got ${ENCRYPTION_KEY.length})`);
    } else {
      console.log('✅ ENCRYPTION_KEY is configured correctly');
    }

    console.log('');

    // Summary
    console.log('📋 Summary');
    console.log('==========');
    console.log('');
    console.log('OAuth System Status:');
    console.log(`  Mode: ${TEST_MODE ? 'TEST' : 'PRODUCTION'}`);
    console.log(`  Backend: ${API_URL}`);
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Ensure backend is running: npm run dev');
    console.log('  2. Check backend logs for OAuth provider initialization');
    console.log('  3. Test OAuth flow:');
    console.log('     - Navigate to http://localhost:5173/social/accounts');
    console.log('     - Click "Connect Account"');
    console.log('     - Complete OAuth flow');
    console.log('');
    console.log('For production:');
    console.log('  1. Set OAUTH_TEST_MODE=false');
    console.log('  2. Configure OAuth credentials in .env');
    console.log('  3. Register OAuth apps on each platform');
    console.log('  4. Configure redirect URIs');
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('  1. Ensure backend is running: npm run dev');
    console.error('  2. Check .env configuration');
    console.error('  3. Verify ENCRYPTION_KEY is set');
    console.error('  4. Check backend logs for errors');
  }
}

// Run tests
testOAuthSystem();
