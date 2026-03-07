const Redis = require('ioredis');

async function testRedis() {
  console.log('Testing Redis connection...');
  
  const redis = new Redis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
  });

  try {
    const info = await redis.info('server');
    console.log('Redis INFO:', info);
    
    const version = info.match(/redis_version:([^\r\n]+)/);
    if (version) {
      console.log('✅ Redis version:', version[1]);
    }
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testRedis();
