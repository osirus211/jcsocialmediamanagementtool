require('dotenv').config({ path: '.env.production' });
const { connectDatabase } = require('./dist/config/database');
const { connectRedis } = require('./dist/config/redis');
const { PostingQueue } = require('./dist/queue/PostingQueue');

async function testQueue() {
  try {
    console.log('🔌 Connecting to databases...');
    await connectDatabase();
    await connectRedis();
    console.log('✅ Connected to databases');

    console.log('🚀 Creating posting queue...');
    const queue = new PostingQueue();

    console.log('📝 Adding test job to queue...');
    const job = await queue.addPost({
      postId: '69919caf331f35cf3560e6d6',
      workspaceId: '699192069d54284153d6b712',
      socialAccountId: '699195b646abb73d5f8ce5b0',
      retryCount: 0
    });

    console.log('✅ Job added successfully:', job.id);
    console.log('🔍 Checking queue stats...');
    
    const stats = await queue.getStats();
    console.log('Queue stats:', stats);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testQueue();