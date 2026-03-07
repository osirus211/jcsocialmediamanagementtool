import { MongoClient } from 'mongodb';

async function createImmediatePost() {
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
  
  console.log('Creating immediate test post...');
  
  const result = await db.collection('posts').insertOne({
    workspaceId: workspace._id,
    socialAccountId: account._id,
    content: `Immediate test post - should be picked up now`,
    status: 'scheduled',
    scheduledAt: new Date(Date.now() - 1000), // 1 second ago
    createdBy: user._id,
    retryCount: 0,
    metadata: {
      testType: 'immediate_test'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  console.log('✅ Created immediate post:', result.insertedId);
  console.log('Status:', 'scheduled');
  console.log('ScheduledAt:', new Date(Date.now() - 1000));
  
  await client.close();
}

createImmediatePost();
