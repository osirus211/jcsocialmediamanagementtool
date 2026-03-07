import { MongoClient } from 'mongodb';

async function checkScheduledPosts() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  
  try {
    await client.connect();
    const db = client.db('social-media-scheduler');
    
    const now = new Date();
    console.log('Current time:', now.toISOString());
    
    const scheduledPosts = await db.collection('posts')
      .find({ status: 'scheduled' })
      .limit(5)
      .toArray();
    
    console.log('\nFirst 5 scheduled posts:');
    scheduledPosts.forEach((post, i) => {
      console.log(`${i + 1}. scheduledAt: ${post.scheduledAt?.toISOString() || 'NULL'}`);
      console.log(`   isPast: ${post.scheduledAt && post.scheduledAt <= now}`);
      console.log(`   content: ${post.content?.substring(0, 50)}...`);
    });
    
    const eligibleCount = await db.collection('posts').countDocuments({
      status: 'scheduled',
      scheduledAt: { $lte: now }
    });
    
    console.log(`\n✅ Eligible posts (scheduled + scheduledAt <= now): ${eligibleCount}`);
    
  } finally {
    await client.close();
  }
}

checkScheduledPosts().catch(console.error);
