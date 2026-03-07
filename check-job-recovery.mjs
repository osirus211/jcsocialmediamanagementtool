import { MongoClient } from 'mongodb';

async function checkRecovery() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
  await client.connect();
  const db = client.db();
  
  // Check posts with crash_recovery metadata
  const recoveryPosts = await db.collection('posts').find({
    'metadata.testType': 'crash_recovery'
  }).toArray();
  
  console.log('\n📋 Recovery Test Posts Status:');
  console.log(`Total: ${recoveryPosts.length}`);
  
  const statusCounts = {};
  recoveryPosts.forEach(post => {
    statusCounts[post.status] = (statusCounts[post.status] || 0) + 1;
  });
  
  console.log('\nStatus Distribution:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  
  // Check if any were lost
  if (recoveryPosts.length < 10) {
    console.log(`\n❌ JOB LOSS DETECTED: Only ${recoveryPosts.length}/10 posts found`);
  } else {
    console.log('\n✅ All 10 jobs recovered (no job loss)');
  }
  
  await client.close();
}

checkRecovery().catch(console.error);
