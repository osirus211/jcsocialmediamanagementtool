const { MongoClient, ObjectId } = require('mongodb');
const Redis = require('ioredis');

async function manuallyEnqueue(postId) {
  if (!postId) {
    console.error('❌ Usage: node manually-enqueue-poison-job.cjs <postId>');
    process.exit(1);
  }

  const mongoClient = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
  await mongoClient.connect();
  const db = mongoClient.db();
  
  const post = await db.collection('posts').findOne({
    _id: new ObjectId(postId)
  });
  
  if (!post) {
    console.error('❌ Post not found');
    await mongoClient.close();
    process.exit(1);
  }

  console.log('✅ Found post:', postId);
  console.log('📝 Content:', post.content);
  console.log('🔧 Provider:', post.socialAccountId);

  // Update post status to queued
  await db.collection('posts').updateOne(
    { _id: new ObjectId(postId) },
    { $set: { status: 'queued', updatedAt: new Date() } }
  );

  console.log('✅ Updated post status to queued');

  // Connect to Redis and add job to BullMQ queue
  const redis = new Redis({
    host: '172.29.118.94',
    port: 6379,
  });

  const jobData = {
    postId: postId,
    workspaceId: post.workspaceId.toString(),
    socialAccountId: post.socialAccountId.toString(),
    retryCount: 0,
  };

  const jobId = `post-${postId}`;
  
  // Create BullMQ job structure
  const job = {
    name: 'publish-post',
    data: jobData,
    opts: {
      jobId: jobId,
      priority: 1,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      timestamp: Date.now(),
    },
  };

  // Add to BullMQ queue (simplified - using direct Redis commands)
  const queueKey = 'bull:posting-queue:';
  
  // Store job data
  await redis.hmset(`${queueKey}${jobId}`, {
    name: job.name,
    data: JSON.stringify(job.data),
    opts: JSON.stringify(job.opts),
    timestamp: job.opts.timestamp,
    attemptsMade: 0,
  });

  // Add to waiting list
  await redis.lpush(`${queueKey}wait`, jobId);

  console.log('✅ Job added to BullMQ queue');
  console.log('📋 Job ID:', jobId);
  console.log('⏳ Worker should pick up this job immediately');
  console.log('\n🔍 Monitor backend logs for:');
  console.log('  - Processing publishing job');
  console.log('  - Publishing job failed');
  console.log('  - Retry attempts (1/3, 2/3, 3/3)');
  console.log('  - Post marked as failed after all retries');

  await redis.quit();
  await mongoClient.close();
}

manuallyEnqueue(process.argv[2]).catch(err => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
