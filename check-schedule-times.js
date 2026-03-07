import { MongoClient } from 'mongodb';

async function checkTimes() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
  await client.connect();
  const db = client.db();
  
  const posts = await db.collection('posts').find({
    'metadata.testType': 'recovery_test'
  }).sort({ 'metadata.testNumber': 1 }).toArray();
  
  console.log('Current time:', new Date());
  console.log('\nScheduled times:');
  posts.forEach(p => {
    const diff = (new Date(p.scheduledAt) - new Date()) / 1000;
    console.log(`Post ${p.metadata.testNumber}: ${p.scheduledAt} (${diff > 0 ? 'in ' + Math.round(diff) + 's' : Math.abs(Math.round(diff)) + 's ago'})`);
  });
  
  await client.close();
}

checkTimes();
