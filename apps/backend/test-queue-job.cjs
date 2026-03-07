const { Queue } = require('bullmq');
const Redis = require('ioredis');

async function testQueueJob() {
  try {
    // Connect to Redis
    const redis = new Redis({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null, // Required for BullMQ
    });

    console.log('✓ Connected to Redis');

    // Create queue
    const postingQueue = new Queue('posting', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    });

    // Add a test job with dummy data
    const job = await postingQueue.add('publish-post', {
      postId: '507f1f77bcf86cd799439011', // Dummy ObjectId
      workspaceId: '507f1f77bcf86cd799439012', // Dummy ObjectId
      socialAccountId: '507f1f77bcf86cd799439013', // Dummy ObjectId
    });

    console.log('✓ Added test job to queue:', job.id);
    console.log('  - Job data:', job.data);
    console.log('\n📋 VERIFICATION:');
    console.log('1. Worker should pick up this job immediately');
    console.log('2. Job will fail because the IDs are dummy/non-existent');
    console.log('3. Worker should retry 3 times total');
    console.log('4. After final failure, job should be marked as failed');
    console.log('\n🔍 Monitor with:');
    console.log('docker-compose -f docker-compose.production.yml logs worker -f');

    // Wait a bit then close
    setTimeout(async () => {
      await postingQueue.close();
      await redis.disconnect();
      console.log('\n✓ Test completed');
    }, 2000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testQueueJob();