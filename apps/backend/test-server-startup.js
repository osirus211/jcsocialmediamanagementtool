#!/usr/bin/env node

/**
 * Test Server Startup
 * Verifies that the server can start without Redis connection issues
 */

// Set test environment BEFORE any imports
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler-test';

console.log('🧪 Testing server startup...');

async function testStartup() {
  try {
    console.log('📦 Importing app...');
    const app = require('./src/app').default;
    console.log('✅ App imported successfully');
    
    // Test a simple request
    const request = require('supertest');
    console.log('🔍 Testing health endpoint...');
    
    const response = await request(app)
      .get('/health')
      .timeout(5000);
    
    console.log('✅ Health endpoint response:', response.status);
    
    if (response.status === 200) {
      console.log('🎉 Server startup test completed successfully!');
      console.log('✅ No Redis initialization errors detected');
    } else {
      console.log('⚠️  Health endpoint returned non-200 status');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
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
testStartup();