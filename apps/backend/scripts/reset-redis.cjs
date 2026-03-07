const Redis = require('ioredis');
const REDIS_HOST = '172.29.118.94';
const REDIS_PORT = 6379;

async function resetRedis() {
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null,
  });

  try {
    console.log('✅ Redis connected');
    
    const patterns = ['bull:posting-queue:*', 'queue:lock:*', 'scheduler:lock*'];
    let totalDeleted = 0;
    
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        const deleted = await redis.del(...keys);
        console.log(`🗑️  Deleted ${deleted} keys matching ${pattern}`);
        totalDeleted += deleted;
      } else {
        console.log(`ℹ️  No keys found for pattern: ${pattern}`);
      }
    }
    
    console.log(`📊 Total keys deleted: ${totalDeleted}`);
    
    const remainingQueue = await redis.keys('bull:posting-queue:*');
    console.log(`📊 Remaining queue keys: ${remainingQueue.length}`);
    
    await redis.quit();
    console.log('✅ Redis cleanup complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetRedis();
