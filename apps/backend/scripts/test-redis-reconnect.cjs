const Redis = require('ioredis');
const REDIS_HOST = '172.29.118.94';
const REDIS_PORT = 6379;

async function testRedisReconnect() {
  console.log('🔍 Testing Redis reconnect capability...\n');
  
  let redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
      if (times > 10) {
        console.log('❌ Max retries reached');
        return null;
      }
      const delay = Math.min(times * 300, 5000);
      console.log(`🔄 Retry ${times}/10 - waiting ${delay}ms`);
      return delay;
    },
    reconnectOnError: () => true,
  });

  try {
    await redis.ping();
    console.log('✅ Initial connection successful');
    
    console.log('\n🔌 Simulating disconnect...');
    redis.disconnect();
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Disconnected');
    
    console.log('\n🔄 Attempting reconnect...');
    redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 10) {
          return null;
        }
        const delay = Math.min(times * 300, 5000);
        console.log(`🔄 Retry ${times}/10 - waiting ${delay}ms`);
        return delay;
      },
      reconnectOnError: () => true,
    });
    
    let reconnected = false;
    for (let i = 0; i < 10; i++) {
      try {
        await redis.ping();
        console.log(`✅ Reconnected successfully on attempt ${i + 1}`);
        reconnected = true;
        break;
      } catch (error) {
        console.log(`⚠️  Attempt ${i + 1}/10 failed: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (reconnected) {
      console.log('\n✅ Redis reconnect test PASSED');
      await redis.quit();
      process.exit(0);
    } else {
      console.log('\n❌ Redis reconnect test FAILED');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testRedisReconnect();
