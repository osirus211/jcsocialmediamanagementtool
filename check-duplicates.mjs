import { MongoClient } from 'mongodb';

async function checkDuplicates() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
  await client.connect();
  const db = client.db();
  
  // Find duplicate content
  const duplicates = await db.collection('posts').aggregate([
    {
      $match: {
        'metadata.testType': 'crash_recovery'
      }
    },
    {
      $group: {
        _id: '$content',
        count: { $sum: 1 },
        ids: { $push: '$_id' }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]).toArray();
  
  if (duplicates.length > 0) {
    console.log('❌ DUPLICATES DETECTED:');
    duplicates.forEach(dup => {
      console.log(`  Content: "${dup._id}"`);
      console.log(`  Count: ${dup.count}`);
      console.log(`  IDs: ${dup.ids.join(', ')}`);
    });
  } else {
    console.log('✅ No duplicates detected');
  }
  
  await client.close();
}

checkDuplicates().catch(console.error);
