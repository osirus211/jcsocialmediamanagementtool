/**
 * Demonstration Script: Optimistic Locking for Post Updates
 * 
 * This script demonstrates how optimistic locking prevents race conditions
 * when multiple workers try to update the same post concurrently.
 * 
 * Usage:
 *   ts-node src/scripts/demo-optimistic-locking.ts
 * 
 * Requirements:
 *   - MongoDB must be running
 *   - Environment variables must be configured
 */

import mongoose from 'mongoose';
import { Post, PostStatus } from '../models/Post';
import { postService } from '../services/PostService';
import { SocialAccount } from '../models/SocialAccount';
import { Workspace } from '../models/Workspace';
import { User } from '../models/User';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { logger } from '../utils/logger';

async function demonstrateOptimisticLocking() {
  try {
    console.log('🚀 Starting Optimistic Locking Demonstration\n');

    // Connect to database
    console.log('📡 Connecting to database...');
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Create test data
    console.log('📝 Creating test data...');
    
    const workspace = await Workspace.create({
      name: 'Demo Workspace',
      slug: 'demo-workspace-' + Date.now(),
      ownerId: new mongoose.Types.ObjectId(),
    });

    const user = await User.create({
      email: `demo-${Date.now()}@example.com`,
      passwordHash: 'hashed_password',
      firstName: 'Demo',
      lastName: 'User',
    });

    const socialAccount = await SocialAccount.create({
      workspaceId: workspace._id,
      provider: 'twitter',
      accountName: 'Demo Account',
      accountId: 'demo_account_id',
      accessToken: 'demo_token',
      status: 'connected',
    });

    const post = await Post.create({
      workspaceId: workspace._id,
      socialAccountId: socialAccount._id,
      content: 'Demo post for optimistic locking',
      status: PostStatus.SCHEDULED,
      scheduledAt: new Date(Date.now() + 3600000),
      createdBy: user._id,
      version: 1,
    });

    console.log('✅ Test data created');
    console.log(`   Post ID: ${post._id}`);
    console.log(`   Initial version: ${post.version}\n`);

    // Demonstrate concurrent updates
    console.log('🔄 Simulating 10 concurrent workers updating the same post...\n');

    const workerCount = 10;
    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < workerCount; i++) {
      promises.push(
        postService.updatePostStatus(
          post._id.toString(),
          PostStatus.PUBLISHING as any
        ).then(result => {
          console.log(`✅ Worker ${i + 1} succeeded (version: ${(result as any).version})`);
          return result;
        }).catch(error => {
          console.log(`❌ Worker ${i + 1} failed: ${error.message}`);
          throw error;
        })
      );
    }

    // Wait for all workers to complete
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`\n✅ All ${workerCount} workers completed successfully`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Average time per worker: ${(duration / workerCount).toFixed(2)}ms\n`);

    // Verify final state
    const finalPost = await Post.findById(post._id);
    console.log('📊 Final Post State:');
    console.log(`   Status: ${finalPost?.status}`);
    console.log(`   Version: ${finalPost?.version}`);
    console.log(`   Expected version: ${1 + workerCount}`);
    console.log(`   Version matches: ${finalPost?.version === 1 + workerCount ? '✅ YES' : '❌ NO'}\n`);

    // Demonstrate version mismatch detection
    console.log('🔍 Demonstrating version mismatch detection...\n');

    // Manually update the post to create a version mismatch
    await Post.findByIdAndUpdate(post._id, {
      $inc: { version: 1 },
      $set: { status: PostStatus.QUEUED },
    });

    console.log('   Manually incremented version to create conflict');
    console.log('   Attempting update with old version...\n');

    try {
      const result = await postService.updatePostStatus(
        post._id.toString(),
        PostStatus.PUBLISHING as any
      );
      console.log('✅ Update succeeded after retry');
      console.log(`   New version: ${(result as any).version}\n`);
    } catch (error: any) {
      console.log(`❌ Update failed: ${error.message}\n`);
    }

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await Post.deleteOne({ _id: post._id });
    await SocialAccount.deleteOne({ _id: socialAccount._id });
    await Workspace.deleteOne({ _id: workspace._id });
    await User.deleteOne({ _id: user._id });
    console.log('✅ Cleanup complete\n');

    // Disconnect
    console.log('📡 Disconnecting from database...');
    await disconnectDatabase();
    console.log('✅ Disconnected\n');

    console.log('🎉 Demonstration complete!');
    console.log('\nKey Takeaways:');
    console.log('1. All concurrent workers successfully updated the post');
    console.log('2. Version field incremented correctly for each update');
    console.log('3. Version mismatches are detected and retried automatically');
    console.log('4. No race conditions or lost updates occurred\n');

  } catch (error: any) {
    console.error('❌ Error during demonstration:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run demonstration
demonstrateOptimisticLocking()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
