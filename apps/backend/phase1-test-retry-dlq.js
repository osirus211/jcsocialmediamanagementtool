/**
 * Phase 1 Validation: Retry + DLQ Test
 * 
 * Simulates refresh failure and verifies retry behavior and DLQ handling
 */

require('dotenv').config();
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const mongoose = require('mongoose');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-scheduler';

async function testRetryAndDLQ() {
  let redis;
  let queue;
  let dlqQueue;

  try {
    console.log('🔧 Phase 1: Retry + DLQ Test');
    console.log('=============================\n');

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

    // Create queues
    queue = new Queue('token-refresh-queue', { connection: redis });
    dlqQueue = new Queue('token-refresh-dlq', { connection: redis });

    // Get test account
    const SocialAccount = mongoose.model('SocialAccount');
    const testAccount = await SocialAccount.findOne({
      accountName: { $regex: /^PHASE1_TEST_/ }
    }).sort({ createdAt: 1 });

    if (!testAccount) {
      console.error('❌ No test account found. Run phase1-seed-test-accounts.js first.');
      process.exit(1);
    }

    console.log('🎯 Test Account:');
    console.log(`   ID: ${testAccount._id}`);
    console.log(`   Name: ${testAccount.accountName}`);
    console.log(`   Provider: ${testAccount.provider}\n`);

    // NOTE: To simulate failure, we need to modify the worker temporarily
    // For this test, we'll check if the worker handles failures correctly
    console.log('⚠️  NOTE: This test requires the worker to be running');
    console.log('⚠️  To simulate failure, the worker mock refresh should throw an error\n');

    // Create a job that will fail (using invalid connectionId)
    const invalidConnectionId = new mongoose.Types.ObjectId().toString();
    
    console.log('📤 Enqueuing job with invalid connectionId (will fail)...');
    const job = await queue.add('refresh-token', {
      connectionId: invalidConnectionId,
      provider: 'twitter',
      expiresAt: new Date(Date.now() + 3600000),
      correlationId: `retry-test-${Date.now()}`,
    }, {
      jobId: `refresh-${invalidConnectionId}`,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s for faster testing
      },
    });

    console.log(`   Job ID: ${job.id}\n`);

    // Monitor job progress
    console.log('⏳ Monitoring job attempts (waiting 30 seconds)...\n');
    
    const startTime = Date.now();
    let lastAttempt = 0;
    
    const monitorInterval = setInterval(async () => {
      const currentJob = await queue.getJob(job.id);
      if (currentJob) {
        const state = await currentJob.getState();
        const attempts = currentJob.attemptsMade;
        
        if (attempts > lastAttempt) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`   [${elapsed}s] Attempt ${attempts}/3 - State: ${state}`);
          lastAttempt = attempts;
        }
      }
    }, 1000);

    await new Promise(resolve => setTimeout(resolve, 30000));
    clearInterval(monitorInterval);

    // Check final job state
    console.log('\n📊 Final Job State:');
    const finalJob = await queue.getJob(job.id);
    
    if (finalJob) {
      const state = await finalJob.getState();
      const attempts = finalJob.attemptsMade;
      const failedReason = finalJob.failedReason;
      
      console.log(`   State: ${state}`);
      console.log(`   Attempts: ${attempts}`);
      console.log(`   Failed Reason: ${failedReason || 'N/A'}`);
    } else {
      console.log('   ⚠️  Job not found (may have been removed)');
    }

    // Check DLQ
    console.log('\n🔍 Checking Dead Letter Queue...');
    const dlqJobs = await dlqQueue.getJobs(['waiting', 'completed', 'failed'], 0, 10);
    
    console.log(`   DLQ Jobs: ${dlqJobs.length}`);
    
    if (dlqJobs.length > 0) {
      const dlqJob = dlqJobs[0];
      console.log(`   Latest DLQ Job ID: ${dlqJob.id}`);
      console.log(`   Original Job ID: ${dlqJob.data.originalJobId}`);
      console.log(`   Connection ID: ${dlqJob.data.connectionId}`);
      console.log(`   Attempts: ${dlqJob.data.attempts}`);
      console.log(`   Error: ${dlqJob.data.error}`);
      console.log(`   Failed At: ${dlqJob.data.failedAt}`);
    }

    // Check Redis DLQ key
    const dlqKey = `oauth:refresh:dlq:${invalidConnectionId}`;
    const dlqData = await redis.get(dlqKey);
    
    if (dlqData) {
      console.log('\n✅ Redis DLQ key found:');
      const parsed = JSON.parse(dlqData);
      console.log(`   DLQ Job ID: ${parsed.dlqJobId}`);
      console.log(`   Failed At: ${parsed.failedAt}`);
      console.log(`   Error: ${parsed.error}`);
    } else {
      console.log('\n⚠️  Redis DLQ key not found');
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

    const [dlqWaiting, dlqCompleted, dlqFailed] = await Promise.all([
      dlqQueue.getWaitingCount(),
      dlqQueue.getCompletedCount(),
      dlqQueue.getFailedCount(),
    ]);

    console.log(`\n   DLQ Waiting: ${dlqWaiting}`);
    console.log(`   DLQ Completed: ${dlqCompleted}`);
    console.log(`   DLQ Failed: ${dlqFailed}`);

    console.log('\n✅ Test complete');
    console.log('\n📋 Expected Behavior:');
    console.log('   - Job should retry 3 times');
    console.log('   - Backoff delays: 2s, 10s, 50s (exponential)');
    console.log('   - After 3 failures, job moves to DLQ');
    console.log('   - DLQ job contains original data + error info');
    console.log('   - Redis DLQ key created with 7-day TTL');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    if (queue) await queue.close();
    if (dlqQueue) await dlqQueue.close();
    if (redis) redis.disconnect();
    await mongoose.disconnect();
  }
}

testRetryAndDLQ();
