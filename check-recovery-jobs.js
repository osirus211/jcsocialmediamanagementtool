import { MongoClient } from 'mongodb';

async function checkJobs() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
  await client.connect();
  const db = client.db();
  
  const recoveryJobs = await db.collection('posts').find({
    'metadata.testType': 'recovery_test'
  }).toArray();
  
  console.log(`\n📋 Recovery Jobs Status:`);
  console.log(`Total found: ${recoveryJobs.length}/10`);
  
  const statusCounts = {};
  recoveryJobs.forEach(job => {
    statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
  });
  
  console.log('Status distribution:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  
  await client.close();
  
  if (recoveryJobs.length === 10) {
    console.log('✅ All jobs recovered - no job loss');
  } else {
    console.log(`❌ Job loss detected: ${10 - recoveryJobs.length} jobs missing`);
  }
}

checkJobs();
