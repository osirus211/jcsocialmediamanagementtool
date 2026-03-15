#!/usr/bin/env node

/**
 * Simple Authentication Test
 * Tests basic login functionality without hanging
 */

const request = require('supertest');
const mongoose = require('mongoose');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler-test';

async function testAuth() {
  console.log('🧪 Starting simple authentication test...');
  
  try {
    // Import app after setting environment
    const app = require('./src/app').default;
    
    console.log('✅ App imported successfully');
    
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to test database');
    
    // Test health endpoint first
    console.log('🔍 Testing health endpoint...');
    const healthResponse = await request(app)
      .get('/health')
      .timeout(5000);
    
    console.log('✅ Health check:', healthResponse.status, healthResponse.body);
    
    // Test login endpoint with missing credentials
    console.log('🔍 Testing login endpoint with missing credentials...');
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({})
      .timeout(5000);
    
    console.log('✅ Login test:', loginResponse.status, loginResponse.body);
    
    // Test login endpoint with invalid credentials
    console.log('🔍 Testing login endpoint with invalid credentials...');
    const invalidLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      })
      .timeout(5000);
    
    console.log('✅ Invalid login test:', invalidLoginResponse.status, invalidLoginResponse.body);
    
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      await mongoose.disconnect();
      console.log('✅ Disconnected from database');
    } catch (error) {
      console.error('⚠️  Database disconnect error:', error.message);
    }
    
    // Force exit after a short delay
    setTimeout(() => {
      console.log('🔚 Forcing exit...');
      process.exit(0);
    }, 1000);
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
testAuth();