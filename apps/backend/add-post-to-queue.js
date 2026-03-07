import { Queue } from 'bullmq';
import Redis from 'ioredis';

async function addPostToQueue() {
  try {
    const redis = new Redis({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
    });

    console.log('✓ Connected to Redis\n');

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

    const job = await postingQueue.add('publish-post', {
      postId: '6999a72fbeea069df4ccb290',
      workspaceId: '6999a5e2500b5124e5a36706',
      platform: 'twitter',
    });

    console.log('✓ Added post to queue');
    console.log('  Job ID:', job.id);
    console.log('  Post ID:', job.data.postId);
    console.log('\n📋 Next steps:');
    console.log('1. Worker should pick up this job');
    console.log('2. Check job status in Redis');
    console.log('3. Verify post status updated in MongoDB');

    setTimeout(async () => {
      await postingQueue.close();
      await redis.disconnect();
      console.log('\n✓ Queue connection closed');
    }, 2000);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

addPostToQueue();
