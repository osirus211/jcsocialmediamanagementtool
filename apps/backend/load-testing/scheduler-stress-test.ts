/**
 * Scheduler Stress Test
 * 
 * Tests scheduler with many posts due simultaneously
 * 
 * Usage:
 *   npm run load-test:scheduler -- --posts 5000
 */

import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { connectRedis, disconnectRedis } from '../src/config/redis';
import { TestDataFactory } from './utils/test-data-factory';
import { MetricsCollector } from './utils/metrics-collector';

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: any = {
    posts: 5000,
    platforms: 'twitter,linkedin,facebook',
    burstMinutes: 1, // Schedule all posts 1 minute from now
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key === 'posts' || key === 'burstMinutes') {
      options[key] = parseInt(value, 10);
    } else {
      options[key] = value;
    }
  }

  return options;
}

async function schedulerStressTest() {
  const options = parseArgs();
  const platforms = options.platforms.split(',').map((p: string) => p.trim());
  
  console.log('\n🚀 Starting Scheduler Stress Test...');
  console.log(`   Posts: ${options.posts}`);
  console.log(`   Platforms: ${platforms.join(', ')}`);
  console.log(`   Burst time: ${options.burstMinutes} minute(s) from now\n`);

  const metrics = new MetricsCollector('Scheduler Stress Test');

  try {
    // Connect to database and Redis
    console.log('📦 Connecting to database and Redis...');
    await connectDatabase();
    await connectRedis();
    console.log('✅ Connected\n');

    // Import models and services
    const { User } = await import('../src/models/User');
    const { Workspace } = await import('../src/models/Workspace');
    const { SocialAccount } = await import('../src/models/SocialAccount');
    const { Post, PostStatus } = await import('../src/models/Post');
    const { schedulerWorker } = await import('../src/workers/SchedulerWorker');
    const { SchedulerQueue } = await import('../src/queue/SchedulerQueue');

    // Step 1: Create test data
    console.log('👤 Creating test user and workspace...');
    const userData = TestDataFactory.generateUser();
    const user = await User.create({
      ...userData,
      emailVerified: true,
      metadata: { testUser: true },
    });
    
    const workspaceData = TestDataFactory.generateWorkspace(user._id.toString());
    const workspace = await Workspace.create({
      ...workspaceData,
      metadata: { testWorkspace: true },
    });
    console.log(`✅ Created workspace: ${workspace.name}`);

    // Step 2: Create social accounts
    console.log(`\n📱 Creating social accounts...`);
    const accountsPerPlatform = 10;
    const socialAccounts: any[] = [];
    
    for (const platform of platforms) {
      for (let i = 0; i < accountsPerPlatform; i++) {
        const accountData = TestDataFactory.generateSocialAccount(
          workspace._id.toString(),
          platform
        );
        
        const account = await SocialAccount.create({
          ...accountData,
          workspaceId: workspace._id,
          metadata: { testAccount: true },
        });
        
        socialAccounts.push(account);
      }
      console.log(`✅ ${platform}: ${accountsPerPlatform} accounts`);
    }

    // Step 3: Create burst posts (all scheduled at same time)
    console.log(`\n📝 Creating ${options.posts} burst posts...`);
    const burstTime = TestDataFactory.generateBurstTime(options.burstMinutes);
    console.log(`   Scheduled for: ${burstTime.toISOString()}`);
    
    const batchSize = 100;
    let postsCreated = 0;
    
    for (let i = 0; i < options.posts; i += batchSize) {
      const batch = [];
      const batchCount = Math.min(batchSize, options.posts - i);
      
      for (let j = 0; j < batchCount; j++) {
        const selectedPlatforms = TestDataFactory.selectRandomPlatforms(platforms, 1, 3);
        const selectedAccounts = selectedPlatforms.map(platform => {
          const platformAccounts = socialAccounts.filter(a => a.provider === platform);
          return platformAccounts[Math.floor(Math.random() * platformAccounts.length)];
        });
        
        const postData = TestDataFactory.generatePost(
          workspace._id.toString(),
          selectedAccounts.map(a => a._id.toString()),
          burstTime, // All posts at same time
          false
        );
        
        batch.push({
          ...postData,
          workspaceId: workspace._id,
          socialAccountId: selectedAccounts[0]._id,
          socialAccountIds: selectedAccounts.map(a => a._id),
        });
      }
      
      await Post.insertMany(batch);
      postsCreated += batch.length;
      
      if (postsCreated % 500 === 0) {
        console.log(`   ${postsCreated}/${options.posts} posts created`);
      }
    }
    
    console.log(`✅ Created ${postsCreated} posts`);
    metrics.set('totalPosts', postsCreated);

    // Step 4: Wait for burst time
    const waitTime = burstTime.getTime() - Date.now();
    if (waitTime > 0) {
      console.log(`\n⏳ Waiting ${Math.ceil(waitTime / 1000)}s for burst time...`);
      await new Promise(resolve => setTimeout(resolve, waitTime + 1000)); // Wait 1s extra
    }

    // Step 5: Trigger scheduler manually
    console.log('\n🔥 Triggering scheduler...');
    const schedulerStartTime = Date.now();
    
    // Get eligible posts count
    const eligibleCount = await Post.countDocuments({
      status: PostStatus.SCHEDULED,
      scheduledAt: { $lte: new Date() },
    });
    console.log(`   Eligible posts: ${eligibleCount}`);
    
    // Measure MongoDB query time
    const queryStartTime = Date.now();
    const eligiblePosts = await Post.find({
      status: PostStatus.SCHEDULED,
      scheduledAt: { $lte: new Date() },
    })
      .limit(100) // Scheduler batch size
      .sort({ scheduledAt: 1 })
      .lean();
    const queryTime = Date.now() - queryStartTime;
    
    console.log(`   MongoDB query time: ${queryTime}ms`);
    metrics.setCustom('mongoQueryTime', queryTime);
    metrics.setCustom('eligiblePosts', eligibleCount);
    metrics.setCustom('batchSize', eligiblePosts.length);

    // Start scheduler worker
    schedulerWorker.start();
    
    // Wait for scheduler to process
    console.log('\n⏳ Waiting for scheduler to process...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const schedulerDuration = Date.now() - schedulerStartTime;
    console.log(`✅ Scheduler completed in ${schedulerDuration}ms`);
    metrics.setCustom('schedulerDuration', schedulerDuration);

    // Step 6: Check results
    console.log('\n📊 Checking results...');
    
    const queuedCount = await Post.countDocuments({
      workspaceId: workspace._id,
      status: PostStatus.QUEUED,
    });
    
    const stillScheduledCount = await Post.countDocuments({
      workspaceId: workspace._id,
      status: PostStatus.SCHEDULED,
      scheduledAt: { $lte: new Date() },
    });
    
    console.log(`   Posts queued: ${queuedCount}`);
    console.log(`   Posts still scheduled: ${stillScheduledCount}`);
    
    metrics.setCustom('postsQueued', queuedCount);
    metrics.setCustom('postsStillScheduled', stillScheduledCount);

    // Get scheduler metrics
    const schedulerMetrics = schedulerWorker.getMetrics();
    console.log(`\n📈 Scheduler Metrics:`);
    console.log(`   Runs: ${schedulerMetrics.scheduler_runs_total}`);
    console.log(`   Posts processed: ${schedulerMetrics.posts_processed_total}`);
    console.log(`   Jobs created: ${schedulerMetrics.jobs_created_total}`);
    console.log(`   Errors: ${schedulerMetrics.errors_total}`);
    
    metrics.setCustom('schedulerRuns', schedulerMetrics.scheduler_runs_total);
    metrics.setCustom('jobsCreated', schedulerMetrics.jobs_created_total);

    // Calculate throughput
    if (schedulerDuration > 0) {
      const postsPerSecond = (eligiblePosts.length / schedulerDuration) * 1000;
      const jobsPerSecond = (schedulerMetrics.jobs_created_total / schedulerDuration) * 1000;
      
      console.log(`\n⚡ Throughput:`);
      console.log(`   Posts/sec: ${postsPerSecond.toFixed(2)}`);
      console.log(`   Jobs/sec: ${jobsPerSecond.toFixed(2)}`);
      
      metrics.setCustom('postsPerSecond', postsPerSecond);
      metrics.setCustom('jobsPerSecond', jobsPerSecond);
    }

    // Stop scheduler
    await schedulerWorker.stop();

    // Print summary
    metrics.finalize();
    metrics.printSummary();

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await Post.deleteMany({ workspaceId: workspace._id });
    await SocialAccount.deleteMany({ workspaceId: workspace._id });
    await Workspace.deleteOne({ _id: workspace._id });
    await User.deleteOne({ _id: user._id });
    console.log('✅ Cleanup complete\n');

  } catch (error: any) {
    console.error('\n❌ Error in scheduler stress test:', error.message);
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
  schedulerStressTest().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { schedulerStressTest };
