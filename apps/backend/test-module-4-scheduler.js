/**
 * 🚀 MODULE 4 — SCHEDULER + QUEUE + PUBLISH PIPELINE VALIDATION
 * 
 * Comprehensive test for the complete scheduling and publishing pipeline
 * 
 * Test Flow:
 * 1. Create scheduled post
 * 2. Wait for scheduler to pick it up
 * 3. Verify queue processing
 * 4. Verify publishing execution
 * 5. Test failure + retry logic
 * 6. Verify queue integrity
 * 7. Check Redis + Metrics
 */

const axios = require('axios');
const mongoose = require('mongoose');
const Redis = require('ioredis');

// Configuration
const BASE_URL = 'http://127.0.0.1:5000/api/v1';
const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';
const REDIS_CONFIG = {
  host: 'localhost',
  port: 6379,
};

// Test credentials
const TEST_USER = {
  email: 'test-composer@example.com',
  password: 'TestPassword123!',
};

// Test results
const results = {
  scheduledPostCreated: false,
  mongoScheduledStatus: false,
  schedulerPickedJob: false,
  jobEnteredQueue: false,
  postPublished: false,
  publishedAtWritten: false,
  retryLogicWorking: false,
  failedJobHandled: false,
  queueStuckJobs: false,
  duplicateJobsDetected: false,
  redisQueueActive: false,
  metricsUpdating: false,
};

let accessToken = null;
let workspaceId = null;
let socialAccountId = null;
let scheduledPostId = null;
let db = null;
let redis = null;

// Helper: Sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Login
async function login() {
  console.log('\n🔐 Logging in...');
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, TEST_USER);
    accessToken = response.data.accessToken;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

// Helper: Get workspace
async function getWorkspace() {
  console.log('\n📁 Getting workspace...');
  try {
    const response = await axios.get(`${BASE_URL}/workspaces`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (response.data.workspaces && response.data.workspaces.length > 0) {
      workspaceId = response.data.workspaces[0]._id;
      console.log('✅ Workspace found:', workspaceId);
      return true;
    }
    
    console.error('❌ No workspace found');
    return false;
  } catch (error) {
    console.error('❌ Get workspace failed:', error.response?.data || error.message);
    return false;
  }
}

// Helper: Get or create social account
async function getSocialAccount() {
  console.log('\n🔗 Getting social account...');
  try {
    const response = await axios.get(`${BASE_URL}/social/accounts`, {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'x-workspace-id': workspaceId,
      },
    });
    
    if (response.data.accounts && response.data.accounts.length > 0) {
      socialAccountId = response.data.accounts[0]._id;
      console.log('✅ Social account found:', socialAccountId);
      return true;
    }
    
    // No account found, create one
    console.log('   No social account found, creating one...');
    return await createSocialAccount();
  } catch (error) {
    console.error('❌ Get social account failed:', error.response?.data || error.message);
    // Try to create one anyway
    return await createSocialAccount();
  }
}

// Helper: Create social account
async function createSocialAccount() {
  console.log('\n🔗 Creating social account...');
  try {
    const response = await axios.post(
      `${BASE_URL}/social/connect/twitter`,
      {
        accountName: 'Test Twitter Account',
        accountId: `twitter_${Date.now()}`,
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token',
        tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-workspace-id': workspaceId,
        },
      }
    );
    
    socialAccountId = response.data.account?.id || response.data.account?._id;
    console.log('✅ Social account created:', socialAccountId);
    return true;
  } catch (error) {
    console.error('❌ Create social account failed:', error.response?.data || error.message);
    return false;
  }
}

// STEP 1: Create scheduled post
async function createScheduledPost() {
  console.log('\n\n📝 STEP 1 — Creating scheduled post...');
  
  try {
    // Schedule for 60 seconds from now
    const scheduledAt = new Date(Date.now() + 60000);
    
    const postData = {
      content: `Module 4 Test Post - ${Date.now()}`,
      socialAccountId: socialAccountId,
      scheduledAt: scheduledAt.toISOString(),
    };
    
    const response = await axios.post(`${BASE_URL}/posts`, postData, {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'x-workspace-id': workspaceId,
      },
    });
    
    scheduledPostId = response.data.post._id;
    console.log('✅ Scheduled post created:', scheduledPostId);
    console.log('   Scheduled for:', scheduledAt.toISOString());
    
    results.scheduledPostCreated = true;
    
    // Verify in MongoDB
    await sleep(1000);
    const post = await db.collection('posts').findOne({ 
      _id: new mongoose.Types.ObjectId(scheduledPostId) 
    });
    
    if (post && post.status === 'scheduled' && post.scheduledAt) {
      console.log('✅ MongoDB: status = scheduled, scheduledAt exists');
      results.mongoScheduledStatus = true;
    } else {
      console.error('❌ MongoDB: Invalid post state');
      console.log('   Post:', JSON.stringify(post, null, 2));
    }
    
    return true;
  } catch (error) {
    console.error('❌ Create scheduled post failed:', error.response?.data || error.message);
    return false;
  }
}

// STEP 2: Wait for scheduler pickup
async function waitForSchedulerPickup() {
  console.log('\n\n⏰ STEP 2 — Waiting for scheduler pickup...');
  console.log('   Waiting 70 seconds for scheduled time to pass...');
  
  // Wait for scheduled time + buffer
  await sleep(70000);
  
  console.log('   Checking if scheduler picked up the job...');
  
  // Check MongoDB status
  const post = await db.collection('posts').findOne({ 
    _id: new mongoose.Types.ObjectId(scheduledPostId) 
  });
  
  if (post && post.status === 'queued') {
    console.log('✅ Scheduler picked job: status = queued');
    results.schedulerPickedJob = true;
  } else {
    console.error('❌ Scheduler did not pick job');
    console.log('   Current status:', post?.status);
  }
  
  // Check Redis queue
  const queueKeys = await redis.keys('bull:posting-queue:*');
  const hasJob = queueKeys.some(key => key.includes(scheduledPostId));
  
  if (hasJob) {
    console.log('✅ Job entered queue: Found in Redis');
    results.jobEnteredQueue = true;
  } else {
    console.error('❌ Job not found in Redis queue');
    console.log('   Queue keys:', queueKeys.length);
  }
  
  return results.schedulerPickedJob && results.jobEnteredQueue;
}

// STEP 3: Wait for publishing
async function waitForPublishing() {
  console.log('\n\n🚀 STEP 3 — Waiting for publishing execution...');
  console.log('   Waiting up to 60 seconds for worker to process...');
  
  let attempts = 0;
  const maxAttempts = 12; // 60 seconds
  
  while (attempts < maxAttempts) {
    await sleep(5000);
    attempts++;
    
    const post = await db.collection('posts').findOne({ 
      _id: new mongoose.Types.ObjectId(scheduledPostId) 
    });
    
    console.log(`   Attempt ${attempts}/${maxAttempts}: status = ${post?.status}`);
    
    if (post && post.status === 'published') {
      console.log('✅ Post published successfully');
      results.postPublished = true;
      
      if (post.publishedAt) {
        console.log('✅ PublishedAt written:', post.publishedAt);
        results.publishedAtWritten = true;
      } else {
        console.error('❌ PublishedAt not written');
      }
      
      return true;
    }
    
    if (post && post.status === 'failed') {
      console.log('⚠️  Post failed (will test retry logic)');
      break;
    }
  }
  
  if (!results.postPublished) {
    console.error('❌ Post did not publish within timeout');
  }
  
  return results.postPublished;
}

// STEP 4: Test failure + retry logic
async function testRetryLogic() {
  console.log('\n\n🔄 STEP 4 — Testing failure + retry logic...');
  
  try {
    // Create a post that will fail
    const scheduledAt = new Date(Date.now() + 10000); // 10 seconds
    
    const postData = {
      content: `Retry Test Post - ${Date.now()}`,
      socialAccountId: socialAccountId,
      scheduledAt: scheduledAt.toISOString(),
      metadata: {
        forceFail: true, // Signal to fail
      },
    };
    
    const response = await axios.post(`${BASE_URL}/posts`, postData, {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'x-workspace-id': workspaceId,
      },
    });
    
    const retryPostId = response.data.post._id;
    console.log('✅ Retry test post created:', retryPostId);
    
    // Wait for processing
    console.log('   Waiting 30 seconds for processing...');
    await sleep(30000);
    
    // Check retry count
    const post = await db.collection('posts').findOne({ 
      _id: new mongoose.Types.ObjectId(retryPostId) 
    });
    
    if (post && post.retryCount > 0) {
      console.log('✅ Retry logic working: retryCount =', post.retryCount);
      results.retryLogicWorking = true;
    } else {
      console.error('❌ Retry logic not working');
    }
    
    if (post && (post.status === 'failed' || post.status === 'published')) {
      console.log('✅ Failed job handled: status =', post.status);
      results.failedJobHandled = true;
    } else {
      console.error('❌ Failed job not handled properly');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Retry logic test failed:', error.response?.data || error.message);
    return false;
  }
}

// STEP 5: Check queue integrity
async function checkQueueIntegrity() {
  console.log('\n\n🔍 STEP 5 — Checking queue integrity...');
  
  // Check for stuck jobs
  const stuckPosts = await db.collection('posts').find({
    status: 'publishing',
    updatedAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) },
  }).toArray();
  
  if (stuckPosts.length === 0) {
    console.log('✅ No stuck jobs found');
    results.queueStuckJobs = false; // No stuck jobs is good
  } else {
    console.error('❌ Found stuck jobs:', stuckPosts.length);
    results.queueStuckJobs = true;
  }
  
  // Check for duplicate jobs in Redis
  const queueKeys = await redis.keys('bull:posting-queue:*');
  const jobIds = new Set();
  let duplicates = 0;
  
  for (const key of queueKeys) {
    if (key.includes(':post-')) {
      const jobId = key.split(':post-')[1];
      if (jobIds.has(jobId)) {
        duplicates++;
      }
      jobIds.add(jobId);
    }
  }
  
  if (duplicates === 0) {
    console.log('✅ No duplicate jobs detected');
    results.duplicateJobsDetected = false; // No duplicates is good
  } else {
    console.error('❌ Found duplicate jobs:', duplicates);
    results.duplicateJobsDetected = true;
  }
  
  // Check queue depth
  const waitingCount = await redis.llen('bull:posting-queue:wait');
  const activeCount = await redis.llen('bull:posting-queue:active');
  
  console.log('   Queue depth: waiting =', waitingCount, ', active =', activeCount);
  
  return true;
}

// STEP 6: Check Redis + Metrics
async function checkRedisAndMetrics() {
  console.log('\n\n📊 STEP 6 — Checking Redis + Metrics...');
  
  // Check Redis queue keys
  const queueKeys = await redis.keys('bull:posting-queue:*');
  
  if (queueKeys.length > 0) {
    console.log('✅ Redis queue active: Found', queueKeys.length, 'keys');
    results.redisQueueActive = true;
  } else {
    console.error('❌ Redis queue not active');
  }
  
  // Check metrics endpoint
  try {
    const response = await axios.get('http://127.0.0.1:5000/metrics');
    const metrics = response.data;
    
    // Check for scheduler metrics
    const hasSchedulerMetrics = metrics.includes('scheduler_jobs_total');
    const hasPublishMetrics = metrics.includes('publish_success_total') || 
                              metrics.includes('publish_fail_total');
    
    if (hasSchedulerMetrics && hasPublishMetrics) {
      console.log('✅ Metrics updating: Found scheduler and publish metrics');
      results.metricsUpdating = true;
    } else {
      console.error('❌ Metrics not updating properly');
      console.log('   Has scheduler metrics:', hasSchedulerMetrics);
      console.log('   Has publish metrics:', hasPublishMetrics);
    }
  } catch (error) {
    console.error('❌ Failed to fetch metrics:', error.message);
  }
  
  return true;
}

// Print final results
function printResults() {
  console.log('\n\n' + '='.repeat(60));
  console.log('📋 MODULE 4 TEST RESULTS');
  console.log('='.repeat(60));
  
  console.log(`Scheduled post created: ${results.scheduledPostCreated ? 'YES' : 'NO'}`);
  console.log(`Mongo scheduled status: ${results.mongoScheduledStatus ? 'YES' : 'NO'}`);
  console.log(`Scheduler picked job: ${results.schedulerPickedJob ? 'YES' : 'NO'}`);
  console.log(`Job entered queue: ${results.jobEnteredQueue ? 'YES' : 'NO'}`);
  console.log(`Post published: ${results.postPublished ? 'YES' : 'NO'}`);
  console.log(`PublishedAt written: ${results.publishedAtWritten ? 'YES' : 'NO'}`);
  console.log(`Retry logic working: ${results.retryLogicWorking ? 'YES' : 'NO'}`);
  console.log(`Failed job handled: ${results.failedJobHandled ? 'YES' : 'NO'}`);
  console.log(`Queue stuck jobs: ${results.queueStuckJobs ? 'YES' : 'NO'}`);
  console.log(`Duplicate jobs detected: ${results.duplicateJobsDetected ? 'YES' : 'NO'}`);
  console.log(`Redis queue active: ${results.redisQueueActive ? 'YES' : 'NO'}`);
  console.log(`Metrics updating: ${results.metricsUpdating ? 'YES' : 'NO'}`);
  
  const allPassed = Object.entries(results).every(([key, value]) => {
    // Inverted checks (false is good)
    if (key === 'queueStuckJobs' || key === 'duplicateJobsDetected') {
      return value === false;
    }
    return value === true;
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`Module 4 status: ${allPassed ? 'PASS' : 'FAIL'}`);
  console.log('='.repeat(60) + '\n');
  
  return allPassed;
}

// Main test execution
async function runTests() {
  console.log('🚀 MODULE 4 — SCHEDULER + QUEUE + PUBLISH PIPELINE VALIDATION');
  console.log('='.repeat(60));
  
  try {
    // Connect to MongoDB
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    db = mongoose.connection.db;
    console.log('✅ MongoDB connected');
    
    // Connect to Redis
    console.log('\n🔌 Connecting to Redis...');
    redis = new Redis(REDIS_CONFIG);
    await redis.ping();
    console.log('✅ Redis connected');
    
    // Login and setup
    if (!await login()) return false;
    if (!await getWorkspace()) return false;
    if (!await getSocialAccount()) return false;
    
    // Run test steps
    await createScheduledPost();
    await waitForSchedulerPickup();
    await waitForPublishing();
    await testRetryLogic();
    await checkQueueIntegrity();
    await checkRedisAndMetrics();
    
    // Print results
    const passed = printResults();
    
    return passed;
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    return false;
  } finally {
    // Cleanup
    if (mongoose.connection) {
      await mongoose.connection.close();
      console.log('\n🔌 MongoDB disconnected');
    }
    if (redis) {
      redis.disconnect();
      console.log('🔌 Redis disconnected');
    }
  }
}

// Run tests
runTests()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
