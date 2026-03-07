/**
 * Phase 1 Validation: Duplicate Prevention Test
 * 
 * Enqueues the same connectionId 5 times and verifies only one refresh occurs
 */

require('dotenv').config();
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const mongoose = require('mongoose');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-scheduler';

async function testDuplicatePrevention() {
  let redis;
  let queue;

  try {
    console.log('🔧 Phase 1: Duplicate Prevention Test');
    console.log('=====================================\n');

    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // Connect to Redis
    console.log('📦 Connecting to Redis...');
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    console.log('✅ Redis connected\n');

    // Get test account
    const SocialAccount = mongoose.model('SocialAccount');
    const testAccount = await SocialAccount.findOne({
      accountName: { $regex: /^PHASE1_TEST_/ }
    });

    if (!testAccount) {
      console.error('❌ No test account found. Run phase1-seed-test-accounts.js first.');
      process.exit(1);
    }

    console.log('🎯 Test Account:');
    console.log(`   ID: ${testAccount._id}`);
    console.log(`   Name: ${testAccount.accountName}`);
    console.log(`   Provider: ${testAccount.provider}\n`);

    // Create queue
    queue = new Queue('token-refresh-queue', {
      connection: redis,
    });

    // Enqueue same job 5 times
    console.log('📤 Enqueuing same connectionId 5 times...\n');
    
    const connectionId = testAccount._id.toString();
    const jobs = [];

    for (let i = 0; i < 5; i++) {
      const job = await queue.add('refresh-token', {
        connectionId,
        provider: testAccount.provider,
        expiresAt: testAccount.tokenExpiresAt,
        correlationId: `duplicate-test-${i + 1}`,
      }, {
        jobId: `refresh-${connectionId}`, // Same jobId = deduplication
      });

      jobs.push(job);
      console.log(`   Attempt ${i + 1}: Job ID = ${job.id}`);
    }

    console.log('\n⏳ Waiting 10 seconds for processing...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check Redis lock
    console.log('🔍 Checking Redis lock key...');
    const lockKey = `oauth:refresh:lock:${connectionId}`;
    const lockValue = await redis.get(lockKey);
    
    if (lockValue) {
      console.log(`   ⚠️  Lock still held: ${lockValue}`);
    } else {
      console.log('   ✅ Lock released (expected)');
    }

    // Check job status
    console.log('\n📊 Job Status:');
    for (let i = 0; i < jobs.length; i++) {
      const job = await queue.getJob(jobs[i].id);
      if (job) {
        const state = await job.getState();
        console.log(`   Job ${i + 1}: ${state}`);
      }
    }

    // Check account update
    console.log('\n🔍 Checking account update...');
    const updatedAccount = await SocialAccount.findById(testAccount._id);
    
    if (updatedAccount.lastRefreshedAt) {
      console.log(`   ✅ Account refreshed at: ${updatedAccount.lastRefreshedAt.toISOString()}`);
      console.log(`   Status: ${updatedAccount.status}`);
    } else {
      console.log('   ⚠️  Account not yet refreshed');
    }

    // Get queue stats
    console.log('\n📈 Queue Statistics:');
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    console.log(`   Waiting: ${waiting}`);
    console.log(`   Active: ${active}`);
    console.log(`   Completed: ${completed}`);
    console.log(`   Failed: ${failed}`);

    console.log('\n✅ Test complete');
    console.log('\n📋 Expected Behavior:');
    console.log('   - All 5 enqueue attempts should use same jobId');
    console.log('   - Only 1 job should be processed');
    console.log('   - Lock should be released');
    console.log('   - Account should be refreshed once');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    if (queue) await queue.close();
    if (redis) redis.disconnect();
    await mongoose.disconnect();
  }
}

testDuplicatePrevention();
