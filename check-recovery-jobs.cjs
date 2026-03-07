const { MongoClient } = require('mongodb');

async function checkRecoveryJobs() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
  await client.connect();
  const db = client.db();
  
  const recoveryPosts = await db.collection('posts').find({
    'metadata.testType': 'crash_recovery'
  }).toArray();
  
  console.log(`\n📋 Recovery Test Posts: ${recoveryPosts.length}/10`);
  
  const statusCounts = {};
  recoveryPosts.forEach(post => {
    statusCounts[post.status] = (statusCounts[post.status] || 0) + 1;
  });
  
  console.log('\nStatus Distribution:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  
  await client.close();
  
  if (recoveryPosts.length === 10) {
    console.log('\n✅ All 10 jobs still exist (no job loss)');
  } else {
    console.log(`\n❌ Job loss detected: ${10 - recoveryPosts.length} jobs missing`);
  }
}

checkRecoveryJobs().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
