/**
 * Test getEligiblePostsForQueue directly
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';

async function testEligiblePosts() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    console.log('\n🔍 Testing getEligiblePostsForQueue logic...\n');
    
    const now = new Date();
    console.log('Current time:', now.toISOString());
    
    // Simulate the query
    const posts = await mongoose.connection.db.collection('posts').find({
      status: 'scheduled',
      scheduledAt: { $lte: now },
    }).toArray();
    
    console.log(`\nFound ${posts.length} eligible posts:\n`);
    
    posts.forEach(post => {
      console.log(`  Post ID: ${post._id}`);
      console.log(`  Status: ${post.status}`);
      console.log(`  Scheduled: ${post.scheduledAt}`);
      console.log(`  Workspace: ${post.workspaceId}`);
      console.log(`  Social Account: ${post.socialAccountId}`);
      console.log('');
    });
    
    // Check if socialAccountId is populated
    if (posts.length > 0) {
      const firstPost = posts[0];
      console.log('Checking if socialAccountId needs population...');
      console.log('socialAccountId type:', typeof firstPost.socialAccountId);
      console.log('socialAccountId value:', firstPost.socialAccountId);
      
      // Try to populate
      const Post = mongoose.model('Post', new mongoose.Schema({}, { strict: false }));
      const populatedPost = await Post.findById(firstPost._id).populate('socialAccountId');
      
      console.log('\nAfter population:');
      console.log('socialAccountId:', populatedPost.socialAccountId);
    }
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testEligiblePosts();
