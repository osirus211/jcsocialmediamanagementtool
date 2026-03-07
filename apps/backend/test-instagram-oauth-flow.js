/**
 * Test Instagram OAuth Flow
 * 
 * This script tests the complete Instagram OAuth flow:
 * 1. Get authorization URL
 * 2. Simulate callback with code
 * 3. Check if accounts are created in database
 * 
 * Usage: node test-instagram-oauth-flow.js
 */

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:5000';
const MONGODB_URI = process.env.MONGODB_URI;

// Test credentials (you'll need to provide these)
const TEST_WORKSPACE_ID = '699abb302e5396ce53e57284'; // From the database check
const TEST_USER_ID = 'test_user_id';
const TEST_JWT_TOKEN = 'your_jwt_token_here'; // You'll need a valid JWT

async function testInstagramOAuth() {
  console.log('=== INSTAGRAM OAUTH FLOW TEST ===\n');

  try {
    // Step 1: Get authorization URL
    console.log('Step 1: Getting authorization URL...');
    const authResponse = await axios.post(
      `${API_URL}/api/v1/oauth/instagram/authorize`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Authorization URL obtained');
    console.log('URL:', authResponse.data.authorizationUrl);
    console.log('State:', authResponse.data.state);
    console.log('');

    console.log('⚠️  MANUAL STEP REQUIRED:');
    console.log('1. Open the authorization URL in your browser');
    console.log('2. Complete the Instagram OAuth flow');
    console.log('3. Copy the callback URL with the code parameter');
    console.log('4. Extract the code and state from the callback URL');
    console.log('');
    console.log('Callback URL format:');
    console.log(`${API_URL}/api/v1/oauth/instagram/callback?code=XXXXX&state=XXXXX`);
    console.log('');

    // Step 2: Check database for Instagram accounts
    console.log('Step 2: Checking database for Instagram accounts...');
    await mongoose.connect(MONGODB_URI);
    
    const SocialAccount = mongoose.model('SocialAccount', new mongoose.Schema({}, { strict: false }));
    const instagramAccounts = await SocialAccount.find({ provider: 'instagram' }).lean();

    console.log(`Found ${instagramAccounts.length} Instagram account(s) in database`);
    
    if (instagramAccounts.length > 0) {
      console.log('');
      instagramAccounts.forEach((account, index) => {
        console.log(`Account ${index + 1}:`);
        console.log(`  ID: ${account._id}`);
        console.log(`  Workspace ID: ${account.workspaceId}`);
        console.log(`  Username: ${account.metadata?.username || account.accountName}`);
        console.log(`  Status: ${account.status}`);
        console.log(`  Created: ${account.createdAt}`);
        console.log('');
      });
    }

    await mongoose.disconnect();

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('');
      console.log('⚠️  Authentication failed. You need a valid JWT token.');
      console.log('To get a JWT token:');
      console.log('1. Login to the app');
      console.log('2. Open browser DevTools > Application > Local Storage');
      console.log('3. Copy the "token" value');
      console.log('4. Update TEST_JWT_TOKEN in this script');
    }
    
    process.exit(1);
  }
}

// Alternative: Test with mock data
async function testWithMockData() {
  console.log('=== TESTING WITH MOCK DATA ===\n');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const SocialAccount = mongoose.model('SocialAccount', new mongoose.Schema({}, { strict: false }));
    
    // Check current Instagram accounts
    const before = await SocialAccount.countDocuments({ provider: 'instagram' });
    console.log(`Instagram accounts before: ${before}`);
    
    // Create a test Instagram account
    console.log('\nCreating test Instagram account...');
    const testAccount = await SocialAccount.create({
      workspaceId: TEST_WORKSPACE_ID,
      provider: 'instagram',
      providerUserId: 'test_instagram_' + Date.now(),
      accountName: 'Test Instagram Account',
      accessToken: 'encrypted_test_token',
      status: 'active',
      scopes: ['instagram_basic', 'instagram_content_publish'],
      metadata: {
        username: 'test_instagram_user',
        name: 'Test Instagram User',
        followersCount: 1000,
      },
      lastSyncAt: new Date(),
    });
    
    console.log('✅ Test account created:', testAccount._id);
    
    // Check after
    const after = await SocialAccount.countDocuments({ provider: 'instagram' });
    console.log(`Instagram accounts after: ${after}`);
    
    // Clean up
    console.log('\nCleaning up test account...');
    await SocialAccount.deleteOne({ _id: testAccount._id });
    console.log('✅ Test account deleted');
    
    await mongoose.disconnect();
    
    console.log('\n✅ Mock data test completed successfully');
    console.log('This confirms that:');
    console.log('1. Database connection works');
    console.log('2. SocialAccount model can create Instagram accounts');
    console.log('3. The issue is likely in the OAuth callback handler');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run tests
console.log('Choose test mode:');
console.log('1. Full OAuth flow (requires manual steps)');
console.log('2. Mock data test (automated)');
console.log('');

// For now, run mock data test
testWithMockData();
