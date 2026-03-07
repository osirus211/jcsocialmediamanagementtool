const { MongoClient } = require('mongodb');

async function checkDuplicates() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
  await client.connect();
  const db = client.db();
  
  const recoveryPosts = await db.collection('posts').find({
    'metadata.testType': 'crash_recovery'
  }).toArray();
  
  // Check for duplicate content
  const contentMap = new Map();
  let duplicates = 0;
  
  recoveryPosts.forEach(post => {
    const key = `${post.content}-${post.metadata.testNumber}`;
    if (contentMap.has(key)) {
      duplicates++;
      console.log(`❌ Duplicate found: ${post.content}`);
    } else {
      contentMap.set(key, post._id);
    }
  });
  
  await client.close();
  
  if (duplicates === 0) {
    console.log('✅ No duplicate posts detected');
  } else {
    console.log(`❌ Found ${duplicates} duplicate posts`);
  }
  
  return duplicates === 0;
}

checkDuplicates().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
