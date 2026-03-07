import { MongoClient } from 'mongodb';

async function checkUsers() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  
  try {
    await client.connect();
    const db = client.db('social-media-tool');
    
    const users = await db.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users:`);
    users.forEach(u => {
      console.log(`  - ${u.email} (ID: ${u._id})`);
    });
    
    const workspaces = await db.collection('workspaces').find({}).toArray();
    console.log(`\nFound ${workspaces.length} workspaces:`);
    workspaces.forEach(w => {
      console.log(`  - ${w.name} (ID: ${w._id}, Owner: ${w.ownerId})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

checkUsers();
