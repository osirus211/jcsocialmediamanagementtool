import { MongoClient } from 'mongodb';

async function checkDuplicates() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
  await client.connect();
  const db = client.db();
  
  // Check for duplicate posts with same content
  const duplicates = await db.collection('posts').aggregate([
    {
      $match: {
        'metadata.testType': 'recovery_test'
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
  
  if (duplicates.length === 0) {
    console.log('✅ No duplicate posts detected');
  } else {
    console.log(`❌ Duplicates found: ${duplicates.length}`);
    duplicates.forEach(dup => {
      console.log(`  Content: ${dup._id}`);
      console.log(`  Count: ${dup.count}`);
    });
  }
  
  await client.close();
}

checkDuplicates();
