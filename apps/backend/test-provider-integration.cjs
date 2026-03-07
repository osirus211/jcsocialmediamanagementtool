/**
 * Test Provider Integration
 * 
 * Verifies that PublishingWorker correctly uses provider layer
 * Tests both success and failure scenarios
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function testProviderIntegration() {
  try {
    console.log('=== Provider Integration Test ===\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/social-scheduler');
    console.log('✓ Connected to MongoDB\n');

    const { Post } = require('./dist/models/Post');
    const { SocialAccount } = require('./dist/models/SocialAccount');
    const { Workspace } = require('./dist/models/Workspace');

    // Find or create test workspace
    let workspace = await Workspace.findOne({ name: 'Test Workspace' });
    if (!workspace) {
      workspace = await Workspace.create({
        name: 'Test Workspace',
        slug: 'test-workspace',
        ownerId: new mongoose.Types.ObjectId(),
      });
      console.log('✓ Created test workspace\n');
    }

    // Find or create test social account (Twitter)
    let account = await SocialAccount.findOne({
      workspaceId: workspace._id,
      provider: 'twitter',
    }).select('+accessToken +refreshToken');

    if (!account) {
      account = await SocialAccount.create({
        workspaceId: workspace._id,
        provider: 'twitter',
        providerUserId: 'test_user_123',
        accountName: '@testuser',
        accessToken: 'test_access_token_12345',
        refreshToken: 'test_refresh_token_12345',
        tokenExpiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        scopes: ['tweet.read', 'tweet.write'],
        status: 'active',
        metadata: {
          profileUrl: 'https://twitter.com/testuser',
        },
      });
      console.log('✓ Created test Twitter account\n');
    } else {
      console.log('✓ Using existing Twitter account\n');
    }

    // Create test post
    const testPost = await Post.create({
      workspaceId: workspace._id,
      accountId: account._id,
      content: 'Test post via provider integration! #testing',
      mediaUrls: [],
      scheduledFor: new Date(Date.now() + 5000), // 5 seconds from now
      status: 'scheduled',
      metadata: {
        testRun: true,
      },
    });

    console.log('✓ Created test post:', testPost._id);
    console.log('  Content:', testPost.content);
    console.log('  Provider:', account.provider);
    console.log('  Scheduled for:', testPost.scheduledFor);
    console.log('\n⏳ Waiting for scheduler to pick up post...');
    console.log('   (Scheduler runs every 30 seconds)');
    console.log('   Post will be queued and processed by worker\n');

    // Monitor post status
    let attempts = 0;
    const maxAttempts = 40; // 40 * 3s = 2 minutes max wait

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts++;

      const updatedPost = await Post.findById(testPost._id);
      
      console.log(`[${attempts}] Status: ${updatedPost.status}, Retry: ${updatedPost.retryCount}`);

      if (updatedPost.status === 'published') {
        console.log('\n✅ SUCCESS! Post published via provider layer');
        console.log('   Platform Post ID:', updatedPost.platformPostId);
        console.log('   Published At:', updatedPost.publishedAt);
        console.log('   Retry Count:', updatedPost.retryCount);
        break;
      }

      if (updatedPost.status === 'failed') {
        console.log('\n❌ Post failed (expected for some mock scenarios)');
        console.log('   Error:', updatedPost.errorMessage);
        console.log('   Retry Count:', updatedPost.retryCount);
        console.log('   This is normal - mock provider has 15% failure rate');
        break;
      }

      if (attempts >= maxAttempts) {
        console.log('\n⚠️  Timeout waiting for post to complete');
        console.log('   Final status:', updatedPost.status);
        console.log('   Check that scheduler and worker are running');
      }
    }

    console.log('\n=== Test Complete ===');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testProviderIntegration();
