const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');

async function testPoisonViaAPI() {
  try {
    // Login
    const loginRes = await axios.post('http://127.0.0.1:5000/api/v1/auth/login', {
      email: 'test-composer@example.com',
      password: 'TestPassword123!'
    });
    
    const token = loginRes.data.accessToken;
    console.log('✅ Logged in');
    
    // Get workspaces
    const workspacesRes = await axios.get('http://127.0.0.1:5000/api/v1/workspaces', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const workspaceId = workspacesRes.data.workspaces[0]._id;
    console.log('✅ Got workspace:', workspaceId);
    
    // Create invalid social account directly in MongoDB
    const mongoClient = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
    await mongoClient.connect();
    const db = mongoClient.db();
    
    const invalidAccount = await db.collection('socialaccounts').insertOne({
      workspaceId: new ObjectId(workspaceId),
      provider: 'INVALID_PROVIDER',
      accountName: 'Poison Test Account',
      accountHandle: '@poisontest',
      accessToken: 'INVALID_TOKEN',
      refreshToken: 'INVALID_REFRESH',
      tokenExpiresAt: new Date(Date.now() + 3600000),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    console.log('✅ Created invalid social account:', invalidAccount.insertedId.toString());
    
    await mongoClient.close();
    
    // Create post via API
    const postRes = await axios.post('http://127.0.0.1:5000/api/v1/posts', {
      socialAccountId: invalidAccount.insertedId.toString(),
      content: 'POISON JOB TEST - This will fail due to invalid provider',
      scheduledAt: new Date(Date.now() + 3000) // 3 seconds from now
    }, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId
      }
    });
    
    const postId = postRes.data.post._id;
    console.log('✅ Created post:', postId);
    console.log('\n📋 Expected behavior:');
    console.log('1. Scheduler picks up post in ~3 seconds');
    console.log('2. Worker attempts to publish (fails - invalid provider)');
    console.log('3. Worker retries with exponential backoff (3 attempts total)');
    console.log('4. Post status changes to "failed"');
    console.log('5. Job moves to failed queue');
    console.log('\n⏳ Wait 2-3 minutes, then check:');
    console.log(`   node check-poison-job-status.cjs ${postId}`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testPoisonViaAPI();
