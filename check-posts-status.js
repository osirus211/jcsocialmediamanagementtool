import { MongoClient } from 'mongodb';

async function checkStatus() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/social-media-scheduler');
  await client.connect();
  const db = client.db();
  
  const statuses = await db.collection('posts').aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]).toArray();
  
  console.log('Post Status Distribution:');
  statuses.forEach(s => console.log(`  ${s._id}: ${s.count}`));
  
  const total = statuses.reduce((sum, s) => sum + s.count, 0);
  console.log(`\nTotal posts: ${total}`);
  
  await client.close();
}

checkStatus().catch(console.error);
