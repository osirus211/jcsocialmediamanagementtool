/**
 * Manually trigger scheduler to see what happens
 */

const axios = require('axios');

async function triggerScheduler() {
  try {
    console.log('🔄 Manually triggering scheduler...');
    
    // Login first
    const loginResponse = await axios.post('http://127.0.0.1:5000/api/v1/auth/login', {
      email: 'test-composer@example.com',
      password: 'TestPassword123!',
    });
    
    const token = loginResponse.data.accessToken;
    console.log('✅ Logged in');
    
    // Check if there's an admin endpoint to trigger scheduler
    // If not, we'll need to check the logs
    
    console.log('\n📊 Checking current post status...');
    const mongoose = require('mongoose');
    await mongoose.connect('mongodb://127.0.0.1:27017/social-media-scheduler');
    const db = mongoose.connection.db;
    
    const scheduledPosts = await db.collection('posts').find({
      status: 'scheduled',
      scheduledAt: { $lte: new Date() }
    }).toArray();
    
    console.log(`Found ${scheduledPosts.length} eligible posts`);
    scheduledPosts.forEach(post => {
      console.log(`  - ${post._id}: scheduled for ${post.scheduledAt}`);
    });
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

triggerScheduler();
