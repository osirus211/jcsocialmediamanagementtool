import { MongoClient, ObjectId } from 'mongodb';

async function setupBillingNoAuth() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('social-media-tool');
    
    // Find the test user's workspace
    const workspacesCollection = db.collection('workspaces');
    const usersCollection = db.collection('users');
    
    const testUser = await usersCollection.findOne({ email: 'test-composer@example.com' });
    if (!testUser) {
      console.error('❌ Test user not found');
      process.exit(1);
    }
    console.log(`✅ Found test user: ${testUser._id}`);
    
    const workspace = await workspacesCollection.findOne({ ownerId: testUser._id });
    if (!workspace) {
      console.error('❌ Workspace not found');
      process.exit(1);
    }
    console.log(`✅ Found workspace: ${workspace._id}`);
    
    // Get or create free plan
    const plansCollection = db.collection('plans');
    let freePlan = await plansCollection.findOne({ name: 'free' });
    
    if (!freePlan) {
      console.log('📝 Creating free plan...');
      const planDoc = {
        name: 'free',
        displayName: 'Free',
        description: 'Perfect for getting started',
        priceMonthly: 0,
        priceYearly: 0,
        limits: {
          maxSocialAccounts: 10,
          maxPostsPerMonth: 1000, // High limit for load testing
          maxTeamMembers: 5,
          aiCreditsPerMonth: 500
        },
        features: [
          '10 social accounts',
          '1000 posts per month',
          'Basic analytics',
          '500 AI credits per month'
        ],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await plansCollection.insertOne(planDoc);
      freePlan = { ...planDoc, _id: result.insertedId };
      console.log(`✅ Free plan created: ${freePlan._id}`);
    } else {
      console.log(`✅ Free plan exists: ${freePlan._id}`);
      // Update limits for load testing
      await plansCollection.updateOne(
        { _id: freePlan._id },
        { 
          $set: { 
            'limits.maxPostsPerMonth': 1000,
            'limits.maxSocialAccounts': 10,
            'limits.aiCreditsPerMonth': 500
          } 
        }
      );
      console.log('✅ Updated plan limits for load testing');
    }
    
    // Create or update billing
    const billingsCollection = db.collection('billings');
    const existing = await billingsCollection.findOne({ workspaceId: workspace._id });
    
    if (existing) {
      console.log('✅ Billing already exists, updating...');
      await billingsCollection.updateOne(
        { _id: existing._id },
        { 
          $set: { 
            planId: freePlan._id,
            status: 'active',
            'usage.postsThisMonth': 0
          } 
        }
      );
    } else {
      console.log('📝 Creating billing...');
      const billingDoc = {
        workspaceId: workspace._id,
        planId: freePlan._id,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        usage: {
          postsThisMonth: 0,
          aiCreditsUsed: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await billingsCollection.insertOne(billingDoc);
      console.log('✅ Billing created successfully!');
    }
    
    // Create a social account if none exists
    const socialAccountsCollection = db.collection('socialaccounts');
    const existingAccount = await socialAccountsCollection.findOne({ workspaceId: workspace._id });
    
    if (!existingAccount) {
      console.log('📝 Creating social account...');
      const accountDoc = {
        workspaceId: workspace._id,
        userId: testUser._id,
        platform: 'twitter',
        accountName: 'TestAccount',
        accountId: 'test123',
        accessToken: 'mock_token_encrypted',
        refreshToken: 'mock_refresh_encrypted',
        tokenExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await socialAccountsCollection.insertOne(accountDoc);
      console.log(`✅ Social account created: ${result.insertedId}`);
    } else {
      console.log(`✅ Social account exists: ${existingAccount._id}`);
    }
    
    console.log('\n✅ Setup complete! Ready for load test.');
    console.log(`   Workspace ID: ${workspace._id}`);
    console.log(`   User: ${testUser.email}`);
    
  } catch (error) {
    console.error('❌ MongoDB operation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupBillingNoAuth();
