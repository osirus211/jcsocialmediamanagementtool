import { MongoClient } from 'mongodb';

async function debugQuery() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
  await client.connect();
  const db = client.db();
  
  const now = new Date();
  console.log('Current time:', now);
  
  // Check all recovery test posts
  const allPosts = await db.collection('posts').find({
    'metadata.testType': 'recovery_test'
  }).toArray();
  
  console.log('\nAll recovery test posts:');
  allPosts.forEach(p => {
    console.log(`  Post ${p.metadata.testNumber}:`);
    console.log(`    Status: ${p.status}`);
    console.log(`    ScheduledAt: ${p.scheduledAt}`);
    console.log(`    Is past? ${new Date(p.scheduledAt) <= now}`);
  });
  
  // Run the same query as scheduler
  const eligiblePosts = await db.collection('posts').find({
    status: 'scheduled',
    scheduledAt: { $lte: now },
    'metadata.testType': 'recovery_test'
  }).toArray();
  
  console.log(`\nEligible posts (scheduler query): ${eligiblePosts.length}`);
  
  await client.close();
}

debugQuery();
