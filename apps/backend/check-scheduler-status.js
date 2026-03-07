/**
 * Quick diagnostic to check scheduler status
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';

async function checkStatus() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    
    console.log('\n📊 SCHEDULER STATUS CHECK');
    console.log('='.repeat(60));
    
    // Check scheduled posts
    const scheduledPosts = await db.collection('posts').find({
      status: 'scheduled'
    }).toArray();
    
    console.log(`\n📝 Scheduled Posts: ${scheduledPosts.length}`);
    
    const now = new Date();
    scheduledPosts.forEach(post => {
      const scheduledAt = new Date(post.scheduledAt);
      const diff = scheduledAt - now;
      const diffSeconds = Math.floor(diff / 1000);
      
      console.log(`\n  Post ID: ${post._id}`);
      console.log(`  Scheduled: ${scheduledAt.toISOString()}`);
      console.log(`  Current:   ${now.toISOString()}`);
      console.log(`  Diff:      ${diffSeconds} seconds ${diffSeconds < 0 ? '(PAST)' : '(FUTURE)'}`);
      console.log(`  Status:    ${post.status}`);
    });
    
    // Check queued posts
    const queuedPosts = await db.collection('posts').find({
      status: 'queued'
    }).toArray();
    
    console.log(`\n📦 Queued Posts: ${queuedPosts.length}`);
    
    // Check published posts
    const publishedPosts = await db.collection('posts').find({
      status: 'published'
    }).toArray();
    
    console.log(`\n✅ Published Posts: ${publishedPosts.length}`);
    
    // Check failed posts
    const failedPosts = await db.collection('posts').find({
      status: 'failed'
    }).toArray();
    
    console.log(`\n❌ Failed Posts: ${failedPosts.length}`);
    
    console.log('\n' + '='.repeat(60));
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkStatus();
