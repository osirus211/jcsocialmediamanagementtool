import Redis from 'ioredis';

async function testRedis() {
  const redis = new Redis({
    host: '127.0.0.1',
    port: 6379,
    connectTimeout: 5000
  });
  
  try {
    console.log('🔍 Testing Redis connection...');
    const pong = await redis.ping();
    console.log(`✅ Redis responded: ${pong}`);
    
    // Check queue keys
    const queueKeys = await redis.keys('bull:publish:*');
    console.log(`\n📊 Found ${queueKeys.length} queue keys:`);
    queueKeys.slice(0, 10).forEach(k => console.log(`   - ${k}`));
    
    // Check waiting jobs
    const waitingCount = await redis.llen('bull:publish:wait');
    console.log(`\n⏳ Waiting jobs: ${waitingCount}`);
    
    const activeCount = await redis.llen('bull:publish:active');
    console.log(`🔄 Active jobs: ${activeCount}`);
    
    const failedCount = await redis.llen('bull:publish:failed');
    console.log(`❌ Failed jobs: ${failedCount}`);
    
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
  } finally {
    await redis.quit();
  }
}

testRedis();
