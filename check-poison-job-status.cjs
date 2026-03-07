const { MongoClient, ObjectId } = require('mongodb');

async function checkStatus(postId) {
  if (!postId) {
    console.error('❌ Usage: node check-poison-job-status.js <postId>');
    process.exit(1);
  }

  const client = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
  await client.connect();
  const db = client.db();
  
  const post = await db.collection('posts').findOne({
    _id: new ObjectId(postId)
  });
  
  if (!post) {
    console.error('❌ Post not found');
    await client.close();
    process.exit(1);
  }

  console.log('\n📋 Post Status:');
  console.log(`Status: ${post.status}`);
  console.log(`Retry Count: ${post.retryCount || 0}`);
  console.log(`Error Message: ${post.errorMessage || 'None'}`);
  console.log(`Updated At: ${post.updatedAt}`);
  console.log(`Created At: ${post.createdAt}`);
  
  if (post.metadata) {
    console.log(`\nMetadata:`);
    console.log(JSON.stringify(post.metadata, null, 2));
  }
  
  if (post.status === 'failed') {
    console.log('\n✅ Post correctly marked as FAILED');
  } else {
    console.log(`\n⚠️  Post status is "${post.status}", expected "failed"`);
  }
  
  await client.close();
}

// Usage: node check-poison-job-status.js <postId>
checkStatus(process.argv[2]).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
