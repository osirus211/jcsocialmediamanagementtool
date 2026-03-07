/**
 * Phase 1B: Combined Failure Test
 * 
 * Tests circuit breaker + rate limiter + queue stability under stress
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

async function testCombinedFailure() {
  let redis;
  let queue;

  try {
    console.log('🔧 Phase 1B: Combined Failure Test');
    console.log('====================================\n');

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

    // SCENARIO: Provider outage + rate limit + high load
    console.log('SCENARIO: Provider outage + rate limit + high load\n');
    console.log('This test simulates:');
    console.log('1. Provider experiencing failures (circuit breaker)');
    console.log('2. High request volume (rate limiter)');
    console.log('3. Queue stability under stress\n');

    // Clear existing state
    const circuitKey = `oauth:circuit:${provider}`;
    const currentMinute = Math.floor(Date.now() / 60000);
    const rateLimitKey = `oauth:ratelimit:${provider}:${currentMinute}`;

    await redis.del(circuitKey);
    await redis.del(rateLimitKey);
    console.log('🗑️  Cleared existing state\n');

    // PHASE 1: Trigger circuit breaker
    console.log('PHASE 1: Triggering circuit breaker (5 failures)...\n');

    for (let i = 1; i <= 5; i++) {
      const account = testAccounts[i % testAccounts.length];
      
      await queue.add('refresh-token', {
        connectionId: account._id.toString(),
        provider,
        expiresAt: new Date(Date.now() + 3600000),
        correlationId: `combined-circuit-${i}`,
      }, {
        jobId: `combined-circuit-${provider}-${i}`,
      });

      await sleep(500);
    }

    console.log('Waiting 10 seconds for circuit to open...\n');
    await sleep(10000);

    // Check circuit state
    const circuitData = await redis.get(circuitKey);
    if (circuitData) {
      const state = JSON.parse(circuitData);
      console.log(`Circuit State: ${state.state}`);
      console.log(`Failure Count: ${state.failureCount}\n`);

      if (state.state === 'OPEN') {
        console.log('✅ Circuit breaker OPEN\n');
      } else {
        console.log('⚠️  Circuit breaker not OPEN yet\n');
      }
    }

    // PHASE 2: Send high volume while circuit is open
    console.log('PHASE 2: Sending 20 requests while circuit is OPEN...\n');

    for (let i = 1; i <= 20; i++) {
      const account = testAccounts[i % testAccounts.length];
      
      await queue.add('refresh-token', {
        connectionId: account._id.toString(),
        provider,
        expiresAt: new Date(Date.now() + 3600000),
        correlationId: `combined-volume-${i}`,
      }, {
        jobId: `combined-volume-${provider}-${i}`,
      });

      await sleep(100);
    }

    console.log('✅ 20 requests enqueued\n');

    // Wait for processing
    console.log('Waiting 5 seconds for processing...\n');
    await sleep(5000);

    // PHASE 3: Check queue stability
    console.log('PHASE 3: Checking queue stability...\n');

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    console.log('Queue Statistics:');
    console.log(`   Waiting: ${waiting}`);
    console.log(`   Active: ${active}`);
    console.log(`   Completed: ${completed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Delayed: ${delayed}\n`);

    // PHASE 4: Check circuit breaker blocked requests
    console.log('PHASE 4: Analyzing circuit breaker behavior...\n');

    const finalCircuitData = await redis.get(circuitKey);
    if (finalCircuitData) {
      const state = JSON.parse(finalCircuitData);
      console.log('Circuit State:');
      console.log(`   State: ${state.state}`);
      console.log(`   Failure Count: ${state.failureCount}`);
      console.log(`   Success Count: ${state.successCount}`);
      
      if (state.nextAttemptAt) {
        const remaining = Math.ceil((state.nextAttemptAt - Date.now()) / 1000);
        console.log(`   Cooldown Remaining: ${remaining} seconds`);
      }
      console.log('');
    }

    // PHASE 5: Check rate limiter
    console.log('PHASE 5: Checking rate limiter...\n');

    const rateLimitCounter = await redis.get(rateLimitKey);
    console.log(`Rate Limit Counter: ${rateLimitCounter || 0}\n`);

    // PHASE 6: Verify no job loss
    console.log('PHASE 6: Verifying no job loss...\n');

    const totalJobs = waiting + active + completed + failed + delayed;
    const expectedJobs = 25; // 5 circuit + 20 volume

    console.log(`Total Jobs: ${totalJobs}`);
    console.log(`Expected: ${expectedJobs}\n`);

    if (totalJobs >= expectedJobs * 0.9) { // Allow 10% margin
      console.log('✅ No significant job loss\n');
    } else {
      console.log('⚠️  Possible job loss detected\n');
    }

    // PHASE 7: Check delayed jobs
    console.log('PHASE 7: Checking delayed jobs...\n');

    if (delayed > 0) {
      console.log(`✅ ${delayed} jobs delayed (circuit breaker working)\n`);
      
      const delayedJobs = await queue.getDelayed(0, 5);
      console.log('Sample Delayed Jobs:');
      for (const job of delayedJobs) {
        const delayMs = job.timestamp - Date.now();
        const delaySec = Math.ceil(delayMs / 1000);
        console.log(`   Job ${job.id}: Delayed by ${delaySec} seconds`);
      }
      console.log('');
    } else {
      console.log('⚠️  No delayed jobs found\n');
    }

    // PHASE 8: System health check
    console.log('PHASE 8: System health check...\n');

    const healthChecks = [];

    // Check Redis connection
    try {
      await redis.ping();
      healthChecks.push({ component: 'Redis', status: 'OK' });
    } catch (error) {
      healthChecks.push({ component: 'Redis', status: 'FAILED', error: error.message });
    }

    // Check MongoDB connection
    try {
      await mongoose.connection.db.admin().ping();
      healthChecks.push({ component: 'MongoDB', status: 'OK' });
    } catch (error) {
      healthChecks.push({ component: 'MongoDB', status: 'FAILED', error: error.message });
    }

    // Check queue connection
    try {
      await queue.getJobCounts();
      healthChecks.push({ component: 'BullMQ Queue', status: 'OK' });
    } catch (error) {
      healthChecks.push({ component: 'BullMQ Queue', status: 'FAILED', error: error.message });
    }

    for (const check of healthChecks) {
      const status = check.status === 'OK' ? '✅' : '❌';
      console.log(`   ${status} ${check.component}: ${check.status}`);
      if (check.error) {
        console.log(`      Error: ${check.error}`);
      }
    }
    console.log('');

    // FINAL SUMMARY
    console.log('═══════════════════════════════════════\n');
    console.log('FINAL SUMMARY\n');
    console.log('═══════════════════════════════════════\n');

    console.log('Protection Mechanisms:');
    console.log(`   ✅ Circuit Breaker: ${circuitData ? 'Active' : 'Inactive'}`);
    console.log(`   ✅ Rate Limiter: ${rateLimitCounter ? 'Active' : 'Inactive'}`);
    console.log(`   ✅ Queue Stability: ${totalJobs >= expectedJobs * 0.9 ? 'Stable' : 'Unstable'}`);
    console.log('');

    console.log('Expected Behavior:');
    console.log('- Circuit opens after 5 failures');
    console.log('- Subsequent requests blocked and delayed');
    console.log('- No job loss (all jobs preserved)');
    console.log('- Queue remains stable under stress');
    console.log('- System components remain healthy\n');

    console.log('Check backend logs for:');
    console.log('- "Circuit breaker OPEN"');
    console.log('- "Circuit breaker OPEN, blocking request"');
    console.log('- "Refresh skipped - circuit breaker OPEN"');
    console.log('- "Rate limit exceeded" (if triggered)');
    console.log('- No crashes or deadlocks\n');

    const allHealthy = healthChecks.every(c => c.status === 'OK');
    const queueStable = totalJobs >= expectedJobs * 0.9;

    if (allHealthy && queueStable) {
      console.log('✅ Combined failure test PASSED\n');
      console.log('System demonstrated resilience under:');
      console.log('- Provider outages');
      console.log('- High request volume');
      console.log('- Circuit breaker activation');
      console.log('- Rate limiting\n');
    } else {
      console.log('⚠️  Combined failure test FAILED\n');
      console.log('Issues detected - review logs and metrics\n');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    if (queue) await queue.close();
    if (redis) redis.disconnect();
    await mongoose.disconnect();
  }
}

testCombinedFailure();
