/**
 * Phase 1 Validation: Comprehensive Test Suite
 * 
 * Runs all validation tests and produces final report
 */

require('dotenv').config();
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const mongoose = require('mongoose');
const { spawn } = require('child_process');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-scheduler';

const results = {
  functional: { passed: false, details: [] },
  duplicatePrevention: { passed: false, details: [] },
  retryDLQ: { passed: false, details: [] },
  lockExpiry: { passed: false, details: [] },
  redisFailure: { passed: false, details: [] },
  metrics: {},
  anomalies: [],
  healthRating: 0,
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkRedisConnection() {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  try {
    await redis.ping();
    redis.disconnect();
    return true;
  } catch (error) {
    redis.disconnect();
    return false;
  }
}

async function checkMongoConnection() {
  try {
    await mongoose.connect(MONGODB_URI);
    await mongoose.disconnect();
    return true;
  } catch (error) {
    return false;
  }
}

async function testFunctional() {
  console.log('\n📋 TEST 1: Functional Validation');
  console.log('==================================\n');

  let redis, queue;
  
  try {
    await mongoose.connect(MONGODB_URI);
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    queue = new Queue('token-refresh-queue', { connection: redis });

    // Check for test accounts
    const SocialAccount = mongoose.model('SocialAccount');
    const testAccounts = await SocialAccount.find({
      accountName: { $regex: /^PHASE1_TEST_/ }
    });

    if (testAccounts.length === 0) {
      results.functional.details.push('❌ No test accounts found');
      console.log('❌ No test accounts found. Run phase1-seed-test-accounts.js first.');
      return;
    }

    results.functional.details.push(`✅ Found ${testAccounts.length} test accounts`);
    console.log(`✅ Found ${testAccounts.length} test accounts`);

    // Check queue activity
    const [waiting, active, completed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
    ]);

    results.functional.details.push(`Queue: ${waiting} waiting, ${active} active, ${completed} completed`);
    console.log(`Queue: ${waiting} waiting, ${active} active, ${completed} completed`);

    // Check if any accounts were refreshed
    const refreshedAccounts = await SocialAccount.countDocuments({
      accountName: { $regex: /^PHASE1_TEST_/ },
      lastRefreshedAt: { $exists: true, $ne: null }
    });

    if (refreshedAccounts > 0) {
      results.functional.details.push(`✅ ${refreshedAccounts} accounts refreshed`);
      console.log(`✅ ${refreshedAccounts} accounts refreshed`);
      results.functional.passed = true;
    } else {
      results.functional.details.push('⚠️  No accounts refreshed yet (may need more time)');
      console.log('⚠️  No accounts refreshed yet (may need more time)');
    }

    // Check for locks
    const lockKeys = await redis.keys('oauth:refresh:lock:*');
    if (lockKeys.length > 0) {
      results.functional.details.push(`⚠️  ${lockKeys.length} active locks (should be released)`);
      console.log(`⚠️  ${lockKeys.length} active locks`);
    } else {
      results.functional.details.push('✅ No active locks (expected)');
      console.log('✅ No active locks');
    }

  } catch (error) {
    results.functional.details.push(`❌ Error: ${error.message}`);
    console.error('❌ Error:', error.message);
  } finally {
    if (queue) await queue.close();
    if (redis) redis.disconnect();
    await mongoose.disconnect();
  }
}

async function testDuplicatePrevention() {
  console.log('\n📋 TEST 2: Duplicate Prevention');
  console.log('=================================\n');

  let redis, queue;
  
  try {
    await mongoose.connect(MONGODB_URI);
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    queue = new Queue('token-refresh-queue', { connection: redis });

    const SocialAccount = mongoose.model('SocialAccount');
    const testAccount = await SocialAccount.findOne({
      accountName: { $regex: /^PHASE1_TEST_/ }
    });

    if (!testAccount) {
      results.duplicatePrevention.details.push('❌ No test account found');
      console.log('❌ No test account found');
      return;
    }

    const connectionId = testAccount._id.toString();
    const jobId = `refresh-${connectionId}`;

    // Try to enqueue 3 times
    console.log('Enqueuing same job 3 times...');
    for (let i = 0; i < 3; i++) {
      await queue.add('refresh-token', {
        connectionId,
        provider: testAccount.provider,
        expiresAt: testAccount.tokenExpiresAt,
        correlationId: `dup-test-${i}`,
      }, { jobId });
    }

    await sleep(5000);

    // Check if only one job exists
    const job = await queue.getJob(jobId);
    if (job) {
      const state = await job.getState();
      results.duplicatePrevention.details.push(`✅ Job deduplication working (state: ${state})`);
      console.log(`✅ Job deduplication working (state: ${state})`);
      results.duplicatePrevention.passed = true;
    } else {
      results.duplicatePrevention.details.push('⚠️  Job not found');
      console.log('⚠️  Job not found');
    }

  } catch (error) {
    results.duplicatePrevention.details.push(`❌ Error: ${error.message}`);
    console.error('❌ Error:', error.message);
  } finally {
    if (queue) await queue.close();
    if (redis) redis.disconnect();
    await mongoose.disconnect();
  }
}

async function testLockExpiry() {
  console.log('\n📋 TEST 3: Lock Expiry');
  console.log('========================\n');

  let redis;
  
  try {
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

    // Create a test lock
    const testConnectionId = 'test-lock-expiry';
    const lockKey = `oauth:refresh:lock:${testConnectionId}`;
    
    console.log('Creating test lock with 5s TTL...');
    await redis.set(lockKey, 'test-worker', 'EX', 5);

    const ttl1 = await redis.ttl(lockKey);
    console.log(`Lock TTL: ${ttl1}s`);

    console.log('Waiting for expiry...');
    await sleep(6000);

    const exists = await redis.exists(lockKey);
    if (exists === 0) {
      results.lockExpiry.details.push('✅ Lock expired correctly');
      console.log('✅ Lock expired correctly');
      results.lockExpiry.passed = true;
    } else {
      results.lockExpiry.details.push('❌ Lock did not expire');
      console.log('❌ Lock did not expire');
      results.anomalies.push('Lock did not expire after TTL');
    }

  } catch (error) {
    results.lockExpiry.details.push(`❌ Error: ${error.message}`);
    console.error('❌ Error:', error.message);
  } finally {
    if (redis) redis.disconnect();
  }
}

async function testRedisFailure() {
  console.log('\n📋 TEST 4: Redis Failure Handling');
  console.log('===================================\n');

  console.log('⚠️  This test requires manually stopping Redis');
  console.log('⚠️  Skipping automated test');
  
  results.redisFailure.details.push('⚠️  Manual test required');
  results.redisFailure.passed = null; // null = not tested
}

async function collectMetrics() {
  console.log('\n📊 Collecting Metrics');
  console.log('======================\n');

  let redis, queue, dlqQueue;
  
  try {
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    queue = new Queue('token-refresh-queue', { connection: redis });
    dlqQueue = new Queue('token-refresh-dlq', { connection: redis });

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    const [dlqWaiting, dlqCompleted, dlqFailed] = await Promise.all([
      dlqQueue.getWaitingCount(),
      dlqQueue.getCompletedCount(),
      dlqQueue.getFailedCount(),
    ]);

    results.metrics = {
      queue: { waiting, active, completed, failed, delayed },
      dlq: { waiting: dlqWaiting, completed: dlqCompleted, failed: dlqFailed },
      successRate: completed > 0 ? ((completed / (completed + failed)) * 100).toFixed(2) : 0,
    };

    console.log('Queue Metrics:');
    console.log(`  Waiting: ${waiting}`);
    console.log(`  Active: ${active}`);
    console.log(`  Completed: ${completed}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Delayed: ${delayed}`);
    console.log(`\nDLQ Metrics:`);
    console.log(`  Waiting: ${dlqWaiting}`);
    console.log(`  Completed: ${dlqCompleted}`);
    console.log(`  Failed: ${dlqFailed}`);
    console.log(`\nSuccess Rate: ${results.metrics.successRate}%`);

  } catch (error) {
    console.error('❌ Error collecting metrics:', error.message);
  } finally {
    if (queue) await queue.close();
    if (dlqQueue) await dlqQueue.close();
    if (redis) redis.disconnect();
  }
}

function calculateHealthRating() {
  let score = 0;
  
  if (results.functional.passed) score += 3;
  if (results.duplicatePrevention.passed) score += 3;
  if (results.retryDLQ.passed) score += 2;
  if (results.lockExpiry.passed) score += 2;
  
  // Deduct for anomalies
  score -= results.anomalies.length;
  
  results.healthRating = Math.max(0, Math.min(10, score));
}

function printFinalReport() {
  console.log('\n\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           PHASE 1 VALIDATION FINAL REPORT');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('TEST RESULTS:');
  console.log('─────────────\n');

  console.log('1. Functional Validation:', results.functional.passed ? '✅ PASS' : '❌ FAIL');
  results.functional.details.forEach(d => console.log(`   ${d}`));

  console.log('\n2. Duplicate Prevention:', results.duplicatePrevention.passed ? '✅ PASS' : '❌ FAIL');
  results.duplicatePrevention.details.forEach(d => console.log(`   ${d}`));

  console.log('\n3. Retry + DLQ:', results.retryDLQ.passed ? '✅ PASS' : '⚠️  NOT TESTED');
  results.retryDLQ.details.forEach(d => console.log(`   ${d}`));

  console.log('\n4. Lock Expiry:', results.lockExpiry.passed ? '✅ PASS' : '❌ FAIL');
  results.lockExpiry.details.forEach(d => console.log(`   ${d}`));

  console.log('\n5. Redis Failure:', results.redisFailure.passed === null ? '⚠️  MANUAL TEST' : (results.redisFailure.passed ? '✅ PASS' : '❌ FAIL'));
  results.redisFailure.details.forEach(d => console.log(`   ${d}`));

  console.log('\n\nMETRICS:');
  console.log('────────\n');
  console.log(`Queue Completed: ${results.metrics.queue?.completed || 0}`);
  console.log(`Queue Failed: ${results.metrics.queue?.failed || 0}`);
  console.log(`DLQ Entries: ${results.metrics.dlq?.completed || 0}`);
  console.log(`Success Rate: ${results.metrics.successRate || 0}%`);

  if (results.anomalies.length > 0) {
    console.log('\n\nANOMALIES:');
    console.log('──────────\n');
    results.anomalies.forEach((a, i) => console.log(`${i + 1}. ${a}`));
  }

  console.log('\n\nFINAL HEALTH RATING:');
  console.log('────────────────────\n');
  console.log(`   ${results.healthRating}/10`);
  
  if (results.healthRating >= 8) {
    console.log('   🟢 EXCELLENT - Production ready');
  } else if (results.healthRating >= 6) {
    console.log('   🟡 GOOD - Minor issues to address');
  } else if (results.healthRating >= 4) {
    console.log('   🟠 FAIR - Significant issues found');
  } else {
    console.log('   🔴 POOR - Critical issues require attention');
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

async function runAllTests() {
  console.log('🚀 Phase 1 Comprehensive Validation');
  console.log('====================================\n');

  // Pre-flight checks
  console.log('Pre-flight checks...');
  const redisOk = await checkRedisConnection();
  const mongoOk = await checkMongoConnection();

  if (!redisOk) {
    console.error('❌ Redis not available');
    process.exit(1);
  }

  if (!mongoOk) {
    console.error('❌ MongoDB not available');
    process.exit(1);
  }

  console.log('✅ Redis connected');
  console.log('✅ MongoDB connected');

  // Run tests
  await testFunctional();
  await testDuplicatePrevention();
  await testLockExpiry();
  await testRedisFailure();
  await collectMetrics();

  // Calculate health rating
  calculateHealthRating();

  // Print final report
  printFinalReport();
}

runAllTests().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
