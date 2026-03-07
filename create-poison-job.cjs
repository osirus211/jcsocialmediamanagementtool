const { MongoClient, ObjectId } = require('mongodb');

async function createPoisonJob() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
  await client.connect();
  const db = client.db();
  
  // Get existing workspace and user
  const workspace = await db.collection('workspaces').findOne();
  const user = await db.collection('users').findOne();
  
  if (!workspace || !user) {
    console.error('❌ No workspace or user found');
    await client.close();
    return null;
  }
  
  // Create a social account with INVALID provider
  const invalidAccount = await db.collection('socialaccounts').insertOne({
    workspaceId: workspace._id,
    provider: 'INVALID_PROVIDER', // This will cause publish to fail
    accountName: 'Poison Job Account',
    accountHandle: '@poisonjob',
    accessToken: 'INVALID_TOKEN',
    refreshToken: 'INVALID_REFRESH',
    tokenExpiresAt: new Date(Date.now() + 3600000),
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  console.log(`✅ Created invalid social account: ${invalidAccount.insertedId}`);
  
  // Create post scheduled for immediate execution
  const poisonPost = await db.collection('posts').insertOne({
    workspaceId: workspace._id,
    socialAccountId: invalidAccount.insertedId,
    content: 'POISON JOB - This post will always fail',
    status: 'scheduled',
    scheduledAt: new Date(Date.now() - 1000), // 1 second in the past (immediate pickup)
    createdBy: user._id,
    retryCount: 0,
    metadata: {
      testType: 'poison_job',
      expectedBehavior: 'fail_after_max_retries'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  console.log(`✅ Created poison job post: ${poisonPost.insertedId}`);
  console.log('⏳ Post will be picked up by scheduler immediately');
  console.log('⏳ Worker will retry 3 times, then mark as failed');
  
  await client.close();
  
  return {
    accountId: invalidAccount.insertedId.toString(),
    postId: poisonPost.insertedId.toString()
  };
}

createPoisonJob().then(result => {
  if (result) {
    console.log('\n📋 Monitor this post:');
    console.log(`Post ID: ${result.postId}`);
    console.log(`Account ID: ${result.accountId}`);
    console.log('\nExpected behavior:');
    console.log('1. Scheduler picks up post');
    console.log('2. Worker attempts to publish (fails)');
    console.log('3. Worker retries 2 more times (fails each time)');
    console.log('4. Post status changes to "failed"');
    console.log('5. Job moves to failed queue in Redis');
    console.log('6. Worker continues processing other jobs');
  }
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
