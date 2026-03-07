const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');

async function testNormalJob() {
  try {
    // First, restore the social account
    const mongoClient = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
    await mongoClient.connect();
    const db = mongoClient.db();
    
    await db.collection('socialaccounts').updateOne(
      { _id: new ObjectId('6999e6e24b8d7464fd13f138') },
      { $set: { provider: 'twitter' } }
    );
    
    console.log('✅ Restored social account provider');
    await mongoClient.close();
    
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
    
    // Get social accounts
    const accountsRes = await axios.get('http://127.0.0.1:5000/api/v1/social/accounts', {
      headers: { 
        Authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId
      }
    });
    
    const socialAccountId = accountsRes.data.accounts[0]._id;
    console.log('✅ Got social account:', socialAccountId);
    
    // Create normal post
    const postRes = await axios.post('http://127.0.0.1:5000/api/v1/posts', {
      socialAccountId: socialAccountId,
      content: 'Normal post after poison job test - verifying worker still processes jobs',
      scheduledAt: new Date(Date.now() + 3000) // 3 seconds from now
    }, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId
      }
    });
    
    const postId = postRes.data.post._id;
    console.log('✅ Created normal post:', postId);
    console.log('\n⏳ Wait 30 seconds, then check:');
    console.log(`   node check-poison-job-status.cjs ${postId}`);
    console.log('\n📋 Expected: Post should be processed normally (published or failed with normal error)');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testNormalJob();
