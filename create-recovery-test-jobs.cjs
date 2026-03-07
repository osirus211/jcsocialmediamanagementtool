const { MongoClient, ObjectId } = require('mongodb');

async function createRecoveryJobs() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
  await client.connect();
  const db = client.db();
  
  // Get existing workspace, user, and social account
  const workspace = await db.collection('workspaces').findOne();
  const user = await db.collection('users').findOne();
  const account = await db.collection('socialaccounts').findOne({
    workspaceId: workspace._id,
    status: 'active'
  });
  
  if (!workspace || !user || !account) {
    console.error('Missing required data');
    return;
  }
  
  const postIds = [];
  
  // Create 10 posts scheduled for 30 seconds from now
  for (let i = 1; i <= 10; i++) {
    const result = await db.collection('posts').insertOne({
      workspaceId: workspace._id,
      socialAccountId: account._id,
      content: `Recovery test post ${i} - Testing crash recovery`,
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 30000), // 30 seconds
      createdBy: user._id,
      retryCount: 0,
      metadata: {
        testType: 'crash_recovery',
        testNumber: i
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    postIds.push(result.insertedId.toString());
    console.log(`✅ Created recovery test post ${i}: ${result.insertedId}`);
  }
  
  await client.close();
  
  console.log('\n📋 Created 10 recovery test posts');
  console.log('⏳ Posts scheduled for 30 seconds from now');
  console.log('\n🔴 READY FOR REDIS RESTART TEST');
  
  return postIds;
}

createRecoveryJobs().then(postIds => {
  console.log('\n📝 Post IDs for tracking:');
  postIds.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
