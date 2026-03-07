import { MongoClient } from 'mongodb';

async function fixPosts() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  
  try {
    await client.connect();
    const db = client.db('social-media-scheduler');
    
    // Get a sample post to find the userId
    const samplePost = await db.collection('posts').findOne({ status: 'scheduled' });
    if (!samplePost) {
      console.log('No scheduled posts found');
      return;
    }
    
    const userId = samplePost.userId;
    console.log('Using userId:', userId);
    
    // Update all scheduled posts to add createdBy field
    const result = await db.collection('posts').updateMany(
      { status: 'scheduled', createdBy: { $exists: false } },
      { $set: { createdBy: userId } }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} posts with createdBy field`);
    
  } finally {
    await client.close();
  }
}

fixPosts().catch(console.error);
