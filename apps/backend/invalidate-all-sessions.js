/**
 * SECURITY FIX: Invalidate all existing sessions after JWT secret rotation
 * This script:
 * 1. Clears all refresh tokens from database
 * 2. Clears all Redis auth/session keys
 * 3. Forces all users to re-authenticate
 */

const mongoose = require('mongoose');
const Redis = require('ioredis');
require('dotenv').config();

async function invalidateAllSessions() {
  console.log('🔒 Starting session invalidation...\n');

  try {
    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // Connect to Redis
    console.log('📦 Connecting to Redis...');
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
    });
    console.log('✅ Redis connected\n');

    // Clear all refresh tokens from database
    console.log('🗑️  Clearing refresh tokens from database...');
    const User = mongoose.model('User', new mongoose.Schema({
      refreshTokens: [String]
    }));
    
    const result = await User.updateMany(
      { refreshTokens: { $exists: true, $ne: [] } },
      { $set: { refreshTokens: [] } }
    );
    console.log(`✅ Cleared refresh tokens from ${result.modifiedCount} users\n`);

    // Clear Redis auth keys
    console.log('🗑️  Clearing Redis auth/session keys...');
    const patterns = [
      'auth:*',
      'session:*',
      'refresh:*',
      'token:*',
      'user:*:tokens',
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        const deleted = await redis.del(...keys);
        console.log(`   - Deleted ${deleted} keys matching "${pattern}"`);
        totalDeleted += deleted;
      }
    }
    console.log(`✅ Cleared ${totalDeleted} Redis keys\n`);

    // Cleanup
    await redis.quit();
    await mongoose.connection.close();

    console.log('✅ Session invalidation complete!');
    console.log('🔐 All users must re-authenticate with new JWT secrets\n');

  } catch (error) {
    console.error('❌ Error during session invalidation:', error);
    process.exit(1);
  }
}

invalidateAllSessions();
