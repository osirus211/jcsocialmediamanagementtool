import Redis from 'ioredis';

async function clearRateLimits() {
  const redis = new Redis({
    host: '127.0.0.1',
    port: 6379
  });
  
  try {
    console.log('🔍 Finding rate limit keys...');
    const keys = await redis.keys('rl:*');
    console.log(`Found ${keys.length} rate limit keys`);
    
    if (keys.length > 0) {
      console.log('🗑️  Deleting rate limit keys...');
      await redis.del(...keys);
      console.log('✅ Rate limits cleared!');
    } else {
      console.log('ℹ️  No rate limit keys found');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await redis.quit();
  }
}

clearRateLimits();
