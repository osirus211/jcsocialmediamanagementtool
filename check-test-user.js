import { MongoClient } from 'mongodb';

async function checkTestUser() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  
  try {
    await client.connect();
    const db = client.db('social-media-scheduler');
    
    const user = await db.collection('users').findOne({ email: 'billing-test-1771698236603@example.com' });
    
    if (!user) {
      console.log('❌ Test user not found');
      console.log('Looking for any user...');
      const anyUser = await db.collection('users').findOne({});
      if (anyUser) {
        console.log(`✅ Found user: ${anyUser.email}`);
        const workspace = await db.collection('workspaces').findOne({ ownerId: anyUser._id });
        if (workspace) {
          console.log(`✅ Found workspace: ${workspace.name}`);
          const socialAccount = await db.collection('socialaccounts').findOne({ workspaceId: workspace._id });
          if (socialAccount) {
            console.log(`✅ Found social account: ${socialAccount.accountName}`);
          } else {
            console.log('❌ No social account found');
          }
        } else {
          console.log('❌ No workspace found');
        }
      } else {
        console.log('❌ No users in database');
      }
    } else {
      console.log(`✅ Test user found: ${user.email}`);
      const workspace = await db.collection('workspaces').findOne({ ownerId: user._id });
      if (workspace) {
        console.log(`✅ Workspace: ${workspace.name}`);
        const socialAccount = await db.collection('socialaccounts').findOne({ workspaceId: workspace._id });
        if (socialAccount) {
          console.log(`✅ Social account: ${socialAccount.accountName}`);
        } else {
          console.log('❌ No social account found');
        }
      } else {
        console.log('❌ No workspace found');
      }
    }
    
  } finally {
    await client.close();
  }
}

checkTestUser().catch(console.error);
