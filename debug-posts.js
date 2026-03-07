import { MongoClient, ObjectId } from 'mongodb';

async function debugPosts() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  
  try {
    await client.connect();
    const db = client.db('social-media-scheduler');
    
    const now = new Date();
    console.log('Current time:', now.toISOString());
    
    // Check if socialAccountId is valid ObjectId
    const posts = await db.collection('posts')
      .find({ status: 'scheduled' })
      .limit(3)
      .toArray();
    
    console.log('\nFirst 3 scheduled posts:');
    posts.forEach((post, i) => {
      console.log(`\n${i + 1}. Post ID: ${post._id}`);
      console.log(`   status: ${post.status}`);
      console.log(`   scheduledAt: ${post.scheduledAt?.toISOString()}`);
      console.log(`   socialAccountId: ${post.socialAccountId} (type: ${typeof post.socialAccountId})`);
      console.log(`   socialAccountId is ObjectId: ${post.socialAccountId instanceof ObjectId}`);
      console.log(`   workspaceId: ${post.workspaceId}`);
      console.log(`   userId: ${post.userId}`);
    });
    
    // Check if social account exists
    if (posts.length > 0) {
      const socialAccountId = posts[0].socialAccountId;
      const socialAccount = await db.collection('socialaccounts').findOne({ _id: socialAccountId });
      console.log('\nSocial account exists:', !!socialAccount);
      if (socialAccount) {
        console.log('Social account:', {
          _id: socialAccount._id,
          platform: socialAccount.platform,
          accountName: socialAccount.accountName,
          isActive: socialAccount.isActive
        });
      }
    }
    
  } finally {
    await client.close();
  }
}

debugPosts().catch(console.error);
