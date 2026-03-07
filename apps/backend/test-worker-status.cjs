const mongoose = require('mongoose');

// Connect to MongoDB
async function testWorkerStatus() {
  try {
    await mongoose.connect('mongodb://localhost:27017/social_media_scheduler');
    console.log('✓ Connected to MongoDB');

    // Import models
    const { Post } = require('./dist/models/Post');
    const { SocialAccount } = require('./dist/models/SocialAccount');
    const { Workspace } = require('./dist/models/Workspace');
    const { User } = require('./dist/models/User');

    // Find existing test data
    const user = await User.findOne({ email: 'test@example.com' });
    if (!user) {
      console.log('❌ Test user not found');
      return;
    }
    console.log('✓ Found test user:', user._id);

    const workspace = await Workspace.findOne({ ownerId: user._id });
    if (!workspace) {
      console.log('❌ Test workspace not found');
      return;
    }
    console.log('✓ Found test workspace:', workspace._id);

    const socialAccount = await SocialAccount.findOne({ workspaceId: workspace._id });
    if (!socialAccount) {
      console.log('❌ Test social account not found');
      return;
    }
    console.log('✓ Found test social account:', socialAccount._id, socialAccount.platform);

    // Create a test post scheduled 1 minute in the future
    const scheduledAt = new Date(Date.now() + 60 * 1000); // 1 minute from now
    
    const post = new Post({
      workspaceId: workspace._id,
      socialAccountId: socialAccount._id,
      content: 'Test post for worker status update verification - should fail with dummy tokens',
      mediaUrls: [],
      status: 'scheduled',
      scheduledAt: scheduledAt,
      createdBy: user._id,
      retryCount: 0,
      metadata: {}
    });

    await post.save();
    console.log('✓ Created test post:', post._id);
    console.log('  - Status:', post.status);
    console.log('  - Scheduled at:', post.scheduledAt);
    console.log('  - Social account platform:', socialAccount.platform);

    console.log('\n📋 VERIFICATION STEPS:');
    console.log('1. Wait for scheduler to queue the post (should happen within 30 seconds)');
    console.log('2. Worker will attempt to publish with dummy tokens (will fail)');
    console.log('3. Worker will retry 3 times total');
    console.log('4. After final failure, post status should be "failed"');
    console.log('\n🔍 Monitor with:');
    console.log('docker-compose -f docker-compose.production.yml logs worker -f');
    console.log('\n📊 Check post status with:');
    console.log(`node -e "const mongoose = require('mongoose'); mongoose.connect('mongodb://localhost:27017/social_media_scheduler').then(async () => { const { Post } = require('./dist/models/Post'); const post = await Post.findById('${post._id}'); console.log('Post status:', post.status, 'Error:', post.errorMessage); process.exit(0); })"`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testWorkerStatus();