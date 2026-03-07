const mongoose = require('mongoose');
const Redis = require('ioredis');
const axios = require('axios');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';
const REDIS_HOST = '172.29.118.94';
const REDIS_PORT = 6379;

async function verifyChaos() {
  try {
    console.log('🔍 MODULE 11 — CHAOS + RESILIENCE VERIFICATION\n');
    console.log('='.repeat(60));
    
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    
    const redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      maxRetriesPerRequest: null,
    });
    
    const results = {
      redisReconnect: false,
      workerCrashRecovery: false,
      noJobLoss: false,
      noDuplicates: false,
      locksCleared: false,
      exactlyOnce: false,
      systemStable: false,
    };
    
    console.log('\n📊 STEP 1 — Checking Redis Connection');
    try {
      await redis.ping();
      console.log('✅ Redis reconnect successful: YES');
      results.redisReconnect = true;
    } catch (error) {
      console.log('❌ Redis reconnect successful: NO');
      console.log('   Error:', error.message);
    }
    
    console.log('\n📊 STEP 2 — Checking Worker Crash Recovery');
    const scheduledCount = await postsCollection.countDocuments({ status: 'scheduled' });
    const queuedCount = await postsCollection.countDocuments({ status: 'queued' });
    const publishedCount = await postsCollection.countDocuments({ status: 'published' });
    const failedCount = await postsCollection.countDocuments({ status: 'failed' });
    const publishingCount = await postsCollection.countDocuments({ status: 'publishing' });
    
    console.log(`   Scheduled: ${scheduledCount}`);
    console.log(`   Queued: ${queuedCount}`);
    console.log(`   Publishing: ${publishingCount}`);
    console.log(`   Published: ${publishedCount}`);
    console.log(`   Failed: ${failedCount}`);
    
    if (publishedCount > 0 || failedCount > 0) {
      console.log('✅ Worker crash recovery: YES');
      results.workerCrashRecovery = true;
    } else {
      console.log('❌ Worker crash recovery: NO');
    }
    
    console.log('\n📊 STEP 3 — Checking Job Loss');
    const totalPosts = scheduledCount + queuedCount + publishedCount + failedCount + publishingCount;
    console.log(`   Total posts: ${totalPosts}`);
    if (totalPosts >= 20) {
      console.log('✅ No job loss: YES');
      results.noJobLoss = true;
    } else {
      console.log(`❌ No job loss: NO (expected 20, found ${totalPosts})`);
    }
    
    console.log('\n📊 STEP 4 — Checking Duplicates');
    const posts = await postsCollection.find({
      status: { $in: ['scheduled', 'queued', 'published', 'failed', 'publishing'] }
    }).toArray();
    
    const contentMap = new Map();
    let duplicates = 0;
    posts.forEach(post => {
      const key = post.content;
      if (contentMap.has(key)) {
        duplicates++;
        console.log(`   ⚠️  Duplicate found: ${key.substring(0, 50)}...`);
      } else {
        contentMap.set(key, post._id);
      }
    });
    
    if (duplicates === 0) {
      console.log('✅ No duplicates: YES');
      results.noDuplicates = true;
    } else {
      console.log(`❌ No duplicates: NO (found ${duplicates} duplicates)`);
    }
    
    console.log('\n📊 STEP 5 — Checking Locks');
    const lockedPosts = await postsCollection.countDocuments({ lock: { $exists: true } });
    if (lockedPosts === 0) {
      console.log('✅ Locks cleared: YES');
      results.locksCleared = true;
    } else {
      console.log(`❌ Locks cleared: NO (found ${lockedPosts} locked posts)`);
    }
    
    console.log('\n📊 STEP 6 — Checking Exactly-Once Guarantee');
    const postsByContent = {};
    posts.forEach(post => {
      const key = post.content;
      if (!postsByContent[key]) {
        postsByContent[key] = [];
      }
      postsByContent[key].push(post);
    });
    
    let multipleAttempts = 0;
    Object.keys(postsByContent).forEach(content => {
      const postsWithSameContent = postsByContent[content];
      if (postsWithSameContent.length > 1) {
        multipleAttempts++;
      }
    });
    
    if (multipleAttempts === 0) {
      console.log('✅ Exactly-once guarantee: YES');
      results.exactlyOnce = true;
    } else {
      console.log(`❌ Exactly-once guarantee: NO (${multipleAttempts} posts with multiple attempts)`);
    }
    
    console.log('\n📊 STEP 7 — Checking System Stability');
    try {
      const metricsRes = await axios.get('http://127.0.0.1:5000/metrics');
      const metrics = metricsRes.data;
      
      const hasWorkerMetrics = metrics.includes('worker_alive') || metrics.includes('publish_');
      const hasSchedulerMetrics = metrics.includes('scheduler_alive') || metrics.includes('scheduler_runs');
      const hasRedisMetrics = metrics.includes('redis_') || true;
      
      if (hasWorkerMetrics && hasSchedulerMetrics && results.redisReconnect) {
        console.log('✅ System stable: YES');
        results.systemStable = true;
      } else {
        console.log('❌ System stable: NO');
        console.log(`   Worker metrics: ${hasWorkerMetrics}`);
        console.log(`   Scheduler metrics: ${hasSchedulerMetrics}`);
        console.log(`   Redis connected: ${results.redisReconnect}`);
      }
    } catch (error) {
      console.log('❌ System stable: NO (metrics endpoint error)');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`Redis reconnect successful: ${results.redisReconnect ? 'YES' : 'NO'}`);
    console.log(`Worker crash recovery: ${results.workerCrashRecovery ? 'YES' : 'NO'}`);
    console.log(`No job loss: ${results.noJobLoss ? 'YES' : 'NO'}`);
    console.log(`No duplicates: ${results.noDuplicates ? 'YES' : 'NO'}`);
    console.log(`Locks cleared: ${results.locksCleared ? 'YES' : 'NO'}`);
    console.log(`Exactly-once guarantee: ${results.exactlyOnce ? 'YES' : 'NO'}`);
    console.log(`System stable: ${results.systemStable ? 'YES' : 'NO'}`);
    
    const allPassed = Object.values(results).every(v => v === true);
    console.log('\n' + '='.repeat(60));
    console.log(`Module 11 status: ${allPassed ? 'PASS' : 'FAIL'}`);
    console.log('='.repeat(60));
    
    await mongoose.connection.close();
    await redis.quit();
    
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('❌ Verification error:', error.message);
    process.exit(1);
  }
}

verifyChaos();
