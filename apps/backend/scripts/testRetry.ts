#!/usr/bin/env ts-node

/**
 * Retry State Machine Verification Test
 * 
 * This script tests the PublishingWorker retry logic by:
 * 1. Creating a test post in MongoDB
 * 2. Enqueuing it with forceFail=true to trigger deterministic failures
 * 3. Monitoring the post status and retryCount in real-time
 * 4. Verifying the final state after all retries are exhausted
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/database';
import { connectRedis } from '../src/config/redis';
import { Post, PostStatus } from '../src/models/Post';
import { SocialAccount } from '../src/models/SocialAccount';
import { Workspace } from '../src/models/Workspace';
import { User } from '../src/models/User';
import { PostingQueue } from '../src/queue/PostingQueue';

// Load environment variables
dotenv.config({ path: '.env.production' });

interface TestResult {
  postId: string;
  attemptsObserved: number;
  finalStatus: string;
  finalRetryCount: number;
  timeElapsed: number;
  success: boolean;
}

class RetryTester {
  private postingQueue: PostingQueue | null = null;
  public testPostId: string | null = null; // Made public for cleanup access
  private startTime: number = 0;
  private attemptsObserved: number = 0;

  async initialize(): Promise<void> {
    console.log('🔌 Connecting to databases...');
    await connectDatabase();
    await connectRedis();
    console.log('✅ Connected to databases');

    this.postingQueue = new PostingQueue();
    console.log('✅ PostingQueue initialized');
  }

  async createTestPost(): Promise<string> {
    console.log('📝 Creating test post...');

    // Find existing test data
    const user = await User.findOne({ email: 'test@example.com' });
    if (!user) {
      throw new Error('Test user not found. Run create-test-user.cjs first.');
    }

    const workspace = await Workspace.findOne({ ownerId: user._id });
    if (!workspace) {
      throw new Error('Test workspace not found.');
    }

    const socialAccount = await SocialAccount.findOne({ workspaceId: workspace._id });
    if (!socialAccount) {
      throw new Error('Test social account not found.');
    }

    // Create test post scheduled for immediate processing
    const post = new Post({
      workspaceId: workspace._id,
      socialAccountId: socialAccount._id,
      content: 'RETRY TEST POST - This will fail 3 times then be marked as failed',
      mediaUrls: [],
      status: PostStatus.SCHEDULED,
      scheduledAt: new Date(), // Schedule for immediate processing
      createdBy: user._id,
      retryCount: 0,
      metadata: {
        testRun: true,
        testTimestamp: new Date().toISOString(),
      },
    });

    await post.save();

    console.log('✅ Test post created:', {
      postId: post._id.toString(),
      status: post.status,
      scheduledAt: post.scheduledAt,
      retryCount: post.retryCount,
    });

    return post._id.toString();
  }

  async enqueueTestJob(postId: string): Promise<void> {
    console.log('🚀 Enqueuing test job with forceFail=true...');

    if (!this.postingQueue) {
      throw new Error('PostingQueue not initialized');
    }

    // Find the post to get workspace and social account IDs
    const post = await Post.findById(postId).populate('socialAccountId');
    if (!post) {
      throw new Error('Test post not found');
    }

    const job = await this.postingQueue.addPost({
      postId: postId,
      workspaceId: post.workspaceId.toString(),
      socialAccountId: post.socialAccountId._id.toString(),
      retryCount: 0,
      forceFail: true, // This triggers the failure injection
    });

    console.log('✅ Test job enqueued:', {
      jobId: job.id,
      postId: postId,
      forceFail: true,
    });
  }

  async monitorPostStatus(postId: string): Promise<TestResult> {
    console.log('👀 Starting post status monitoring...');
    console.log('Expected behavior:');
    console.log('  - Attempt 1: scheduled → publishing → scheduled (retry)');
    console.log('  - Attempt 2: scheduled → publishing → scheduled (retry)');
    console.log('  - Attempt 3: scheduled → publishing → failed (final)');
    console.log('');

    this.startTime = Date.now();
    let previousStatus = '';
    let previousRetryCount = 0;
    let stableCount = 0;

    return new Promise((resolve) => {
      const monitor = setInterval(async () => {
        try {
          const post = await Post.findById(postId);
          if (!post) {
            console.error('❌ Post not found during monitoring');
            clearInterval(monitor);
            resolve({
              postId,
              attemptsObserved: this.attemptsObserved,
              finalStatus: 'NOT_FOUND',
              finalRetryCount: 0,
              timeElapsed: Date.now() - this.startTime,
              success: false,
            });
            return;
          }

          const currentTime = new Date().toISOString().split('T')[1].split('.')[0];
          
          // Detect status changes
          if (post.status !== previousStatus || post.retryCount !== previousRetryCount) {
            if (post.status === PostStatus.PUBLISHING) {
              this.attemptsObserved++;
              console.log(`[${currentTime}] 🔄 ATTEMPT ${this.attemptsObserved}: ${previousStatus} → ${post.status} (retryCount: ${post.retryCount})`);
            } else {
              console.log(`[${currentTime}] 📊 STATUS: ${post.status}, retryCount: ${post.retryCount}${post.errorMessage ? `, error: ${post.errorMessage}` : ''}`);
            }
            
            previousStatus = post.status;
            previousRetryCount = post.retryCount;
            stableCount = 0;
          } else {
            stableCount++;
          }

          // Check if we've reached final failed state
          if (post.status === PostStatus.FAILED) {
            console.log('');
            console.log('🏁 FINAL STATE REACHED');
            clearInterval(monitor);
            
            const result: TestResult = {
              postId,
              attemptsObserved: this.attemptsObserved,
              finalStatus: post.status,
              finalRetryCount: post.retryCount,
              timeElapsed: Date.now() - this.startTime,
              success: this.attemptsObserved === 3 && post.status === PostStatus.FAILED && post.retryCount === 3,
            };
            
            resolve(result);
            return;
          }

          // Timeout after 5 minutes
          if (Date.now() - this.startTime > 300000) {
            console.log('');
            console.log('⏰ TIMEOUT: Test took longer than 5 minutes');
            clearInterval(monitor);
            
            resolve({
              postId,
              attemptsObserved: this.attemptsObserved,
              finalStatus: post.status,
              finalRetryCount: post.retryCount,
              timeElapsed: Date.now() - this.startTime,
              success: false,
            });
          }

        } catch (error: any) {
          console.error('❌ Error during monitoring:', error.message);
          clearInterval(monitor);
          resolve({
            postId,
            attemptsObserved: this.attemptsObserved,
            finalStatus: 'ERROR',
            finalRetryCount: 0,
            timeElapsed: Date.now() - this.startTime,
            success: false,
          });
        }
      }, 2000); // Check every 2 seconds
    });
  }

  printResults(result: TestResult): void {
    console.log('');
    console.log('📋 FINAL RESULT SUMMARY');
    console.log('========================');
    console.log(`Post ID: ${result.postId}`);
    console.log(`Attempts Observed: ${result.attemptsObserved}`);
    console.log(`Final Status: ${result.finalStatus}`);
    console.log(`Final Retry Count: ${result.finalRetryCount}`);
    console.log(`Time Elapsed: ${(result.timeElapsed / 1000).toFixed(1)}s`);
    console.log('');

    if (result.success) {
      console.log('✅ TEST PASSED');
      console.log('✅ Retry state machine working correctly');
      console.log('✅ 3 attempts observed');
      console.log('✅ Final status: failed');
      console.log('✅ Retry count properly incremented');
    } else {
      console.log('❌ TEST FAILED');
      console.log('Expected: 3 attempts, status=failed, retryCount=3');
      console.log(`Actual: ${result.attemptsObserved} attempts, status=${result.finalStatus}, retryCount=${result.finalRetryCount}`);
    }
    console.log('');
  }

  async cleanup(): Promise<void> {
    if (this.testPostId) {
      console.log('🧹 Cleaning up test post...');
      await Post.findByIdAndDelete(this.testPostId);
      console.log('✅ Test post cleaned up');
    }
    
    await mongoose.disconnect();
    console.log('✅ Database disconnected');
  }
}

async function runRetryTest(): Promise<void> {
  const tester = new RetryTester();
  
  try {
    await tester.initialize();
    
    const postId = await tester.createTestPost();
    tester.testPostId = postId;
    
    await tester.enqueueTestJob(postId);
    
    const result = await tester.monitorPostStatus(postId);
    
    tester.printResults(result);
    
    process.exit(result.success ? 0 : 1);
    
  } catch (error: any) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Test terminated');
  process.exit(1);
});

// Run the test
if (require.main === module) {
  runRetryTest();
}

export { runRetryTest, RetryTester };