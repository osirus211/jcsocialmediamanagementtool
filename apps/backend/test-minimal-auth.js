#!/usr/bin/env node

/**
 * Minimal Authentication Test
 * Tests basic authentication functionality without complex setup
 */

// Set test environment BEFORE any imports
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler-test';

const request = require('supertest');

async function testMinimalAuth() {
  console.log('🧪 Starting minimal authentication test...');
  
  try {
    // Import app
    console.log('📦 Importing app...');
    const app = require('./src/app').default;
    console.log('✅ App imported successfully');
    
    // Test 1: Health endpoint
    console.log('🔍 Testing health endpoint...');
    const healthResponse = await request(app)
      .get('/health')
      .timeout(5000);
    
    console.log('✅ Health check:', healthResponse.status);
    
    // Test 2: Login endpoint with missing credentials (should return 400)
    console.log('🔍 Testing login endpoint with missing credentials...');
    const missingCredsResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({})
      .timeout(5000);
    
    console.log('✅ Missing credentials test:', missingCredsResponse.status, missingCredsResponse.body?.error);
    
    // Test 3: Login endpoint with invalid email format (should return 400)
    console.log('🔍 Testing login endpoint with invalid email format...');
    const invalidEmailResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'invalid-email',
        password: 'somepassword'
      })
      .timeout(5000);
    
    console.log('✅ Invalid email test:', invalidEmailResponse.status, invalidEmailResponse.body?.error);
    
    // Test 4: Login endpoint with valid format but non-existent user (should return 401)
    console.log('🔍 Testing login endpoint with non-existent user...');
    const nonExistentUserResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'somepassword123'
      })
      .timeout(5000);
    
    console.log('✅ Non-existent user test:', nonExistentUserResponse.status, nonExistentUserResponse.body?.error);
    
    // Verify expected responses
    const results = {
      health: healthResponse.status === 200,
      missingCreds: missingCredsResponse.status === 400,
      invalidEmail: invalidEmailResponse.status === 400,
      nonExistentUser: nonExistentUserResponse.status === 401
    };
    
    console.log('\n📊 Test Results:');
    console.log('Health endpoint:', results.health ? '✅ PASS' : '❌ FAIL');
    console.log('Missing credentials:', results.missingCreds ? '✅ PASS' : '❌ FAIL');
    console.log('Invalid email format:', results.invalidEmail ? '✅ PASS' : '❌ FAIL');
    console.log('Non-existent user:', results.nonExistentUser ? '✅ PASS' : '❌ FAIL');
    
    const allPassed = Object.values(results).every(result => result);
    
    if (allPassed) {
      console.log('\n🎉 All minimal authentication tests passed!');
      console.log('✅ Authentication system is working correctly');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the test
testMinimalAuth();