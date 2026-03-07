import Redis from 'ioredis';

async function checkRedis() {
  const redis = new Redis({
    host: 'localhost',
    port: 6379,
    password: ''
  });

  try {
    // Scan for auth keys
    let cursor = '0';
    let authKeys = [];
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', '*auth*', 'COUNT', 100);
      cursor = newCursor;
      authKeys = authKeys.concat(keys);
    } while (cursor !== '0');

    // Scan for session keys
    cursor = '0';
    let sessionKeys = [];
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', '*session*', 'COUNT', 100);
      cursor = newCursor;
      sessionKeys = sessionKeys.concat(keys);
    } while (cursor !== '0');

    // Scan for refresh keys
    cursor = '0';
    let refreshKeys = [];
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', '*refresh*', 'COUNT', 100);
      cursor = newCursor;
      refreshKeys = refreshKeys.concat(keys);
    } while (cursor !== '0');

    console.log('AUTH_KEYS:', authKeys.length > 0 ? 'YES' : 'NO');
    console.log('SESSION_KEYS:', sessionKeys.length > 0 ? 'YES' : 'NO');
    console.log('REFRESH_KEYS:', refreshKeys.length > 0 ? 'YES' : 'NO');

    await redis.quit();
  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

checkRedis();
