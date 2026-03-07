/**
 * Test Data Generator
 * 
 * Generates large volumes of test posts for load testing
 * 
 * Usage:
 *   npm run load-test:generate -- --posts 10000 --accounts 2000 --platforms twitter,linkedin,facebook
 */

import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { TestDataFactory } from './utils/test-data-factory';
import { MetricsCollector } from './utils/metrics-collector';

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: any = {
    posts: 1000,
    accounts: 100,
    platforms: 'twitter,linkedin,facebook',
    spread: 60, // minutes
    media: 0.3, // 30% of posts have media
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key === 'posts' || key === 'accounts' || key === 'spread') {
      options[key] = parseInt(value, 10);
    } else if (key === 'media') {
      options[key] = parseFloat(value);
    } else {
      options[key] = value;
    }
  }

  return options;
}

async function generateTestData() {
  const options = parseArgs();
  const platforms = options.platforms.split(',').map((p: string) => p.trim());
  
  console.log('\n🚀 Starting test data generation...');
  console.log(`   Posts: ${options.posts}`);
  console.log(`   Accounts: ${options.accounts}`);
  console.log(`   Platforms: ${platforms.join(', ')}`);
  console.log(`   Time spread: ${options.spread} minutes`);
  console.log(`   Media: ${(options.media * 100).toFixed(0)}%\n`);

  const metrics = new MetricsCollector('Test Data Generation');

  try {
    // Connect to database
    console.log('📦 Connecting to database...');
    await connectDatabase();
    console.log('✅ Database connected\n');

    // Import models (after DB connection)
    const { User } = await import('../src/models/User');
    const { Workspace } = await import('../src/models/Workspace');
    const { SocialAccount } = await import('../src/models/SocialAccount');
    const { Post } = await import('../src/models/Post');

    // Step 1: Create test user
    console.log('👤 Creating test user...');
    const userData = TestDataFactory.generateUser();
    const user = await User.create({
      ...userData,
      emailVerified: true,
      metadata: { testUser: true },
    });
    console.log(`✅ Created user: ${user.email}`);
    metrics.set('userId', user._id.toString());

    // Step 2: Create test workspace
    console.log('\n🏢 Creating test workspace...');
    const workspaceData = TestDataFactory.generateWorkspace(user._id.toString());
    const workspace = await Workspace.create({
      ...workspaceData,
      metadata: { testWorkspace: true },
    });
    console.log(`✅ Created workspace: ${workspace.name}`);
    metrics.set('workspaceId', workspace._id.toString());

    // Step 3: Create social accounts
    console.log(`\n📱 Creating ${options.accounts} social accounts...`);
    const accountsPerPlatform = Math.ceil(options.accounts / platforms.length);
    const socialAccounts: any[] = [];
    
    for (const platform of platforms) {
      const count = Math.min(accountsPerPlatform, options.accounts - socialAccounts.length);
      
      for (let i = 0; i < count; i++) {
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
        
        if ((i + 1) % 100 === 0) {
          console.log(`   ${platform}: ${i + 1}/${count} accounts created`);
        }
      }
      
      console.log(`✅ ${platform}: ${count} accounts created`);
    }
    
    metrics.set('totalAccounts', socialAccounts.length);

    // Step 4: Create posts
    console.log(`\n📝 Creating ${options.posts} posts...`);
    const batchSize = 100;
    let postsCreated = 0;
    
    for (let i = 0; i < options.posts; i += batchSize) {
      const batch = [];
      const batchCount = Math.min(batchSize, options.posts - i);
      
      for (let j = 0; j < batchCount; j++) {
        // Select random accounts (1-3 platforms)
        const selectedPlatforms = TestDataFactory.selectRandomPlatforms(platforms, 1, 3);
        const selectedAccounts = selectedPlatforms.map(platform => {
          const platformAccounts = socialAccounts.filter(a => a.provider === platform);
          return platformAccounts[Math.floor(Math.random() * platformAccounts.length)];
        });
        
        // Generate scheduled time
        const scheduledAt = TestDataFactory.generateScheduledTime(options.spread);
        
        // Generate post
        const includeMedia = Math.random() < options.media;
        const postData = TestDataFactory.generatePost(
          workspace._id.toString(),
          selectedAccounts.map(a => a._id.toString()),
          scheduledAt,
          includeMedia
        );
        
        batch.push({
          ...postData,
          workspaceId: workspace._id,
          socialAccountId: selectedAccounts[0]._id, // Primary account
          socialAccountIds: selectedAccounts.map(a => a._id),
        });
      }
      
      // Insert batch
      await Post.insertMany(batch);
      postsCreated += batch.length;
      
      console.log(`   ${postsCreated}/${options.posts} posts created`);
    }
    
    console.log(`✅ Created ${postsCreated} posts`);
    metrics.set('totalPosts', postsCreated);

    // Step 5: Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test Data Generation Complete');
    console.log('='.repeat(60));
    console.log(`User: ${user.email}`);
    console.log(`Workspace: ${workspace.name}`);
    console.log(`Accounts: ${socialAccounts.length}`);
    
    // Count posts per platform
    const postsByPlatform: Record<string, number> = {};
    for (const platform of platforms) {
      const count = await Post.countDocuments({
        workspaceId: workspace._id,
        'metadata.testPost': true,
        socialAccountIds: {
          $in: socialAccounts.filter(a => a.provider === platform).map(a => a._id),
        },
      });
      postsByPlatform[platform] = count;
      console.log(`   ${platform}: ${count} posts`);
    }
    
    console.log(`Total Posts: ${postsCreated}`);
    console.log(`Scheduled: Next ${options.spread} minutes`);
    console.log('='.repeat(60) + '\n');

    // Save IDs for cleanup
    const testDataIds = {
      userId: user._id.toString(),
      workspaceId: workspace._id.toString(),
      accountIds: socialAccounts.map(a => a._id.toString()),
      generatedAt: new Date().toISOString(),
    };
    
    const fs = await import('fs');
    fs.writeFileSync(
      'load-testing/.test-data-ids.json',
      JSON.stringify(testDataIds, null, 2)
    );
    
    console.log('💾 Test data IDs saved to load-testing/.test-data-ids.json');
    console.log('   Use cleanup script to remove test data\n');

  } catch (error: any) {
    console.error('\n❌ Error generating test data:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await disconnectDatabase();
    console.log('👋 Database disconnected\n');
  }
}

// Run if called directly
if (require.main === module) {
  generateTestData().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { generateTestData };
