const { MongoClient, ObjectId } = require('mongodb');

async function checkDetails(postId) {
  if (!postId) {
    console.error('❌ Usage: node check-post-details.cjs <postId>');
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

  console.log('\n📋 Full Post Details:');
  console.log(JSON.stringify(post, null, 2));
  
  console.log('\n⏰ Time Comparison:');
  console.log(`Current Time: ${new Date()}`);
  console.log(`Scheduled At: ${post.scheduledAt}`);
  console.log(`Is Eligible: ${post.scheduledAt <= new Date()}`);
  
  await client.close();
}

checkDetails(process.argv[2]).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
