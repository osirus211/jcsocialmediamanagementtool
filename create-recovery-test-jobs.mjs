import { MongoClient, ObjectId } from 'mongodb';

async function createRecoveryJobs() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
  await client.connect();
  const db = client.db();
  
  // Get existing workspace and user
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
  
  console.log('Creating 10 recovery test jobs...');
  const postIds = [];
  
  for (let i = 0; i < 10; i++) {
    const scheduledAt = new Date(Date.now() + 30000 + (i * 5000)); // 30s + 5s intervals
    
    const result = await db.collection('posts').insertOne({
      workspaceId: workspace._id,
      socialAccountId: account._id,
      content: `Recovery test post ${i + 1} - Testing crash recovery`,
      status: 'scheduled',
      scheduledAt,
      createdBy: user._id,
      retryCount: 0,
      metadata: {
        testType: 'crash_recovery',
        testNumber: i + 1
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    postIds.push(result.insertedId.toString());
    console.log(`✅ Created post ${i + 1}: ${result.insertedId}`);
  }
  
  console.log('\n📋 Test Jobs Summary:');
  console.log(`Total: 10 posts`);
  console.log(`Scheduled: 30-75 seconds from now`);
  console.log(`Status: scheduled`);
  console.log(`\nPost IDs:`);
  postIds.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));
  
  await client.close();
  return postIds;
}

createRecoveryJobs().catch(console.error);
