require('dotenv').config();
const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || '6380';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_URL = process.env.REDIS_URL || 
  (REDIS_PASSWORD 
    ? `redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`
    : `redis://${REDIS_HOST}:${REDIS_PORT}`);

async function checkRedisKeys() {
  const redis = new Redis(REDIS_URL);
  
  try {
    const allKeys = await redis.keys('*');
    
    const circuitKeys = allKeys.filter(k => k.startsWith('oauth:circuit:'));
    const rateLimitKeys = allKeys.filter(k => k.startsWith('oauth:ratelimit:'));
    const bullmqKeys = allKeys.filter(k => k.startsWith('bull:'));
    
    console.log('Redis Key Summary:');
    console.log('==================\n');
    console.log(`Total Keys: ${allKeys.length}\n`);
    
    console.log(`Circuit Breaker Keys (${circuitKeys.length}):`);
    circuitKeys.forEach(k => console.log(`  - ${k}`));
    console.log('');
    
    console.log(`Rate Limiter Keys (${rateLimitKeys.length}):`);
    rateLimitKeys.forEach(k => console.log(`  - ${k}`));
    console.log('');
    
    console.log(`BullMQ Keys (${bullmqKeys.length}):`);
    bullmqKeys.slice(0, 10).forEach(k => console.log(`  - ${k}`));
    if (bullmqKeys.length > 10) {
      console.log(`  ... and ${bullmqKeys.length - 10} more`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    redis.disconnect();
  }
}

checkRedisKeys();
