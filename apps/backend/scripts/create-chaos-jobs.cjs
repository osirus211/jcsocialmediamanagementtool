const mongoose = require('mongoose');
const axios = require('axios');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';
const BASE_URL = 'http://127.0.0.1:5000/api/v1';
const TEST_USER = {
  email: 'test-composer@example.com',
  password: 'TestPassword123!',
};

async function createChaosJobs() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');
    
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, TEST_USER);
    const token = loginRes.data.accessToken;
    console.log('✅ Logged in');
    
    const workspacesRes = await axios.get(`${BASE_URL}/workspaces`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const workspaceId = workspacesRes.data.workspaces[0]._id;
    console.log('✅ Workspace ID:', workspaceId);
    
    const accountsRes = await axios.get(`${BASE_URL}/social/accounts`, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId,
      },
    });
    const socialAccountId = accountsRes.data.accounts[0]._id;
    console.log('✅ Social Account ID:', socialAccountId);
    
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: TEST_USER.email });
    const createdBy = user._id;
    
    const scheduledAt = new Date(Date.now() + 10000);
    const posts = [];
    
    for (let i = 0; i < 20; i++) {
      posts.push({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        socialAccountId: new mongoose.Types.ObjectId(socialAccountId),
        content: `Module 11 Chaos Test Post ${i + 1} - ${Date.now()}`,
        status: 'scheduled',
        scheduledAt: scheduledAt,
        createdBy: createdBy,
        retryCount: 0,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    
    const postsCollection = db.collection('posts');
    const result = await postsCollection.insertMany(posts);
    
    console.log(`✅ Inserted ${result.insertedCount} scheduled posts`);
    console.log(`📅 Scheduled for: ${scheduledAt.toISOString()}`);
    console.log(`⏰ Time until scheduled: 10 seconds`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

createChaosJobs();
