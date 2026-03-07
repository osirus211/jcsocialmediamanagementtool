import { MongoClient, ObjectId } from 'mongodb';

async function directLoadTest() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('social-media-tool');
    
    // Get user and workspace
    const user = await db.collection('users').findOne({ email: 'billing-test-1771698236603@example.com' });
    const workspace = await db.collection('workspaces').findOne({ ownerId: user._id });
    const socialAccount = await db.collection('socialaccounts').findOne({ workspaceId: workspace._id });
    
    console.log(`✅ User: ${user.email}`);
    console.log(`✅ Workspace: ${workspace.name}`);
    console.log(`✅ Social Account: ${socialAccount.accountName}`);
    
    // Create 300 posts directly in MongoDB
    console.log('\n🚀 Creating 300 scheduled posts directly in MongoDB...');
    
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
    console.log('\n📊 MONITORING INSTRUCTIONS:');
    console.log('   1. Check queue depth:');
    console.log('      (Install redis-cli or use Redis GUI)');
    console.log('   2. Check metrics:');
    console.log('      curl -s http://127.0.0.1:5000/metrics | grep queue');
    console.log('   3. Watch backend logs for:');
    console.log('      - "Backpressure triggered"');
    console.log('      - "Scheduler paused"');
    console.log('      - Queue depth messages');
    console.log('   4. Monitor system resources (CPU, memory)');
    console.log('\n⏱️  Wait 5-10 minutes for queue to drain, then check:');
    console.log('      - All posts should have status "published" or "failed"');
    console.log('      - No posts stuck in "queued" status');
    console.log('      - System should remain stable');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.close();
  }
}

directLoadTest();
