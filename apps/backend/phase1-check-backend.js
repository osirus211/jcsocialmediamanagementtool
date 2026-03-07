/**
 * Phase 1 Validation: Check Backend Status
 * 
 * Verifies backend is running and token refresh system is operational
 */

require('dotenv').config();
const axios = require('axios');
const Redis = require('ioredis');
const mongoose = require('mongoose');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-scheduler';

async function checkBackend() {
  console.log('🔧 Phase 1: Backend Status Check');
  console.log('==================================\n');

  const results = {
    backend: false,
    redis: false,
    mongodb: false,
    scheduler: false,
    worker: false,
    testAccounts: 0,
  };

  // Check backend health
  try {
    console.log('📡 Checking backend health...');
    const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    
    if (response.status === 200) {
      results.backend = true;
      console.log('✅ Backend is running');
      console.log(`   Status: ${response.data.status}`);
      
      if (response.data.redis) {
        results.redis = response.data.redis.status === 'connected';
        console.log(`   Redis: ${response.data.redis.status}`);
      }
      
      if (response.data.mongodb) {
        results.mongodb = response.data.mongodb.status === 'connected';
        console.log(`   MongoDB: ${response.data.mongodb.status}`);
      }
    }
  } catch (error) {
    console.log('❌ Backend not responding');
    console.log(`   Error: ${error.message}`);
    console.log(`   URL: ${BACKEND_URL}/health`);
  }

  // Check Redis directly
  if (!results.redis) {
    try {
      console.log('\n📡 Checking Redis directly...');
      const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
      await redis.ping();
      results.redis = true;
      console.log('✅ Redis is accessible');
      
      // Check for locks
      const lockKeys = await redis.keys('oauth:refresh:lock:*');
      console.log(`   Active locks: ${lockKeys.length}`);
      
      // Check for DLQ entries
      const dlqKeys = await redis.keys('oauth:refresh:dlq:*');
      console.log(`   DLQ entries: ${dlqKeys.length}`);
      
      redis.disconnect();
    } catch (error) {
      console.log('❌ Redis not accessible');
      console.log(`   Error: ${error.message}`);
    }
  }

  // Check MongoDB directly
  if (!results.mongodb) {
    try {
      console.log('\n📡 Checking MongoDB directly...');
      await mongoose.connect(MONGODB_URI);
      results.mongodb = true;
      console.log('✅ MongoDB is accessible');
      
      // Check for test accounts
      const db = mongoose.connection.db;
      const collection = db.collection('socialaccounts');
      const count = await collection.countDocuments({
        accountName: { $regex: /^PHASE1_TEST_/ }
      });
      
      results.testAccounts = count;
      console.log(`   Test accounts: ${count}`);
      
      // Check if any were refreshed
      const refreshed = await collection.countDocuments({
        accountName: { $regex: /^PHASE1_TEST_/ },
        lastRefreshedAt: { $exists: true, $ne: null }
      });
      
      console.log(`   Refreshed accounts: ${refreshed}`);
      
      await mongoose.disconnect();
    } catch (error) {
      console.log('❌ MongoDB not accessible');
      console.log(`   Error: ${error.message}`);
    }
  }

  // Check metrics endpoint
  try {
    console.log('\n📡 Checking metrics endpoint...');
    const response = await axios.get(`${BACKEND_URL}/metrics`, { timeout: 5000 });
    
    if (response.status === 200) {
      console.log('✅ Metrics endpoint accessible');
      
      // Parse metrics
      const metrics = response.data;
      
      if (typeof metrics === 'string') {
        // Prometheus format
        const lines = metrics.split('\n');
        const refreshSuccess = lines.find(l => l.startsWith('refresh_success_total'));
        const refreshFailure = lines.find(l => l.startsWith('refresh_failure_total'));
        
        if (refreshSuccess) {
          console.log(`   ${refreshSuccess}`);
        }
        if (refreshFailure) {
          console.log(`   ${refreshFailure}`);
        }
      }
    }
  } catch (error) {
    console.log('⚠️  Metrics endpoint not accessible');
    console.log(`   Error: ${error.message}`);
  }

  // Print summary
  console.log('\n\n═══════════════════════════════════════');
  console.log('           SYSTEM STATUS');
  console.log('═══════════════════════════════════════\n');

  console.log(`Backend:       ${results.backend ? '✅ Running' : '❌ Not Running'}`);
  console.log(`Redis:         ${results.redis ? '✅ Connected' : '❌ Not Connected'}`);
  console.log(`MongoDB:       ${results.mongodb ? '✅ Connected' : '❌ Not Connected'}`);
  console.log(`Test Accounts: ${results.testAccounts}`);

  console.log('\n═══════════════════════════════════════\n');

  if (!results.backend) {
    console.log('⚠️  Backend is not running. Start it with:');
    console.log('   cd apps/backend && npm run dev\n');
  }

  if (!results.redis) {
    console.log('⚠️  Redis is not accessible. Check connection.\n');
  }

  if (!results.mongodb) {
    console.log('⚠️  MongoDB is not accessible. Check connection.\n');
  }

  if (results.testAccounts === 0) {
    console.log('⚠️  No test accounts found. Seed them with:');
    console.log('   node phase1-seed-test-accounts.js\n');
  }

  const allGood = results.backend && results.redis && results.mongodb && results.testAccounts > 0;

  if (allGood) {
    console.log('✅ System is ready for validation!\n');
    console.log('Next steps:');
    console.log('1. Monitor Redis: node phase1-monitor-redis.js');
    console.log('2. Wait 5 minutes for scheduler to run');
    console.log('3. Check if test accounts were refreshed\n');
  }
}

checkBackend().catch(error => {
  console.error('❌ Check failed:', error);
  process.exit(1);
});
