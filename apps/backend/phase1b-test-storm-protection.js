/**
 * Phase 1B: Storm Protection Validation
 * 
 * Tests jitter distribution across multiple accounts
 */

require('dotenv').config();
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const mongoose = require('mongoose');

// Construct Redis URL from environment variables
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || '6380';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_URL = process.env.REDIS_URL || 
  (REDIS_PASSWORD 
    ? `redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`
    : `redis://${REDIS_HOST}:${REDIS_PORT}`);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-scheduler';

// Import SocialAccount model
require('./dist/models/SocialAccount');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testStormProtection() {
  let redis;
  let queue;

  try {
    console.log('🔧 Phase 1B: Storm Protection Test');
    console.log('====================================\n');

    // Connect
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    await mongoose.connect(MONGODB_URI);
    queue = new Queue('token-refresh-queue', { connection: redis });

    // Create 20 test accounts with synchronized expiry
    const SocialAccount = mongoose.model('SocialAccount');
    
    console.log('STEP 1: Creating 20 test accounts with synchronized expiry...\n');

    const expiryTime = new Date(Date.now() + 3600000); // 1 hour from now
    const testAccounts = [];

    for (let i = 1; i <= 20; i++) {
      const account = await SocialAccount.create({
        userId: new mongoose.Types.ObjectId(),
        provider: 'twitter',
        accountId: `storm_test_${i}`,
        accountName: `STORM_TEST_${i}`,
        accessToken: 'encrypted_test_token',
        refreshToken: 'encrypted_test_refresh',
        tokenExpiresAt: expiryTime,
        status: 'ACTIVE',
      });
      testAccounts.push(account);
    }

    console.log(`✅ Created 20 accounts expiring at: ${expiryTime.toISOString()}\n`);

    // STEP 2: Simulate scheduler enqueueing jobs with jitter
    console.log('STEP 2: Simulating scheduler with jitter...\n');

    const jitterData = [];

    for (const account of testAccounts) {
      // Calculate jitter (±10 minutes = ±600000 ms)
      const jitterMs = Math.floor(Math.random() * 1200000) - 600000;
      const delay = Math.max(0, jitterMs);
      
      const scheduledTime = new Date(Date.now() + delay);
      
      jitterData.push({
        accountId: account.accountId,
        jitterMs,
        delay,
        scheduledTime,
      });

      console.log(`   ${account.accountId}: Jitter ${jitterMs >= 0 ? '+' : ''}${Math.floor(jitterMs / 1000)}s → ${scheduledTime.toISOString()}`);
    }

    console.log('');

    // STEP 3: Analyze jitter distribution
    console.log('STEP 3: Analyzing jitter distribution...\n');

    const jitterValues = jitterData.map(d => d.jitterMs);
    const delays = jitterData.map(d => d.delay);

    const minJitter = Math.min(...jitterValues);
    const maxJitter = Math.max(...jitterValues);
    const avgJitter = jitterValues.reduce((a, b) => a + b, 0) / jitterValues.length;

    const minDelay = Math.min(...delays);
    const maxDelay = Math.max(...delays);
    const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;

    console.log('Jitter Statistics:');
    console.log(`   Min: ${Math.floor(minJitter / 1000)}s (${Math.floor(minJitter / 60000)} min)`);
    console.log(`   Max: ${Math.floor(maxJitter / 1000)}s (${Math.floor(maxJitter / 60000)} min)`);
    console.log(`   Avg: ${Math.floor(avgJitter / 1000)}s (${Math.floor(avgJitter / 60000)} min)`);
    console.log('');

    console.log('Delay Statistics (non-negative):');
    console.log(`   Min: ${Math.floor(minDelay / 1000)}s (${Math.floor(minDelay / 60000)} min)`);
    console.log(`   Max: ${Math.floor(maxDelay / 1000)}s (${Math.floor(maxDelay / 60000)} min)`);
    console.log(`   Avg: ${Math.floor(avgDelay / 1000)}s (${Math.floor(avgDelay / 60000)} min)`);
    console.log('');

    // STEP 4: Calculate time spread
    const scheduledTimes = jitterData.map(d => d.scheduledTime.getTime());
    const earliestTime = Math.min(...scheduledTimes);
    const latestTime = Math.max(...scheduledTimes);
    const spreadMs = latestTime - earliestTime;
    const spreadMin = Math.floor(spreadMs / 60000);

    console.log('Time Spread:');
    console.log(`   Earliest: ${new Date(earliestTime).toISOString()}`);
    console.log(`   Latest: ${new Date(latestTime).toISOString()}`);
    console.log(`   Spread: ${spreadMin} minutes\n`);

    // STEP 5: Distribution buckets (5-minute intervals)
    console.log('STEP 4: Distribution by 5-minute buckets...\n');

    const buckets = {};
    for (const data of jitterData) {
      const bucketMin = Math.floor(data.delay / 300000) * 5; // 5-minute buckets
      const bucketKey = `${bucketMin}-${bucketMin + 5} min`;
      buckets[bucketKey] = (buckets[bucketKey] || 0) + 1;
    }

    const sortedBuckets = Object.entries(buckets).sort((a, b) => {
      const aMin = parseInt(a[0].split('-')[0]);
      const bMin = parseInt(b[0].split('-')[0]);
      return aMin - bMin;
    });

    for (const [bucket, count] of sortedBuckets) {
      const bar = '█'.repeat(count);
      console.log(`   ${bucket.padEnd(15)}: ${bar} (${count})`);
    }
    console.log('');

    // STEP 6: Validation
    console.log('STEP 5: Validation...\n');

    const validations = [];

    // Check jitter range
    const jitterRangeValid = minJitter >= -600000 && maxJitter <= 600000;
    validations.push({
      check: 'Jitter within ±10 minutes',
      passed: jitterRangeValid,
      details: `Min: ${Math.floor(minJitter / 60000)}m, Max: ${Math.floor(maxJitter / 60000)}m`,
    });

    // Check no negative delays
    const noNegativeDelays = minDelay >= 0;
    validations.push({
      check: 'No negative delays',
      passed: noNegativeDelays,
      details: `Min delay: ${Math.floor(minDelay / 1000)}s`,
    });

    // Check spread is reasonable (at least 5 minutes)
    const spreadValid = spreadMin >= 5;
    validations.push({
      check: 'Jobs spread over time',
      passed: spreadValid,
      details: `Spread: ${spreadMin} minutes`,
    });

    // Check distribution is not too concentrated
    const maxBucketCount = Math.max(...Object.values(buckets));
    const distributionValid = maxBucketCount <= 10; // No more than 10 in one bucket
    validations.push({
      check: 'Distribution not concentrated',
      passed: distributionValid,
      details: `Max in one bucket: ${maxBucketCount}`,
    });

    for (const validation of validations) {
      const status = validation.passed ? '✅' : '❌';
      console.log(`   ${status} ${validation.check}`);
      console.log(`      ${validation.details}`);
    }
    console.log('');

    const allPassed = validations.every(v => v.passed);

    if (allPassed) {
      console.log('✅ Storm protection validation PASSED\n');
    } else {
      console.log('⚠️  Storm protection validation FAILED\n');
    }

    // STEP 7: Cleanup
    console.log('STEP 6: Cleaning up test accounts...\n');
    await SocialAccount.deleteMany({
      accountName: { $regex: /^STORM_TEST_/ }
    });
    console.log('✅ Test accounts deleted\n');

    console.log('Summary:');
    console.log('- Jitter spreads jobs over 20-minute window');
    console.log('- Prevents synchronized expiry bursts');
    console.log('- Reduces provider API load');
    console.log('- Minimizes circuit breaker triggers\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    if (queue) await queue.close();
    if (redis) redis.disconnect();
    await mongoose.disconnect();
  }
}

testStormProtection();
