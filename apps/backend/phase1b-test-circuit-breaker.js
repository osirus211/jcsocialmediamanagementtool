/**
 * Phase 1B: Circuit Breaker Validation
 * 
 * Tests circuit breaker state transitions
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

async function testCircuitBreaker() {
  let redis;
  let queue;

  try {
    console.log('🔧 Phase 1B: Circuit Breaker Test');
    console.log('===================================\n');

    // Connect
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    await mongoose.connect(MONGODB_URI);
    queue = new Queue('token-refresh-queue', { connection: redis });

    // Get test account
    const SocialAccount = mongoose.model('SocialAccount');
    const testAccount = await SocialAccount.findOne({
      accountName: { $regex: /^PHASE1_TEST_/ }
    });

    if (!testAccount) {
      console.error('❌ No test account found');
      process.exit(1);
    }

    const provider = testAccount.provider;
    const connectionId = testAccount._id.toString();

    console.log(`🎯 Test Provider: ${provider}`);
    console.log(`   Connection ID: ${connectionId}\n`);

    // Clear existing circuit state
    const circuitKey = `oauth:circuit:${provider}`;
    await redis.del(circuitKey);
    console.log('🗑️  Cleared existing circuit state\n');

    // STEP 1: Trigger 6 failures
    console.log('STEP 1: Triggering 6 consecutive failures...\n');

    for (let i = 1; i <= 6; i++) {
      console.log(`Attempt ${i}:`);
      
      // Enqueue job (worker should fail due to mock error)
      await queue.add('refresh-token', {
        connectionId,
        provider,
        expiresAt: new Date(Date.now() + 3600000),
        correlationId: `circuit-test-${i}`,
      }, {
        jobId: `circuit-test-${provider}-${i}`,
      });

      // Wait for processing
      await sleep(2000);

      // Check circuit state
      const circuitData = await redis.get(circuitKey);
      if (circuitData) {
        const state = JSON.parse(circuitData);
        console.log(`   Circuit State: ${state.state}`);
        console.log(`   Failure Count: ${state.failureCount}`);
        
        if (state.state === 'OPEN') {
          console.log(`   ✅ Circuit OPENED after ${i} failures`);
          console.log(`   Next Attempt At: ${new Date(state.nextAttemptAt).toISOString()}\n`);
          break;
        }
      } else {
        console.log(`   Circuit State: CLOSED (no state yet)`);
      }
      console.log('');
    }

    // STEP 2: Verify circuit blocks requests
    console.log('STEP 2: Verifying circuit blocks requests...\n');

    const circuitData = await redis.get(circuitKey);
    if (circuitData) {
      const state = JSON.parse(circuitData);
      
      if (state.state === 'OPEN') {
        console.log('✅ Circuit is OPEN');
        console.log(`   Cooldown until: ${new Date(state.nextAttemptAt).toISOString()}`);
        
        const cooldownSeconds = Math.ceil((state.nextAttemptAt - Date.now()) / 1000);
        console.log(`   Cooldown remaining: ${cooldownSeconds} seconds\n`);

        // Try to enqueue another job
        console.log('Attempting refresh while circuit is OPEN...');
        await queue.add('refresh-token', {
          connectionId,
          provider,
          expiresAt: new Date(Date.now() + 3600000),
          correlationId: 'circuit-test-blocked',
        }, {
          jobId: `circuit-test-${provider}-blocked`,
        });

        await sleep(2000);
        console.log('✅ Job enqueued (worker should block and re-enqueue)\n');
      } else {
        console.log('⚠️  Circuit did not open\n');
      }
    } else {
      console.log('❌ No circuit state found\n');
    }

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

    // STEP 4: Final circuit state
    console.log('STEP 4: Final Circuit State...\n');
    const finalCircuitData = await redis.get(circuitKey);
    if (finalCircuitData) {
      const state = JSON.parse(finalCircuitData);
      console.log(JSON.stringify(state, null, 2));
    } else {
      console.log('No circuit state');
    }

    console.log('\n✅ Circuit breaker test complete');
    console.log('\nNext: Wait 60 seconds and test HALF_OPEN transition');
    console.log('Run: node phase1b-test-circuit-recovery.js\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    if (queue) await queue.close();
    if (redis) redis.disconnect();
    await mongoose.disconnect();
  }
}

testCircuitBreaker();
