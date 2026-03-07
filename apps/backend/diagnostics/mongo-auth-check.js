// RUNTIME_TRACE MongoDB Verification Script
// Read-only checks for authentication data

const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-media-tool';

async function checkAuthData() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');
    
    const db = client.db();
    
    // Check users collection
    const usersCount = await db.collection('users').countDocuments();
    console.log(`\n📊 Users: ${usersCount}`);
    
    // Check recent user
    const recentUser = await db.collection('users')
      .findOne({}, { sort: { createdAt: -1 } });
    
    if (recentUser) {
      console.log(`\n👤 Most Recent User:`);
      console.log(`   Email: ${recentUser.email}`);
      console.log(`   Created: ${recentUser.createdAt}`);
      console.log(`   Refresh Tokens: ${recentUser.refreshTokens?.length || 0}`);
    }
    
    // Check workspaces
    const workspacesCount = await db.collection('workspaces').countDocuments();
    console.log(`\n🏢 Workspaces: ${workspacesCount}`);
    
    // Check workspace for recent user
    if (recentUser) {
      const userWorkspaces = await db.collection('workspaces')
        .find({ ownerId: recentUser._id })
        .toArray();
      
      console.log(`   User's Workspaces: ${userWorkspaces.length}`);
      
      if (userWorkspaces.length > 0) {
        console.log(`   ✓ Workspace auto-created: ${userWorkspaces[0].name}`);
      } else {
        console.log(`   ⚠ No workspace found for user`);
      }
    }
    
    // Check for duplicate users
    const duplicates = await db.collection('users').aggregate([
      { $group: { _id: '$email', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    if (duplicates.length > 0) {
      console.log(`\n⚠ Duplicate Users Found: ${duplicates.length}`);
      duplicates.forEach(dup => {
        console.log(`   ${dup._id}: ${dup.count} entries`);
      });
    } else {
      console.log(`\n✓ No duplicate users`);
    }
    
    console.log('\n=== MongoDB Check Complete ===');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkAuthData();
