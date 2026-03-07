const mongoose = require('mongoose');
const Redis = require('ioredis');
const axios = require('axios');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';
const REDIS_HOST = '172.29.118.94';
const REDIS_PORT = 6379;

async function verifyRecovery() {
  try {
    console.log('🔍 MODULE 10 — CRASH RECOVERY VERIFICATION\n');
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
      jobsRecovered: false,
      noJobLoss: false,
      noDuplicates: false,
      locksCleared: false,
      workerRecovered: false,
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
    
    console.log('\n📊 STEP 2 — Checking Job Recovery');
    const scheduledCount = await postsCollection.countDocuments({ status: 'scheduled' });
    const queuedCount = await postsCollection.countDocuments({ status: 'queued' });
    const publishedCount = await postsCollection.countDocuments({ status: 'published' });
    const failedCount = await postsCollection.countDocuments({ status: 'failed' });
    
    console.log(`   Scheduled: ${scheduledCount}`);
    console.log(`   Queued: ${queuedCount}`);
    console.log(`   Published: ${publishedCount}`);
    console.log(`   Failed: ${failedCount}`);
    
    if (queuedCount > 0 || publishedCount > 0) {
      console.log('✅ Jobs recovered: YES');
      results.jobsRecovered = true;
    } else {
      console.log('❌ Jobs recovered: NO');
    }
    
    console.log('\n📊 STEP 3 — Checking Job Loss');
    const totalPosts = scheduledCount + queuedCount + publishedCount + failedCount;
    console.log(`   Total posts: ${totalPosts}`);
    if (totalPosts >= 10) {
      console.log('✅ No job loss: YES');
      results.noJobLoss = true;
    } else {
      console.log(`❌ No job loss: NO (expected 10, found ${totalPosts})`);
    }
    
    console.log('\n📊 STEP 4 — Checking Duplicates');
    const posts = await postsCollection.find({
      status: { $in: ['scheduled', 'queued', 'published'] }
    }).toArray();
    
    const contentMap = new Map();
    let duplicates = 0;
    posts.forEach(post => {
      const key = post.content;
      if (contentMap.has(key)) {
        duplicates++;
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
    
    console.log('\n📊 STEP 6 — Checking Worker Status');
    try {
      const metricsRes = await axios.get('http://127.0.0.1:5000/metrics');
      const metrics = metricsRes.data;
      
      const hasWorkerMetrics = metrics.includes('worker_alive') || metrics.includes('publish_');
      const hasSchedulerMetrics = metrics.includes('scheduler_alive') || metrics.includes('scheduler_runs');
      
      if (hasWorkerMetrics && hasSchedulerMetrics) {
        console.log('✅ Worker recovered: YES');
        results.workerRecovered = true;
      } else {
        console.log('❌ Worker recovered: NO');
        console.log(`   Worker metrics: ${hasWorkerMetrics}`);
        console.log(`   Scheduler metrics: ${hasSchedulerMetrics}`);
      }
    } catch (error) {
      console.log('❌ Worker recovered: NO (metrics endpoint error)');
    }
    
    console.log('\n📊 STEP 7 — System Stability Check');
    const queueKeys = await redis.keys('bull:posting-queue:*');
    const hasQueue = queueKeys.length > 0;
    const hasProcessedJobs = queuedCount > 0 || publishedCount > 0;
    
    if (hasQueue && hasProcessedJobs && results.redisReconnect) {
      console.log('✅ System stable: YES');
      results.systemStable = true;
    } else {
      console.log('❌ System stable: NO');
      console.log(`   Queue active: ${hasQueue}`);
      console.log(`   Jobs processed: ${hasProcessedJobs}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`Redis reconnect successful: ${results.redisReconnect ? 'YES' : 'NO'}`);
    console.log(`Jobs recovered: ${results.jobsRecovered ? 'YES' : 'NO'}`);
    console.log(`No job loss: ${results.noJobLoss ? 'YES' : 'NO'}`);
    console.log(`No duplicates: ${results.noDuplicates ? 'YES' : 'NO'}`);
    console.log(`Locks cleared: ${results.locksCleared ? 'YES' : 'NO'}`);
    console.log(`Worker recovered: ${results.workerRecovered ? 'YES' : 'NO'}`);
    console.log(`System stable: ${results.systemStable ? 'YES' : 'NO'}`);
    
    const allPassed = Object.values(results).every(v => v === true);
    console.log('\n' + '='.repeat(60));
    console.log(`Module 10 status: ${allPassed ? 'PASS' : 'FAIL'}`);
    console.log('='.repeat(60));
    
    await mongoose.connection.close();
    await redis.quit();
    
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('❌ Verification error:', error.message);
    process.exit(1);
  }
}

verifyRecovery();
