/**
 * Cleanup Test Data
 * 
 * Removes all test data from database and Redis
 * 
 * Usage:
 *   npm run load-test:cleanup
 */

import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { connectRedis, disconnectRedis, getRedisClient } from '../src/config/redis';
import * as fs from 'fs';
import * as path from 'path';

async function cleanup() {
  console.log('\n🧹 Starting cleanup...\n');

  try {
    // Connect to database and Redis
    console.log('📦 Connecting to database and Redis...');
    await connectDatabase();
    await connectRedis();
    console.log('✅ Connected\n');

    // Import models
    const { User } = await import('../src/models/User');
    const { Workspace } = await import('../src/models/Workspace');
    const { SocialAccount } = await import('../src/models/SocialAccount');
    const { Post } = await import('../src/models/Post');
    const { Media } = await import('../src/models/Media');

    // Step 1: Remove test posts
    console.log('📝 Removing test posts...');
    const postsResult = await Post.deleteMany({
      'metadata.testPost': true,
    });
    console.log(`✅ Removed ${postsResult.deletedCount} test posts`);

    // Step 2: Remove test media
    console.log('\n🖼️  Removing test media...');
    const mediaResult = await Media.deleteMany({
      'metadata.testMedia': true,
    });
    console.log(`✅ Removed ${mediaResult.deletedCount} test media`);

    // Step 3: Remove test social accounts
    console.log('\n📱 Removing test social accounts...');
    const accountsResult = await SocialAccount.deleteMany({
      'metadata.testAccount': true,
    });
    console.log(`✅ Removed ${accountsResult.deletedCount} test accounts`);

    // Step 4: Remove test workspaces
    console.log('\n🏢 Removing test workspaces...');
    const workspacesResult = await Workspace.deleteMany({
      'metadata.testWorkspace': true,
    });
    console.log(`✅ Removed ${workspacesResult.deletedCount} test workspaces`);

    // Step 5: Remove test users
    console.log('\n👤 Removing test users...');
    const usersResult = await User.deleteMany({
      'metadata.testUser': true,
    });
    console.log(`✅ Removed ${usersResult.deletedCount} test users`);

    // Step 6: Clean up Redis test keys
    console.log('\n🔴 Cleaning up Redis test keys...');
    const redis = getRedisClient();
    
    // Find all test keys
    const testKeys = await redis.keys('test:*');
    if (testKeys.length > 0) {
      await redis.del(...testKeys);
      console.log(`✅ Removed ${testKeys.length} Redis test keys`);
    } else {
      console.log('✅ No Redis test keys found');
    }

    // Step 7: Clean up test queue jobs
    console.log('\n📋 Cleaning up test queue jobs...');
    const { QueueManager } = await import('../src/queue/QueueManager');
    const queueManager = QueueManager.getInstance();
    
    try {
      // Clean posting queue
      const postingQueue = queueManager.getQueue('posting-queue');
      
      // Get all jobs and remove test jobs
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        postingQueue.getWaiting(0, 1000),
        postingQueue.getActive(0, 1000),
        postingQueue.getCompleted(0, 1000),
        postingQueue.getFailed(0, 1000),
        postingQueue.getDelayed(0, 1000),
      ]);
      
      const allJobs = [...waiting, ...active, ...completed, ...failed, ...delayed];
      let removedCount = 0;
      
      for (const job of allJobs) {
        const data = job.data as any;
        if (data.workspaceId && data.workspaceId.includes('test')) {
          await job.remove();
          removedCount++;
        }
      }
      
      console.log(`✅ Removed ${removedCount} test queue jobs`);
    } catch (error: any) {
      console.log(`⚠️  Could not clean queue jobs: ${error.message}`);
    }

    // Step 8: Remove test data IDs file
    console.log('\n💾 Removing test data IDs file...');
    const idsFilePath = path.join(__dirname, '.test-data-ids.json');
    if (fs.existsSync(idsFilePath)) {
      fs.unlinkSync(idsFilePath);
      console.log('✅ Removed .test-data-ids.json');
    } else {
      console.log('✅ No test data IDs file found');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Cleanup Complete');
    console.log('='.repeat(60));
    console.log(`Posts removed: ${postsResult.deletedCount}`);
    console.log(`Media removed: ${mediaResult.deletedCount}`);
    console.log(`Accounts removed: ${accountsResult.deletedCount}`);
    console.log(`Workspaces removed: ${workspacesResult.deletedCount}`);
    console.log(`Users removed: ${usersResult.deletedCount}`);
    console.log(`Redis keys removed: ${testKeys.length}`);
    console.log('='.repeat(60) + '\n');

  } catch (error: any) {
    console.error('\n❌ Error during cleanup:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await disconnectRedis();
    await disconnectDatabase();
    console.log('👋 Disconnected\n');
  }
}

// Run if called directly
if (require.main === module) {
  cleanup().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { cleanup };
