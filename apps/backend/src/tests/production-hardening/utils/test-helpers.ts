/**
 * Test Helper Utilities
 * 
 * Provides utility functions for creating test data, connecting to databases,
 * and waiting for conditions during tests.
 */

import mongoose from 'mongoose';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { Workspace } from '../../../models/Workspace';
import { User } from '../../../models/User';
import { connectRedis as connectRedisConfig, getRedisClient } from '../../../config/redis';

/**
 * Create a test workspace
 */
export async function createTestWorkspace(): Promise<string> {
  const workspace = new Workspace({
    name: `Test Workspace ${uuidv4().substring(0, 8)}`,
    slug: `test-${uuidv4().substring(0, 8)}`,
    ownerId: new mongoose.Types.ObjectId(),
    settings: {
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'HH:mm',
    },
  });

  await workspace.save();
  return workspace._id.toString();
}

/**
 * Create a test user
 */
export async function createTestUser(workspaceId?: string): Promise<string> {
  const user = new User({
    email: `test-${uuidv4().substring(0, 8)}@example.com`,
    password: 'hashed_password_placeholder',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
  });

  await user.save();
  return user._id.toString();
}

/**
 * Generate a unique identifier with optional prefix
 */
export function generateUniqueId(prefix: string = 'test'): string {
  return `${prefix}-${uuidv4()}`;
}

/**
 * Connect to MongoDB with retry logic
 */
export async function connectMongoDB(retries: number = 3): Promise<typeof mongoose> {
  for (let i = 0; i < retries; i++) {
    try {
      if (mongoose.connection.readyState === 1) {
        return mongoose;
      }

      const mongoUri = config.database.uri;
      await mongoose.connect(mongoUri);
      
      console.log('MongoDB connected for tests');
      return mongoose;
    } catch (error) {
      console.error(`MongoDB connection attempt ${i + 1} failed:`, error);
      
      if (i === retries - 1) {
        throw new Error(`Failed to connect to MongoDB after ${retries} attempts`);
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }

  throw new Error('Failed to connect to MongoDB');
}

/**
 * Connect to Redis with retry logic
 */
export async function connectRedis(retries: number = 3): Promise<Redis> {
  for (let i = 0; i < retries; i++) {
    try {
      // Use the config module's connectRedis function
      const redis = await connectRedisConfig();
      
      console.log('Redis connected for tests');
      return redis;
    } catch (error) {
      console.error(`Redis connection attempt ${i + 1} failed:`, error);
      
      if (i === retries - 1) {
        throw new Error(`Failed to connect to Redis after ${retries} attempts`);
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }

  throw new Error('Failed to connect to Redis');
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 30000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await Promise.resolve(condition());
    
    if (result) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Wait for a specific duration
 */
export async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryAsync<T>(
  operation: () => Promise<T>,
  retries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, i);
      await wait(delay);
    }
  }

  throw new Error('Retry failed');
}

/**
 * Create a test MongoDB ObjectId
 */
export function createTestObjectId(): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId();
}

/**
 * Get current timestamp
 */
export function getCurrentTimestamp(): Date {
  return new Date();
}

/**
 * Get backdated timestamp (for TTL testing)
 */
export function getBackdatedTimestamp(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/**
 * Check if MongoDB is connected
 */
export function isMongoDBConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Check if Redis is connected
 */
export async function isRedisConnected(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get test database name
 */
export function getTestDatabaseName(): string {
  return config.test.dbName;
}

/**
 * Get test Redis namespace
 */
export function getTestRedisNamespace(): string {
  return config.test.redisNamespace;
}
