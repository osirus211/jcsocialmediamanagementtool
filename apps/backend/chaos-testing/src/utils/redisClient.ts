import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';
import { config } from '../config';

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  redisClient = createClient({
    socket: {
      host: config.redisHost,
      port: config.redisPort,
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis reconnection failed after 10 retries');
          return new Error('Redis reconnection failed');
        }
        return Math.min(retries * 100, 3000);
      },
    },
  });

  redisClient.on('error', (err) => {
    logger.error('Redis client error', { error: err.message });
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('reconnecting', () => {
    logger.warn('Redis client reconnecting');
  });

  await redisClient.connect();

  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Increment counter in Redis
 */
export async function incrementCounter(key: string, amount: number = 1): Promise<number> {
  const client = await getRedisClient();
  return await client.incrBy(key, amount);
}

/**
 * Get counter value from Redis
 */
export async function getCounter(key: string): Promise<number> {
  const client = await getRedisClient();
  const value = await client.get(key);
  return value ? parseInt(value) : 0;
}

/**
 * Set value in Redis with optional TTL
 */
export async function setValue(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const client = await getRedisClient();
  if (ttlSeconds) {
    await client.setEx(key, ttlSeconds, value);
  } else {
    await client.set(key, value);
  }
}

/**
 * Get value from Redis
 */
export async function getValue(key: string): Promise<string | null> {
  const client = await getRedisClient();
  return await client.get(key);
}

/**
 * Add to set in Redis
 */
export async function addToSet(key: string, member: string): Promise<number> {
  const client = await getRedisClient();
  return await client.sAdd(key, member);
}

/**
 * Check if member exists in set
 */
export async function isMemberOfSet(key: string, member: string): Promise<boolean> {
  const client = await getRedisClient();
  return await client.sIsMember(key, member);
}

/**
 * Get set size
 */
export async function getSetSize(key: string): Promise<number> {
  const client = await getRedisClient();
  return await client.sCard(key);
}

/**
 * Get all members of set
 */
export async function getSetMembers(key: string): Promise<string[]> {
  const client = await getRedisClient();
  return await client.sMembers(key);
}

/**
 * Delete key from Redis
 */
export async function deleteKey(key: string): Promise<number> {
  const client = await getRedisClient();
  return await client.del(key);
}

/**
 * Get all keys matching pattern
 */
export async function getKeys(pattern: string): Promise<string[]> {
  const client = await getRedisClient();
  return await client.keys(pattern);
}
