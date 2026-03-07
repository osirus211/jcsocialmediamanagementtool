import { MongoClient, ObjectId } from 'mongodb';

async function createLoadTestData() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('social-media-scheduler');
    
    // Find or create user
    let user = await db.collection('users').findOne({ email: 'qatest@example.com' });
    if (!user) {
      console.log('Creating test user...');
      const result = await db.collection('users').insertOne({
        email: 'qatest@example.com',
        password: 'hashed_password',
        name: 'QA Test User',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      user = { _id: result.insertedId, email: 'qatest@example.com' };
    }
    console.log(`✅ User: ${user.email}`);
    
    // Find or create workspace
    let workspace = await db.collection('workspaces').findOne({ ownerId: user._id });
    if (!workspace) {
      console.log('Creating test workspace...');
      const result = await db.collection('workspaces').insertOne({
        name: 'Load Test Workspace',
        slug: 'load-test-workspace',
        ownerId: user._id,
        plan: 'pro',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      workspace = { _id: result.insertedId, name: 'Load Test Workspace', ownerId: user._id };
    }
    console.log(`✅ Workspace: ${workspace.name}`);
    
    // Find or create social account
    let socialAccount = await db.collection('socialaccounts').findOne({ workspaceId: workspace._id });
    if (!socialAccount) {
      console.log('Creating test social account...');
      const result = await db.collection('socialaccounts').insertOne({
        workspaceId: workspace._id,
        platform: 'twitter',
        accountName: 'Test Twitter Account',
        accountId: 'test_twitter_123',
        accessToken: 'mock_token',
        refreshToken: 'mock_refresh',
        tokenExpiry: new Date(Date.now() + 86400000),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      socialAccount = { _id: result.insertedId, accountName: 'Test Twitter Account', workspaceId: workspace._id };
    }
    console.log(`✅ Social Account: ${socialAccount.accountName}`);
    
    // Create 300 posts
    console.log('\n🚀 Creating 300 scheduled posts...');
    
    const postsCollection = db.collection('posts');
    const scheduledAt = new Date(Date.now() + 10000); // 10 seconds from now
    const posts = [];
    
    for (let i = 0; i < 300; i++) {
      posts.push({
        workspaceId: workspace._id,
        userId: user._id,
        socialAccountId: socialAccount._id,
        content: `Load test post ${i + 1} - Testing queue backpressure and worker stability`,
        platform: 'twitter',
        status: 'scheduled',
        scheduledAt,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Insert in batches
      if (posts.length === 50 || i === 299) {
        await postsCollection.insertMany(posts);
        console.log(`📝 Inserted ${i + 1}/300 posts`);
        posts.length = 0;
      }
    }
    
    console.log('\n✅ All 300 posts created in database!');
    console.log('⏳ Posts will be picked up by scheduler in ~10 seconds');
    console.log('\n📊 MONITORING:');
    console.log('   Watch backend logs for:');
    console.log('   - Posts being enqueued');
    console.log('   - "Backpressure detected" messages');
    console.log('   - Queue depth warnings');
    console.log('   - Worker processing jobs');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.close();
  }
}

createLoadTestData();
