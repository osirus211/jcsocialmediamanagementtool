/**
 * Phase 1B: Rate Limiter Validation
 * 
 * Tests rate limit blocking and job re-enqueueing
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

async function testRateLimiter() {
  let redis;
  let queue;

  try {
    console.log('🔧 Phase 1B: Rate Limiter Test');
    console.log('================================\n');

    // Connect
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    await mongoose.connect(MONGODB_URI);
    queue = new Queue('token-refresh-queue', { connection: redis });

    // Get test accounts
    const SocialAccount = mongoose.model('SocialAccount');
    const testAccounts = await SocialAccount.find({
      accountName: { $regex: /^PHASE1_TEST_/ }
    }).limit(5);

    if (testAccounts.length === 0) {
      console.error('❌ No test accounts found');
      process.exit(1);
    }

    const provider = testAccounts[0].provider;
    console.log(`🎯 Test Provider: ${provider}`);
    console.log(`   Test Accounts: ${testAccounts.length}\n`);

    // Get current minute
    const currentMinute = Math.floor(Date.now() / 60000);
    const rateLimitKey = `oauth:ratelimit:${provider}:${currentMinute}`;

    // Clear existing rate limit counter
    await redis.del(rateLimitKey);
    console.log('🗑️  Cleared existing rate limit counter\n');

    // STEP 1: Check rate limit configuration
    console.log('STEP 1: Rate Limit Configuration...\n');
    console.log(`   Provider: ${provider}`);
    console.log(`   Default Limit: 100 requests/minute`);
    console.log(`   Current Minute: ${currentMinute}`);
    console.log(`   Rate Limit Key: ${rateLimitKey}\n`);

    // STEP 2: Send requests under limit
    console.log('STEP 2: Sending 10 requests (under limit)...\n');

    for (let i = 1; i <= 10; i++) {
      const account = testAccounts[i % testAccounts.length];
      
      await queue.add('refresh-token', {
        connectionId: account._id.toString(),
        provider,
        expiresAt: new Date(Date.now() + 3600000),
        correlationId: `rate-test-${i}`,
      }, {
        jobId: `rate-test-${provider}-${i}`,
      });

      // Small delay to allow processing
      await sleep(100);
    }

    console.log('✅ 10 requests enqueued\n');

    // Wait for processing
    console.log('Waiting 5 seconds for processing...\n');
    await sleep(5000);

    // Check rate limit counter
    const counter = await redis.get(rateLimitKey);
    console.log(`Rate Limit Counter: ${counter || 0}\n`);

    // STEP 3: Check queue stats
    console.log('STEP 3: Queue Statistics...\n');
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    console.log(`   Waiting: ${waiting}`);
    console.log(`   Active: ${active}`);
    console.log(`   Completed: ${completed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Delayed: ${delayed}\n`);

    // STEP 4: Simulate rate limit exceeded
    console.log('STEP 4: Simulating rate limit exceeded...\n');
    console.log('Setting counter to 99 (next request will be 100th)...\n');

    await redis.set(rateLimitKey, '99', 'EX', 120);

    // Send 3 more requests
    console.log('Sending 3 requests (100th, 101st, 102nd)...\n');

    for (let i = 11; i <= 13; i++) {
      const account = testAccounts[i % testAccounts.length];
      
      await queue.add('refresh-token', {
        connectionId: account._id.toString(),
        provider,
        expiresAt: new Date(Date.now() + 3600000),
        correlationId: `rate-test-limit-${i}`,
      }, {
        jobId: `rate-test-limit-${provider}-${i}`,
      });

      await sleep(100);
    }

    console.log('✅ 3 requests enqueued\n');

    // Wait for processing
    console.log('Waiting 5 seconds for processing...\n');
    await sleep(5000);

    // Check final counter
    const finalCounter = await redis.get(rateLimitKey);
    console.log(`Final Rate Limit Counter: ${finalCounter || 0}\n`);

    // STEP 5: Check delayed jobs
    console.log('STEP 5: Checking delayed jobs...\n');
    const delayedCount = await queue.getDelayedCount();
    console.log(`   Delayed Jobs: ${delayedCount}\n`);

    if (delayedCount > 0) {
      console.log('✅ Jobs were delayed due to rate limit\n');
      
      // Get delayed jobs
      const delayedJobs = await queue.getDelayed(0, 10);
      console.log('Delayed Job Details:');
      for (const job of delayedJobs) {
        const delayMs = job.timestamp - Date.now();
        const delaySec = Math.ceil(delayMs / 1000);
        console.log(`   Job ${job.id}: Delayed by ${delaySec} seconds`);
      }
      console.log('');
    } else {
      console.log('⚠️  No delayed jobs found\n');
    }

    // STEP 6: Final queue stats
    console.log('STEP 6: Final Queue Statistics...\n');
    const [finalWaiting, finalActive, finalCompleted, finalFailed, finalDelayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    console.log(`   Waiting: ${finalWaiting}`);
    console.log(`   Active: ${finalActive}`);
    console.log(`   Completed: ${finalCompleted}`);
    console.log(`   Failed: ${finalFailed}`);
    console.log(`   Delayed: ${finalDelayed}\n`);

    console.log('✅ Rate limiter test complete\n');
    console.log('Expected Behavior:');
    console.log('- First 10 requests: Processed normally');
    console.log('- Requests 100-100: Allowed');
    console.log('- Requests 101+: Blocked and delayed');
    console.log('- Delayed jobs: Re-enqueued for next minute\n');

    console.log('Check backend logs for:');
    console.log('- "Rate limit check passed" (requests 1-100)');
    console.log('- "Rate limit exceeded" (requests 101+)');
    console.log('- "Refresh delayed - rate limit exceeded"\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    if (queue) await queue.close();
    if (redis) redis.disconnect();
    await mongoose.disconnect();
  }
}

testRateLimiter();
